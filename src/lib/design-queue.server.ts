import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createDesignRecord, streamDesignInto, type DesignJobParams } from "./design-generate.server";
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
    })
    .select("id, status, attempts, max_attempts, created_at")
    .single();
  if (error) throw new Error(error.message);

  return { design, job };
}

/**
 * Claims one queued job (SKIP LOCKED, so concurrent workers never collide) and
 * runs it to completion. Returns false when the queue is empty.
 */
export async function processNextDesignJob(): Promise<boolean> {
  const db = await admin();
  const { data, error } = await db.rpc("claim_design_job");
  if (error) throw new Error(error.message);
  const job = (data ?? [])[0];
  if (!job) return false;

  const params: DesignJobParams = {
    supabase: db,
    userId: job.user_id,
    mode: job.mode as DesignMode,
    prompt: job.prompt,
    source: job.source as DesignJobParams["source"],
    ownerScope: job.user_id,
  };

  try {
    let stageCount = 0;
    const { finished } = await streamDesignInto(params, job.design_id, {
      onStage: (stage) => {
        const now = new Date().toISOString();
        const stagesDone = stageCount;
        stageCount += 1;
        void db
          .from("design_jobs")
          .update({ current_stage: stage, stages_done: stagesDone, stage_started_at: now, updated_at: now })
          .eq("id", job.id)
          .eq("status", "running")
          .then(() => undefined, () => undefined);
      },
    });
    await finished;
    const now = new Date().toISOString();
    const { data: done } = await db
      .from("design_jobs")
      .update({ status: "succeeded", locked_at: null, finished_at: now, updated_at: now, current_stage: null, stages_done: stageCount })
      .eq("id", job.id)
      .eq("status", "running")
      .select("id");
    if (!done?.length) {
      // Cancelled while running: discard the result.
      await db
        .from("designs")
        .update({ status: "failed", error: "Cancelled by user" })
        .eq("id", job.design_id);
    }
  } catch (error) {
    const message = (error as Error).message.slice(0, 500);
    const exhausted = job.attempts >= job.max_attempts;
    const now = new Date().toISOString();
    const { data: updated } = await db
      .from("design_jobs")
      .update({
        status: exhausted ? "failed" : "queued",
        current_stage: null,
        stages_done: 0,
        last_error: message,
        locked_at: null,
        finished_at: exhausted ? now : null,
        updated_at: now,
      })
      .eq("id", job.id)
      .eq("status", "running")
      .select("id");
    if (!exhausted && updated?.length) {
      // Leave the design row in `running` so a retry can still finish it.
      await db.from("designs").update({ status: "running", error: message }).eq("id", job.design_id);
    }
    console.error("[design-queue]", job.id, message);
  }
  return true;
}

/** Drains up to `max` jobs sequentially; used by the worker route and the cron sweep. */
export async function drainDesignQueue(max = 3) {
  let processed = 0;
  for (let i = 0; i < max; i += 1) {
    const didWork = await processNextDesignJob();
    if (!didWork) break;
    processed += 1;
  }
  return processed;
}
