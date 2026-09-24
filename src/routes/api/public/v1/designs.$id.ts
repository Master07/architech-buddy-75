import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, AuthError } from "@/lib/supabase-request.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
};

export const Route = createFileRoute("/api/public/v1/designs/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request, params }) => {
        try {
          const auth = await authenticateRequest(request);
          const { data, error } = await auth.supabase
            .from("designs")
            .select("id, title, mode, status, source, markdown, diagram, error, created_at")
            .eq("id", params.id)
            .eq("user_id", auth.userId)
            .maybeSingle();
          if (error) throw new Error(error.message);
          if (!data) return Response.json({ error: "Not found" }, { status: 404, headers: CORS });

          const { data: job } = await auth.supabase
            .from("design_jobs")
            .select("id, status, attempts, max_attempts, last_error, mode, started_at, current_stage, stages_done, locked_at, updated_at")
            .eq("design_id", params.id)
            .eq("user_id", auth.userId)
            .maybeSingle();

          // Self-heal: if a waiting step has sat idle for 30s, wake a worker.
          const idle = job && (job.status === "queued" || (job.status === "running" && !job.locked_at))
            && Date.now() - new Date(job.updated_at).getTime() > 30_000;
          if (idle) {
            const { kickDesignWorker } = await import("@/lib/design-queue.server");
            await kickDesignWorker();
          }

          let progress = null;
          if (job) {
            const { estimateProgress } = await import("@/lib/job-progress");
            const p = estimateProgress(job, null);
            progress = {
              percent: p.percent,
              stage: job.current_stage,
              stages_done: job.stages_done,
              estimated_seconds_remaining: p.remainingMs == null ? null : Math.round(p.remainingMs / 1000),
            };
          }
          return Response.json({ design: data, job: job ?? null, progress }, { headers: CORS });

        } catch (error) {
          const status = error instanceof AuthError ? error.status : 500;
          return Response.json({ error: (error as Error).message }, { status, headers: CORS });
        }
      },
      DELETE: async ({ request, params }) => {
        try {
          const auth = await authenticateRequest(request);
          const { cancelDesignJob } = await import("@/lib/design-queue.server");
          const result = await cancelDesignJob({ userId: auth.userId, designId: params.id });
          return Response.json(result, { headers: CORS });
        } catch (error) {
          const message = (error as Error).message;
          const status = error instanceof AuthError ? error.status : message === "Request is no longer active" ? 409 : 500;
          return Response.json({ error: message }, { status, headers: CORS });
        }
      },
    },
  },
});
