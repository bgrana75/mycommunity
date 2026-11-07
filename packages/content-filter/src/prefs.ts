import { extractSignals, normalizeApp, normalizeTag } from './normalize';
import type { ContentFilterPrefs, FilterableContent, MuteRule } from './types';

export const MAX_RULES = 500;
const MAX_FIELD = 64;
const PRESET_ID = /^[a-z0-9_-]{1,32}$/;
// Printable, no control chars. Apps can contain spaces ("Skatehive App 3.0").
const SAFE_TEXT = /^[^\u0000-\u001f\u007f]+$/;

export function emptyPrefs(): ContentFilterPrefs {
  return { v: 1, rules: [], presets: [], updatedAt: 0 };
}

/** Stable identity for a rule, used to de-duplicate and compare. */
export function ruleKey(r: MuteRule): string {
  if (r.kind === 'tag') return `tag:${r.tag}`;
  if (r.kind === 'app') return `app:${r.app}`;
  return `app_tag:${r.app}:${r.tag}`;
}

function cleanField(raw: unknown, normalize: (v: unknown) => string): string | null {
  if (typeof raw !== 'string') return null;
  const v = normalize(raw);
  if (!v || v.length > MAX_FIELD || !SAFE_TEXT.test(v)) return null;
  return v;
}

/** Returns a normalized rule, or null if it's malformed. */
export function sanitizeRule(raw: unknown): MuteRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.kind === 'tag') {
    const tag = cleanField(r.tag, normalizeTag);
    return tag ? { kind: 'tag', tag } : null;
  }
  if (r.kind === 'app') {
    const app = cleanField(r.app, normalizeApp);
    return app ? { kind: 'app', app } : null;
  }
  if (r.kind === 'app_tag') {
    const app = cleanField(r.app, normalizeApp);
    const tag = cleanField(r.tag, normalizeTag);
    return app && tag ? { kind: 'app_tag', app, tag } : null;
  }
  return null;
}

function dedupeRules(rules: MuteRule[]): MuteRule[] {
  const seen = new Set<string>();
  const out: MuteRule[] = [];
  for (const r of rules) {
    const k = ruleKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out.slice(0, MAX_RULES);
}

/** Validates untrusted input (a request body, a storage blob) into prefs.
 *  Returns null when it isn't prefs-shaped at all; drops individual bad rules. */
export function sanitizePrefs(raw: unknown): ContentFilterPrefs | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (!Array.isArray(p.rules) || !Array.isArray(p.presets)) return null;
  const rules = dedupeRules(p.rules.map(sanitizeRule).filter((r): r is MuteRule => r !== null));
  const presets = [...new Set(p.presets.filter((id): id is string => typeof id === 'string' && PRESET_ID.test(id)))];
  const updatedAt = typeof p.updatedAt === 'number' && Number.isFinite(p.updatedAt) && p.updatedAt >= 0 ? p.updatedAt : 0;
  return { v: 1, rules, presets, updatedAt };
}

/** Turns a legacy `mutedTags: string[]` list (snapie.io `snapie_user_settings`,
 *  HiveSnaps `hivesnaps_muted_tags`) into tag rules. */
export function fromLegacyTags(tags: unknown, now = Date.now()): ContentFilterPrefs {
  const list = Array.isArray(tags) ? tags : [];
  const rules = dedupeRules(
    list.map(t => sanitizeRule({ kind: 'tag', tag: t })).filter((r): r is MuteRule => r !== null),
  );
  return { v: 1, rules, presets: [], updatedAt: rules.length ? now : 0 };
}

export function hasRule(prefs: ContentFilterPrefs, rule: MuteRule): boolean {
  const k = ruleKey(rule);
  return prefs.rules.some(r => ruleKey(r) === k);
}

export function addRule(prefs: ContentFilterPrefs, raw: MuteRule, now = Date.now()): ContentFilterPrefs {
  const rule = sanitizeRule(raw);
  if (!rule || hasRule(prefs, rule) || prefs.rules.length >= MAX_RULES) return prefs;
  return { ...prefs, rules: [...prefs.rules, rule], updatedAt: now };
}

export function removeRule(prefs: ContentFilterPrefs, raw: MuteRule, now = Date.now()): ContentFilterPrefs {
  const rule = sanitizeRule(raw);
  if (!rule) return prefs;
  const k = ruleKey(rule);
  const rules = prefs.rules.filter(r => ruleKey(r) !== k);
  return rules.length === prefs.rules.length ? prefs : { ...prefs, rules, updatedAt: now };
}

export function setPreset(prefs: ContentFilterPrefs, id: string, enabled: boolean, now = Date.now()): ContentFilterPrefs {
  if (!PRESET_ID.test(id)) return prefs;
  const has = prefs.presets.includes(id);
  if (has === enabled) return prefs;
  const presets = enabled ? [...prefs.presets, id] : prefs.presets.filter(p => p !== id);
  return { ...prefs, presets, updatedAt: now };
}

/** Order-insensitive identity of what's being filtered. Use it as a React
 *  effect dependency to refetch when filters change. Ignores updatedAt. */
export function prefsFingerprint(prefs: Pick<ContentFilterPrefs, 'rules' | 'presets'>): string {
  const rules = prefs.rules.map(ruleKey).sort();
  const presets = [...prefs.presets].sort();
  return JSON.stringify([presets, rules]);
}

export function samePrefs(a: ContentFilterPrefs, b: ContentFilterPrefs): boolean {
  return prefsFingerprint(a) === prefsFingerprint(b);
}

/** Reconciles this device's prefs with the server copy.
 *  - No server copy yet → keep local (caller should upload it).
 *  - `firstSync` (this device has never synced for this account) → union, so
 *    nobody loses mutes they set on a device before sync existed.
 *  - Otherwise → last write wins by updatedAt (server wins ties). */
export function mergePrefs(
  local: ContentFilterPrefs,
  remote: ContentFilterPrefs | null,
  opts: { firstSync: boolean },
): ContentFilterPrefs {
  if (!remote) return local;
  if (opts.firstSync) {
    return {
      v: 1,
      rules: dedupeRules([...remote.rules, ...local.rules]),
      presets: [...new Set([...remote.presets, ...local.presets])],
      updatedAt: Math.max(local.updatedAt, remote.updatedAt),
    };
  }
  return local.updatedAt > remote.updatedAt ? local : remote;
}

export interface RuleSuggestion {
  rule: MuteRule;
  /** Human label, e.g. "Everything from hiveword" or "#scroddle". */
  label: string;
}

/** Rules a "Hide posts like this" menu can offer for a specific item: its app,
 *  its app scoped to each tag, and each tag on its own. Generic tags that are
 *  on nearly every snap are left out. */
const GENERIC_TAGS = new Set(['snaps', 'hivesnaps', 'waves', 'hive', 'snapie', 'leofinance', 'neoxian', 'peakd', 'ecency']);

/** General-purpose Hive clients. Hiding "everything from" one of these would
 *  wipe out most of a feed, so suggestions never offer app-wide or app-scoped
 *  rules for them, only the post's own tags. */
export const GENERAL_CLIENTS = new Set([
  'snapie', 'hivesnaps', 'peakd', 'ecency', 'hiveblog', 'hive.blog', 'leofinance', 'inleo', 'waves',
  '3speak', 'mycommunity-mobile', 'actifit', 'liketu', 'stemgeeks', 'sportsblock', 'skatehive app 3.0',
  'skatehive', 'hivesigner', 'condenser', 'steemit', 'esteem', 'flexus',
]);

export function suggestRules(item: FilterableContent, opts: { maxTags?: number } = {}): RuleSuggestion[] {
  const signals = extractSignals(item);
  const tags = signals.tags;
  const app = GENERAL_CLIENTS.has(signals.app) ? '' : signals.app;
  const maxTags = opts.maxTags ?? 4;
  const specific = [...tags].filter(t => !GENERIC_TAGS.has(t) && !/^hive-\d+$/.test(t) && t !== app).slice(0, maxTags);
  const out: RuleSuggestion[] = [];
  if (app) out.push({ rule: { kind: 'app', app }, label: `Everything from ${app}` });
  for (const tag of specific) out.push({ rule: { kind: 'tag', tag }, label: `#${tag}` });
  if (app) {
    for (const tag of specific) out.push({ rule: { kind: 'app_tag', app, tag }, label: `#${tag} from ${app}` });
  }
  return out;
}

/** Short human description of a rule, for chips and lists. */
export function describeRule(r: MuteRule): string {
  if (r.kind === 'tag') return `#${r.tag}`;
  if (r.kind === 'app') return `App: ${r.app}`;
  return `#${r.tag} from ${r.app}`;
}
