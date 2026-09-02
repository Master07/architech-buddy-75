import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest, AuthError } from "@/lib/supabase-request.server";
import { generateDesign } from "@/lib/design-generate.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const Body = z.object({
  prompt: z.string().trim().min(10).max(20000),
  mode: z.enum(["design", "review", "stack", "interview"]).default("design"),
});

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

          const design = await generateDesign({
            supabase: auth.supabase,
            userId: auth.userId,
            mode: parsed.data.mode,
            prompt: parsed.data.prompt,
            source: auth.via === "api_key" ? "api" : "app",
            ...(auth.via === "api_key" ? { ownerScope: auth.userId } : {}),
          });

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
