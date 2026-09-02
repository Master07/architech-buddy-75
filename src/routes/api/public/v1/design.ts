import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest, AuthError } from "@/lib/supabase-request.server";
import {
  createDesignRecord,
  generateDesign,
  streamDesignInto,
  type DesignJobParams,
} from "@/lib/design-generate.server";
import { runInBackground } from "@/lib/background.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const Body = z.object({
  prompt: z.string().trim().min(10).max(20000),
  mode: z.enum(["design", "review", "stack", "interview"]).default("design"),
  /** Stream the document as Server-Sent Events while it is written. */
  stream: z.boolean().default(false),
  /** false → return 202 with a design id immediately and generate in the background. */
  wait: z.boolean().default(true),
});

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export const Route = createFileRoute("/api/public/v1/design")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const auth = await authenticateRequest(request);
          const parsed = Body.safeParse(await request.json());
          if (!parsed.success) {
            return Response.json(
              { error: "Invalid request body", details: parsed.error.flatten() },
              { status: 400, headers: CORS },
            );
          }

          const job: DesignJobParams = {
            supabase: auth.supabase,
            userId: auth.userId,
            mode: parsed.data.mode,
            prompt: parsed.data.prompt,
            source: auth.via === "api_key" ? "api" : "app",
            ...(auth.via === "api_key" ? { ownerScope: auth.userId } : {}),
          };

          // --- Streaming: bytes keep flowing, so long documents never idle out.
          if (parsed.data.stream) {
            const created = await createDesignRecord(job);
            const { textStream, finished } = await streamDesignInto(job, created.id);
            const encoder = new TextEncoder();

            const body = new ReadableStream<Uint8Array>({
              async start(controller) {
                controller.enqueue(encoder.encode(sse("design.started", { id: created.id })));
                try {
                  for await (const delta of textStream) {
                    controller.enqueue(encoder.encode(sse("delta", { text: delta })));
                  }
                  const design = await finished;
                  controller.enqueue(encoder.encode(sse("design.completed", { design })));
                } catch (error) {
                  controller.enqueue(
                    encoder.encode(
                      sse("error", { id: created.id, message: (error as Error).message }),
                    ),
                  );
                }
                controller.close();
              },
            });

            return new Response(body, {
              headers: {
                ...CORS,
                "Content-Type": "text/event-stream; charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
                "X-Design-Id": created.id,
              },
            });
          }

          // --- Async: hand back an id now, poll GET /api/public/v1/designs/:id.
          if (!parsed.data.wait) {
            const created = await createDesignRecord(job);
            runInBackground(
              streamDesignInto(job, created.id).then(({ finished }) => finished),
            );
            return Response.json(
              { design: created, poll: `/api/public/v1/designs/${created.id}` },
              { status: 202, headers: CORS },
            );
          }

          // --- Buffered (default, backwards compatible). Long docs may hit
          // client/proxy timeouts; prefer `stream` or `wait: false` for those.
          const design = await generateDesign(job);
          return Response.json({ design }, { headers: CORS });
        } catch (error) {
          const status = error instanceof AuthError ? error.status : 500;
          console.error("[api/v1/design]", error);
          return Response.json({ error: (error as Error).message }, { status, headers: CORS });
        }
      },
    },
  },
});
