import { describe, expect, it } from 'vitest';
import {
  addRule, emptyPrefs, fromLegacyTags, MAX_RULES, mergePrefs, prefsFingerprint,
  removeRule, sanitizePrefs, setPreset, suggestRules,
} from './prefs';
import type { ContentFilterPrefs } from './types';

const P = (over: Partial<ContentFilterPrefs> = {}): ContentFilterPrefs => ({ ...emptyPrefs(), ...over });

describe('sanitizePrefs', () => {
  it('rejects non-prefs', () => {
    expect(sanitizePrefs(null)).toBeNull();
    expect(sanitizePrefs({ rules: 'x', presets: [] })).toBeNull();
  });

  it('normalizes, drops bad rules, dedupes, caps', () => {
    const out = sanitizePrefs({
      rules: [
        { kind: 'tag', tag: '#Foo' }, { kind: 'tag', tag: 'foo' }, { kind: 'app', app: 'HiveWord/1.0' },
        { kind: 'nope' }, { kind: 'tag', tag: '' }, { kind: 'tag', tag: 'x'.repeat(65) }, { kind: 'tag', tag: 'a\u0000b' },
        { kind: 'app_tag', app: 'zingit', tag: 'Scroddle' }, { kind: 'app_tag', app: 'zingit' },
      ],
      presets: ['games', 'games', 'BAD ID', 7],
      updatedAt: -5,
    });
    expect(out).toEqual({
      v: 1,
      rules: [{ kind: 'tag', tag: 'foo' }, { kind: 'app', app: 'hiveword' }, { kind: 'app_tag', app: 'zingit', tag: 'scroddle' }],
      presets: ['games'],
      updatedAt: 0,
    });
    const many = sanitizePrefs({ rules: Array.from({ length: MAX_RULES + 10 }, (_, i) => ({ kind: 'tag', tag: `t${i}` })), presets: [] });
    expect(many!.rules).toHaveLength(MAX_RULES);
  });
});

describe('editing', () => {
  it('add/remove/preset bump updatedAt only on change', () => {
    const a = addRule(P(), { kind: 'tag', tag: '#X' }, 10);
    expect(a.rules).toEqual([{ kind: 'tag', tag: 'x' }]);
    expect(addRule(a, { kind: 'tag', tag: 'x' }, 20)).toBe(a);
    expect(removeRule(a, { kind: 'tag', tag: 'X' }, 30)).toEqual(P({ updatedAt: 30 }));
    expect(removeRule(a, { kind: 'tag', tag: 'y' }, 30)).toBe(a);
    const g = setPreset(a, 'games', true, 40);
    expect(g.presets).toEqual(['games']);
    expect(setPreset(g, 'games', true, 50)).toBe(g);
    expect(setPreset(g, 'games', false, 60).presets).toEqual([]);
  });

  it('fingerprint ignores order and updatedAt', () => {
    const a = P({ rules: [{ kind: 'tag', tag: 'a' }, { kind: 'app', app: 'b' }], presets: ['games'], updatedAt: 1 });
    const b = P({ rules: [{ kind: 'app', app: 'b' }, { kind: 'tag', tag: 'a' }], presets: ['games'], updatedAt: 9 });
    expect(prefsFingerprint(a)).toBe(prefsFingerprint(b));
  });

  it('migrates legacy tag lists', () => {
    expect(fromLegacyTags(['#ScrobbleLife', 'scrobblelife', 3, ''], 5)).toEqual(P({ rules: [{ kind: 'tag', tag: 'scrobblelife' }], updatedAt: 5 }));
    expect(fromLegacyTags(undefined)).toEqual(P());
  });
});

describe('mergePrefs', () => {
  const local = P({ rules: [{ kind: 'tag', tag: 'a' }], presets: [], updatedAt: 100 });
  const remote = P({ rules: [{ kind: 'tag', tag: 'b' }], presets: ['games'], updatedAt: 50 });

  it('keeps local when server has nothing', () => expect(mergePrefs(local, null, { firstSync: true })).toBe(local));
  it('unions on first sync', () => {
    expect(mergePrefs(local, remote, { firstSync: true })).toEqual(P({
      rules: [{ kind: 'tag', tag: 'b' }, { kind: 'tag', tag: 'a' }], presets: ['games'], updatedAt: 100,
    }));
  });
  it('last write wins afterwards, server wins ties', () => {
    expect(mergePrefs(local, remote, { firstSync: false })).toBe(local);
    expect(mergePrefs({ ...local, updatedAt: 10 }, remote, { firstSync: false })).toBe(remote);
    expect(mergePrefs({ ...local, updatedAt: 50 }, remote, { firstSync: false })).toBe(remote);
  });
});

describe('suggestRules', () => {
  it('offers app, specific tags, and app-scoped tags; skips generic ones', () => {
    const s = suggestRules({ json_metadata: { app: 'zingit/1.0', tags: ['scrobblelife', 'scroddle', 'snaps', 'hive-197333'] } });
    expect(s.map(x => x.label)).toEqual(['Everything from zingit', '#scrobblelife', '#scroddle', '#scrobblelife from zingit', '#scroddle from zingit']);
  });
  it('never offers app-wide rules for general clients', () => {
    const s = suggestRules({ json_metadata: { app: 'peakd/2026.1', tags: ['scroddle'] } });
    expect(s.map(x => x.rule)).toEqual([{ kind: 'tag', tag: 'scroddle' }]);
    expect(suggestRules({ json_metadata: { app: 'snapie/1', tags: ['snaps'] } })).toEqual([]);
  });

  it('works with no app', () => {
    expect(suggestRules({ json_metadata: { tags: ['foo'] } }).map(x => x.rule)).toEqual([{ kind: 'tag', tag: 'foo' }]);
  });
});
