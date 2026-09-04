import { stepCountIs, streamText, tool, type ModelMessage } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider, requireLovableApiKey } from "./ai-gateway.server";
import {
  CHAT_MODEL,
  CRITIC_PROMPT,
  REVISION_PROMPT,
  systemPrompt,
  type DesignMode,
} from "./design-agent";
import { searchKnowledge } from "./retrieval.server";
import { formatEvidenceBundle, loadThreadEvidence, type EvidenceItem } from "./evidence.server";

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
  const gateway = createLovableAiGatewayProvider(requireLovableApiKey(), runId);
  const [libraryReady, evidence] = await Promise.all([
    hasLibrary(options.supabase, options.userId),
    resolveEvidence(options),
  ]);

  const result = streamText({
    model: gateway(CHAT_MODEL),
    system: systemPrompt(mode, { hasLibrary: libraryReady, hasEvidence: evidence.length > 0 }),
    messages,
    tools: buildTools(options, libraryReady, evidence),
    stopWhen: stepCountIs(50),
  });

  return { result, gateway };
}

/**
 * A draft alone is a fluent answer; the blueprint's quality comes from attacking
 * it. Documents therefore go through draft -> adversarial critique -> revision.
 * Short conversational turns (interview questions, clarifications) skip the
 * extra passes, because there is nothing substantial to attack yet.
 */
export function warrantsCritique(text: string) {
  const trimmed = text.trim();
  if (trimmed.length < 1500) return false;
  const headings = trimmed.match(/^##\s+/gm)?.length ?? 0;
  return headings >= 3;
}

export type PipelineStage = "draft" | "critique" | "final";

export type StageRun = {
  stage: PipelineStage;
  result: Awaited<ReturnType<typeof runDesignAgent>>["result"];
};

export type PipelineHandlers = {
  /** Called with each stage's live stream before it is awaited. */
  onStage?: (run: StageRun) => void;
  /** Called when a stage's text is complete. */
  onStageEnd?: (stage: PipelineStage, text: string) => void;
};

export type PipelineOutcome = {
  draft: string;
  critique: string | null;
  final: string;
  /** The document to persist and show as the answer. */
  document: string;
};

/**
 * Runs the full blueprint pipeline. Every stage streams, so bytes keep flowing
 * on the edge runtime no matter how long the document takes.
 */
export async function runDesignPipeline(
  options: AgentRunOptions,
  handlers: PipelineHandlers = {},
): Promise<PipelineOutcome> {
  const gateway = createLovableAiGatewayProvider(requireLovableApiKey(), options.runId);
  const [libraryReady, evidence] = await Promise.all([
    hasLibrary(options.supabase, options.userId),
    resolveEvidence(options),
  ]);
  const system = systemPrompt(options.mode, {
    hasLibrary: libraryReady,
    hasEvidence: evidence.length > 0,
  });
  const tools = buildTools(options, libraryReady, evidence);

  const runStage = async (stage: PipelineStage, messages: ModelMessage[]) => {
    const result = streamText({
      model: gateway(CHAT_MODEL),
      system,
      messages,
      tools,
      stopWhen: stepCountIs(50),
    });
    handlers.onStage?.({ stage, result });
    const text = await result.text;
    handlers.onStageEnd?.(stage, text);
    return text;
  };

  const draft = await runStage("draft", options.messages);

  if (!warrantsCritique(draft)) {
    return { draft, critique: null, final: draft, document: draft };
  }

  const withDraft: ModelMessage[] = [
    ...options.messages,
    { role: "assistant", content: draft },
  ];

  const critique = await runStage("critique", [
    ...withDraft,
    { role: "user", content: CRITIC_PROMPT },
  ]);

  const final = await runStage("final", [
    ...withDraft,
    { role: "user", content: CRITIC_PROMPT },
    { role: "assistant", content: critique },
    { role: "user", content: REVISION_PROMPT },
  ]);

  return { draft, critique, final, document: final };
}

export { createLovableAiGatewayProvider };
