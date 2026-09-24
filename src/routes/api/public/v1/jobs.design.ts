import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { drainDesignQueue } from "@/lib/design-queue.server";

async function authenticateDesignWorker(request: Request): Promise<Response | null> {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([^\s,]+)$/.exec(authorization);
  const token = match?.[1];
  if (token) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("verify_design_worker_token", {
      _token: token,
    });
    if (!error && data === true) return null;
  }

  return authenticateCronRequest(request);
}

/**
 * Queue worker. Invoked right after an enqueue (fire-and-forget) and by the
 * scheduled sweep, which also picks up jobs whose worker died mid-run.
 */
export const Route = createFileRoute("/api/public/v1/jobs/design")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = await authenticateDesignWorker(request);
        if (unauthorized) return unauthorized;
        try {
          const processed = await drainDesignQueue(3);
          return Response.json({ processed });
        } catch (error) {
          console.error("[jobs/design]", error);
          return Response.json({ error: (error as Error).message }, { status: 500 });
        }
      },
    },
  },
});
