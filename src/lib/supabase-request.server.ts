import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export type RequestAuth = {
  supabase: SupabaseClient<Database>;
  userId: string;
  via: "session" | "api_key";
};

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export function supabaseForToken(token: string) {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_PUBLISHABLE_KEY");
  return createClient<Database>(url, key, {
    global: {
      fetch: createSupabaseFetch(key),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export async function sha256Hex(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Authenticates a raw HTTP request either with a Supabase session JWT
 * (browser / MCP OAuth) or with an app-issued `sda_` API key.
 */
export async function authenticateRequest(request: Request): Promise<RequestAuth> {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) {
    throw new AuthError("Missing bearer token");
  }
  const token = header.slice(7).trim();
  if (!token) throw new AuthError("Missing bearer token");

  if (token.startsWith("sda_")) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hash = await sha256Hex(token);
    const { data, error } = await supabaseAdmin
      .from("api_keys")
      .select("id, user_id, revoked")
      .eq("key_hash", hash)
      .maybeSingle();
    if (error) throw new AuthError("Could not verify API key", 500);
    if (!data || data.revoked) throw new AuthError("Invalid or revoked API key");
    await supabaseAdmin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id);
    return { supabase: supabaseAdmin as SupabaseClient<Database>, userId: data.user_id, via: "api_key" };
  }

  if (token.split(".").length !== 3) throw new AuthError("Invalid token");
  const supabase = supabaseForToken(token);
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new AuthError("Invalid token");
  return { supabase, userId: data.claims.sub, via: "session" };
}
