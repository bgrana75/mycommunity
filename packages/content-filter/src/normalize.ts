import type { FilterableContent, JsonMetadata } from './types';

/** Canonical hashtag: trimmed, no leading `#`, lowercase. The rule editor and
 *  the matcher both use this, so they can never disagree. */
export function normalizeTag(raw: unknown): string {
  return String(raw ?? '').trim().replace(/^#+/, '').trim().toLowerCase();
}

/** Canonical app id: lowercase, version suffix dropped
 *  (`HiveSuite/0.1.262` → `hivesuite`, `Skatehive App 3.0` → `skatehive app 3.0`). */
export function normalizeApp(raw: unknown): string {
  return String(raw ?? '').split('/')[0].trim().toLowerCase();
}

/** Parses json_metadata into an object. Never throws; anything unusable is `{}`. */
export function parseMetadata(jsonMetadata: JsonMetadata): Record<string, unknown> {
  if (!jsonMetadata) return {};
  if (typeof jsonMetadata === 'object') return jsonMetadata;
  try {
    const parsed: unknown = JSON.parse(jsonMetadata);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

// A `#` that isn't glued to a word or URL (so `page#anchor` and
// `https://x.com/#/route` don't count), then a tag that starts with a letter.
const BODY_HASHTAG = /(?:^|[^\w/&#])#([a-z][\w-]{0,63})/gi;

export function extractBodyHashtags(body: string | null | undefined): string[] {
  if (!body) return [];
  const out = new Set<string>();
  for (const m of body.matchAll(BODY_HASHTAG)) out.add(m[1].toLowerCase());
  return [...out];
}

export interface ContentSignals {
  /** Normalized app id, or '' when missing. */
  app: string;
  /** Metadata tags plus body hashtags, normalized and de-duplicated. */
  tags: Set<string>;
}

/** Pulls out what rules match against. Exposed so UIs can offer
 *  "Hide posts like this" built from a specific post's own app and tags. */
export function extractSignals(item: FilterableContent): ContentSignals {
  const meta = parseMetadata(item.json_metadata);
  const tags = new Set<string>();
  if (Array.isArray(meta.tags)) {
    for (const t of meta.tags) {
      const n = normalizeTag(t);
      if (n) tags.add(n);
    }
  }
  for (const t of extractBodyHashtags(item.body)) tags.add(t);
  return { app: normalizeApp(meta.app), tags };
}
