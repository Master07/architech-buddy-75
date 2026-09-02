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

/**
 * Runs the agent to completion (streamed on the wire, buffered for the caller)
 * and persists the result as a design record. Shared by the REST API and MCP.
 */
export async function generateDesign(params: {
  supabase: SupabaseClient<Database>;
  userId: string;
  mode: DesignMode;
  prompt: string;
  source: "api" | "mcp" | "app";
  threadId?: string;
  ownerScope?: string;
}) {
  const { supabase, userId, mode, prompt, source, threadId, ownerScope } = params;

  const { data: created, error: createError } = await supabase
    .from("designs")
    .insert({
      user_id: userId,
      title: prompt.trim().split("\n")[0]?.slice(0, 120) || "Untitled design",
      mode,
      prompt,
      source,
      status: "running",
      thread_id: threadId ?? null,
    })
    .select("id")
    .single();
  if (createError) throw new Error(createError.message);

  try {
    const { result } = await runDesignAgent({
      supabase,
      userId,
      mode,
      messages: [{ role: "user", content: prompt }],
      ...(ownerScope ? { ownerScope } : {}),
    });
    const markdown = await result.text;

    const { data: row, error } = await supabase
      .from("designs")
      .update({
        status: "ready",
        markdown,
        diagram: extractDiagram(markdown),
        title: extractTitle(prompt, markdown),
        updated_at: new Date().toISOString(),
      })
      .eq("id", created.id)
      .select("id, title, mode, markdown, diagram, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  } catch (error) {
    await supabase
      .from("designs")
      .update({ status: "failed", error: (error as Error).message.slice(0, 500) })
      .eq("id", created.id);
    throw error;
  }
}
