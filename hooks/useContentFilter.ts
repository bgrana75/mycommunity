'use client';
import { useEffect } from 'react';
import { useContentFilter as usePackageContentFilter } from '@snapie/content-filter/react';
import { contentFilterStore, refreshPresetCatalog, remoteFor } from '@/lib/contentFilter/store';

/** Current content filter. `filter(item)` → true means hide it.
 *  `fingerprint` changes whenever what's hidden changes; use it as an effect
 *  dependency where a feed must refetch (it replaces the old `mutedTagsKey`). */
export function useContentFilter() {
  useEffect(() => { void contentFilterStore.hydrate(); }, []);
  const state = usePackageContentFilter(contentFilterStore);
  // '' when nothing is filtered: feeds use that to know the shared, unfiltered
  // SSR seed page is still valid for this viewer.
  const active = state.prefs.rules.length > 0 || state.prefs.presets.length > 0;
  return { ...state, key: active ? state.fingerprint : '' };
}

/** Mount once (LayoutContent). Syncs filters for the logged-in account and
 *  loads the latest preset catalog. */
export function useContentFilterSync(username: string | null | undefined) {
  useEffect(() => {
    void contentFilterStore.hydrate();
    refreshPresetCatalog();
  }, []);

  useEffect(() => {
    // `~` warm-up ids have no Hive key to mint a session with.
    const user = username && !username.startsWith('~') ? username : null;
    void contentFilterStore.setSyncUser(user, user ? remoteFor(user) : null);
  }, [username]);
}
