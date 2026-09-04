import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { authenticateRequest, AuthError } from "@/lib/supabase-request.server";
import { runDesignPipeline, type PipelineStage } from "@/lib/agent-run.server";
import { DESIGN_MODES, type DesignMode } from "@/lib/design-agent";
import type { EvidenceItem } from "@/lib/evidence.server";

const STAGE_HEADING: Record<PipelineStage, string | null> = {
  draft: null,
  critique: "\n\n---\n\n### Adversarial review\n\n",
  final: "\n\n---\n\n### Final document\n\n",
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let auth;
        try {
          auth = await authenticateRequest(request);
        } catch (error) {
          const status = error instanceof AuthError ? error.status : 401;
          return Response.json({ error: (error as Error).message }, { status });
        }

        const body = (await request.json()) as {
          messages: UIMessage[];
          threadId?: string;
          mode?: string;
          evidence?: EvidenceItem[];
        };

        const mode: DesignMode = DESIGN_MODES.includes(body.mode as DesignMode)
          ? (body.mode as DesignMode)
          : "interview";

        const threadId = body.threadId;

        try {
          if (threadId) {
            const last = body.messages[body.messages.length - 1];
            if (last?.role === "user") {
              await auth.supabase.from("messages").insert({
                thread_id: threadId,
                user_id: auth.userId,
                role: "user",
                message_id: last.id,
                parts: last.parts as never,
              });
            }
          }

          const modelMessages = await convertToModelMessages(body.messages);

          const stream = createUIMessageStream({
            execute: async ({ writer }) => {
              const outcome = await runDesignPipeline(
                {
                  supabase: auth.supabase,
                  userId: auth.userId,
                  mode,
                  messages: modelMessages,
                  ...(threadId ? { threadId } : {}),
                  ...(body.evidence?.length ? { evidence: body.evidence } : {}),
                  ...(auth.via === "api_key" ? { ownerScope: auth.userId } : {}),
                },
                {
                  onStage: ({ stage, result }) => {
                    const id = `stage-${stage}`;
                    writer.write({ type: "text-start", id });
                    const heading = STAGE_HEADING[stage];
                    if (heading) writer.write({ type: "text-delta", id, delta: heading });
                    void (async () => {
                      try {
                        for await (const delta of result.textStream) {
                          writer.write({ type: "text-delta", id, delta });
                        }
                      } finally {
                        writer.write({ type: "text-end", id });
                      }
                    })();
                  },
                },
              );

              if (threadId) {
                await auth.supabase.from("messages").insert({
                  thread_id: threadId,
                  user_id: auth.userId,
                  role: "assistant",
                  message_id: crypto.randomUUID(),
                  parts: [{ type: "text", text: outcome.document }] as never,
                });
                await auth.supabase
                  .from("threads")
                  .update({ updated_at: new Date().toISOString() })
                  .eq("id", threadId);
              }
            },
            onError: (error) => {
              console.error("[chat]", error);
              return (error as Error).message ?? "Generation failed";
            },
          });

          return createUIMessageStreamResponse({ stream });
        } catch (error) {
          console.error("[chat]", error);
          return Response.json({ error: (error as Error).message }, { status: 500 });
        }
      },
    },
  },
});
