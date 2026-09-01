/**
 * In-memory limiter. On Netlify this is per isolate, which still
 * slows down casual brute force against /api/login and /api/logo.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function pruneExpired(now: number) {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  pruneExpired(now);
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

/** Prefer Netlify's client IP so callers cannot spoof X-Forwarded-For. */
export function clientKey(req: Request): string {
  return req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-real-ip") || "local";
}
