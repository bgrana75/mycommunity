import { sanitizePrefs, sanitizeRule } from './prefs';
import type { ContentFilterPrefs, FilterPreset, MuteRule, PresetCatalog } from './types';

/** Endpoints served by snapie.io. HiveSnaps calls the same ones with
 *  `baseUrl: 'https://snapie.io'`. */
export const CONTENT_FILTER_PATHS = {
  prefs: '/api/user/content-filters',
  presets: '/api/content-filters/presets',
} as const;

/** Makes a request and returns the Response, or null when it couldn't be sent
 *  (e.g. no auth token and the user declined to sign). Each app plugs in its
 *  own auth here: snapie.io wraps `authenticatedFetch`, HiveSnaps signs the
 *  `/api/chat/auth` challenge with the stored posting key and adds
 *  `Authorization: Bearer <jwt>`. */
export type AuthedRequest = (path: string, init: RequestInit) => Promise<Response | null>;

export interface ContentFilterRemote {
  /** null = the account has no server copy yet. Throws on transport errors. */
  load(): Promise<ContentFilterPrefs | null>;
  /** Returns the server's copy when it rejected the write as stale (another
   *  device changed filters more recently), otherwise null. */
  save(prefs: ContentFilterPrefs): Promise<ContentFilterPrefs | null>;
}

/** Remote adapter for the logged-in user's prefs. */
export function createContentFilterRemote(request: AuthedRequest): ContentFilterRemote {
  return {
    async load() {
      const res = await request(CONTENT_FILTER_PATHS.prefs, { method: 'GET' });
      if (!res) throw new Error('content-filter: not authenticated');
      if (!res.ok) throw new Error(`content-filter: load failed (${res.status})`);
      const body = (await res.json()) as { prefs?: unknown };
      return body.prefs ? sanitizePrefs(body.prefs) : null;
    },
    async save(prefs) {
      const res = await request(CONTENT_FILTER_PATHS.prefs, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefs }),
      });
      if (!res) throw new Error('content-filter: not authenticated');
      if (!res.ok) throw new Error(`content-filter: save failed (${res.status})`);
      const body = (await res.json().catch(() => ({}))) as { applied?: boolean; prefs?: unknown };
      return body.applied === false && body.prefs ? sanitizePrefs(body.prefs) : null;
    },
  };
}

/** Validates a preset catalog from the network. Drops malformed presets. */
export function sanitizeCatalog(raw: unknown): PresetCatalog | null {
  if (!raw || typeof raw !== 'object') return null;
  const list = Array.isArray(raw) ? raw : Object.values(raw as Record<string, unknown>);
  const out: PresetCatalog = {};
  for (const p of list) {
    if (!p || typeof p !== 'object') continue;
    const { id, label, description, rules } = p as Record<string, unknown>;
    if (typeof id !== 'string' || typeof label !== 'string' || !Array.isArray(rules)) continue;
    out[id] = {
      id,
      label,
      description: typeof description === 'string' ? description : '',
      rules: rules.map(sanitizeRule).filter((r): r is MuteRule => r !== null),
    } satisfies FilterPreset;
  }
  return Object.keys(out).length ? out : null;
}

/** Public, unauthenticated. `fetchImpl` defaults to global fetch. */
export async function fetchPresetCatalog(baseUrl = '', fetchImpl: typeof fetch = fetch): Promise<PresetCatalog | null> {
  try {
    const res = await fetchImpl(`${baseUrl}${CONTENT_FILTER_PATHS.presets}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { presets?: unknown };
    return sanitizeCatalog(body.presets);
  } catch {
    return null;
  }
}
