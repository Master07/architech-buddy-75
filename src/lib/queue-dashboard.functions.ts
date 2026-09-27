import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-only live view of every user's design requests plus per-step timing. */
export const getQueueDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (isAdmin !== true) throw new Error("Admins only");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const [active, recent, usage] = await Promise.all([
      db
        .from("design_jobs")
        .select("id, design_id, user_id, mode, prompt, status, attempts, max_attempts, last_error, locked_at, created_at, started_at, current_stage, stages_done, stage_started_at, not_before")
        .in("status", ["queued", "running"])
        .order("created_at", { ascending: true })
        .limit(200),
      db
        .from("design_jobs")
        .select("id, mode, prompt, status, last_error, created_at, started_at, finished_at, stages_done")
        .in("status", ["succeeded", "failed", "cancelled"])
        .gte("created_at", since)
        .order("finished_at", { ascending: false })
        .limit(100),
      db.from("ai_usage").select("stage, duration_ms, total_tokens").eq("kind", "design").gte("created_at", since).limit(5000),
    ]);
    if (active.error) throw new Error(active.error.message);
    if (recent.error) throw new Error(recent.error.message);

    const stats = new Map<string, { count: number; totalMs: number; maxMs: number; tokens: number }>();
    for (const u of usage.data ?? []) {
      if (!u.stage) continue;
      const s = stats.get(u.stage) ?? { count: 0, totalMs: 0, maxMs: 0, tokens: 0 };
      s.count++;
      s.totalMs += u.duration_ms ?? 0;
      s.maxMs = Math.max(s.maxMs, u.duration_ms ?? 0);
      s.tokens += u.total_tokens ?? 0;
      stats.set(u.stage, s);
    }
    const stageStats = [...stats.entries()]
      .map(([stage, s]) => ({ stage, calls: s.count, avgMs: Math.round(s.totalMs / s.count), maxMs: s.maxMs, avgTokens: Math.round(s.tokens / s.count) }))
      .sort((a, b) => b.avgMs - a.avgMs);

    const { data: q } = await db.schema("private" as never).from("design_queue_state" as never).select("paused_until, paused_reason").maybeSingle();
    const pause = q as { paused_until: string | null; paused_reason: string | null } | null;

    return {
      now: new Date().toISOString(),
      active: active.data ?? [],
      recent: recent.data ?? [],
      stageStats,
      paused: pause?.paused_until && new Date(pause.paused_until) > new Date() ? pause : null,
    };
  });
