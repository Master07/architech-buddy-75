import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DESIGN_MODES } from "./design-agent";

export const listDesigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("designs")
      .select("id, title, mode, status, source, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getDesign = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("designs")
      .select("id, title, mode, status, source, markdown, diagram, prompt, error, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Design not found");
    return row;
  });

export const saveDesign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(120),
        markdown: z.string().min(1),
        mode: z.enum(DESIGN_MODES).default("design"),
        threadId: z.string().uuid().nullable().default(null),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const diagram = data.markdown.match(/```mermaid\n([\s\S]*?)```/)?.[1]?.trim() ?? null;
    const { data: row, error } = await context.supabase
      .from("designs")
      .insert({
        user_id: context.userId,
        title: data.title,
        markdown: data.markdown,
        diagram,
        mode: data.mode,
        source: "app",
        status: "ready",
        thread_id: data.threadId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteDesign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("designs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Latest run of a design plus per-step timing and tokens, for the step breakdown. */
export const getDesignSteps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: job } = await context.supabase
      .from("design_jobs")
      .select("id, mode, status, attempts, max_attempts, last_error, created_at, started_at, finished_at, current_stage, stages_done, stage_started_at, locked_at")
      .eq("design_id", data.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: usage } = await context.supabase
      .from("ai_usage")
      .select("stage, total_tokens, duration_ms, created_at")
      .eq("design_id", data.id)
      .order("created_at", { ascending: true });
    return { job: job ?? null, usage: usage ?? [] };
  });
