// Minimal in-memory rate limiter (per running server instance).
// Good protection for a single-server deployment; swap for Upstash/Redis
// if the app is ever scaled to multiple instances.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  // opportunistic cleanup so the map can't grow unbounded
  if (buckets.size > 10_000) {
    buckets.forEach((b, k) => {
      if (b.resetAt < now) buckets.delete(k);
    });
  }
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count++;
  return true;
}
