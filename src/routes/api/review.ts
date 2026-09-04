import { createFileRoute } from "@tanstack/react-router";
import { stepCountIs, streamText } from "ai";
import { authenticateRequest, AuthError } from "@/lib/supabase-request.server";
import { createLovableAiGatewayProvider, requireLovableApiKey } from "@/lib/ai-gateway.server";
import { CHAT_MODEL, DOCUMENT_REVIEW_PROMPT, systemPrompt } from "@/lib/design-agent";

/**
 * Scores an uploaded design document against the blueprint's acceptance gates.
 * Streams plain text so a long review never buffers past the edge timeout; the
 * client parses the trailing machine-readable gate block itself.
 */
export const Route = createFileRoute("/api/review")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await authenticateRequest(request);
        } catch (error) {
          const status = error instanceof AuthError ? error.status : 401;
          return Response.json({ error: (error as Error).message }, { status });
        }

        const body = (await request.json()) as { title?: string; markdown?: string };
        const markdown = (body.markdown ?? "").trim();
        if (!markdown) {
          return Response.json({ error: "No document content supplied." }, { status: 400 });
        }

        const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
        const result = streamText({
          model: gateway(CHAT_MODEL),
          system: systemPrompt("review", { hasLibrary: false, hasEvidence: false }),
          messages: [
            {
              role: "user",
              content: [
                `Document title: ${body.title?.trim() || "Untitled design document"}`,
                "",
                "--- BEGIN DOCUMENT ---",
                markdown.slice(0, 180_000),
                "--- END DOCUMENT ---",
                "",
                DOCUMENT_REVIEW_PROMPT,
              ].join("\n"),
            },
          ],
          stopWhen: stepCountIs(10),
        });

        return result.toTextStreamResponse();
      },
    },
  },
});
