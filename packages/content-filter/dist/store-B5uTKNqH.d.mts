/** Hive's condenser/database APIs return json_metadata as a raw JSON string;
 *  bridge_api returns it pre-parsed. Callers can pass either. */
type JsonMetadata = string | Record<string, unknown> | null | undefined;
/** The bits of a Hive post/comment/snap/wave the filter looks at. Any Hive
 *  content object satisfies this structurally. */
interface FilterableContent {
    json_metadata?: JsonMetadata;
    body?: string | null;
}
/** One reason to hide content.
 *  - `tag`: matches `json_metadata.tags` *and* `#hashtags` written in the body.
 *  - `app`: matches `json_metadata.app`, ignoring any `/version` suffix
 *    (`hivesuite/0.1.262` → `hivesuite`).
 *  - `app_tag`: both at once. For apps that post games *and* normal content
 *    (HiveSuite scratchcards, Zingit's Scroddle). */
type MuteRule = {
    kind: 'tag';
    tag: string;
} | {
    kind: 'app';
    app: string;
} | {
    kind: 'app_tag';
    app: string;
    tag: string;
};
/** A named, curated bundle of rules ("Hide game results"). The list can be
 *  refreshed from the server so new games don't need an app release. */
interface FilterPreset {
    id: string;
    label: string;
    description: string;
    rules: MuteRule[];
}
type PresetCatalog = Record<string, FilterPreset>;
/** Everything a user has chosen to hide. This is the shape that is persisted
 *  locally and synced to the server. */
interface ContentFilterPrefs {
    /** Schema version, for future migrations. */
    v: 1;
    rules: MuteRule[];
    /** Preset ids the user switched on (e.g. `["games"]`). */
    presets: string[];
    /** ms epoch of the last user change. Used for last-write-wins sync. 0 means
     *  "never changed" (fresh defaults). */
    updatedAt: number;
}

type ContentFilter = (item: FilterableContent) => boolean;
/** Every rule in effect: the user's own plus those of each enabled preset.
 *  Unknown preset ids are ignored (e.g. a preset retired on the server). */
declare function effectiveRules(prefs: Pick<ContentFilterPrefs, 'rules' | 'presets'>, catalog?: PresetCatalog): MuteRule[];
/** Compiles rules into a fast predicate: `true` means hide the item. Build it
 *  once per prefs change, then call it per item. Never throws. */
declare function compileFilter(rules: MuteRule[]): ContentFilter;
/** Convenience: prefs + catalog → predicate. */
declare function createContentFilter(prefs: Pick<ContentFilterPrefs, 'rules' | 'presets'>, catalog?: PresetCatalog): ContentFilter;

/** Endpoints served by snapie.io. HiveSnaps calls the same ones with
 *  `baseUrl: 'https://snapie.io'`. */
declare const CONTENT_FILTER_PATHS: {
    readonly prefs: "/api/user/content-filters";
    readonly presets: "/api/content-filters/presets";
};
/** Makes a request and returns the Response, or null when it couldn't be sent
 *  (e.g. no auth token and the user declined to sign). Each app plugs in its
 *  own auth here: snapie.io wraps `authenticatedFetch`, HiveSnaps signs the
 *  `/api/chat/auth` challenge with the stored posting key and adds
 *  `Authorization: Bearer <jwt>`. */
type AuthedRequest = (path: string, init: RequestInit) => Promise<Response | null>;
interface ContentFilterRemote {
    /** null = the account has no server copy yet. Throws on transport errors. */
    load(): Promise<ContentFilterPrefs | null>;
    /** Returns the server's copy when it rejected the write as stale (another
     *  device changed filters more recently), otherwise null. */
    save(prefs: ContentFilterPrefs): Promise<ContentFilterPrefs | null>;
}
/** Remote adapter for the logged-in user's prefs. */
declare function createContentFilterRemote(request: AuthedRequest): ContentFilterRemote;
/** Validates a preset catalog from the network. Drops malformed presets. */
declare function sanitizeCatalog(raw: unknown): PresetCatalog | null;
/** Public, unauthenticated. `fetchImpl` defaults to global fetch. */
declare function fetchPresetCatalog(baseUrl?: string, fetchImpl?: typeof fetch): Promise<PresetCatalog | null>;

/** localStorage (sync) and AsyncStorage (async) both fit. */
interface KeyValueStorage {
    getItem(key: string): string | null | Promise<string | null>;
    setItem(key: string, value: string): void | Promise<void>;
}
interface ContentFilterState {
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
interface ContentFilterStoreOptions {
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
interface ContentFilterStore {
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
declare function createContentFilterStore(opts: ContentFilterStoreOptions): ContentFilterStore;

export { type AuthedRequest as A, type ContentFilterPrefs as C, type FilterableContent as F, type JsonMetadata as J, type KeyValueStorage as K, type MuteRule as M, type PresetCatalog as P, type FilterPreset as a, createContentFilter as b, compileFilter as c, type ContentFilter as d, effectiveRules as e, CONTENT_FILTER_PATHS as f, createContentFilterRemote as g, fetchPresetCatalog as h, type ContentFilterRemote as i, createContentFilterStore as j, type ContentFilterState as k, type ContentFilterStore as l, type ContentFilterStoreOptions as m, sanitizeCatalog as s };
