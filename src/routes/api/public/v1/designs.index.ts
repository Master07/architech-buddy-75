import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, AuthError } from "@/lib/supabase-request.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export const Route = createFileRoute("/api/public/v1/designs/")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        try {
          const auth = await authenticateRequest(request);
          const { data, error } = await auth.supabase
            .from("designs")
            .select("id, title, mode, status, source, created_at")
            .eq("user_id", auth.userId)
            .order("created_at", { ascending: false })
            .limit(50);
          if (error) throw new Error(error.message);
          return Response.json({ designs: data ?? [] }, { headers: CORS });
        } catch (error) {
          const status = error instanceof AuthError ? error.status : 500;
          return Response.json({ error: (error as Error).message }, { status, headers: CORS });
        }
      },
    },
  },
});
