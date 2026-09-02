import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sha256Hex } from "./supabase-request.server";

export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("api_keys")
      .select("id, name, prefix, revoked, last_used_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ name: z.string().trim().min(1).max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const secret = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const token = `sda_${secret}`;
    const hash = await sha256Hex(token);

    const { data: row, error } = await context.supabase
      .from("api_keys")
      .insert({
        user_id: context.userId,
        name: data.name,
        prefix: token.slice(0, 12),
        key_hash: hash,
      })
      .select("id, name, prefix, created_at")
      .single();
    if (error) throw new Error(error.message);

    return { ...row, token };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("api_keys")
      .update({ revoked: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
