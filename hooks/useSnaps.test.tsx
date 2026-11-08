// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSnaps } from './useSnaps';
import type { ExtendedComment } from './useComments';
import type { PublicSnapPage } from '@/lib/hive/publicSnapPage';

// Same isolation/mocking approach as useComments.test.tsx.

vi.mock('./usePatronStatus', () => ({
  usePatronStatus: () => ({ byAccount: new Set<string>(), getTier: () => null, isLoading: false }),
}));

vi.mock('@/hooks/useContentFilter', async () => {
  const { compileFilter } = await import('@snapie/content-filter');
  const tags = () => ([] as string[]);
  return {
    useContentFilter: () => ({ filter: compileFilter(tags().map(tag => ({ kind: 'tag' as const, tag }))), key: tags().join(',') }),
  };
});
vi.mock('@/lib/contentFilter/store', async () => {
  const { compileFilter } = await import('@snapie/content-filter');
  return {
    contentFilterStore: { getState: () => ({ filter: compileFilter((([] as string[])).map(tag => ({ kind: 'tag' as const, tag }))) }) },
  };
});

const personalMuteListeners = vi.hoisted(() => new Set<(author: string) => void>());

vi.mock('@/lib/hive/muted-accounts', () => ({
  mutedAccountsManager: {
    getMutedList: vi.fn(async () => new Set<string>()),
    subscribePersonalMute: (listener: (author: string) => void) => {
      personalMuteListeners.add(listener);
      return () => personalMuteListeners.delete(listener);
    },
  },
}));

const databaseCallMock = vi.fn();
vi.mock('@/lib/hive/hiveclient', () => ({
  default: { database: { call: (...args: unknown[]) => databaseCallMock(...args) } },
}));

const getPostMock = vi.fn();
vi.mock('@/lib/hive/client-functions', () => ({
  getFollowing: vi.fn(async () => []),
  getPost: (...args: unknown[]) => getPostMock(...args),
}));

const COMMUNITY_TAG = 'testtag';

function container(permlink: string) {
  return { permlink, created: '2026-08-29T00:00:00', author: 'peak.snaps' };
}

function reply(permlink: string, overrides: Record<string, unknown> = {}) {
  return {
    author: 'someone',
    permlink,
    created: '2026-08-29T00:00:00',
    json_metadata: JSON.stringify({ tags: [COMMUNITY_TAG] }),
    active_votes: [],
    pending_payout_value: '0.000 HBD',
    total_payout_value: '0.000 HBD',
    curator_payout_value: '0.000 HBD',
    net_rshares: 0,
    ...overrides,
  };
}

beforeEach(() => {
  databaseCallMock.mockReset();
  getPostMock.mockReset();
  personalMuteListeners.clear();
  process.env.NEXT_PUBLIC_HIVE_COMMUNITY_TAG = COMMUNITY_TAG;
});

describe('useSnaps.refreshComment', () => {
  it("patches only the matching comment's vote/payout fields, leaving others and array order untouched", async () => {
    // One container with two replies, both matching the community tag —
    // enough for a single fetch pass to populate `comments` (pageMinSize is
    // 10, but the walk stops once the container source is exhausted).
    databaseCallMock.mockImplementationOnce(() => Promise.resolve([container('c1')])); // get_discussions_by_author_before_date
    databaseCallMock.mockImplementationOnce(() => Promise.resolve([ // get_content_replies
      reply('target', { active_votes: [{ voter: 'alice' }] }),
      reply('bystander', { active_votes: [{ voter: 'bob' }] }),
    ]));
    databaseCallMock.mockImplementation(() => Promise.resolve([])); // no more containers — stop the walk

    const { result } = renderHook(() => useSnaps({ filterType: 'community' }));

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

    // pending_payout_value isn't declared on ExtendedComment's dhive-derived
    // type (same reason lib/hive/client-functions.ts's getPayoutValue takes
    // `post: any`) even though it's a real field on the actual JSON — cast
    // the same way for these reads.
    const [first, second] = result.current.comments as any[];
    // Order is preserved (map, not filter+push).
    expect(first.permlink).toBe('target');
    expect(second.permlink).toBe('bystander');

    // The targeted comment picked up the fresh data...
    expect(first.pending_payout_value).toBe('0.164 HBD');
    expect(first.active_votes).toHaveLength(2);

    // ...and the untouched one is genuinely untouched.
    expect(second.pending_payout_value).toBe('0.000 HBD');
    expect(second.active_votes).toHaveLength(1);

    expect(getPostMock).toHaveBeenCalledWith('someone', 'target');
  });

  it('leaves the existing data in place if the refetch fails', async () => {
    databaseCallMock.mockImplementationOnce(() => Promise.resolve([container('c1')])); // get_discussions_by_author_before_date
    databaseCallMock.mockImplementationOnce(() => Promise.resolve([reply('target')])); // get_content_replies
    databaseCallMock.mockImplementation(() => Promise.resolve([])); // no more containers — stop the walk

    const { result } = renderHook(() => useSnaps({ filterType: 'community' }));
    await waitFor(() => expect(result.current.comments).toHaveLength(1));

    getPostMock.mockRejectedValueOnce(new Error('node unreachable'));

    await act(async () => {
      await result.current.refreshComment('someone', 'target');
    });

    expect((result.current.comments[0] as any).pending_payout_value).toBe('0.000 HBD');
  });

  it('drops a muted author from the loaded walk immediately', async () => {
    databaseCallMock.mockImplementationOnce(() => Promise.resolve([container('c1')]));
    databaseCallMock.mockImplementationOnce(() => Promise.resolve([
      reply('keep', { author: 'goodauthor' }),
      reply('gone', { author: 'spammer' }),
      reply('also-gone', { author: 'Spammer' }),
    ]));
    databaseCallMock.mockImplementation(() => Promise.resolve([]));

    const { result } = renderHook(() => useSnaps({ filterType: 'community' }));
    await waitFor(() => expect(result.current.comments).toHaveLength(3));

    act(() => {
      personalMuteListeners.forEach(listener => listener('spammer'));
    });

    expect(result.current.comments.map(c => c.permlink)).toEqual(['keep']);
  });

  it('does not append replies from an author muted while the walk is in flight', async () => {
    let releaseSecond!: () => void;
    const gate = new Promise<void>(resolve => { releaseSecond = resolve; });
    let waitingForSecond = false;

    databaseCallMock.mockImplementation(async (method: string, params?: unknown[]) => {
      const args = Array.isArray(params) ? params : [];
      if (method === 'get_discussions_by_author_before_date') {
        const startPermlink = String(args[1] ?? '');
        if (!startPermlink) return [container('c1')];
        if (startPermlink === 'c1') {
          waitingForSecond = true;
          await gate;
          return [container('c2')];
        }
        return [];
      }
      const containerPermlink = String(args[1] ?? '');
      if (containerPermlink === 'c1') {
        return [
          reply('keep-1', { author: 'goodauthor' }),
          reply('spam-1', { author: 'spammer' }),
        ];
      }
      if (containerPermlink === 'c2') {
        return [
          reply('keep-2', { author: 'goodauthor' }),
          reply('spam-2', { author: 'Spammer' }),
        ];
      }
      return [];
    });

    const { result } = renderHook(() => useSnaps({ filterType: 'community' }));
    await waitFor(() => expect(waitingForSecond).toBe(true));

    act(() => {
      personalMuteListeners.forEach(listener => listener('spammer'));
    });
    releaseSecond();

    await waitFor(() => {
      expect(result.current.comments.map(c => c.permlink)).toEqual(['keep-1', 'keep-2']);
    });
  });
});

describe('useSnaps initial server page', () => {
  const seed: PublicSnapPage = {
    comments: [reply('already', { author: 'alice', body: 'from the server' }) as unknown as ExtendedComment],
    hasMore: true,
    cursor: { permlink: 'container-1', date: '2026-08-29T00:00:00' },
  };

  it('hydrates the public Latest page without refetching it', async () => {
    const { result } = renderHook(() => useSnaps({ filterType: 'all', initialPage: seed }));

    expect(result.current.comments.map(c => c.permlink)).toEqual(['already']);
    expect(result.current.hasFetchedOnce).toBe(true);
    expect(result.current.isLoading).toBe(false);

    await act(async () => {});
    expect(databaseCallMock).not.toHaveBeenCalled();
  });

  it('continues infinite scroll from the server cursor', async () => {
    databaseCallMock.mockResolvedValue([]);
    const { result } = renderHook(() => useSnaps({ filterType: 'all', initialPage: seed }));

    await act(async () => {
      result.current.loadNextPage();
    });

    await waitFor(() => expect(databaseCallMock).toHaveBeenCalled());
    const [method, args] = databaseCallMock.mock.calls[0];
    expect(method).toBe('get_discussions_by_author_before_date');
    expect(args[1]).toBe('container-1');
    expect(args[2]).toBe('2026-08-29T00:00:00');
  });

  it('refetches when a logged-in username arrives', async () => {
    databaseCallMock.mockResolvedValue([]);
    const { result, rerender } = renderHook(
      ({ username }: { username?: string }) => useSnaps({ filterType: 'all', username, initialPage: seed }),
      { initialProps: { username: undefined as string | undefined } }
    );

    expect(databaseCallMock).not.toHaveBeenCalled();
    rerender({ username: 'alice' });

    await waitFor(() => expect(databaseCallMock).toHaveBeenCalled());
    expect(result.current.comments).toEqual([]);
  });

  it('appends the rest of a trimmed container without duplicating or skipping the seed prefix', async () => {
    const prefix: PublicSnapPage = {
      comments: [reply('a'), reply('b')] as unknown as ExtendedComment[],
      hasMore: true,
      cursor: null,
    };
    databaseCallMock
      .mockResolvedValueOnce([container('c1')])
      .mockResolvedValueOnce([reply('a'), reply('b'), reply('c'), reply('d')])
      .mockResolvedValue([]);

    const { result } = renderHook(() => useSnaps({ filterType: 'all', initialPage: prefix }));
    expect(result.current.comments.map(c => c.permlink)).toEqual(['a', 'b']);

    await act(async () => {
      result.current.loadNextPage();
    });

    await waitFor(() => expect(result.current.comments.map(c => c.permlink)).toEqual(['a', 'b', 'c', 'd']));
    const [method, args] = databaseCallMock.mock.calls[0];
    expect(method).toBe('get_discussions_by_author_before_date');
    expect(args[1]).toBe('');
    const permlinks = result.current.comments.map(c => c.permlink);
    expect(new Set(permlinks).size).toBe(permlinks.length);
  });

  it('resumes after the last fully consumed container and dedupes the spilled prefix', async () => {
    const prefix: PublicSnapPage = {
      comments: [reply('a'), reply('b'), reply('c')] as unknown as ExtendedComment[],
      hasMore: true,
      cursor: { permlink: 'c1', date: '2026-08-29T00:00:00' },
    };
    databaseCallMock
      .mockResolvedValueOnce([container('c2')])
      .mockResolvedValueOnce([reply('c'), reply('d'), reply('e')])
      .mockResolvedValue([]);

    const { result } = renderHook(() => useSnaps({ filterType: 'all', initialPage: prefix }));

    await act(async () => {
      result.current.loadNextPage();
    });

    await waitFor(() => expect(result.current.comments.map(c => c.permlink)).toEqual(['a', 'b', 'c', 'd', 'e']));
    const [method, args] = databaseCallMock.mock.calls[0];
    expect(method).toBe('get_discussions_by_author_before_date');
    expect(args[1]).toBe('c1');
    expect(args[2]).toBe('2026-08-29T00:00:00');
  });
});
