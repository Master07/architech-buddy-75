import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EVIDENCE_KINDS } from "./design-agent";

const kindSchema = z.enum(EVIDENCE_KINDS);

export const listEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { threadId: string }) =>
    z.object({ threadId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("context_items")
      .select("id, label, kind, content, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const addEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { threadId: string; label: string; kind: string; content: string }) =>
    z
      .object({
        threadId: z.string().uuid(),
        label: z.string().min(1).max(120),
        kind: kindSchema,
        content: z.string().min(1).max(200_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("context_items")
      .insert({
        user_id: context.userId,
        thread_id: data.threadId,
        label: data.label,
        kind: data.kind,
        content: data.content,
      })
      .select("id, label, kind, content, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("context_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
