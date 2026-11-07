// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTrendingFeed } from './useTrendingFeed';
import { compileFilter, type ContentFilter } from '@snapie/content-filter';

const NONE: ContentFilter = () => false;
const MUTE_SCROBBLE = compileFilter([{ kind: 'tag', tag: 'scrobblelife' }]);

// Same gap as useDiscoveryCandidates: the Trending tab and the "For You"
// cold/warm feeds all paginate through server pools that only filter muted
// accounts, never muted tags (which are local-only). This hook is where the
// client-side layer belongs for all three.

function item(permlink: string, tags: string[]) {
  return { author: 'someone', permlink, created: new Date().toISOString(), json_metadata: JSON.stringify({ tags }), children: 0 };
}

const getPostMock = vi.fn();
vi.mock('@/lib/hive/client-functions', () => ({
  getPost: (...args: unknown[]) => getPostMock(...args),
}));

beforeEach(() => {
  getPostMock.mockReset();
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      items: [item('good', ['hive']), item('spammy', ['scrobblelife'])],
      hasMore: false,
    }),
  }) as Response);
});

describe('useTrendingFeed mute-tag filtering', () => {
  it('excludes a page item carrying a muted tag', async () => {
    const { result } = renderHook(() => useTrendingFeed({ enabled: true, filter: MUTE_SCROBBLE }));

    await waitFor(() => expect(result.current.hasFetchedOnce).toBe(true));

    const permlinks = result.current.comments.map(c => c.permlink);
    expect(permlinks).toContain('good');
    expect(permlinks).not.toContain('spammy');
  });

  it('includes everything when no tags are muted', async () => {
    const { result } = renderHook(() => useTrendingFeed({ enabled: true }));

    await waitFor(() => expect(result.current.hasFetchedOnce).toBe(true));
    expect(result.current.comments.map(c => c.permlink)).toEqual(expect.arrayContaining(['good', 'spammy']));
  });

  it('re-filters already-fetched pages instantly when a tag is muted, without a new fetch', async () => {
    const { result, rerender } = renderHook(
      ({ filter }) => useTrendingFeed({ enabled: true, filter }),
      { initialProps: { filter: NONE } },
    );

    await waitFor(() => expect(result.current.hasFetchedOnce).toBe(true));
    const fetchCallsAfterInitialLoad = (global.fetch as any).mock.calls.length;

    rerender({ filter: MUTE_SCROBBLE });

    expect(result.current.comments.map(c => c.permlink)).not.toContain('spammy');
    expect((global.fetch as any).mock.calls.length).toBe(fetchCallsAfterInitialLoad);
  });
});

describe('useTrendingFeed.refreshComment', () => {
  function candidate(permlink: string, overrides: Record<string, unknown> = {}) {
    return {
      author: 'someone',
      permlink,
      created: '2026-08-29T00:00:00',
      json_metadata: JSON.stringify({ tags: [] }),
      active_votes: [],
      pending_payout_value: '0.000 HBD',
      total_payout_value: '0.000 HBD',
      curator_payout_value: '0.000 HBD',
      net_rshares: 0,
      ...overrides,
    };
  }

  it("patches only the matching item's vote/payout fields, leaving others and array order untouched", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        items: [
          candidate('target', { active_votes: [{ voter: 'alice' }] }),
          candidate('bystander', { active_votes: [{ voter: 'bob' }] }),
        ],
        hasMore: false,
      }),
    }) as Response);

    const { result } = renderHook(() => useTrendingFeed({ enabled: true }));
    await waitFor(() => expect(result.current.comments).toHaveLength(2));

    getPostMock.mockResolvedValueOnce({
      active_votes: [{ voter: 'alice' }, { voter: 'carol' }],
      pending_payout_value: '0.164 HBD',
      total_payout_value: '0.000 HBD',
      curator_payout_value: '0.000 HBD',
      net_rshares: 2548588774622,
    });

    await act(async () => {
      await result.current.refreshComment('someone', 'target');
    });

    const [first, second] = result.current.comments as any[];
    expect(first.permlink).toBe('target');
    expect(second.permlink).toBe('bystander');

    expect(first.pending_payout_value).toBe('0.164 HBD');
    expect(first.active_votes).toHaveLength(2);

    expect(second.pending_payout_value).toBe('0.000 HBD');
    expect(second.active_votes).toHaveLength(1);

    expect(getPostMock).toHaveBeenCalledWith('someone', 'target');
  });

  it('leaves the existing data in place if the refetch fails', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ items: [candidate('target')], hasMore: false }),
    }) as Response);

    const { result } = renderHook(() => useTrendingFeed({ enabled: true }));
    await waitFor(() => expect(result.current.comments).toHaveLength(1));

    getPostMock.mockRejectedValueOnce(new Error('node unreachable'));

    await act(async () => {
      await result.current.refreshComment('someone', 'target');
    });

    expect((result.current.comments[0] as any).pending_payout_value).toBe('0.000 HBD');
  });
});
