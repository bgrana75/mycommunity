'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ExtendedComment } from './useComments';
import { mutedAccountsManager } from '@/lib/hive/muted-accounts';
import { hasMutedTag } from '@/lib/hive/mutedTags';
import { useUserSettings } from './useUserSettings';
import { getPost } from '@/lib/hive/client-functions';
import { withTimeout } from '@/lib/utils/withTimeout';
import type { PublicSnapPage } from '@/lib/hive/publicSnapPage';

interface FeedApiItem {
  source: 'snap' | 'wave';
  author: string;
  permlink: string;
  created: string;
  parentAuthor: string;
  parentPermlink: string;
  body?: string;
  json_metadata?: string;
  active_votes?: ExtendedComment['active_votes'];
  children?: number;
}

interface UseBlendedFeedProps {
  username?: string;
  /** When false, this hook does no fetching — used when the blended source
   *  isn't the active one right now (a different filter is selected, or the
   *  feature flag is off). Defaults to true for standalone use. */
  enabled?: boolean;
  /** Server-rendered first page of blended Latest. Kept for a logged-out
   *  visitor with no muted tags; a username or mute change still refetches. */
  initialPage?: PublicSnapPage | null;
}

function seedBefore(page: PublicSnapPage): string | null {
  if (page.before) return page.before;
  return page.comments[page.comments.length - 1]?.created ?? null;
}

function toExtendedComment(item: FeedApiItem): ExtendedComment {
  return {
    ...item,
    parent_author: item.parentAuthor,
    parent_permlink: item.parentPermlink,
  } as unknown as ExtendedComment;
}

/**
 * Blended snaps+waves feed. Unlike useSnaps, this does no container-walking or
 * client-side filtering — the sidecar already walked both containers, merged
 * them by timestamp, and hands back ready-to-render pages. See
 * internal-docs/hive-activity-sidecar-feed.md for the server-side design.
 */
export const useBlendedFeed = ({ username, enabled = true, initialPage = null }: UseBlendedFeedProps = {}) => {
  const { settings } = useUserSettings();
  // Same value-compared key as useSnaps. Settings hydrate from localStorage
  // after mount (mutedTags starts []), and a mute added later must reset
  // Latest instead of leaving the first page unfiltered.
  const mutedTagsKey = settings.mutedTags.join(',');
  // Public blended page from the server. The first client render must use
  // it (hydration matches the HTML) and must not immediately refetch it.
  const hasSeed = Boolean(initialPage && initialPage.comments.length > 0 && !username && mutedTagsKey === '');
  // Set only when we leave that server page (login, mutes). Staying false
  // through a Strict Mode double-invoke keeps the first paint from refetching.
  const leftSeedRef = useRef(false);
  const lastCreatedRef = useRef<string | null>(hasSeed ? seedBefore(initialPage!) : null);
  const fetchedPermlinksRef = useRef<Set<string>>(
    new Set(hasSeed ? initialPage!.comments.map(comment => comment.permlink) : []),
  );
  const isFetchingRef = useRef(false);
  const isThrottledRef = useRef(false);
  // Same "generation" guard as useSnaps — a stale fetch (e.g. from a fast
  // tab-switch away and back) must not clobber results from a newer one.
  const fetchGenerationRef = useRef(0);

  const [currentPage, setCurrentPage] = useState(1);
  const [comments, setComments] = useState<ExtendedComment[]>(hasSeed ? initialPage!.comments : []);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(hasSeed ? initialPage!.hasMore : true);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(hasSeed);
  // currentPage alone doesn't change on a same-page refresh() call — this
  // forces the fetch effect to re-run regardless, same pattern as useSnaps.
  const [fetchTrigger, setFetchTrigger] = useState(0);

  // 30, up from 20: with the virtualized SnapList, a fast mobile doomscroll
  // can reach the bottom of a loaded page before the next fetch lands,
  // which reads as the feed stalling. A bigger page is cheap runway — the
  // sidecar hands back pre-merged pages, so the marginal cost is small,
  // and virtualization means the extra items don't stay mounted anyway.
  const pageSize = 30;
  // Same target as useSnaps' pageMinSize: a long Hive mute list can strip
  // all but a couple of items from a 30-item sidecar page, which otherwise
  // reads as the feed being stuck. Keep asking the sidecar for more pages
  // until this many survive the mute filter.
  const pageMinSize = 10;
  // Caps the worst case (a mute list that removes nearly everything) to a
  // bounded number of sidecar round-trips per scroll/load-more instead of
  // fetching forever. Same order of magnitude as useSnaps' container cap.
  const MAX_PAGES_PER_FETCH = 5;
  // In-request retries before a page counts as failed. A failed page keeps
  // hasMore true so the next scroll trigger tries again.
  const RETRY_DELAYS_MS = [800, 2000];
  const MUTE_LIST_WAIT_MS = 6000;
  const [loadError, setLoadError] = useState(false);

  // One page request. A non-OK status or malformed body throws so the caller
  // can retry — it must never be read as "no more history".
  async function requestPage(qs: URLSearchParams): Promise<{ items: FeedApiItem[]; hasMore: boolean; before?: string }> {
    const res = await fetch(`/api/feed?${qs.toString()}`);
    if (!res.ok) throw new Error(`feed responded ${res.status}`);
    const data = await res.json();
    if (!data || !Array.isArray(data.items) || typeof data.hasMore !== 'boolean') {
      throw new Error('feed returned a malformed page');
    }
    return data;
  }

  // Fetches one sidecar page, retrying per RETRY_DELAYS_MS before giving up.
  async function requestPageWithRetry(isCancelled: () => boolean): Promise<Awaited<ReturnType<typeof requestPage>> | null> {
    const qs = new URLSearchParams({ limit: String(pageSize) });
    if (lastCreatedRef.current) qs.set('before', lastCreatedRef.current);

    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
        if (isCancelled()) return null;
      }
      try {
        return await requestPage(qs);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  }

  // Fetches sidecar pages, going back for more only when the mute filter is
  // what left us short. One sidecar page is normally one visible page — a
  // page that's naturally small (the real end of the feed) is returned as
  // is, exactly like before. But a long personal/tag mute list can strip
  // most of a page's items, which used to look like the feed had stalled;
  // once that's seen on this fetch, keep asking for more pages until enough
  // survive, hasMore goes false, or the page cap is hit.
  async function getMoreFeedItems(isCancelled: () => boolean): Promise<{ comments: ExtendedComment[]; hasMoreData: boolean }> {
    const collected: ExtendedComment[] = [];
    let hasMoreData = true;
    let pagesFetched = 0;
    let sawMuteAttrition = false;

    do {
      if (isCancelled()) return { comments: collected, hasMoreData: true };

      // Start the mute lookup alongside the page request, and never wait on it
      // longer than MUTE_LIST_WAIT_MS: it is a Hive RPC call that can stall for
      // over a minute on a flaky connection, which left an already-fetched
      // page hidden behind "Loading...". shortcut: a page that outruns the
      // lookup shows without that mute list, so a muted author can appear
      // until the next load; upgrade by re-filtering once the list arrives.
      const mutedPromise = withTimeout(mutedAccountsManager.getMutedList(username), MUTE_LIST_WAIT_MS)
        .catch(() => new Set<string>());

      let data: Awaited<ReturnType<typeof requestPage>> | null;
      try {
        data = await requestPageWithRetry(isCancelled);
      } catch (err) {
        // A page that fails outright (all retries exhausted) must never be
        // read as "no more history" — rethrow unless an earlier page in
        // this same fetch already found something worth showing.
        if (collected.length > 0) return { comments: collected, hasMoreData: true };
        throw err;
      }
      if (data === null) return { comments: collected, hasMoreData: true };

      if (isCancelled()) return { comments: collected, hasMoreData: data.hasMore };
      pagesFetched += 1;

      const mutedList = await mutedPromise;
      // The reset effect clears lastCreatedRef / fetchedPermlinksRef when
      // username or muted tags change. A fetch that started earlier can
      // resume here and write those refs back, which paginates the new feed
      // from the stale page. Discard before touching either ref. The caller
      // still drops the returned comments when this generation is stale.
      if (isCancelled()) return { comments: collected, hasMoreData: data.hasMore };

      const deduped = data.items.filter(item => !fetchedPermlinksRef.current.has(item.permlink));
      const items = deduped
        .filter(item => !mutedList.has(item.author.toLowerCase()))
        .filter(item => !hasMutedTag(item.json_metadata, settings.mutedTags));
      if (items.length < deduped.length) sawMuteAttrition = true;

      for (const item of items) {
        fetchedPermlinksRef.current.add(item.permlink);
        lastCreatedRef.current = item.created;
      }
      // Prefer the sidecar's own cursor: items it failed to hydrate at the
      // tail of a page would otherwise be re-requested (or skipped) via a
      // cursor derived from the last item that did come back.
      if (data.before && (!lastCreatedRef.current || data.before < lastCreatedRef.current)) {
        lastCreatedRef.current = data.before;
      }

      collected.push(...items.map(toExtendedComment));
      hasMoreData = data.hasMore;
    } while (sawMuteAttrition && collected.length < pageMinSize && hasMoreData && pagesFetched < MAX_PAGES_PER_FETCH);

    return { comments: collected, hasMoreData };
  }

  // Username is a fetch input: a list loaded before login resolved only
  // applied community mutes. The mount pass keeps a server-rendered public
  // page in place; a signed-in account or muted tags still clear and refetch.
  // Declared before the fetch effect so a reset in this commit clears the
  // cursor before a new fetch reads it. Bump the generation immediately so
  // a page fetched with the previous mute list cannot land after this reset.
  useEffect(() => {
    const publicDefault = !username && mutedTagsKey === '';
    if (!leftSeedRef.current && publicDefault && initialPage && initialPage.comments.length > 0) {
      return;
    }
    leftSeedRef.current = true;
    fetchGenerationRef.current += 1;
    lastCreatedRef.current = null;
    fetchedPermlinksRef.current.clear();
    isFetchingRef.current = false;
    setComments([]);
    setHasMore(true);
    setHasFetchedOnce(false);
    setCurrentPage(1);
    setFetchTrigger(prev => prev + 1);
  }, [username, mutedTagsKey, initialPage]);

  useEffect(() => {
    if (!enabled) return;
    // Mount of the public blended page: the server already rendered this
    // batch. Pagination (currentPage > 1) and refresh (fetchTrigger > 0)
    // still fetch. `leftSeedRef` flips only when the reset effect drops
    // the server page.
    if (
      !leftSeedRef.current &&
      !username &&
      mutedTagsKey === '' &&
      initialPage &&
      initialPage.comments.length > 0 &&
      currentPage === 1 &&
      fetchTrigger === 0
    ) {
      return;
    }

    const fetchPosts = async () => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      const myGeneration = ++fetchGenerationRef.current;
      setIsLoading(true);
      const isStale = () => fetchGenerationRef.current !== myGeneration;
      try {
        const { comments: newItems, hasMoreData } = await getMoreFeedItems(isStale);
        if (isStale()) return;

        setLoadError(false);
        setHasMore(hasMoreData);
        setComments(prev => {
          const existing = new Set(prev.map(c => c.permlink));
          const unique = newItems.filter(c => !existing.has(c.permlink));
          return [...prev, ...unique];
        });
      } catch (err) {
        if (!isStale()) {
          console.error('Error fetching blended feed:', err);
          setLoadError(true);
        }
      } finally {
        if (!isStale()) {
          setIsLoading(false);
          setHasFetchedOnce(true);
          isFetchingRef.current = false;
        }
      }
    };

    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, fetchTrigger, enabled]);

  useEffect(() => {
    return mutedAccountsManager.subscribePersonalMute((author) => {
      const target = author.toLowerCase();
      setComments(prev => prev.filter(c => c.author.toLowerCase() !== target));
    });
  }, []);

  const loadNextPage = useCallback(() => {
    if (isLoading || !hasMore || isThrottledRef.current) return;
    isThrottledRef.current = true;
    setCurrentPage(prev => prev + 1);
    setTimeout(() => { isThrottledRef.current = false; }, 1000);
  }, [isLoading, hasMore]);

  const refresh = () => {
    lastCreatedRef.current = null;
    fetchedPermlinksRef.current.clear();
    isFetchingRef.current = false;
    setComments([]);
    setHasMore(true);
    setHasFetchedOnce(false);
    setCurrentPage(1);
    setFetchTrigger(prev => prev + 1);
  };

  // Same helper as useSnaps.ts/useProfileSnaps.ts, same reason: an item
  // handed back by the sidecar is never refetched once it's in `comments`,
  // so its vote/payout data goes stale the moment anyone votes on it after
  // the fact. `get_content` works the same for a 'wave' item as a 'snap'
  // one — both are just a Hive author/permlink pair underneath the app's
  // own source-type label.
  const refreshComment = useCallback(async (author: string, permlink: string) => {
    try {
      const fresh = await getPost(author, permlink);
      setComments(prev => prev.map(c =>
        c.author === author && c.permlink === permlink
          ? {
              ...c,
              active_votes: fresh.active_votes,
              pending_payout_value: fresh.pending_payout_value,
              total_payout_value: fresh.total_payout_value,
              curator_payout_value: fresh.curator_payout_value,
              net_rshares: fresh.net_rshares,
            }
          : c
      ));
    } catch {
      // Leave the optimistic value in place on failure.
    }
  }, []);

  return { comments, isLoading, loadNextPage, hasMore, hasFetchedOnce, loadError, refresh, refreshComment };
};
