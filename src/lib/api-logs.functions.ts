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
    return data ?? [];
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
