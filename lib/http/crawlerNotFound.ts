/**
 * Real 404s for crawlers on missing Hive posts and accounts.
 *
 * The root layout wraps every page in <Suspense> (and app/loading.tsx adds
 * another boundary), so the 200 shell is sent before a page can call
 * notFound(). Visitors still get the not-found page, with noindex, but the
 * status is 200, which Search Console reports as a soft 404. Middleware runs
 * before rendering, so for crawler requests only it asks Hive whether the
 * post or account exists, and rewrites to a 404 when Hive says it doesn't.
 *
 * Only a definite answer from Hive is a 404. A timeout, a node error or
 * anything unexpected is `unknown`, and the page renders as usual, so a sick
 * node can never get a live post deindexed.
 *
 * Plain fetch (no dhive) so it runs in the middleware runtime.
 */

export type HiveExistence = 'found' | 'missing' | 'unknown';

const NODES = ['https://api.hive.blog', 'https://api.openhive.network'];
const NODE_TIMEOUT_MS = 2000;
const TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 1000;

// Per-instance memory. Crawlers re-request the same URLs, so this spares Hive
// most of the repeat lookups. Only definite answers are cached.
const cache = new Map<string, { status: 'found' | 'missing'; at: number }>();

type Fetch = typeof fetch;

type RpcReply = {
  result?: unknown;
  error?: { data?: { name?: unknown; extension?: { assertion_expression?: unknown } } };
};

async function rpc(method: string, params: unknown[], fetchImpl: Fetch): Promise<RpcReply | null> {
  for (const node of NODES) {
    try {
      const res = await fetchImpl(node, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(NODE_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const reply = (await res.json()) as RpcReply;
      if (reply && typeof reply === 'object' && ('result' in reply || 'error' in reply)) return reply;
    } catch {
      // Timeout or network error: try the next node.
    }
  }
  return null;
}

async function cached(key: string, lookup: () => Promise<HiveExistence>): Promise<HiveExistence> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.status;
  const status = await lookup();
  if (status !== 'unknown') {
    if (!cache.has(key) && cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
    cache.set(key, { status, at: Date.now() });
  }
  return status;
}

/** A Hive account name: 3-16 chars, lowercase letters, digits, dots and dashes. */
function isPlausibleAccount(name: string): boolean {
  return name.length >= 3 && name.length <= 16 && /^[a-z][a-z0-9.-]*[a-z0-9]$/.test(name);
}

export function hiveAccountStatus(username: string, fetchImpl: Fetch = fetch): Promise<HiveExistence> {
  // No Hive account can have this name, so there is nothing to look up.
  if (!isPlausibleAccount(username)) return Promise.resolve('missing');
  return cached(`account:${username}`, async () => {
    const reply = await rpc('condenser_api.get_accounts', [[username]], fetchImpl);
    if (!reply || !Array.isArray(reply.result)) return 'unknown';
    return reply.result.length > 0 ? 'found' : 'missing';
  });
}

export function hivePostStatus(author: string, permlink: string, fetchImpl: Fetch = fetch): Promise<HiveExistence> {
  if (!isPlausibleAccount(author)) return Promise.resolve('missing');
  if (!permlink) return Promise.resolve('unknown');
  return cached(`post:${author}/${permlink}`, async () => {
    const reply = await rpc('condenser_api.get_content', [author, permlink], fetchImpl);
    if (!reply) return 'unknown';
    if (reply.error) {
      // hived answers a missing post with this assert, not an empty result.
      const data = reply.error.data;
      const expression = data?.extension?.assertion_expression;
      const missing = data?.name === 'assert_exception'
        && typeof expression === 'string'
        && /^Post .+ does not exist$/.test(expression);
      return missing ? 'missing' : 'unknown';
    }
    const post = reply.result as { author?: unknown } | null;
    if (!post || typeof post !== 'object') return 'unknown';
    return post.author ? 'found' : 'missing';
  });
}

/** Test hook. */
export function clearCrawlerNotFoundCache(): void {
  cache.clear();
}
