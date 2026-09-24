import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createDesignRecord } from "./design-generate.server";
import type { DesignMode } from "./design-agent";

type Admin = SupabaseClient<Database>;

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as Admin;
}

export type EnqueueParams = {
  supabase: SupabaseClient<Database>;
  userId: string;
  mode: DesignMode;
  prompt: string;
  source: "api" | "mcp" | "app";
  threadId?: string;
  ownerScope?: string;
  apiKeyId?: string | null;
};

/**
 * Creates the `running` design row plus a durable queue entry. The HTTP handler
 * returns as soon as this resolves, so generation length never affects the
 * request lifetime on the edge runtime.
 */
export async function enqueueDesignJob(params: EnqueueParams) {
  const design = await createDesignRecord({
    supabase: params.supabase,
    userId: params.userId,
    mode: params.mode,
    prompt: params.prompt,
    source: params.source,
    ...(params.threadId ? { threadId: params.threadId } : {}),
    ...(params.ownerScope ? { ownerScope: params.ownerScope } : {}),
  });

  const db = await admin();
  const { data: job, error } = await db
    .from("design_jobs")
    .insert({
      design_id: design.id,
      user_id: params.userId,
      mode: params.mode,
      prompt: params.prompt,
      source: params.source,
      bypass_rls: Boolean(params.ownerScope),
      api_key_id: params.apiKeyId ?? null,
    })
    .select("id, status, attempts, max_attempts, created_at")
    .single();
  if (error) throw new Error(error.message);

  return { design, job };
}

/** Asks the database to wake a worker over a long-lived connection. Never throws. */
export async function kickDesignWorker() {
  try {
    const db = await admin();
    const { error } = await db.rpc("kick_design_worker");
    if (error) console.error("[design-queue] kick failed", error.message);
  } catch (error) {
    console.error("[design-queue] kick failed", error);
  }
}

const HEARTBEAT_MS = 20_000;
/** Far above a normal step (~1-2 min); only catches a hung provider call. */
const STEP_DEADLINE_MS = 12 * 60_000;

type ProviderFailure = { kind: "retry" | "rate" | "pause" | "fatal"; status?: number; message: string };

function classify(error: unknown): ProviderFailure {
  const e = error as { statusCode?: number; status?: number; lastError?: unknown; message?: string; responseBody?: string };
  const inner = (e?.lastError ?? e) as typeof e;
  const status = inner?.statusCode ?? inner?.status ?? e?.statusCode;
  let message = String(inner?.message ?? e?.message ?? error).slice(0, 500);
  if (inner?.responseBody) {
    try {
      const parsed = JSON.parse(inner.responseBody);
      message = String(parsed?.error?.message ?? parsed?.message ?? message).slice(0, 500);
    } catch { /* keep */ }
  }
  if (status === 429) return { kind: "rate", status, message };
  if (status === 402 || status === 403) return { kind: "pause", status, message };
  if (status === 400 || status === 401 || status === 404) return { kind: "fatal", status, message };
  return { kind: "retry", ...(status ? { status } : {}), message };
}

type Job = Database["public"]["Tables"]["design_jobs"]["Row"];

/** Runs one stage of one claimed job, saves it, and advances the job. */
async function runJobStep(db: Admin, job: Job): Promise<"advanced" | "finished" | "stopped"> {
  const { planNextStep, runSingleStage } = await import("./agent-run.server");
  const state = (job.pipeline_state ?? {}) as Record<string, string>;
  const mode = job.mode as DesignMode;
  const plan = planNextStep(mode, job.prompt, state);
  const stagesDone = Object.keys(state).length;

  const finishDone = async (document: string) => {
    const now = new Date().toISOString();
    const { data: done } = await db
      .from("design_jobs")
      .update({ status: "succeeded", locked_at: null, finished_at: now, updated_at: now, current_stage: null, stages_done: stagesDone, last_error: null })
      .eq("id", job.id).eq("status", "running").select("id");
    if (!done?.length) return "stopped" as const;
    const heading = document.match(/^#\s+(.+)$/m)?.[1]?.trim();
    await db.from("designs").update({
      status: "ready",
      markdown: document,
      diagram: document.match(/```mermaid\n([\s\S]*?)```/)?.[1]?.trim() ?? null,
      title: (heading ?? job.prompt.trim().split("\n")[0] ?? "Untitled design").slice(0, 120),
      error: null,
      updated_at: now,
    }).eq("id", job.design_id);
    return "finished" as const;
  };

  if (plan.done) return finishDone(plan.document);

  const abort = new AbortController();
  let cancelled = false;
  const deadline = setTimeout(() => abort.abort("Step deadline exceeded"), STEP_DEADLINE_MS);
  let lastBeat = Date.now();
  const watcher = setInterval(() => {
    void (async () => {
      const { data } = await db.from("design_jobs").select("status").eq("id", job.id).maybeSingle();
      if (data?.status !== "running") {
        cancelled = true;
        abort.abort("Cancelled by user");
        return;
      }
      if (Date.now() - lastBeat >= HEARTBEAT_MS) {
        lastBeat = Date.now();
        await db.from("design_jobs").update({ locked_at: new Date().toISOString() }).eq("id", job.id).eq("status", "running");
      }
    })().catch(() => undefined);
  }, 3000);

  try {
    const text = await runSingleStage(
      {
        supabase: db,
        userId: job.user_id,
        mode,
        messages: [],
        ownerScope: job.user_id,
        usage: { requestId: job.design_id, kind: "design_job", designId: job.design_id, label: job.prompt },
        abortSignal: abort.signal,
      },
      plan.stage,
      plan.messages,
      () => {
        const now = new Date().toISOString();
        void db.from("design_jobs")
          .update({ current_stage: plan.stage, stages_done: stagesDone, stage_started_at: now, updated_at: now, locked_at: now })
          .eq("id", job.id).eq("status", "running").then(() => undefined, () => undefined);
      },
    );
    const nextState = { ...state, [plan.key]: text };
    const next = planNextStep(mode, job.prompt, nextState);
    const now = new Date().toISOString();
    const { data: saved } = await db
      .from("design_jobs")
      .update({ pipeline_state: nextState, stages_done: stagesDone + 1, attempts: 0, locked_at: null, last_error: null, updated_at: now })
      .eq("id", job.id).eq("status", "running").select("id");
    if (!saved?.length) return "stopped";
    if (next.done) {
      // Re-read nothing: finish immediately with the saved state.
      return finishDone(next.document);
    }
    return "advanced";
  } catch (error) {
    if (cancelled) return "stopped";
    const failure = abort.signal.aborted
      ? { kind: "retry" as const, message: "The AI step took over 12 minutes and was retried" }
      : classify(error);
    const now = new Date();
    const exhausted = failure.kind === "fatal" || failure.kind === "pause" || job.attempts >= job.max_attempts;
    // Rate limits wait and retry without using up a try.
    const update = failure.kind === "rate" && job.attempts < job.max_attempts + 3
      ? { locked_at: null, attempts: Math.max(0, job.attempts - 1), not_before: new Date(now.getTime() + 60_000 * Math.max(1, job.attempts)).toISOString(), last_error: `Rate limited, retrying soon: ${failure.message}`, updated_at: now.toISOString() }
      : exhausted
        ? { status: "failed", locked_at: null, current_stage: null, finished_at: now.toISOString(), last_error: failure.message, updated_at: now.toISOString() }
        : { locked_at: null, not_before: new Date(now.getTime() + 10_000 * job.attempts).toISOString(), last_error: failure.message, updated_at: now.toISOString() };
    const { data: updated } = await db.from("design_jobs").update(update).eq("id", job.id).eq("status", "running").select("id, status");
    if (updated?.[0]?.status === "failed") {
      await db.from("designs").update({ status: "failed", error: failure.message }).eq("id", job.design_id);
    }
    if (failure.kind === "pause") {
      await db.rpc("pause_design_queue", { _minutes: 15, _reason: failure.message });
    }
    console.error("[design-queue]", job.id, plan.stage, failure.status ?? "", failure.message);
    return "stopped";
  } finally {
    clearTimeout(deadline);
    clearInterval(watcher);
  }
}

/**
 * Claims up to `limit` steps (the database enforces global and per-system caps),
 * runs them side by side, and wakes a fresh worker if work remains. Each call does
 * a bounded amount of work, so no request lives longer than one AI step.
 */
export async function runDesignSteps(limit = 4) {
  const db = await admin();
  const { data, error } = await db.rpc("claim_design_steps", { _limit: limit });
  if (error) throw new Error(error.message);
  const jobs = (data ?? []) as Job[];
  if (jobs.length === 0) return { claimed: 0, results: [] as string[] };
  const results = await Promise.all(jobs.map((job) => runJobStep(db, job).catch((e) => {
    console.error("[design-queue] step crashed", job.id, e);
    return "stopped" as const;
  })));
  // Gated next hop: only wake another worker while runnable work exists.
  const { count } = await db
    .from("design_jobs")
    .select("id", { count: "exact", head: true })
    .or("status.eq.queued,and(status.eq.running,locked_at.is.null)");
  if ((count ?? 0) > 0) {
    // One wake-up per finished step keeps parallelism without a storm.
    const wakes = Math.min(count ?? 0, jobs.length);
    await Promise.all(Array.from({ length: wakes }, () => kickDesignWorker()));
  }
  return { claimed: jobs.length, results };
}

export async function cancelDesignJob(input: { userId: string; jobId?: string; designId?: string }) {
  const db = await admin();
  let query = db
    .from("design_jobs")
    .update({
      status: "cancelled",
      last_error: "Cancelled by user",
      locked_at: null,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      current_stage: null,
    })
    .eq("user_id", input.userId)
    .in("status", ["queued", "running"]);
  if (input.jobId) query = query.eq("id", input.jobId);
  if (input.designId) query = query.eq("design_id", input.designId);
  const { data, error } = await query.select("id, design_id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Request is no longer active");

  const { error: designError } = await db
    .from("designs")
    .update({ status: "failed", error: "Cancelled by user", updated_at: new Date().toISOString() })
    .eq("id", data.design_id)
    .eq("user_id", input.userId);
  if (designError) throw new Error(designError.message);
  return { jobId: data.id, designId: data.design_id, status: "cancelled" as const };
}

/** Kept for older callers: runs one bounded batch of steps. */
export async function drainDesignQueue(max = 4) {
  const { claimed } = await runDesignSteps(max);
  return claimed;
}
