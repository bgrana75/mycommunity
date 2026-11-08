import { isIP } from 'node:net';

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Address to key a per-visitor limiter on.
 *
 * Requests through Cloudflare (`snapie.io`) carry `cf-connecting-ip`, set
 * by Cloudflare to the visitor. That is used first.
 *
 * Requests that reach nginx directly carry no Cloudflare header. `www.snapie.io`
 * is served that way today. For those, the key is the **last**
 * `x-forwarded-for` entry: nginx appends its own `$remote_addr` (the TCP peer)
 * there, so the client can't choose it. The first entry is client-supplied, and
 * rotating it would mint a new bucket per request, so it is never used. Before
 * this fallback, every such request shared one `'unknown'` bucket. With the
 * image proxy's 60/min limit, one busy feed starved images for every `www`
 * visitor (#335).
 *
 * `'unknown'` is left only for requests with neither header (local dev,
 * tests). A visitor reaching nginx directly can still send their own
 * `cf-connecting-ip`; the real fix for that is to route `www` through
 * Cloudflare or redirect it to `snapie.io`.
 */
export function trustedClientIp(headers: Headers): string {
  const candidate = headers.get('cf-connecting-ip')?.trim() ?? '';
  if (candidate !== '' && isIP(candidate) !== 0) return candidate;
  const lastHop = headers.get('x-forwarded-for')?.split(',').pop()?.trim() ?? '';
  if (lastHop !== '' && isIP(lastHop) !== 0) return lastHop;
  return 'unknown';
}

/**
 * Fixed-window limiter. `true` means the request is allowed.
 * Expired buckets are dropped on each check so a rotating key cannot
 * grow the map without bound; live entries are still capped by the window.
 */
export function checkRateLimit(
  buckets: Map<string, RateLimitEntry>,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): boolean {
  for (const [bucketKey, entry] of buckets) {
    if (now >= entry.resetAt) buckets.delete(bucketKey);
  }

  const entry = buckets.get(key);
  if (!entry) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}
