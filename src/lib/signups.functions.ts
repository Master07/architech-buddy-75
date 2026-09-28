import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Signup = z.object({
  email: z.string().trim().email().max(255),
  name: z.string().trim().max(100).optional().default(""),
  useCase: z.string().trim().max(60).optional().default(""),
  note: z.string().trim().max(1000).optional().default(""),
});

/** Public: a visitor joins the waitlist. Duplicate emails succeed silently. */
export const joinWaitlist = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Signup.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("waitlist_signups").insert({
      email: data.email.toLowerCase(),
      name: data.name || null,
      use_case: data.useCase || null,
      note: data.note || null,
    });
    if (error && error.code !== "23505") throw new Error("Could not join the waitlist. Please try again.");
    if (!error) {
      try {
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
        await sendTemplateEmail("waitlist-signup", "navneet.jha07@gmail.com", {
          templateData: { email: data.email.toLowerCase(), name: data.name, useCase: data.useCase, note: data.note },
          idempotencyKey: `waitlist-signup-${data.email.toLowerCase()}`,
        });
      } catch (e) {
        console.error("waitlist signup email failed", (e as Error).message);
      }
    }
    return { ok: true };
  });

export const listSignups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (isAdmin !== true) throw new Error("Admins only");
    const { data, error } = await context.supabase
      .from("waitlist_signups")
      .select("id, email, name, use_case, note, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
