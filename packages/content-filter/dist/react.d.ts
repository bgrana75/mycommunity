import { k as ContentFilterState, M as MuteRule, l as ContentFilterStore } from './store-B5uTKNqH.js';

interface UseContentFilterResult extends ContentFilterState {
    addRule(rule: MuteRule): void;
    removeRule(rule: MuteRule): void;
    setPreset(id: string, enabled: boolean): void;
}
/** Subscribes to a content-filter store. Works in React DOM and React Native.
 *  Create the store once at module level (see createContentFilterStore). */
declare function useContentFilter(store: ContentFilterStore): UseContentFilterResult;

export { type UseContentFilterResult, useContentFilter };
