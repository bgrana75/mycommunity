import { useCallback, useSyncExternalStore } from 'react';
import type { ContentFilterState, ContentFilterStore } from '../store';
import type { MuteRule } from '../types';

export interface UseContentFilterResult extends ContentFilterState {
  addRule(rule: MuteRule): void;
  removeRule(rule: MuteRule): void;
  setPreset(id: string, enabled: boolean): void;
}

/** Subscribes to a content-filter store. Works in React DOM and React Native.
 *  Create the store once at module level (see createContentFilterStore). */
export function useContentFilter(store: ContentFilterStore): UseContentFilterResult {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getServerState);
  const addRule = useCallback((r: MuteRule) => store.addRule(r), [store]);
  const removeRule = useCallback((r: MuteRule) => store.removeRule(r), [store]);
  const setPreset = useCallback((id: string, on: boolean) => store.setPreset(id, on), [store]);
  return { ...state, addRule, removeRule, setPreset };
}
