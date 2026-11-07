# @snapie/content-filter

Hide Hive content by **app**, **tag**, or **app + tag** (game results, bots, anything), with curated presets and cross-device sync. Shared by snapie.io and HiveSnaps, so both apps hide the same things for the same account.

- Zero runtime dependencies. Works in Node, browsers and React Native.
- `@snapie/content-filter/react` gives a `useContentFilter(store)` hook (React DOM and React Native).

## Rules

```ts
type MuteRule =
  | { kind: 'tag'; tag: string }                 // json_metadata.tags + #hashtags in the body
  | { kind: 'app'; app: string }                 // json_metadata.app, version ignored (hivesuite/0.1.262 → hivesuite)
  | { kind: 'app_tag'; app: string; tag: string } // both, for apps that post games *and* normal content
```

Presets bundle curated rules. `games` ("Hide game results") ships in `DEFAULT_PRESETS`. The server serves the latest catalog at `GET https://snapie.io/api/content-filters/presets`, so new games can be added without an app release.

## Filtering a list

```ts
import { createContentFilter } from '@snapie/content-filter';

const hide = createContentFilter({ rules: [{ kind: 'app', app: 'pizzabot' }], presets: ['games'] });
const visible = snaps.filter(s => !hide(s)); // any object with json_metadata (string or object) and body
```

## Store + sync

`createContentFilterStore` owns persistence, legacy migration and sync:

- **Storage:** plug in anything with `getItem`/`setItem` (sync or async).
- **Sync:** `setSyncUser(username, remote)`. On a device's first sync for an account, local and server rules are unioned, so nobody loses mutes. After that it's last-write-wins on `updatedAt`. If the server rejects an upload as stale, the store adopts the server copy. A device that synced a *different* account takes the new account's server copy instead of leaking the old one's mutes.
- **Uploads** are debounced (800 ms). Call `flush()` before the app backgrounds.

Server API (snapie.io):

| Method | Path | Auth | Body / response |
|---|---|---|---|
| GET | `/api/user/content-filters` | `Bearer <chat JWT>` | `{ prefs: ContentFilterPrefs \| null }` |
| PUT | `/api/user/content-filters` | `Bearer <chat JWT>` | `{ prefs }` → `{ applied, prefs }` (`applied: false` = a newer copy is stored, returned in `prefs`) |
| GET | `/api/content-filters/presets` | none | `{ presets: FilterPreset[] }` |

The JWT is the same one snapie.io's chat/points use. Get it with `POST /api/chat/auth/challenge { username }` → sign the returned `challenge` with the posting key → `POST /api/chat/auth/verify { username, challenge, signature }` → `{ token }` (7 days).

## HiveSnaps (React Native) wiring

Replaces `hooks/useMutedTags.ts` + `utils/mutedTags.ts`.

```ts
// services/contentFilter.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContentFilterRemote, createContentFilterStore, fetchPresetCatalog,
} from '@snapie/content-filter';

const SNAPIE = 'https://snapie.io';

export const contentFilterStore = createContentFilterStore({
  storage: AsyncStorage,
  // One-time migration of the old hashtag-only list.
  readLegacyTags: async () => JSON.parse((await AsyncStorage.getItem('hivesnaps_muted_tags')) ?? '[]'),
});

export function startContentFilterSync(username: string | null, getSnapieToken: () => Promise<string | null>) {
  void fetchPresetCatalog(SNAPIE).then(c => c && contentFilterStore.setCatalog(c));
  const remote = username
    ? createContentFilterRemote(async (path, init) => {
        const token = await getSnapieToken(); // challenge → sign with posting key → verify (see above)
        if (!token) return null;
        return fetch(`${SNAPIE}${path}`, { ...init, headers: { ...(init.headers as object), Authorization: `Bearer ${token}` } });
      })
    : null;
  return contentFilterStore.setSyncUser(username, remote);
}
```

```tsx
// FeedScreen.tsx
import { useContentFilter } from '@snapie/content-filter/react';
const { filter } = useContentFilter(contentFilterStore);
const visible = useMemo(() => snaps.filter(s => !mutedList?.includes(s.author) && !filter(s)), [snaps, mutedList, filter]);
```

For a "Hide posts like this" sheet, use `suggestRules(snap)`. It never offers app-wide rules for general clients (Snapie, PeakD, Ecency, HiveSnaps…).

## Develop

```bash
pnpm --filter @snapie/content-filter test
pnpm --filter @snapie/content-filter build   # dist/ is committed, like the other @snapie packages
```
