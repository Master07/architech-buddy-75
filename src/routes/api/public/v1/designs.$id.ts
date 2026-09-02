import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, AuthError } from "@/lib/supabase-request.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export const Route = createFileRoute("/api/public/v1/designs/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request, params }) => {
        try {
          const auth = await authenticateRequest(request);
          const { data, error } = await auth.supabase
            .from("designs")
            .select("id, title, mode, status, source, markdown, diagram, error, created_at")
            .eq("id", params.id)
            .eq("user_id", auth.userId)
            .maybeSingle();
          if (error) throw new Error(error.message);
          if (!data) return Response.json({ error: "Not found" }, { status: 404, headers: CORS });
          return Response.json({ design: data }, { headers: CORS });
        } catch (error) {
          const status = error instanceof AuthError ? error.status : 500;
          return Response.json({ error: (error as Error).message }, { status, headers: CORS });
        }
      },
    },
  },
});
