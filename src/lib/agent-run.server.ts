import { stepCountIs, streamText, tool, type ModelMessage } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { resolveChatProvider } from "./ai-provider.server";
import {
  CANDIDATES_PROMPT,
  CAPACITY_PROMPT,
  CRITIC_PROMPT,
  DRAFT_FROM_STAGES_PROMPT,
  GATE_CHECK_PROMPT,
  INTERVIEW_SCORE_PROMPT,
  REQUIREMENTS_PROMPT,
  REVISION_PROMPT,
  VALIDATION_PROMPT,
  failingGates,
  gateRepairPrompt,
  gateScore,
  parseGateBlock,
  stripGateBlock,
  systemPrompt,
  type DesignMode,
  type GateResult,
} from "./design-agent";
import { searchKnowledge } from "./retrieval.server";
import { formatEvidenceBundle, loadThreadEvidence, type EvidenceItem } from "./evidence.server";
import { recordUsage, type UsageTag } from "./usage.server";

export type AgentRunOptions = {
  supabase: SupabaseClient<Database>;
  userId: string;
  mode: DesignMode;
  messages: ModelMessage[];
  runId?: string;
  /** Set when the supabase client bypasses RLS (API-key requests). */
  ownerScope?: string;
  /** Session whose attached evidence the agent may read. */
  threadId?: string;
  /** Evidence supplied inline by an API caller with no session. */
  evidence?: EvidenceItem[];
  /** When set, token usage of every stage is logged under this request. */
  usage?: UsageTag;
};

export async function hasLibrary(supabase: SupabaseClient<Database>, userId: string) {
  const { count } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "ready");
  return (count ?? 0) > 0;
}

async function resolveEvidence(options: AgentRunOptions): Promise<EvidenceItem[]> {
  const inline = options.evidence ?? [];
  if (!options.threadId) return inline;
  try {
    const stored = await loadThreadEvidence(options.supabase, options.userId, options.threadId);
    return [...stored, ...inline];
  } catch (error) {
    console.error("[agent-run] evidence load failed", error);
    return inline;
  }
}

function buildTools(
  options: AgentRunOptions,
  libraryReady: boolean,
  evidence: EvidenceItem[],
) {
  return {
    search_design_knowledge: tool({
      description:
        "Semantic search over the user's uploaded system design books. Use it to ground claims and to quote what a specific book says. Returns passages with their source titles. This is tier-7 literature evidence, never a fact about the user's own system.",
      inputSchema: z.object({
        query: z.string().describe("What to look for, phrased as a technical question or topic."),
      }),
      execute: async ({ query }) => {
        if (!libraryReady) {
          return { hits: [], note: "The user's library is empty; answer from canonical knowledge." };
        }
        const hits = await searchKnowledge(options.supabase, query, 6, options.ownerScope);
        return {
          hits: hits.map((h) => ({
            source: h.document_title,
            section: h.section,
            similarity: Number(h.similarity.toFixed(3)),
            passage: h.content,
          })),
        };
      },
    }),
    read_system_evidence: tool({
      description:
        "Read the real system evidence the user attached to this session: telemetry, incidents, deployed configuration, code, schemas, tests, decision records and stakeholder notes, ordered strongest tier first. This outranks books and general knowledge. Call it before designing whenever evidence exists; only claims backed by it may be labelled Verified.",
      inputSchema: z.object({
        reason: z.string().describe("What you are hoping the evidence tells you."),
      }),
      execute: async () => ({
        item_count: evidence.length,
        bundle: formatEvidenceBundle(evidence),
      }),
    }),
  };
}

/** Single-pass draft. Kept for callers that only need one generation. */
export async function runDesignAgent(options: AgentRunOptions) {
  const { mode, messages, runId } = options;
  const resolved = await resolveChatProvider(options.supabase, options.userId, runId);
  const gateway = resolved.gateway;
  const [libraryReady, evidence] = await Promise.all([
    hasLibrary(options.supabase, options.userId),
    resolveEvidence(options),
  ]);

  const result = streamText({
    model: resolved.model,
    system: systemPrompt(mode, { hasLibrary: libraryReady, hasEvidence: evidence.length > 0 }),
    messages,
    tools: buildTools(options, libraryReady, evidence),
    stopWhen: stepCountIs(50),
  });

  return { result, gateway };
}

/**
 * A draft alone is a fluent answer; the blueprint's quality comes from attacking
 * it. Documents therefore go through the full staged pipeline. Short
 * conversational turns (interview questions, clarifications) take the interview
 * scoring path instead, because there is nothing substantial to attack yet.
 */
export function warrantsCritique(text: string) {
  const trimmed = text.trim();
  if (trimmed.length < 1500) return false;
  const headings = trimmed.match(/^##\s+/gm)?.length ?? 0;
  return headings >= 3;
}

export const PIPELINE_STAGES = [
  "requirements",
  "capacity",
  "candidates",
  "draft",
  "critique",
  "validation",
  "final",
  "gatecheck",
  "repair",
  "interview-score",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_LABEL: Record<PipelineStage, string> = {
  requirements: "Requirements ledger",
  capacity: "Capacity envelope",
  candidates: "Candidate architectures",
  draft: "Draft package",
  critique: "Adversarial review board",
  validation: "Validation engine",
  final: "Revision",
  gatecheck: "Gate enforcement",
  repair: "Gate repair",
  "interview-score": "Question scoring",
};

export type StageRun = {
  stage: PipelineStage;
  result: Awaited<ReturnType<typeof runDesignAgent>>["result"];
};

export type PipelineHandlers = {
  /** Called with each stage's live stream before it is awaited. */
  onStage?: (run: StageRun) => void;
  /** Called when a stage's text is complete. */
  onStageEnd?: (stage: PipelineStage, text: string) => void;
  /** Called once gates have been scored (and again after a repair pass). */
  onGates?: (gates: GateResult[], score: number) => void;
};

export type PipelineOutcome = {
  stages: Partial<Record<PipelineStage, string>>;
  draft: string;
  critique: string | null;
  final: string;
  gates: GateResult[];
  gateScore: number;
  /** The document to persist and show as the answer. */
  document: string;
};

/**
 * Runs the full blueprint pipeline: requirements -> capacity -> candidates ->
 * draft -> critic -> validation -> revise -> gate enforcement. Every stage
 * streams, so bytes keep flowing on the edge runtime no matter how long the
 * document takes.
 */
export async function runDesignPipeline(
  options: AgentRunOptions,
  handlers: PipelineHandlers = {},
): Promise<PipelineOutcome> {
  const resolved = await resolveChatProvider(options.supabase, options.userId, options.runId);
  const [libraryReady, evidence] = await Promise.all([
    hasLibrary(options.supabase, options.userId),
    resolveEvidence(options),
  ]);
  const system = systemPrompt(options.mode, {
    hasLibrary: libraryReady,
    hasEvidence: evidence.length > 0,
  });
  const tools = buildTools(options, libraryReady, evidence);
  const stages: Partial<Record<PipelineStage, string>> = {};

  const runStage = async (stage: PipelineStage, messages: ModelMessage[]) => {
    const startedAt = Date.now();
    const result = streamText({
      model: resolved.model,
      system,
      messages,
      tools,
      stopWhen: stepCountIs(50),
    });
    handlers.onStage?.({ stage, result });
    const text = await result.text;
    if (options.usage) {
      const usage = await Promise.resolve(result.totalUsage).catch(() => undefined);
      await recordUsage(options.userId, options.usage, {
        stage,
        model: resolved.modelId,
        ...(usage ? { usage } : {}),
        durationMs: Date.now() - startedAt,
      });
    }
    stages[stage] = text;
    handlers.onStageEnd?.(stage, text);
    return text;
  };

  const turn = (
    history: ModelMessage[],
    instruction: string,
  ): ModelMessage[] => [...history, { role: "user", content: instruction }];

  let history: ModelMessage[] = [...options.messages];
  const append = (assistant: string, instruction: string) => {
    history = [...turn(history, instruction), { role: "assistant", content: assistant }];
  };

  // Modes that produce an architecture get the analytical pre-stages. Review and
  // stack advice start from the user's own material, so they skip straight to a
  // draft and are attacked from there.
  const usesPreStages = options.mode === "design" || options.mode === "stack";

  let draft: string;
  if (usesPreStages) {
    const requirements = await runStage("requirements", turn(history, REQUIREMENTS_PROMPT));
    append(requirements, REQUIREMENTS_PROMPT);

    const capacity = await runStage("capacity", turn(history, CAPACITY_PROMPT));
    append(capacity, CAPACITY_PROMPT);

    const candidates = await runStage("candidates", turn(history, CANDIDATES_PROMPT));
    append(candidates, CANDIDATES_PROMPT);

    draft = await runStage("draft", turn(history, DRAFT_FROM_STAGES_PROMPT));
    append(draft, DRAFT_FROM_STAGES_PROMPT);
  } else {
    draft = await runStage("draft", history);
    history = [...history, { role: "assistant", content: draft }];
  }

  // An interview round is a set of questions, not a document: score the round
  // against the gates instead of attacking a design that does not exist yet.
  if (!warrantsCritique(draft)) {
    if (options.mode === "interview") {
      const scored = await runStage("interview-score", turn(history, INTERVIEW_SCORE_PROMPT));
      const gates = parseGateBlock(scored);
      handlers.onGates?.(gates, gateScore(gates));
      const revised = scored.match(/##\s*Revised Round\s*\n([\s\S]*?)(?=\n##\s|$)/i)?.[1]?.trim();
      const document = stripGateBlock(revised && revised.length > 80 ? revised : draft);
      return {
        stages,
        draft,
        critique: null,
        final: document,
        gates,
        gateScore: gateScore(gates),
        document,
      };
    }
    return {
      stages,
      draft,
      critique: null,
      final: draft,
      gates: [],
      gateScore: 0,
      document: draft,
    };
  }

  const critique = await runStage("critique", turn(history, CRITIC_PROMPT));
  append(critique, CRITIC_PROMPT);

  const validation = await runStage("validation", turn(history, VALIDATION_PROMPT));
  append(validation, VALIDATION_PROMPT);

  let final = await runStage("final", turn(history, REVISION_PROMPT));
  history = [...turn(history, REVISION_PROMPT), { role: "assistant", content: final }];

  // Enforcement: the document does not return until the gates have been scored,
  // and one repair pass is spent on whatever still fails.
  const check = await runStage("gatecheck", turn(history, GATE_CHECK_PROMPT));
  let gates = parseGateBlock(check);
  handlers.onGates?.(gates, gateScore(gates));

  const failed = failingGates(gates);
  if (failed.length > 0) {
    history = [...turn(history, GATE_CHECK_PROMPT), { role: "assistant", content: check }];
    const repairInstruction = gateRepairPrompt(failed);
    const repaired = await runStage("repair", turn(history, repairInstruction));
    if (repaired.trim().length > 500) {
      final = repaired;
      history = [...turn(history, repairInstruction), { role: "assistant", content: repaired }];
      const recheck = await runStage("gatecheck", turn(history, GATE_CHECK_PROMPT));
      const rescored = parseGateBlock(recheck);
      if (rescored.length > 0) {
        gates = rescored;
        handlers.onGates?.(gates, gateScore(gates));
      }
    }
  }

  const document = stripGateBlock(final);

  return {
    stages,
    draft,
    critique,
    final: document,
    gates,
    gateScore: gateScore(gates),
    document,
  };
}

export { createLovableAiGatewayProvider };

