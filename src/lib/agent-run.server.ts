import { stepCountIs, streamText, tool, type ModelMessage } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider, requireLovableApiKey } from "./ai-gateway.server";
import { CHAT_MODEL, systemPrompt, type DesignMode } from "./design-agent";
import { searchKnowledge } from "./retrieval.server";

export type AgentRunOptions = {
  supabase: SupabaseClient<Database>;
  userId: string;
  mode: DesignMode;
  messages: ModelMessage[];
  runId?: string;
  /** Set when the supabase client bypasses RLS (API-key requests). */
  ownerScope?: string;
};

export async function hasLibrary(supabase: SupabaseClient<Database>, userId: string) {
  const { count } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "ready");
  return (count ?? 0) > 0;
}

export async function runDesignAgent(options: AgentRunOptions) {
  const { supabase, userId, mode, messages, runId, ownerScope } = options;
  const gateway = createLovableAiGatewayProvider(requireLovableApiKey(), runId);
  const libraryReady = await hasLibrary(supabase, userId);

  const tools = {
    search_design_knowledge: tool({
      description:
        "Semantic search over the user's uploaded system design books. Use it to ground claims and to quote what a specific book says. Returns passages with their source titles.",
      inputSchema: z.object({
        query: z.string().describe("What to look for, phrased as a technical question or topic."),
      }),
      execute: async ({ query }) => {
        if (!libraryReady) {
          return { hits: [], note: "The user's library is empty; answer from canonical knowledge." };
        }
        const hits = await searchKnowledge(supabase, query, 6, ownerScope);
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
  };

  const result = streamText({
    model: gateway(CHAT_MODEL),
    system: systemPrompt(mode, libraryReady),
    messages,
    tools,
    stopWhen: stepCountIs(50),
  });

  return { result, gateway };
}
