import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest, AuthError } from "@/lib/supabase-request.server";
import { createDesignRecord, streamDesignInto, type DesignJobParams } from "@/lib/design-generate.server";
import { enqueueDesignJob } from "@/lib/design-queue.server";

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
          const raw = await request.json().catch(() => undefined);
          if (raw === undefined) return Response.json({ error: "Body must be valid JSON" }, { status: 400, headers: CORS });
          const parsed = Body.safeParse(raw);
          if (!parsed.success) {
            return Response.json(
              { error: "Invalid request body", details: parsed.error.flatten() },
              { status: 400, headers: CORS },
            );
          }

          const base = {
            supabase: auth.supabase,
            userId: auth.userId,
            mode: parsed.data.mode,
            prompt: parsed.data.prompt,
            source: (auth.via === "api_key" ? "api" : "app") as DesignJobParams["source"],
            ...(auth.via === "api_key" ? { ownerScope: auth.userId } : {}),
          };

          // --- Streaming: bytes keep flowing, so long documents never idle out.
          if (parsed.data.stream) {
            const created = await createDesignRecord(base);
            const { textStream, finished } = await streamDesignInto(base, created.id);
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

          // --- Default: durable queue. The request returns immediately with an
          // id; a worker generates the document, so no request can time out.
          const { design, job } = await enqueueDesignJob({
            ...base,
            ...(auth.apiKeyId ? { apiKeyId: auth.apiKeyId } : {}),
          });
          // enqueueDesignJob already woke a worker over a long-lived connection.
          return Response.json(
            {
              design,
              job: { id: job.id, status: job.status },
              poll: `/api/public/v1/designs/${design.id}`,
            },
            { status: 202, headers: { ...CORS, "X-Design-Id": design.id } },
          );
        } catch (error) {
          const status = error instanceof AuthError ? error.status : 500;
          console.error("[api/v1/design]", error);
          return Response.json({ error: (error as Error).message }, { status, headers: CORS });
        }
      },
    },
  },
});
