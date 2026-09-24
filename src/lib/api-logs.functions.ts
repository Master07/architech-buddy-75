import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listApiLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("design_jobs")
      .select(
        "id, design_id, mode, prompt, source, status, attempts, max_attempts, last_error, created_at, started_at, finished_at, resubmitted_from",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const jobs = data ?? [];
    const ids = jobs.map((j) => j.design_id);
    const totals = new Map<string, { input: number; output: number; total: number }>();
    if (ids.length) {
      const { data: usage } = await context.supabase
        .from("ai_usage")
        .select("design_id, input_tokens, output_tokens, total_tokens")
        .in("design_id", ids);
      for (const u of usage ?? []) {
        if (!u.design_id) continue;
        const t = totals.get(u.design_id) ?? { input: 0, output: 0, total: 0 };
        t.input += u.input_tokens;
        t.output += u.output_tokens;
        t.total += u.total_tokens;
        totals.set(u.design_id, t);
      }
    }
    return jobs.map((j) => ({ ...j, tokens: totals.get(j.design_id) ?? null }));
  });

/** Chat turns and document reviews made inside the app, grouped per request. */
export const listAppAiActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ai_usage")
      .select("request_id, kind, label, stage, model, input_tokens, output_tokens, total_tokens, duration_ms, created_at")
      .eq("user_id", context.userId)
      .is("design_id", null)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    const groups = new Map<
      string,
      { requestId: string; kind: string; label: string | null; model: string | null; firstAt: string; steps: number; input: number; output: number; total: number; durationMs: number }
    >();
    for (const u of data ?? []) {
      const g = groups.get(u.request_id) ?? {
        requestId: u.request_id, kind: u.kind, label: u.label, model: u.model,
        firstAt: u.created_at, steps: 0, input: 0, output: 0, total: 0, durationMs: 0,
      };
      g.steps += 1;
      g.input += u.input_tokens;
      g.output += u.output_tokens;
      g.total += u.total_tokens;
      g.durationMs += u.duration_ms ?? 0;
      if (u.created_at < g.firstAt) g.firstAt = u.created_at;
      groups.set(u.request_id, g);
    }
    return [...groups.values()].slice(0, 100);
  });

async function ownedJob(supabase: { from: Function } & any, userId: string, id: string) {
  const { data, error } = await supabase
    .from("design_jobs")
    .select("id, design_id, status, mode, prompt, source")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Request not found");
  return data as { id: string; design_id: string; status: string; mode: string; prompt: string; source: string };
}

export const cancelApiJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const job = await ownedJob(context.supabase, context.userId, data.id);
    if (job.status !== "queued" && job.status !== "running") {
      throw new Error("Only waiting or running requests can be cancelled");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("design_jobs")
      .update({ status: "cancelled", last_error: "Cancelled by user", locked_at: null, finished_at: now, updated_at: now })
      .eq("id", job.id)
      .in("status", ["queued", "running"]);
    await supabaseAdmin
      .from("designs")
      .update({ status: "failed", error: "Cancelled by user" })
      .eq("id", job.design_id);
    return { ok: true };
  });

export const resubmitApiJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const job = await ownedJob(context.supabase, context.userId, data.id);
    const { enqueueDesignJob, drainDesignQueue } = await import("./design-queue.server");
    const { runInBackground } = await import("./background.server");
    const { design, job: created } = await enqueueDesignJob({
      supabase: context.supabase,
      userId: context.userId,
      mode: job.mode as never,
      prompt: job.prompt,
      source: (["api", "mcp", "app"].includes(job.source) ? job.source : "api") as "api",
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("design_jobs").update({ resubmitted_from: job.id }).eq("id", created.id);
    runInBackground(drainDesignQueue(1));
    return { designId: design.id, jobId: created.id };
  });
