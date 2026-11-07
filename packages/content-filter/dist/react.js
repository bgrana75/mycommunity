'use strict';

var react = require('react');

// src/react/index.ts
function useContentFilter(store) {
  const state = react.useSyncExternalStore(store.subscribe, store.getState, store.getServerState);
  const addRule = react.useCallback((r) => store.addRule(r), [store]);
  const removeRule = react.useCallback((r) => store.removeRule(r), [store]);
  const setPreset = react.useCallback((id, on) => store.setPreset(id, on), [store]);
  return { ...state, addRule, removeRule, setPreset };
}

exports.useContentFilter = useContentFilter;
//# sourceMappingURL=react.js.map
//# sourceMappingURL=react.js.map