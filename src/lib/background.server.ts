/**
 * Keeps a promise alive after the HTTP response has been returned.
 *
 * On the edge runtime the request context is torn down as soon as the handler
 * resolves, so a floating promise would be killed mid-generation. When the
 * runtime exposes `waitUntil` we hand the work to it; otherwise (local dev on
 * Node) the floating promise is fine.
 */
export function runInBackground(work: Promise<unknown>) {
  const safe = work.catch((error) => {
    console.error("[background]", error);
  });

  try {
    const ctx = (globalThis as { __cfCtx?: { waitUntil?: (p: Promise<unknown>) => void } }).__cfCtx;
    if (ctx?.waitUntil) {
      ctx.waitUntil(safe);
      return;
    }
  } catch {
    /* ignore */
  }

  void safe;
}

/** Best-effort capture of the Cloudflare execution context for `runInBackground`. */
export function rememberExecutionContext(ctx: unknown) {
  if (ctx && typeof (ctx as { waitUntil?: unknown }).waitUntil === "function") {
    (globalThis as { __cfCtx?: unknown }).__cfCtx = ctx;
  }
}
