// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useComments } from './useComments';

// The content filter hydrates from localStorage after mount, so the very
// first render sees an empty filter. This mock lets each test control exactly
// what useComments sees on each render, to reproduce that mount-time
// sequence deterministically rather than relying on real localStorage timing.
let mockMutedTags: string[] = [];
vi.mock('@/hooks/useContentFilter', async () => {
  const { compileFilter } = await import('@snapie/content-filter');
  const tags = () => mockMutedTags;
  return {
    useContentFilter: () => ({ filter: compileFilter(tags().map(tag => ({ kind: 'tag' as const, tag }))), key: tags().join(',') }),
  };
});
vi.mock('@/lib/contentFilter/store', async () => {
  const { compileFilter } = await import('@snapie/content-filter');
  return {
    contentFilterStore: { getState: () => ({ filter: compileFilter((mockMutedTags).map(tag => ({ kind: 'tag' as const, tag }))) }) },
  };
});

vi.mock('@/lib/hive/muted-accounts', () => ({
  mutedAccountsManager: { getMutedList: vi.fn(async () => new Set<string>()) },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

function comment(permlink: string, tags: string[]) {
  return {
    author: 'someone',
    permlink,
    created: new Date().toISOString(),
    json_metadata: JSON.stringify({ tags }),
    children: 0,
  };
}

const callMock = vi.fn();
vi.mock('@/lib/hive/hiveclient', () => ({
  default: { database: { call: (...args: unknown[]) => callMock(...args) } },
}));

beforeEach(() => {
  mockMutedTags = [];
  callMock.mockReset();
});

describe('useComments mute-tag hydration race', () => {
  it('does not let a stale pre-hydration (unfiltered) fetch clobber the later, correctly-filtered one', async () => {
    const firstFetch = deferred<any[]>();
    const secondFetch = deferred<any[]>();
    callMock.mockReturnValueOnce(firstFetch.promise).mockReturnValueOnce(secondFetch.promise);

    const { result, rerender } = renderHook(
      ({ mutedTags }) => { mockMutedTags = mutedTags; return useComments('author', 'permlink'); },
      { initialProps: { mutedTags: [] as string[] } },
    );

    // Mount fired the first (pre-hydration) fetch — mutedTags is still [].
    expect(callMock).toHaveBeenCalledTimes(1);

    // Settings hydrate: mutedTags now excludes #spam. mutedTagsKey changes,
    // fetchAndUpdateComments gets a new identity, the effect re-runs and
    // dispatches a second fetch — this is the one whose result should win.
    rerender({ mutedTags: ['spam'] });
    await waitFor(() => expect(callMock).toHaveBeenCalledTimes(2));

    const spamComment = comment('c2', ['spam']);
    const cleanComment = comment('c1', ['hive']);

    // The SECOND (correct) fetch resolves first...
    secondFetch.resolve([spamComment, cleanComment]);
    await waitFor(() => {
      const permlinks = result.current.comments.map(c => c.permlink);
      expect(permlinks).toContain('c1');
    });
    expect(result.current.comments.map(c => c.permlink)).not.toContain('c2');

    // ...then the FIRST (stale, pre-hydration) fetch resolves late, with the
    // same raw data but filtered against mutedTags=[] — c2 would pass through.
    await act(async () => {
      firstFetch.resolve([spamComment, cleanComment]);
      await Promise.resolve();
      await Promise.resolve();
    });

    // The stale fetch's result must be discarded — c2 (#spam) must not
    // reappear just because the older request happened to finish last.
    const finalPermlinks = result.current.comments.map(c => c.permlink);
    expect(finalPermlinks).toContain('c1');
    expect(finalPermlinks).not.toContain('c2');
  });
});
