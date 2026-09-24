import { AsyncLocalStorage } from "node:async_hooks";

type ExecutionContext = { waitUntil?: (promise: Promise<unknown>) => void };

const executionContext = new AsyncLocalStorage<ExecutionContext>();

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
    const ctx = executionContext.getStore();
    if (ctx?.waitUntil) {
      ctx.waitUntil(safe);
      return;
    }
  } catch {
    /* ignore */
  }

  void safe;
}

/** Keeps each request's execution context isolated from concurrent requests. */
export function withExecutionContext<T>(ctx: unknown, work: () => T): T {
  const scoped = ctx && typeof (ctx as ExecutionContext).waitUntil === "function"
    ? (ctx as ExecutionContext)
    : {};
  return executionContext.run(scoped, work);
}
