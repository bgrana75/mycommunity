import HiveClient from "./hiveclient";

// Link-preview crawlers hit the same few URLs repeatedly, and a slow Hive node
// used to turn one of those hits into a generic "Snapie" card that the crawler
// then caches. Keep the last good result: serve it while a refresh runs, share
// one lookup between concurrent requests, and let a lookup that outlives the
// caller's timeout still land in the cache for the next retry.
// shortcut: per-process memory, fine for one long-lived server; use a shared
// cache if this ever runs on many short-lived instances.
const TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 500;
const cache = new Map<string, { value: unknown; at: number }>();
const inflight = new Map<string, Promise<unknown>>();

async function cachedLookup<T>(key: string, lookup: () => Promise<T | null>): Promise<T | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;

  let pending = inflight.get(key) as Promise<T | null> | undefined;
  if (!pending) {
    pending = lookup()
      .then((value) => {
        if (value) {
          if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
          cache.set(key, { value, at: Date.now() });
        }
        return value;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  // A stale result beats a generic card, and the refresh keeps running.
  return hit ? (hit.value as T) : pending;
}

export function getPostForMetadata(author: string, permlink: string) {
  return cachedLookup(`post:${author}/${permlink}`, async () => {
    try {
      const post = await HiveClient.database.call('get_content', [author, permlink]);
      if (!post || !post.author) return null;
      return post;
    } catch {
      return null;
    }
  });
}

export function getProfileForMetadata(username: string) {
  return cachedLookup(`profile:${username}`, async () => {
    try {
      const profile = await HiveClient.call('bridge', 'get_profile', { account: username });
      if (!profile || !profile.name) return null;
      return profile;
    } catch {
      return null;
    }
  });
}
