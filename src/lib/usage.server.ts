export type UsageTag = {
  requestId: string;
  kind: "design_job" | "chat" | "review";
  designId?: string;
  threadId?: string;
  label?: string;
};

type Usage = { inputTokens?: number | undefined; outputTokens?: number | undefined; totalTokens?: number | undefined };

/** Best-effort: never lets usage logging break an AI run. */
export async function recordUsage(
  userId: string,
  tag: UsageTag,
  entry: { stage?: string; model?: string; usage?: Usage; durationMs?: number },
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const input = entry.usage?.inputTokens ?? 0;
    const output = entry.usage?.outputTokens ?? 0;
    await supabaseAdmin.from("ai_usage").insert({
      user_id: userId,
      request_id: tag.requestId,
      kind: tag.kind,
      design_id: tag.designId ?? null,
      thread_id: tag.threadId ?? null,
      label: tag.label?.slice(0, 300) ?? null,
      stage: entry.stage ?? null,
      model: entry.model ?? null,
      input_tokens: input,
      output_tokens: output,
      total_tokens: entry.usage?.totalTokens ?? input + output,
      duration_ms: entry.durationMs != null ? Math.round(entry.durationMs) : null,
    });
  } catch (error) {
    console.error("[usage]", error);
  }
}
