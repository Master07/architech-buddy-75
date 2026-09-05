import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { encryptProviderKey, keyHint } from "./provider-crypto.server";

const ProviderInput = z.object({
  label: z.string().trim().min(1).max(60),
  base_url: z.string().trim().url().max(300),
  model: z.string().trim().min(1).max(120),
  api_key: z.string().trim().min(8).max(400),
  enabled: z.boolean().default(true),
});

const SELECT = "id, label, base_url, model, key_hint, enabled, created_at, updated_at";

export const getAiProvider = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ai_providers")
      .select(SELECT)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  });

export const saveAiProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProviderInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ai_providers")
      .upsert(
        {
          user_id: context.userId,
          label: data.label,
          base_url: data.base_url,
          model: data.model,
          api_key_ciphertext: encryptProviderKey(data.api_key),
          key_hint: keyHint(data.api_key),
          enabled: data.enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select(SELECT)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const setAiProviderEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ai_providers")
      .update({ enabled: data.enabled, updated_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAiProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("ai_providers")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Sends one trivial request to the saved provider to prove the key works. */
export const testAiProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveChatProvider } = await import("./ai-provider.server");
    const resolved = await resolveChatProvider(context.supabase, context.userId);
    if (!resolved.custom) {
      return { ok: false, message: "No custom provider is active." };
    }
    const { streamText } = await import("ai");
    try {
      const result = streamText({
        model: resolved.model,
        prompt: "Reply with the single word: ready",
      });
      const text = await result.text;
      return { ok: true, message: `${resolved.modelId} replied: ${text.trim().slice(0, 80)}` };
    } catch (error) {
      return { ok: false, message: (error as Error).message.slice(0, 300) };
    }
  });
