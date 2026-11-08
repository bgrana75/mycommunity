/**
 * Muted Accounts Manager
 * Combines community muted accounts with user's personal muted list.
 * Caches the combined result per user in localStorage for 24 hours.
 */

import HiveClient from '@/lib/hive/hiveclient';
import { withTimeout } from '@/lib/utils/withTimeout';

const COMMUNITY_ROLE_TIMEOUT_MS = 5000;

/**
 * Community-role mute, which applies to every visitor including crawlers.
 * `unknown` when the role list cannot be loaded, so a page can leave the
 * post body out of the HTML instead of publishing a muted author.
 */
export async function isCommunityRoleMuted(account: string): Promise<boolean | 'unknown'> {
  const community = process.env.NEXT_PUBLIC_HIVE_COMMUNITY_TAG;
  if (!community || !account) return false;
  try {
    const result = await withTimeout(
      HiveClient.call('bridge', 'list_community_roles', { community, limit: 1000 }),
      COMMUNITY_ROLE_TIMEOUT_MS,
    );
    if (!Array.isArray(result)) return 'unknown';
    const name = account.toLowerCase();
    return result.some(
      (row: unknown) =>
        Array.isArray(row) && String(row[0]).toLowerCase() === name && row[1] === 'muted',
    );
  } catch {
    return 'unknown';
  }
}

const STORAGE_KEY_PREFIX = 'hive_muted_accounts';
/** Personal mutes that succeeded locally but may not be in Hive's follow
 *  index yet. Kept separate from the 24h combined cache so clearCache can
 *  drop that snapshot without forgetting the mute that just landed. */
const PENDING_MUTES_PREFIX = 'hive_pending_personal_mutes';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
/** How long a local mute may hide an account the follow index has not
 *  listed yet. After this, a fetched list that still omits them wins —
 *  including an unmute that landed somewhere else. */
const PENDING_MUTE_TTL_MS = 10 * 60 * 1000;

interface MutedListCache {
  accounts: Set<string>;
  timestamp: number;
}

type PersonalMuteListener = (author: string) => void;

class MutedAccountsManager {
  private cache: Map<string, MutedListCache> = new Map();
  private loading: Map<string, Promise<Set<string>>> = new Map();
  /** Bumped by clearCache so an in-flight getMutedList cannot write the
   *  pre-clear snapshot back over the cache it just invalidated. */
  private epoch: Map<string, number> = new Map();
  /** username -> (account -> mutedAt epoch ms) */
  private pendingMutes: Map<string, Map<string, number>> = new Map();
  private personalMuteListeners = new Set<PersonalMuteListener>();

  private getStorageKey(username?: string): string {
    return username
      ? `${STORAGE_KEY_PREFIX}_${username}`
      : `${STORAGE_KEY_PREFIX}_guest`;
  }

  private getCacheKey(username?: string): string {
    return username || '_guest';
  }

  /**
   * Fetch community muted accounts via bridge.list_community_roles
   */
  private async fetchCommunityMutedList(): Promise<string[]> {
    const community = process.env.NEXT_PUBLIC_HIVE_COMMUNITY_TAG;
    if (!community) return [];

    const result = await HiveClient.call('bridge', 'list_community_roles', { community, limit: 1000 });

    if (result && Array.isArray(result)) {
      return result
        .filter((r: [string, string, string]) => r[1] === 'muted')
        .map((r: [string, string, string]) => r[0]);
    }
    return [];
  }

  /**
   * Fetch a user's personal muted list via bridge.get_follow_list
   */
  private async fetchUserMutedList(username: string): Promise<string[]> {
    const result = await HiveClient.call('bridge', 'get_follow_list', { observer: username, follow_type: 'muted' });

    if (result && Array.isArray(result)) {
      return result.map((entry: { name: string }) => entry.name);
    }
    return [];
  }

  private loadFromStorage(username?: string, ignoreTtl = false): MutedListCache | null {
    try {
      if (typeof window === 'undefined') return null;

      const stored = localStorage.getItem(this.getStorageKey(username));
      if (!stored) return null;

      const data = JSON.parse(stored);
      const cache: MutedListCache = {
        accounts: new Set(data.accounts.map((a: string) => a.toLowerCase())),
        timestamp: data.timestamp,
      };

      if (ignoreTtl || Date.now() - cache.timestamp < CACHE_DURATION) {
        return cache;
      }

      return null;
    } catch (error) {
      console.error('Failed to load muted list from storage:', error);
      return null;
    }
  }

  private saveToStorage(accounts: Set<string>, username?: string): void {
    try {
      if (typeof window === 'undefined') return;

      const data = {
        accounts: Array.from(accounts),
        timestamp: Date.now(),
      };
      localStorage.setItem(this.getStorageKey(username), JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save muted list to storage:', error);
    }
  }

  private pendingStorageKey(username: string): string {
    return `${PENDING_MUTES_PREFIX}_${username}`;
  }

  private readPending(username?: string): Map<string, number> {
    if (!username) return new Map();
    const pending = new Map(this.pendingMutes.get(username) ?? []);
    try {
      if (typeof window === 'undefined') return pending;
      const raw = localStorage.getItem(this.pendingStorageKey(username));
      if (!raw) return pending;
      const names = JSON.parse(raw);
      if (!Array.isArray(names)) return pending;
      for (const entry of names) {
        // A bare string is the previous shape, which had no timestamp and
        // could outlive an unmute. Treat it as already expired.
        if (typeof entry === 'string') {
          const name = entry.toLowerCase();
          if (!pending.has(name)) pending.set(name, 0);
          continue;
        }
        if (!entry || typeof entry.name !== 'string') continue;
        const name = entry.name.toLowerCase();
        const mutedAt = typeof entry.mutedAt === 'number' ? entry.mutedAt : 0;
        const known = pending.get(name);
        if (known === undefined || mutedAt > known) pending.set(name, mutedAt);
      }
    } catch {
      // A corrupt pending entry just means "nothing extra to union."
    }
    return pending;
  }

  private writePending(username: string, accounts: Map<string, number>): void {
    this.pendingMutes.set(username, new Map(accounts));
    try {
      if (typeof window === 'undefined') return;
      if (accounts.size === 0) {
        localStorage.removeItem(this.pendingStorageKey(username));
      } else {
        const payload = Array.from(accounts, ([name, mutedAt]) => ({ name, mutedAt }));
        localStorage.setItem(this.pendingStorageKey(username), JSON.stringify(payload));
      }
    } catch (error) {
      console.error('Failed to save pending mutes:', error);
    }
  }

  /**
   * Union local mutes Hive may not have indexed yet.
   * When `authoritativePersonal` is the personal list just fetched, a name
   * that appears there is dropped from pending (the index now owns it) and
   * a name older than PENDING_MUTE_TTL_MS is dropped even if the index
   * still omits it — so a later unmute is not hidden forever.
   */
  private withPending(
    accounts: Set<string>,
    username?: string,
    authoritativePersonal?: Set<string>,
  ): Set<string> {
    if (!username) return accounts;
    const pending = this.readPending(username);
    const now = Date.now();
    let changed = false;
    for (const [name, mutedAt] of pending) {
      const expired = now - mutedAt >= PENDING_MUTE_TTL_MS;
      const indexed = authoritativePersonal?.has(name) ?? false;
      if (expired || indexed) {
        pending.delete(name);
        changed = true;
        continue;
      }
      accounts.add(name);
    }
    if (changed) this.writePending(username, pending);
    return accounts;
  }

  private epochOf(cacheKey: string): number {
    return this.epoch.get(cacheKey) ?? 0;
  }

  /** Invalidate one cache key. Drops the in-flight promise so the next
   *  getMutedList starts a new fetch, and bumps the epoch so the old fetch
   *  cannot save when it resolves. */
  private invalidate(cacheKey: string): void {
    this.epoch.set(cacheKey, this.epochOf(cacheKey) + 1);
    this.cache.delete(cacheKey);
    this.loading.delete(cacheKey);
  }

  /**
   * Get the combined muted list (community + user personal).
   * If username is provided, also fetches the user's personal muted list.
   * Results are cached for 24 hours per user.
   */
  async getMutedList(username?: string): Promise<Set<string>> {
    const cacheKey = this.getCacheKey(username);

    // Return in-memory cache if available and not expired
    const cached = this.cache.get(cacheKey);
    if (cached) {
      if (Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.accounts;
      }
      this.cache.delete(cacheKey);
    }

    // If already loading for this user, wait for that promise
    const existing = this.loading.get(cacheKey);
    if (existing) {
      return existing;
    }

    // Try localStorage. Union any mute that succeeded after this snapshot
    // was saved — the 24h entry alone is missing that account until Hive
    // reindexes, and must not be treated as the whole list.
    const stored = this.loadFromStorage(username);
    if (stored) {
      this.withPending(stored.accounts, username);
      this.cache.set(cacheKey, stored);
      return stored.accounts;
    }

    // `owned` holds this request's promise so finally can drop the in-flight
    // slot only if it still belongs to this call. Reading `promise` from
    // inside its own initializer is a definite-assignment error (TS2454).
    const epochAtStart = this.epochOf(cacheKey);
    const owned: { current: Promise<Set<string>> | null } = { current: null };
    const promise = (async () => {
      try {
        const fetches: Promise<string[]>[] = [this.fetchCommunityMutedList()];
        if (username) {
          fetches.push(this.fetchUserMutedList(username));
        }

        const results = await Promise.all(fetches);
        const personal = username
          ? new Set((results[1] ?? []).map(a => a.toLowerCase()))
          : undefined;
        const combined = this.withPending(
          new Set(results.flat().map(a => a.toLowerCase())),
          username,
          personal,
        );

        // clearCache / notifyPersonalMute landed while this fetch was in
        // flight. Return the list (including any mute that just succeeded)
        // but do not write the pre-clear snapshot back for 24 hours.
        if (this.epochOf(cacheKey) !== epochAtStart) {
          return combined;
        }

        this.cache.set(cacheKey, { accounts: combined, timestamp: Date.now() });
        this.saveToStorage(combined, username);

        return combined;
      } catch (error) {
        console.error('Failed to fetch muted list:', error);
        if (this.epochOf(cacheKey) !== epochAtStart) {
          return this.withPending(new Set(), username);
        }
        // Return expired cache if available rather than empty set
        const stale = this.loadFromStorage(username, true);
        if (stale) {
          this.withPending(stale.accounts, username);
          this.cache.set(cacheKey, stale);
          return stale.accounts;
        }
        return this.withPending(new Set(), username);
      } finally {
        if (this.loading.get(cacheKey) === owned.current) {
          this.loading.delete(cacheKey);
        }
      }
    })();
    owned.current = promise;

    this.loading.set(cacheKey, promise);
    return promise;
  }

  /**
   * A personal mute just succeeded. Drops the 24h combined cache for
   * `viewer` (an in-flight fetch will not write it back) and tells mounted
   * feeds to hide `author` immediately, before Hive reindexes the ignore.
   */
  notifyPersonalMute(viewer: string, author: string): void {
    const name = author.toLowerCase();
    if (!viewer || !name) return;
    const pending = this.readPending(viewer);
    pending.set(name, Date.now());
    this.writePending(viewer, pending);
    this.clearCache(viewer);
    this.personalMuteListeners.forEach(listener => listener(name));
  }

  /** The viewer unmuted `author`. Pending local mutes must not keep hiding them. */
  releasePersonalMute(viewer: string, author: string): void {
    const name = author.toLowerCase();
    if (!viewer || !name) return;
    const pending = this.readPending(viewer);
    pending.delete(name);
    this.writePending(viewer, pending);
    this.clearCache(viewer);
  }

  /** Feeds subscribe so a mute hides that author without waiting for a refetch. */
  subscribePersonalMute(listener: PersonalMuteListener): () => void {
    this.personalMuteListeners.add(listener);
    return () => {
      this.personalMuteListeners.delete(listener);
    };
  }

  /**
   * Check if an account is muted
   */
  async isMuted(account: string, username?: string): Promise<boolean> {
    const list = await this.getMutedList(username);
    return list.has(account.toLowerCase());
  }

  /**
   * Clear cache for a specific user or all caches
   */
  clearCache(username?: string): void {
    if (username) {
      const cacheKey = this.getCacheKey(username);
      this.invalidate(cacheKey);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(this.getStorageKey(username));
      }
    } else {
      const keys = new Set<string>([
        ...this.cache.keys(),
        ...this.loading.keys(),
        ...this.epoch.keys(),
      ]);
      keys.forEach(key => this.invalidate(key));
      this.cache.clear();
      if (typeof window !== 'undefined') {
        // Clear all muted account keys. Pending personal mutes use a
        // different prefix and stay until unmute — wiping them here would
        // resurrect accounts the viewer just muted.
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key?.startsWith(STORAGE_KEY_PREFIX)) {
            localStorage.removeItem(key);
          }
        }
      }
    }
  }
}

export const mutedAccountsManager = new MutedAccountsManager();
