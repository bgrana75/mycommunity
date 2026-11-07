import { useSyncExternalStore, useCallback } from 'react';

// src/react/index.ts
function useContentFilter(store) {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getServerState);
  const addRule = useCallback((r) => store.addRule(r), [store]);
  const removeRule = useCallback((r) => store.removeRule(r), [store]);
  const setPreset = useCallback((id, on) => store.setPreset(id, on), [store]);
  return { ...state, addRule, removeRule, setPreset };
}

export { useContentFilter };
//# sourceMappingURL=react.mjs.map
//# sourceMappingURL=react.mjs.map