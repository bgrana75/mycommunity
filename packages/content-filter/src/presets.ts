import type { FilterPreset, PresetCatalog } from './types';

/** Built from sampling ~1,300 recent snaps/waves (Nov 2026). Rules that only
 *  hit one app's game posts, never its normal ones:
 *  - Single-purpose games (HiveGrove, MydEmpire, HiveWord) → whole-app rules,
 *    plus the game's own tag so reshares from other clients are caught too.
 *  - Multi-purpose apps (HiveSuite, Zingit) → app+tag only, because the same
 *    apps carry people's ordinary snaps, TV reviews, music, etc.
 *  Generic words (e.g. `pinnacle`, `poker`) are only ever app-scoped. */
export const GAMES_PRESET: FilterPreset = {
  id: 'games',
  label: 'Hide game results',
  description: 'Scores, streaks and recaps auto-posted by games like HiveWord, HiveGrove, Scroddle and HiveSuite.',
  rules: [
    { kind: 'app', app: 'hivegrove' },
    { kind: 'app', app: 'mydempire' },
    { kind: 'app', app: 'hiveword' },
    { kind: 'tag', tag: 'hivegrove' },
    { kind: 'tag', tag: 'mydempire' },
    { kind: 'tag', tag: 'hiveword' },
    { kind: 'tag', tag: 'scroddle' },
    { kind: 'tag', tag: 'holohover' },
    { kind: 'tag', tag: 'holovortex' },
    { kind: 'tag', tag: 'hologoal' },
    { kind: 'app_tag', app: 'hivesuite', tag: 'hivegaming' },
    { kind: 'app_tag', app: 'hivesuite', tag: 'scratchcard' },
    { kind: 'app_tag', app: 'hivesuite', tag: 'dailyrewards' },
    { kind: 'app_tag', app: 'zingit', tag: 'pinnacle' },
  ],
};

/** Bundled fallback. Apps should prefer a fresher catalog from the server
 *  (`GET /api/content-filters/presets`) and fall back to this offline. */
export const DEFAULT_PRESETS: PresetCatalog = {
  [GAMES_PRESET.id]: GAMES_PRESET,
};
