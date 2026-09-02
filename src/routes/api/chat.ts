import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, type UIMessage } from "ai";
import { authenticateRequest, AuthError } from "@/lib/supabase-request.server";
import { runDesignAgent } from "@/lib/agent-run.server";
import { DESIGN_MODES, type DesignMode } from "@/lib/design-agent";
import {
  getLovableAiGatewayResponseHeaders,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai-gateway.server";

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
        };

        const mode: DesignMode = DESIGN_MODES.includes(body.mode as DesignMode)
          ? (body.mode as DesignMode)
          : "interview";

        const initialRunId = getLovableAiGatewayRunId(request);

        try {
          const { result, gateway } = await runDesignAgent({
            supabase: auth.supabase,
            userId: auth.userId,
            mode,
            messages: await convertToModelMessages(body.messages),
            ...(auth.via === "api_key" ? { ownerScope: auth.userId } : {}),
            ...(initialRunId ? { runId: initialRunId } : {}),
          });

          const threadId = body.threadId;
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

          const response = result.toUIMessageStreamResponse({
            sendReasoning: true,
            originalMessages: body.messages,
            onFinish: async ({ responseMessage }) => {
              if (!threadId) return;
              await auth.supabase.from("messages").insert({
                thread_id: threadId,
                user_id: auth.userId,
                role: "assistant",
                message_id: responseMessage.id,
                parts: responseMessage.parts as never,
              });
              await auth.supabase
                .from("threads")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", threadId);
            },
            headers: getLovableAiGatewayResponseHeaders(undefined, {
              ...(initialRunId ? { "X-Lovable-AIG-Run-ID": initialRunId } : {}),
            }),
          });

          return withLovableAiGatewayRunIdHeader(response, gateway);
        } catch (error) {
          console.error("[chat]", error);
          return Response.json({ error: (error as Error).message }, { status: 500 });
        }
      },
    },
  },
});
