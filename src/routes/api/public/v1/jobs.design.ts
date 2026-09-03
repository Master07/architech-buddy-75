import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { drainDesignQueue } from "@/lib/design-queue.server";

/**
 * Queue worker. Invoked right after an enqueue (fire-and-forget) and by the
 * scheduled sweep, which also picks up jobs whose worker died mid-run.
 */
export const Route = createFileRoute("/api/public/v1/jobs/design")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = await authenticateCronRequest(request);
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
