import type { ContentFilterRemote } from './api';
import { createContentFilter, type ContentFilter } from './matcher';
import {
  addRule as addRuleTo,
  emptyPrefs,
  fromLegacyTags,
  mergePrefs,
  prefsFingerprint,
  removeRule as removeRuleFrom,
  samePrefs,
  sanitizePrefs,
  setPreset as setPresetOn,
} from './prefs';
import { DEFAULT_PRESETS } from './presets';
import type { ContentFilterPrefs, MuteRule, PresetCatalog } from './types';

/** localStorage (sync) and AsyncStorage (async) both fit. */
export interface KeyValueStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
}

export interface ContentFilterState {
  prefs: ContentFilterPrefs;
  catalog: PresetCatalog;
  /** Predicate for the current prefs: `filter(item) === true` → hide it. */
  filter: ContentFilter;
  /** Changes whenever what's filtered changes. Use as an effect dependency. */
  fingerprint: string;
  /** Local storage has been read. Before this, `filter` hides nothing. */
  hydrated: boolean;
  /** Account currently being synced, or null for local-only. */
  syncUser: string | null;
}

export interface ContentFilterStoreOptions {
  storage: KeyValueStorage;
  /** Default `snapie_content_filters`. */
  storageKey?: string;
  /** Returns the old hashtag-only list (`string[]`) to migrate on first run. */
  readLegacyTags?: () => unknown | Promise<unknown>;
  catalog?: PresetCatalog;
  /** Debounce for uploading changes, ms. Default 800. */
  saveDelayMs?: number;
  onError?: (err: unknown) => void;
}

interface Persisted {
  prefs: ContentFilterPrefs;
  /** Account this device last synced with. null = never synced. */
  syncedFor: string | null;
}

export interface ContentFilterStore {
  getState(): ContentFilterState;
  /** The pristine pre-hydration state. Use it as React's server snapshot so
   *  SSR'd markup matches the client's hydration render (web only). */
  getServerState(): ContentFilterState;
  subscribe(listener: () => void): () => void;
  hydrate(): Promise<void>;
  /** Start (username + remote) or stop (null) syncing with the server. */
  setSyncUser(username: string | null, remote?: ContentFilterRemote | null): Promise<void>;
  setCatalog(catalog: PresetCatalog): void;
  addRule(rule: MuteRule): void;
  removeRule(rule: MuteRule): void;
  setPreset(id: string, enabled: boolean): void;
  /** Uploads any pending change now (e.g. on app background). */
  flush(): Promise<void>;
}

export function createContentFilterStore(opts: ContentFilterStoreOptions): ContentFilterStore {
  const key = opts.storageKey ?? 'snapie_content_filters';
  const saveDelay = opts.saveDelayMs ?? 800;
  const onError = opts.onError ?? (() => {});

  let syncedFor: string | null = null;
  let remote: ContentFilterRemote | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let hydratePromise: Promise<void> | null = null;
  let syncGen = 0;
  // Account whose server copy has been loaded and merged into `state.prefs`.
  // Uploads are only allowed for that account: uploading before the merge
  // would overwrite rules saved from other devices with this device's copy.
  let mergedFor: string | null = null;
  // In-flight load+merge for the current sync generation, so edits during a
  // load (or after a failed one) don't start a second.
  let reconciling: Promise<void> | null = null;
  const listeners = new Set<() => void>();

  const build = (prefs: ContentFilterPrefs, catalog: PresetCatalog, patch: Partial<ContentFilterState> = {}): ContentFilterState => ({
    ...state,
    ...patch,
    prefs,
    catalog,
    filter: createContentFilter(prefs, catalog),
    fingerprint: prefsFingerprint(prefs),
  });

  const initialCatalog = opts.catalog ?? DEFAULT_PRESETS;
  let state: ContentFilterState = {
    prefs: emptyPrefs(),
    catalog: initialCatalog,
    filter: () => false,
    fingerprint: prefsFingerprint(emptyPrefs()),
    hydrated: false,
    syncUser: null,
  };
  const serverState = state;

  const emit = () => listeners.forEach(l => l());

  const set = (next: ContentFilterState) => {
    // Keep the same object (and filter identity) when nothing visible changed,
    // so consumers don't refetch.
    if (
      next.fingerprint === state.fingerprint &&
      next.catalog === state.catalog &&
      next.hydrated === state.hydrated &&
      next.syncUser === state.syncUser &&
      next.prefs.updatedAt === state.prefs.updatedAt
    ) return;
    state = next;
    emit();
  };

  const persist = async () => {
    const body: Persisted = { prefs: state.prefs, syncedFor };
    try {
      await opts.storage.setItem(key, JSON.stringify(body));
    } catch (err) {
      onError(err);
    }
  };

  const pushNow = async () => {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (!remote || !state.syncUser || mergedFor !== state.syncUser) return;
    const user = state.syncUser;
    try {
      const newer = await remote.save(state.prefs);
      if (state.syncUser === user) {
        syncedFor = user;
        if (newer) set(build(newer, state.catalog));
        await persist();
      }
    } catch (err) {
      onError(err);
    }
  };

  const schedulePush = () => {
    if (!remote || !state.syncUser) return;
    if (mergedFor !== state.syncUser) {
      // Not merged yet: a load is in flight (its merge will pick this edit up
      // and upload it) or the last one failed (retry it, which uploads after
      // merging). Never upload an unmerged copy.
      if (!reconciling) void reconcile(syncGen);
      return;
    }
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { void pushNow(); }, saveDelay);
  };

  const mutate = (fn: (p: ContentFilterPrefs) => ContentFilterPrefs) => {
    const next = fn(state.prefs);
    if (next === state.prefs) return;
    set(build(next, state.catalog));
    void persist();
    schedulePush();
  };

  const hydrate = () => {
    if (!hydratePromise) {
      hydratePromise = (async () => {
        let prefs: ContentFilterPrefs | null = null;
        try {
          const raw = await opts.storage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw) as Partial<Persisted>;
            prefs = sanitizePrefs(parsed.prefs);
            syncedFor = typeof parsed.syncedFor === 'string' ? parsed.syncedFor : null;
          }
        } catch (err) {
          onError(err);
        }
        if (!prefs && opts.readLegacyTags) {
          try {
            prefs = fromLegacyTags(await opts.readLegacyTags());
          } catch (err) {
            onError(err);
          }
        }
        // Keep anything the user changed while storage was being read.
        const base = prefs ?? emptyPrefs();
        const merged = state.prefs.updatedAt > base.updatedAt ? state.prefs : base;
        set(build(merged, state.catalog, { hydrated: true }));
        if (prefs || merged !== base) void persist();
      })();
    }
    return hydratePromise;
  };

  /** Loads the server copy for the current account, merges it into local
   *  state, and uploads the result if it differs. Sets `mergedFor` only once
   *  the merge has happened; on failure uploads stay blocked until a retry. */
  const reconcile = (gen: number): Promise<void> => {
    const run = (async () => {
      const user = state.syncUser;
      const r = remote;
      if (!user || !r) return;
      await hydrate();
      let server: ContentFilterPrefs | null;
      try {
        server = await r.load();
      } catch (err) {
        onError(err);
        return; // stay local-only; the next edit retries the load
      }
      if (gen !== syncGen) return; // user switched while loading

      let merged: ContentFilterPrefs;
      if (syncedFor !== null && syncedFor !== user) {
        // Device last synced a different account: never carry that account's
        // rules over. Take this account's own copy, or start empty.
        merged = server ?? emptyPrefs();
      } else if (!server) {
        merged = state.prefs;
      } else if (syncedFor === null) {
        merged = mergePrefs(state.prefs, server, { firstSync: true });
      } else {
        merged = mergePrefs(state.prefs, server, { firstSync: false });
      }

      set(build(merged, state.catalog));
      mergedFor = user;
      const needsUpload = server
        ? !samePrefs(merged, server) || merged.updatedAt !== server.updatedAt
        : merged.rules.length > 0 || merged.presets.length > 0;
      if (needsUpload) {
        await pushNow();
      } else {
        syncedFor = user;
        await persist();
      }
    })();
    reconciling = run;
    void run.finally(() => { if (reconciling === run) reconciling = null; });
    return run;
  };

  const setSyncUser = async (username: string | null, nextRemote: ContentFilterRemote | null = null) => {
    const user = username ? username.toLowerCase() : null;
    // Don't drop a change that was still waiting to upload for the old account.
    if (saveTimer) await pushNow();
    const gen = ++syncGen;
    mergedFor = null;
    reconciling = null;
    remote = user ? nextRemote : null;
    set({ ...state, syncUser: user && remote ? user : null });
    if (!user || !remote) return;
    await reconcile(gen);
  };

  return {
    getState: () => state,
    getServerState: () => serverState,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    hydrate,
    setSyncUser,
    setCatalog(catalog) {
      set(build(state.prefs, catalog));
    },
    addRule: rule => mutate(p => addRuleTo(p, rule)),
    removeRule: rule => mutate(p => removeRuleFrom(p, rule)),
    setPreset: (id, enabled) => mutate(p => setPresetOn(p, id, enabled)),
    flush: pushNow,
  };
}
