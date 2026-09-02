import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest, AuthError } from "@/lib/supabase-request.server";
import { searchKnowledge } from "@/lib/retrieval.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const Body = z.object({
  query: z.string().trim().min(3).max(1000),
  limit: z.number().int().min(1).max(20).default(6),
});

export const Route = createFileRoute("/api/public/v1/knowledge")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const auth = await authenticateRequest(request);
          const parsed = Body.safeParse(await request.json());
          if (!parsed.success) {
            return Response.json({ error: "Invalid request body" }, { status: 400, headers: CORS });
          }
          const hits = await searchKnowledge(auth.supabase, parsed.data.query, parsed.data.limit);
          return Response.json({ hits }, { headers: CORS });
        } catch (error) {
          const status = error instanceof AuthError ? error.status : 500;
          return Response.json({ error: (error as Error).message }, { status, headers: CORS });
        }
      },
    },
  },
});
