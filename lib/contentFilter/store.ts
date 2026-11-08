'use client';
import {
  createContentFilterRemote,
  createContentFilterStore,
  fetchPresetCatalog,
  type KeyValueStorage,
} from '@snapie/content-filter';
import { readUserSettings } from '@/hooks/useUserSettings';
import { authenticatedFetch } from '@/lib/points/client';

const browserStorage: KeyValueStorage = {
  getItem: key => (typeof window === 'undefined' ? null : window.localStorage.getItem(key)),
  setItem: (key, value) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
  },
};

/** The one store for the web app. Every feed hook and the Settings page share
 *  it, so a mute applies everywhere at once. Logged-out: localStorage only.
 *  Logged-in: also synced to /api/user/content-filters (see useContentFilterSync). */
export const contentFilterStore = createContentFilterStore({
  storage: browserStorage,
  // Before this, mutes were `mutedTags: string[]` in snapie_user_settings.
  readLegacyTags: () => readUserSettings().mutedTags,
  onError: err => {
    if (process.env.NODE_ENV !== 'production') console.warn('[contentFilter]', err);
  },
});

export function remoteFor(username: string) {
  // Silent: reuses the shared session token, and never re-prompts after a
  // decline. If no token can be had, sync just waits for the next change.
  return createContentFilterRemote((path, init) => authenticatedFetch(username, path, init, { silent: true }));
}

let catalogRequested = false;
export function refreshPresetCatalog() {
  if (catalogRequested) return;
  catalogRequested = true;
  void fetchPresetCatalog().then(catalog => {
    if (catalog) contentFilterStore.setCatalog(catalog);
  });
}
