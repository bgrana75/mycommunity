// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDiscoveryCandidates } from './useDiscoveryCandidates';
import { compileFilter, type ContentFilter } from '@snapie/content-filter';

const NONE: ContentFilter = () => false;
const MUTE_SCROBBLE = compileFilter([{ kind: 'tag', tag: 'scrobblelife' }]);

// The server-side discovery pools (lib/discovery/snapTrending.ts etc.) only
// ever filter by muted ACCOUNTS — muted tags are pure localStorage and can
// never be baked into that shared, cross-user cache. This hook is where
// that client-side layer belongs; these tests guard against it silently
// going missing again (it was missing entirely until this fix).

function item(permlink: string, tags: string[]) {
  return { author: 'someone', permlink, created: new Date().toISOString(), json_metadata: JSON.stringify({ tags }), children: 0, isDiscovery: true };
}

beforeEach(() => {
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      items: [item('good', ['hive']), item('spammy', ['scrobblelife']), item('other', ['photography'])],
      hasMore: false,
    }),
  }) as Response);
});

describe('useDiscoveryCandidates mute-tag filtering', () => {
  it('excludes a candidate carrying a muted tag', async () => {
    const { result } = renderHook(() => useDiscoveryCandidates({ enabled: true, filter: MUTE_SCROBBLE }));

    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0));

    const permlinks = result.current.candidates.map(c => c.permlink);
    expect(permlinks).toContain('good');
    expect(permlinks).toContain('other');
    expect(permlinks).not.toContain('spammy');
  });

  it('includes everything when no tags are muted', async () => {
    const { result } = renderHook(() => useDiscoveryCandidates({ enabled: true }));

    await waitFor(() => expect(result.current.candidates.length).toBe(3));
  });

  it('re-filters an already-fetched pool instantly when a tag is muted, without a new fetch', async () => {
    const { result, rerender } = renderHook(
      ({ filter }) => useDiscoveryCandidates({ enabled: true, filter }),
      { initialProps: { filter: NONE } },
    );

    await waitFor(() => expect(result.current.candidates.length).toBe(3));
    const fetchCallsAfterInitialLoad = (global.fetch as any).mock.calls.length;

    rerender({ filter: MUTE_SCROBBLE });

    expect(result.current.candidates.map(c => c.permlink)).not.toContain('spammy');
    expect((global.fetch as any).mock.calls.length).toBe(fetchCallsAfterInitialLoad); // no extra network call
  });
});
