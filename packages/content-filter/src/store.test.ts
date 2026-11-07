import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentFilterRemote } from './api';
import { emptyPrefs } from './prefs';
import { createContentFilterStore, type KeyValueStorage } from './store';
import type { ContentFilterPrefs } from './types';

function memStorage(initial: Record<string, string> = {}, async = false): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: k => (async ? Promise.resolve(data[k] ?? null) : data[k] ?? null),
    setItem: (k, v) => { data[k] = v; return async ? Promise.resolve() : undefined; },
  };
}

function fakeRemote(server: ContentFilterPrefs | null) {
  const r = {
    server,
    saves: [] as ContentFilterPrefs[],
    load: vi.fn(async () => r.server),
    save: vi.fn(async (p: ContentFilterPrefs): Promise<ContentFilterPrefs | null> => { r.saves.push(p); r.server = p; return null; }),
  };
  return r satisfies ContentFilterRemote;
}

const KEY = 'snapie_content_filters';
const hiveword = { json_metadata: { app: 'hiveword', tags: ['hiveword'] } };
const tagged = (t: string) => ({ json_metadata: { tags: [t] } });

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('local store', () => {
  it('filters nothing until hydrated, then reads storage', async () => {
    const storage = memStorage({ [KEY]: JSON.stringify({ prefs: { rules: [], presets: ['games'], updatedAt: 1 }, syncedFor: null }) }, true);
    const store = createContentFilterStore({ storage });
    expect(store.getState().filter(hiveword)).toBe(false);
    await store.hydrate();
    expect(store.getState().hydrated).toBe(true);
    expect(store.getState().filter(hiveword)).toBe(true);
  });

  it('keeps a stable, unhydrated server snapshot', async () => {
    const storage = memStorage({ [KEY]: JSON.stringify({ prefs: { rules: [], presets: ['games'], updatedAt: 1 }, syncedFor: null }) });
    const store = createContentFilterStore({ storage });
    const server = store.getServerState();
    await store.hydrate();
    expect(store.getServerState()).toBe(server);
    expect(server.hydrated).toBe(false);
    expect(server.prefs.presets).toEqual([]);
    expect(store.getState().prefs.presets).toEqual(['games']);
  });

  it('migrates legacy tags once', async () => {
    const storage = memStorage();
    const store = createContentFilterStore({ storage, readLegacyTags: () => ['ScrobbleLife'] });
    await store.hydrate();
    expect(store.getState().filter(tagged('scrobblelife'))).toBe(true);
    expect(JSON.parse(storage.data[KEY]).prefs.rules).toEqual([{ kind: 'tag', tag: 'scrobblelife' }]);
  });

  it('persists edits and notifies subscribers; no-op edits do not notify', async () => {
    const storage = memStorage();
    const store = createContentFilterStore({ storage });
    await store.hydrate();
    const spy = vi.fn();
    store.subscribe(spy);
    store.addRule({ kind: 'app', app: 'pizzabot' });
    store.addRule({ kind: 'app', app: 'pizzabot' });
    expect(spy).toHaveBeenCalledTimes(1);
    await vi.runAllTimersAsync();
    expect(JSON.parse(storage.data[KEY]).prefs.rules).toEqual([{ kind: 'app', app: 'pizzabot' }]);
  });

  it('keeps an edit made before hydration finished', async () => {
    const storage = memStorage({ [KEY]: JSON.stringify({ prefs: { rules: [{ kind: 'tag', tag: 'old' }], presets: [], updatedAt: 1 }, syncedFor: null }) }, true);
    const store = createContentFilterStore({ storage });
    const h = store.hydrate();
    store.setPreset('games', true);
    await h;
    expect(store.getState().prefs.presets).toEqual(['games']);
  });
});

describe('sync', () => {
  it('first sync unions local and server, then uploads', async () => {
    const storage = memStorage();
    const store = createContentFilterStore({ storage, readLegacyTags: () => ['local'] });
    const remote = fakeRemote({ ...emptyPrefs(), presets: ['games'], updatedAt: 5 });
    await store.setSyncUser('Alice', remote);
    const { prefs, syncUser } = store.getState();
    expect(syncUser).toBe('alice');
    expect(prefs.presets).toEqual(['games']);
    expect(prefs.rules).toEqual([{ kind: 'tag', tag: 'local' }]);
    expect(remote.saves).toHaveLength(1);
    expect(JSON.parse(storage.data[KEY]).syncedFor).toBe('alice');
  });

  it('uploads local when server has nothing', async () => {
    const store = createContentFilterStore({ storage: memStorage(), readLegacyTags: () => ['x'] });
    const remote = fakeRemote(null);
    await store.setSyncUser('bob', remote);
    expect(remote.saves[0].rules).toEqual([{ kind: 'tag', tag: 'x' }]);
  });

  it('on a device already synced, a newer server copy replaces local without re-upload', async () => {
    const storage = memStorage({ [KEY]: JSON.stringify({ prefs: { rules: [{ kind: 'tag', tag: 'stale' }], presets: [], updatedAt: 1 }, syncedFor: 'alice' }) });
    const store = createContentFilterStore({ storage });
    const remote = fakeRemote({ ...emptyPrefs(), presets: ['games'], updatedAt: 9 });
    await store.setSyncUser('alice', remote);
    expect(store.getState().prefs.presets).toEqual(['games']);
    expect(store.getState().prefs.rules).toEqual([]);
    expect(remote.save).not.toHaveBeenCalled();
  });

  it('does not leak a previous account\'s mutes into another account', async () => {
    const storage = memStorage({ [KEY]: JSON.stringify({ prefs: { rules: [{ kind: 'tag', tag: 'alices' }], presets: [], updatedAt: 99 }, syncedFor: 'alice' }) });
    const store = createContentFilterStore({ storage });
    const remote = fakeRemote({ ...emptyPrefs(), rules: [{ kind: 'tag', tag: 'bobs' }], updatedAt: 1 });
    await store.setSyncUser('bob', remote);
    expect(store.getState().prefs.rules).toEqual([{ kind: 'tag', tag: 'bobs' }]);
  });

  it('debounces edits into one upload', async () => {
    const store = createContentFilterStore({ storage: memStorage(), saveDelayMs: 500 });
    const remote = fakeRemote({ ...emptyPrefs(), updatedAt: 1 });
    await store.setSyncUser('alice', remote);
    remote.save.mockClear();
    store.addRule({ kind: 'tag', tag: 'a' });
    store.addRule({ kind: 'tag', tag: 'b' });
    await vi.advanceTimersByTimeAsync(499);
    expect(remote.save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(remote.save).toHaveBeenCalledTimes(1);
    expect(remote.server!.rules).toHaveLength(2);
  });

  it('flushes a pending upload before switching account', async () => {
    const store = createContentFilterStore({ storage: memStorage() });
    const remote = fakeRemote({ ...emptyPrefs(), updatedAt: 1 });
    await store.setSyncUser('alice', remote);
    remote.save.mockClear();
    store.addRule({ kind: 'tag', tag: 'a' });
    await store.setSyncUser(null);
    expect(remote.save).toHaveBeenCalledTimes(1);
    expect(store.getState().syncUser).toBeNull();
  });

  it('adopts the server copy when an upload is rejected as stale', async () => {
    const store = createContentFilterStore({ storage: memStorage() });
    const remote = fakeRemote({ ...emptyPrefs(), updatedAt: 1 });
    await store.setSyncUser('alice', remote);
    const newer = { ...emptyPrefs(), presets: ['games'], updatedAt: Date.now() + 1000 };
    remote.save.mockResolvedValueOnce(newer);
    store.addRule({ kind: 'tag', tag: 'a' });
    await store.flush();
    expect(store.getState().prefs).toEqual(newer);
  });

  it('stays local-only when the server is unreachable', async () => {
    const onError = vi.fn();
    const store = createContentFilterStore({ storage: memStorage(), onError, readLegacyTags: () => ['keep'] });
    const remote = fakeRemote(null);
    remote.load.mockRejectedValueOnce(new Error('offline'));
    await store.setSyncUser('alice', remote);
    expect(onError).toHaveBeenCalled();
    expect(store.getState().filter(tagged('keep'))).toBe(true);
  });

  it('ignores a slow load that finishes after the user switched', async () => {
    const store = createContentFilterStore({ storage: memStorage() });
    let release!: (p: ContentFilterPrefs) => void;
    const slow = fakeRemote(null);
    slow.load.mockImplementationOnce(() => new Promise(r => { release = r; }));
    const first = store.setSyncUser('alice', slow);
    for (let i = 0; i < 10 && slow.load.mock.calls.length === 0; i++) await Promise.resolve();
    expect(slow.load).toHaveBeenCalled();
    await store.setSyncUser(null);
    release({ ...emptyPrefs(), presets: ['games'], updatedAt: 5 });
    await first;
    expect(store.getState().prefs.presets).toEqual([]);
  });
});
