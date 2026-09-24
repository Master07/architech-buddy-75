import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { runDesignSteps } from "@/lib/design-queue.server";

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
        // The step runs inside this request; keep-alive bytes hold the connection
        // open so nothing idles out while one AI step (1-3 minutes) completes.
        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
          async start(controller) {
            const ping = setInterval(() => controller.enqueue(encoder.encode(" ")), 15_000);
            try {
              const result = await runDesignSteps(4);
              controller.enqueue(encoder.encode(JSON.stringify(result)));
            } catch (error) {
              console.error("[jobs/design]", error);
              controller.enqueue(encoder.encode(JSON.stringify({ error: (error as Error).message })));
            } finally {
              clearInterval(ping);
              controller.close();
            }
          },
        });
        return new Response(body, { headers: { "Content-Type": "application/json" } });
      },
    },
  },
});
