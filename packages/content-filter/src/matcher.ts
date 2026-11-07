import { extractSignals, normalizeApp, normalizeTag } from './normalize';
import { DEFAULT_PRESETS } from './presets';
import type { ContentFilterPrefs, FilterableContent, MuteRule, PresetCatalog } from './types';

export type ContentFilter = (item: FilterableContent) => boolean;

/** Every rule in effect: the user's own plus those of each enabled preset.
 *  Unknown preset ids are ignored (e.g. a preset retired on the server). */
export function effectiveRules(prefs: Pick<ContentFilterPrefs, 'rules' | 'presets'>, catalog: PresetCatalog = DEFAULT_PRESETS): MuteRule[] {
  const out = [...prefs.rules];
  for (const id of prefs.presets) {
    const preset = catalog[id];
    if (preset) out.push(...preset.rules);
  }
  return out;
}

/** Compiles rules into a fast predicate: `true` means hide the item. Build it
 *  once per prefs change, then call it per item. Never throws. */
export function compileFilter(rules: MuteRule[]): ContentFilter {
  const tags = new Set<string>();
  const apps = new Set<string>();
  const appTags = new Map<string, Set<string>>();

  for (const r of rules) {
    if (r.kind === 'tag') {
      const t = normalizeTag(r.tag);
      if (t) tags.add(t);
    } else if (r.kind === 'app') {
      const a = normalizeApp(r.app);
      if (a) apps.add(a);
    } else if (r.kind === 'app_tag') {
      const a = normalizeApp(r.app);
      const t = normalizeTag(r.tag);
      if (!a || !t) continue;
      let set = appTags.get(a);
      if (!set) appTags.set(a, (set = new Set()));
      set.add(t);
    }
  }

  if (tags.size === 0 && apps.size === 0 && appTags.size === 0) return () => false;

  return (item) => {
    if (!item) return false;
    const { app, tags: itemTags } = extractSignals(item);
    if (app && apps.has(app)) return true;
    const scoped = app ? appTags.get(app) : undefined;
    for (const t of itemTags) {
      if (tags.has(t)) return true;
      if (scoped?.has(t)) return true;
    }
    return false;
  };
}

/** Convenience: prefs + catalog → predicate. */
export function createContentFilter(prefs: Pick<ContentFilterPrefs, 'rules' | 'presets'>, catalog: PresetCatalog = DEFAULT_PRESETS): ContentFilter {
  return compileFilter(effectiveRules(prefs, catalog));
}
