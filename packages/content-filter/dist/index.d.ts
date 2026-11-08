import { F as FilterableContent, J as JsonMetadata, P as PresetCatalog, a as FilterPreset, C as ContentFilterPrefs, M as MuteRule } from './store-B5uTKNqH.js';
export { A as AuthedRequest, f as CONTENT_FILTER_PATHS, d as ContentFilter, i as ContentFilterRemote, k as ContentFilterState, l as ContentFilterStore, m as ContentFilterStoreOptions, K as KeyValueStorage, c as compileFilter, b as createContentFilter, g as createContentFilterRemote, j as createContentFilterStore, e as effectiveRules, h as fetchPresetCatalog, s as sanitizeCatalog } from './store-B5uTKNqH.js';

/** Canonical hashtag: trimmed, no leading `#`, lowercase. The rule editor and
 *  the matcher both use this, so they can never disagree. */
declare function normalizeTag(raw: unknown): string;
/** Canonical app id: lowercase, version suffix dropped
 *  (`HiveSuite/0.1.262` → `hivesuite`, `Skatehive App 3.0` → `skatehive app 3.0`). */
declare function normalizeApp(raw: unknown): string;
/** Parses json_metadata into an object. Never throws; anything unusable is `{}`. */
declare function parseMetadata(jsonMetadata: JsonMetadata): Record<string, unknown>;
declare function extractBodyHashtags(body: string | null | undefined): string[];
interface ContentSignals {
    /** Normalized app id, or '' when missing. */
    app: string;
    /** Metadata tags plus body hashtags, normalized and de-duplicated. */
    tags: Set<string>;
}
/** Pulls out what rules match against. Exposed so UIs can offer
 *  "Hide posts like this" built from a specific post's own app and tags. */
declare function extractSignals(item: FilterableContent): ContentSignals;

/** Built from sampling ~1,300 recent snaps/waves (Nov 2026). Rules that only
 *  hit one app's game posts, never its normal ones:
 *  - Single-purpose games (HiveGrove, MydEmpire, HiveWord) → whole-app rules,
 *    plus the game's own tag so reshares from other clients are caught too.
 *  - Multi-purpose apps (HiveSuite, Zingit) → app+tag only, because the same
 *    apps carry people's ordinary snaps, TV reviews, music, etc.
 *  Generic words (e.g. `pinnacle`, `poker`) are only ever app-scoped. */
declare const GAMES_PRESET: FilterPreset;
/** Bundled fallback. Apps should prefer a fresher catalog from the server
 *  (`GET /api/content-filters/presets`) and fall back to this offline. */
declare const DEFAULT_PRESETS: PresetCatalog;

declare const MAX_RULES = 500;
declare function emptyPrefs(): ContentFilterPrefs;
/** Stable identity for a rule, used to de-duplicate and compare. */
declare function ruleKey(r: MuteRule): string;
/** Returns a normalized rule, or null if it's malformed. */
declare function sanitizeRule(raw: unknown): MuteRule | null;
/** Validates untrusted input (a request body, a storage blob) into prefs.
 *  Returns null when it isn't prefs-shaped at all; drops individual bad rules. */
declare function sanitizePrefs(raw: unknown): ContentFilterPrefs | null;
/** Turns a legacy `mutedTags: string[]` list (snapie.io `snapie_user_settings`,
 *  HiveSnaps `hivesnaps_muted_tags`) into tag rules. */
declare function fromLegacyTags(tags: unknown, now?: number): ContentFilterPrefs;
declare function hasRule(prefs: ContentFilterPrefs, rule: MuteRule): boolean;
declare function addRule(prefs: ContentFilterPrefs, raw: MuteRule, now?: number): ContentFilterPrefs;
declare function removeRule(prefs: ContentFilterPrefs, raw: MuteRule, now?: number): ContentFilterPrefs;
declare function setPreset(prefs: ContentFilterPrefs, id: string, enabled: boolean, now?: number): ContentFilterPrefs;
/** Order-insensitive identity of what's being filtered. Use it as a React
 *  effect dependency to refetch when filters change. Ignores updatedAt. */
declare function prefsFingerprint(prefs: Pick<ContentFilterPrefs, 'rules' | 'presets'>): string;
declare function samePrefs(a: ContentFilterPrefs, b: ContentFilterPrefs): boolean;
/** Reconciles this device's prefs with the server copy.
 *  - No server copy yet → keep local (caller should upload it).
 *  - `firstSync` (this device has never synced for this account) → union, so
 *    nobody loses mutes they set on a device before sync existed.
 *  - Otherwise → last write wins by updatedAt (server wins ties). */
declare function mergePrefs(local: ContentFilterPrefs, remote: ContentFilterPrefs | null, opts: {
    firstSync: boolean;
}): ContentFilterPrefs;
interface RuleSuggestion {
    rule: MuteRule;
    /** Human label, e.g. "Everything from hiveword" or "#scroddle". */
    label: string;
}
/** General-purpose Hive clients. Hiding "everything from" one of these would
 *  wipe out most of a feed, so suggestions never offer app-wide or app-scoped
 *  rules for them, only the post's own tags. */
declare const GENERAL_CLIENTS: Set<string>;
declare function suggestRules(item: FilterableContent, opts?: {
    maxTags?: number;
}): RuleSuggestion[];
/** Short human description of a rule, for chips and lists. */
declare function describeRule(r: MuteRule): string;

export { ContentFilterPrefs, type ContentSignals, DEFAULT_PRESETS, FilterPreset, FilterableContent, GAMES_PRESET, GENERAL_CLIENTS, JsonMetadata, MAX_RULES, MuteRule, PresetCatalog, type RuleSuggestion, addRule, describeRule, emptyPrefs, extractBodyHashtags, extractSignals, fromLegacyTags, hasRule, mergePrefs, normalizeApp, normalizeTag, parseMetadata, prefsFingerprint, removeRule, ruleKey, samePrefs, sanitizePrefs, sanitizeRule, setPreset, suggestRules };
