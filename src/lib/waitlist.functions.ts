import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AccessStatus = "pending" | "approved" | "rejected";

export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: entry }, { data: roles }] = await Promise.all([
      context.supabase.from("waitlist").select("status, created_at").eq("user_id", context.userId).maybeSingle(),
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
    ]);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    const status: AccessStatus = isAdmin ? "approved" : ((entry?.status as AccessStatus) ?? "pending");
    return { status, isAdmin, joinedAt: entry?.created_at ?? null };
  });

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || data !== true) throw new Error("Admins only");
}

export const listWaitlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("waitlist")
      .select("user_id, email, display_name, status, created_at, decided_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const decideWaitlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), status: z.enum(["pending", "approved", "rejected"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("You can't change your own access");
    const { error } = await context.supabase
      .from("waitlist")
      .update({
        status: data.status,
        decided_at: data.status === "pending" ? null : new Date().toISOString(),
        decided_by: context.userId,
      })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
