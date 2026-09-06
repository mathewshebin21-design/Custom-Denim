import "server-only";

/**
 * Small, swappable rate-limit abstraction.
 *
 * `RateLimitStore` is the only surface a production backend needs to
 * implement (e.g. Upstash/Redis via `INCR` + `PEXPIRE`, or a database table)
 * to replace `MemoryRateLimitStore` below. Nothing that calls
 * `checkRateLimit()` needs to change when that swap happens — only
 * `getStore()`'s implementation does.
 *
 * `MemoryRateLimitStore` is process-local: it works for a single long-running
 * Node process (e.g. `next start` on one machine) but does NOT share state
 * across multiple instances or serverless invocations. That's an accepted
 * limitation for now (see README's production checklist) — it still blunts
 * casual brute-forcing today, and the interface is what makes the eventual
 * swap to a durable, multi-instance-safe store a one-file change.
 */
export interface RateLimitStore {
  /** Increments the counter for `key` and returns the new count. */
  increment(key: string): Promise<number>;
}

class MemoryRateLimitStore implements RateLimitStore {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(private windowMs: number) {}

  async increment(key: string): Promise<number> {
    const now = Date.now();
    const entry = this.hits.get(key);

    // Opportunistic sweep of expired entries so this Map can't grow forever
    // in a long-running process. Cheap and rare enough not to matter.
    if (Math.random() < 0.01) {
      for (const [k, v] of this.hits) {
        if (v.resetAt <= now) this.hits.delete(k);
      }
    }

    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return 1;
    }
    entry.count += 1;
    return entry.count;
  }
}

const stores = new Map<string, MemoryRateLimitStore>();

function getStore(namespace: string, windowMs: number): RateLimitStore {
  const key = `${namespace}:${windowMs}`;
  let store = stores.get(key);
  if (!store) {
    store = new MemoryRateLimitStore(windowMs);
    stores.set(key, store);
  }
  return store;
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/**
 * @param namespace a short label per protected action, e.g. "login" — keeps
 *   limits for different routes from sharing a counter even if the same
 *   identity string is used for both.
 * @param identity the thing being limited (an IP, a user id, ...).
 */
export async function checkRateLimit(
  namespace: string,
  identity: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const store = getStore(namespace, windowMs);
  const count = await store.increment(`${namespace}:${identity}`);
  if (count > limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }
  return { allowed: true };
}

/** Best-effort client IP from standard proxy headers; never throws. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
