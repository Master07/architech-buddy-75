import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { runDesignAgent } from "./agent-run.server";
import type { DesignMode } from "./design-agent";

function extractTitle(prompt: string, markdown: string) {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading.slice(0, 120);
  const firstLine = prompt.trim().split("\n")[0] ?? "Untitled design";
  return firstLine.slice(0, 120);
}

function extractDiagram(markdown: string) {
  return markdown.match(/```mermaid\n([\s\S]*?)```/)?.[1]?.trim() ?? null;
}

export type DesignJobParams = {
  supabase: SupabaseClient<Database>;
  userId: string;
  mode: DesignMode;
  prompt: string;
  source: "api" | "mcp" | "app";
  threadId?: string;
  ownerScope?: string;
};

const DESIGN_COLUMNS = "id, title, mode, status, source, markdown, diagram, error, created_at";

/** Inserts the `running` placeholder row so the caller has an id immediately. */
export async function createDesignRecord(params: DesignJobParams) {
  const { data, error } = await params.supabase
    .from("designs")
    .insert({
      user_id: params.userId,
      title: params.prompt.trim().split("\n")[0]?.slice(0, 120) || "Untitled design",
      mode: params.mode,
      prompt: params.prompt,
      source: params.source,
      status: "running",
      thread_id: params.threadId ?? null,
    })
    .select(DESIGN_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function finishDesign(params: DesignJobParams, designId: string, markdown: string) {
  const { data, error } = await params.supabase
    .from("designs")
    .update({
      status: "ready",
      markdown,
      diagram: extractDiagram(markdown),
      title: extractTitle(params.prompt, markdown),
      updated_at: new Date().toISOString(),
    })
    .eq("id", designId)
    .select(DESIGN_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function markFailed(params: DesignJobParams, designId: string, error: unknown) {
  await params.supabase
    .from("designs")
    .update({ status: "failed", error: (error as Error).message.slice(0, 500) })
    .eq("id", designId);
}

/**
 * Runs the agent for an already-created design row and returns the live text
 * stream plus a `finished` promise that persists the result. Callers that pipe
 * the stream to the client keep bytes flowing, which is what prevents platform
 * request timeouts on long documents.
 */
export async function streamDesignInto(params: DesignJobParams, designId: string) {
  const { result } = await runDesignAgent({
    supabase: params.supabase,
    userId: params.userId,
    mode: params.mode,
    messages: [{ role: "user", content: params.prompt }],
    ...(params.ownerScope ? { ownerScope: params.ownerScope } : {}),
  });

  const finished = (async () => {
    try {
      const markdown = await result.text;
      return await finishDesign(params, designId, markdown);
    } catch (error) {
      await markFailed(params, designId, error);
      throw error;
    }
  })();

  return { textStream: result.textStream, finished };
}

/**
 * Runs the agent to completion (streamed on the wire, buffered for the caller)
 * and persists the result as a design record. Shared by the REST API and MCP.
 */
export async function generateDesign(params: DesignJobParams) {
  const created = await createDesignRecord(params);
  const { finished } = await streamDesignInto(params, created.id);
  return finished;
}
