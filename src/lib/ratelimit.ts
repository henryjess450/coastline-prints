import "server-only";

/**
 * Fixed-window in-memory rate limiter. Fine for a single server process;
 * swap for Redis/Upstash if you run multiple instances.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) sweep(now);
    return { ok: true, retryAfterS: 0 };
  }
  bucket.count++;
  if (bucket.count > limit) return { ok: false, retryAfterS: Math.ceil((bucket.resetAt - now) / 1000) };
  return { ok: true, retryAfterS: 0 };
}

function sweep(now: number) {
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

/**
 * The visitor's IP, as reported by the Caddy reverse proxy in
 * X-Forwarded-For. Caddy replaces any X-Forwarded-For a visitor sends, and
 * the site only listens on 127.0.0.1, so this can't be faked.
 */
export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
