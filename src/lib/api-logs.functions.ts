import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listApiLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("design_jobs")
      .select(
        "id, design_id, mode, prompt, source, status, attempts, max_attempts, last_error, created_at, started_at, finished_at, resubmitted_from, current_stage, stages_done, api_key_id",
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
    const { data: past } = await context.supabase
      .from("design_jobs")
      .select("mode, started_at, finished_at")
      .eq("user_id", context.userId)
      .eq("status", "succeeded")
      .not("started_at", "is", null)
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(50);
    const sums: Record<string, { ms: number; n: number }> = {};
    for (const p of past ?? []) {
      const ms = new Date(p.finished_at!).getTime() - new Date(p.started_at!).getTime();
      if (ms <= 0) continue;
      const s = (sums[p.mode] ??= { ms: 0, n: 0 });
      s.ms += ms;
      s.n += 1;
    }
    const avgRunMs: Record<string, number> = {};
    for (const [mode, s] of Object.entries(sums)) avgRunMs[mode] = Math.round(s.ms / s.n);
    // Per-system breakdown: each API key stands for one calling system.
    const { data: keys } = await context.supabase
      .from("api_keys")
      .select("id, name, prefix, revoked")
      .eq("user_id", context.userId);
    const { data: allJobs } = await context.supabase
      .from("design_jobs")
      .select("design_id, api_key_id, source, status")
      .eq("user_id", context.userId)
      .limit(5000);
    const allIds = (allJobs ?? []).map((j) => j.design_id);
    const allTotals = new Map<string, number>();
    for (let i = 0; i < allIds.length; i += 200) {
      const { data: u } = await context.supabase
        .from("ai_usage")
        .select("design_id, total_tokens")
        .in("design_id", allIds.slice(i, i + 200));
      for (const r of u ?? []) {
        if (r.design_id) allTotals.set(r.design_id, (allTotals.get(r.design_id) ?? 0) + r.total_tokens);
      }
    }
    const keyName = new Map((keys ?? []).map((k) => [k.id, `${k.name} (${k.prefix}…)${k.revoked ? " · revoked" : ""}`]));
    const systems = new Map<string, { key: string; name: string; requests: number; succeeded: number; failed: number; tokens: number }>();
    for (const j of allJobs ?? []) {
      const key = j.api_key_id ?? (j.source === "api" ? "untracked" : "app");
      const name = j.api_key_id
        ? keyName.get(j.api_key_id) ?? "Deleted key"
        : j.source === "api" ? "API (key not recorded — older requests)" : "This app";
      const s = systems.get(key) ?? { key, name, requests: 0, succeeded: 0, failed: 0, tokens: 0 };
      s.requests += 1;
      if (j.status === "succeeded") s.succeeded += 1;
      if (j.status === "failed") s.failed += 1;
      s.tokens += allTotals.get(j.design_id) ?? 0;
      systems.set(key, s);
    }
    return {
      avgRunMs,
      systems: [...systems.values()].sort((a, b) => b.requests - a.requests),
      jobs: jobs.map((j) => ({
        ...j,
        system: j.api_key_id ? keyName.get(j.api_key_id) ?? "Deleted key" : null,
        tokens: totals.get(j.design_id) ?? null,
      })),
    };
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
    .select("id, design_id, status, mode, prompt, source, api_key_id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Request not found");
  return data as { id: string; design_id: string; status: string; mode: string; prompt: string; source: string; api_key_id: string | null };
}

export const cancelApiJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const job = await ownedJob(context.supabase, context.userId, data.id);
    if (job.status !== "queued" && job.status !== "running") {
      throw new Error("Only waiting or running requests can be cancelled");
    }
    const { cancelDesignJob } = await import("./design-queue.server");
    await cancelDesignJob({ userId: context.userId, jobId: job.id });
    return { ok: true };
  });

export const resubmitApiJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const job = await ownedJob(context.supabase, context.userId, data.id);
    if (job.status === "queued" || job.status === "running") {
      throw new Error("Cancel this active request before resubmitting it");
    }
    const { enqueueDesignJob } = await import("./design-queue.server");
    const { design, job: created } = await enqueueDesignJob({
      supabase: context.supabase,
      userId: context.userId,
      mode: job.mode as never,
      prompt: job.prompt,
      source: (["api", "mcp", "app"].includes(job.source) ? job.source : "api") as "api",
      apiKeyId: job.api_key_id,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("design_jobs").update({ resubmitted_from: job.id }).eq("id", created.id);
    return { designId: design.id, jobId: created.id };
  });
