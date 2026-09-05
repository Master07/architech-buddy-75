import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider, requireLovableApiKey } from "./ai-gateway.server";
import { decryptProviderKey } from "./provider-crypto.server";
import { CHAT_MODEL } from "./design-agent";

export type ResolvedChatProvider = {
  /** Call with no arguments to get the configured chat model. */
  model: ReturnType<ReturnType<typeof createLovableAiGatewayProvider>>;
  gateway: {
    getRunId: () => string | undefined;
    waitForRunId: () => Promise<string | undefined>;
  };
  /** Which model id is actually being used. */
  modelId: string;
  /** True when the user's own provider key is driving the call. */
  custom: boolean;
};

type ProviderRow = {
  base_url: string;
  model: string;
  api_key_ciphertext: string;
};

async function loadProviderRow(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ProviderRow | null> {
  try {
    const { data, error } = await supabase
      .from("ai_providers")
      .select("base_url, model, api_key_ciphertext")
      .eq("user_id", userId)
      .eq("enabled", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as ProviderRow | null) ?? null;
  } catch (error) {
    console.error("[ai-provider] lookup failed", error);
    return null;
  }
}

/**
 * Returns the chat model to run the pipeline on: the signed-in user's own
 * provider when they configured one, otherwise Lovable AI. Embeddings are
 * unaffected — the book index is built with the built-in embedding model.
 */
export async function resolveChatProvider(
  supabase: SupabaseClient<Database>,
  userId: string,
  runId?: string,
): Promise<ResolvedChatProvider> {
  const row = await loadProviderRow(supabase, userId);

  if (row) {
    try {
      const apiKey = decryptProviderKey(row.api_key_ciphertext);
      const provider = createOpenAICompatible({
        name: "user-provider",
        baseURL: row.base_url.replace(/\/+$/, ""),
        apiKey,
      });
      return {
        model: provider(row.model) as ResolvedChatProvider["model"],
        gateway: { getRunId: () => undefined, waitForRunId: async () => undefined },
        modelId: row.model,
        custom: true,
      };
    } catch (error) {
      console.error("[ai-provider] custom provider unusable, falling back", error);
    }
  }

  const gateway = createLovableAiGatewayProvider(requireLovableApiKey(), runId);
  return { model: gateway(CHAT_MODEL), gateway, modelId: CHAT_MODEL, custom: false };
}
