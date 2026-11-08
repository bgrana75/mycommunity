import { describe, expect, it } from 'vitest';
import { compileFilter, createContentFilter } from './matcher';
import { extractBodyHashtags, extractSignals, normalizeApp } from './normalize';
import { GAMES_PRESET } from './presets';

const snap = (meta: unknown, body = '') => ({
  json_metadata: typeof meta === 'string' ? meta : JSON.stringify(meta),
  body,
});

describe('signals', () => {
  it('strips app version and lowercases', () => {
    expect(normalizeApp('HiveSuite/0.1.262')).toBe('hivesuite');
    expect(normalizeApp(undefined)).toBe('');
  });

  it('accepts string or object metadata and never throws', () => {
    expect(extractSignals({ json_metadata: { app: 'x/1', tags: ['A'] } })).toEqual({ app: 'x', tags: new Set(['a']) });
    expect(extractSignals({ json_metadata: '{not json' })).toEqual({ app: '', tags: new Set() });
    expect(extractSignals({ json_metadata: '[1,2]' })).toEqual({ app: '', tags: new Set() });
    expect(extractSignals({})).toEqual({ app: '', tags: new Set() });
  });

  it('reads body hashtags but not anchors, URLs, entities or headings', () => {
    expect(extractBodyHashtags('Streak 8 #HiveWord https://hiveword.xyz')).toEqual(['hiveword']);
    expect(extractBodyHashtags('see page#anchor and https://x.com/#/r &#123; ## Heading #1')).toEqual([]);
    expect(extractBodyHashtags('(#scroddle) #a-b_c')).toEqual(['scroddle', 'a-b_c']);
  });
});

describe('compileFilter', () => {
  it('hides nothing with no rules', () => {
    expect(compileFilter([])(snap({ app: 'hiveword', tags: ['hiveword'] }))).toBe(false);
  });

  it('tag rules match metadata tags and body hashtags', () => {
    const f = compileFilter([{ kind: 'tag', tag: '#ScrobbleLife' }]);
    expect(f(snap({ tags: ['scrobblelife'] }))).toBe(true);
    expect(f(snap({ tags: [] }, 'listening now #scrobblelife'))).toBe(true);
    expect(f(snap({ tags: ['music'] }))).toBe(false);
  });

  it('app rules match without tags (pizzabot has none)', () => {
    const f = compileFilter([{ kind: 'app', app: 'pizzabot' }]);
    expect(f(snap({ app: 'pizzabot' }))).toBe(true);
    expect(f(snap({ app: 'peakd/2026.1' }))).toBe(false);
  });

  it('app_tag rules only hit that app', () => {
    const f = compileFilter([{ kind: 'app_tag', app: 'hivesuite', tag: 'hivegaming' }]);
    expect(f(snap({ app: 'hivesuite/0.1.262', tags: ['hivesuite', 'hivegaming', 'scratchcard'] }))).toBe(true);
    expect(f(snap({ app: 'hivesuite/0.1.262', tags: ['hivesuite', 'hivesnaps'] }))).toBe(false);
    expect(f(snap({ app: 'peakd', tags: ['hivegaming'] }))).toBe(false);
  });
});

describe('games preset on real sampled snaps', () => {
  const games = createContentFilter({ rules: [], presets: ['games'] });
  const hidden = [
    snap({ app: 'hiveword', format: 'markdown', tags: ['snaps', 'hiveword'] }, 'HiveWord 2026-11-05 5/6 ⬛🟩 #hiveword'),
    snap({ app: 'hivegrove/1.0', tags: ['hivegrove', 'snaps'] }, '🌳 My Pine Tree grew!'),
    snap({ app: 'mydempire/1.0', tags: ['mydempire', 'dailyreport'] }, '## MydEmpire Daily Empire Report'),
    snap({ app: 'hivesuite/0.1.260', tags: ['hivesuite', 'dailyrewards', 'hivegaming', 'scratchcard'] }),
    snap({ app: 'hivesuite/0.1.258', tags: ['hivesuite', 'cardgame', 'hivegaming', 'poker', 'videopoker'] }),
    snap({ app: 'zingit/1.0', tags: ['scrobblelife', 'scroddle'] }, 'Scroddle TV #180 · 5/7'),
    snap({ app: 'zingit/1.0', tags: ['scrobblelife', 'holohover'] }),
    snap({ app: 'zingit/1.0', tags: ['scrobblelife', 'pinnacle'] }),
    // A reshare of a game result from a general client still carries the tag.
    snap({ app: 'ecency/3.2', tags: ['hiveword'] }),
  ];
  const kept = [
    snap({ app: 'hivesuite/0.1.260', tags: ['hivesuite', 'hivesnaps', 'hive-185924'] }, 'week of hardware failures'),
    snap({ app: 'zingit/1.0', tags: ['scrobblelife', 'tvshow'] }, '📺 The Mentalist · 80/100'),
    snap({ app: 'zingit/1.0', tags: ['scrobblelife', 'music'] }),
    snap({ app: 'peakd/2026', tags: ['pinnacle'] }, 'reached the pinnacle'),
    snap({ app: 'ecency/3.2', tags: ['hive-125125'] }, 'Good morning snappers'),
  ];

  it('hides game results', () => hidden.forEach(s => expect(games(s)).toBe(true)));
  it('keeps normal snaps from the same apps', () => kept.forEach(s => expect(games(s)).toBe(false)));
  it('ignores unknown preset ids', () => {
    expect(createContentFilter({ rules: [], presets: ['retired'] })(hidden[0])).toBe(false);
  });
  it('has no duplicate rules', () => {
    const keys = GAMES_PRESET.rules.map(r => JSON.stringify(r));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
