'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExtendedComment } from './useComments';
import type { ContentFilter } from '@snapie/content-filter';
import { getPost } from '@/lib/hive/client-functions';

const NO_FILTER: ContentFilter = () => false;

interface UseTrendingFeedProps {
    enabled: boolean;
    /** Points this hook at a different candidate-pool route sharing the same
     *  {items, hasMore} contract — e.g. the cold-start "For You" pool instead
     *  of the Trending pool. Defaults to the original Trending endpoint so
     *  every existing call site is unaffected. */
    endpoint?: string;
    /** Extra query-string fragment appended to every request (e.g.
     *  "tags=travel,gaming&username=meno") — needed by the warm "For You"
     *  pool, which the plain limit/offset contract below doesn't cover.
     *  Caller must memoize this so its identity is stable across renders
     *  unless the actual params change — same requirement as `endpoint`,
     *  since it flows into the fetch-effect's dependency list. */
    extraQuery?: string;
    /** The viewer's content filter (muted tags/apps, presets). It's personal,
     *  so it can never be baked into the shared server-cached pool; applied
     *  client-side here. Pass a stable reference (useContentFilter().filter). */
    filter?: ContentFilter;
}

const PAGE_SIZE = 10;
const DEFAULT_ENDPOINT = '/api/discovery/snap-candidates';

/**
 * Paginated view of the same discovery candidate pool used to interleave
 * trending snaps into the normal feed — this just presents the ranked pool
 * directly as its own scrollable list, in the same InfiniteScrollData shape
 * useSnaps/useBlendedFeed already produce, so it drops straight into
 * SnapList with no new rendering path.
 *
 * Generation-counter pattern (not a boolean "isFetching" ref left set across
 * effect instances) — matches useSnaps.ts's own approach, and specifically
 * avoids the bug fixed in useDiscoveryCandidates, where a ref surviving
 * React StrictMode's dev-only double-mount blocked the surviving instance
 * from ever fetching while the orphaned instance's result got discarded.
 */
export function useTrendingFeed({ enabled, endpoint = DEFAULT_ENDPOINT, extraQuery, filter = NO_FILTER }: UseTrendingFeedProps) {
    const [rawComments, setRawComments] = useState<ExtendedComment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [hasFetchedOnce, setHasFetchedOnce] = useState(false);

    // A memo, not a fetch dependency — muting a tag re-filters the
    // already-fetched pages instantly instead of waiting for the next fetch.
    const comments = useMemo(
        () => rawComments.filter(item => !filter(item)),
        [rawComments, filter],
    );

    const offsetRef = useRef(0);
    const isFetchingRef = useRef(false);
    const generationRef = useRef(0);
    const seenPermlinksRef = useRef<Set<string>>(new Set());

    const fetchPage = useCallback(async (myGeneration: number, reset: boolean) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        setIsLoading(true);
        const offset = reset ? 0 : offsetRef.current;
        try {
            const url = `${endpoint}?limit=${PAGE_SIZE}&offset=${offset}${extraQuery ? `&${extraQuery}` : ''}`;
            const res = await fetch(url, { cache: 'no-store' });
            const data = await res.json();
            if (generationRef.current !== myGeneration) return; // superseded by a newer generation
            const items: ExtendedComment[] = Array.isArray(data.items) ? data.items : [];
            const fresh = items.filter(item => !seenPermlinksRef.current.has(item.permlink));
            fresh.forEach(item => seenPermlinksRef.current.add(item.permlink));
            setRawComments(prev => (reset ? fresh : [...prev, ...fresh]));
            offsetRef.current = offset + items.length;
            setHasMore(Boolean(data.hasMore));
        } catch {
            if (generationRef.current === myGeneration) setHasMore(false);
        } finally {
            isFetchingRef.current = false;
            if (generationRef.current === myGeneration) {
                setIsLoading(false);
                setHasFetchedOnce(true);
            }
        }
    }, [endpoint, extraQuery]);

    useEffect(() => {
        const myGeneration = ++generationRef.current;
        isFetchingRef.current = false; // fresh generation always starts clean

        if (!enabled) {
            setRawComments([]);
            setHasMore(true);
            setHasFetchedOnce(false);
            offsetRef.current = 0;
            seenPermlinksRef.current.clear();
            return;
        }

        offsetRef.current = 0;
        seenPermlinksRef.current.clear();
        setRawComments([]);
        setHasFetchedOnce(false);
        fetchPage(myGeneration, true);
    }, [enabled, fetchPage]);

    const loadNextPage = useCallback(() => {
        if (!enabled || isLoading || !hasMore) return;
        fetchPage(generationRef.current, false);
    }, [enabled, isLoading, hasMore, fetchPage]);

    const refresh = useCallback(() => {
        const myGeneration = ++generationRef.current;
        isFetchingRef.current = false;
        offsetRef.current = 0;
        seenPermlinksRef.current.clear();
        setRawComments([]);
        setHasMore(true);
        setHasFetchedOnce(false);
        fetchPage(myGeneration, true);
    }, [fetchPage]);

    // Same helper as useSnaps.ts/useBlendedFeed.ts/useProfileSnaps.ts, same
    // reason: a candidate handed back by the discovery pool is never
    // refetched once it's in `rawComments`, so its vote/payout data goes
    // stale the moment anyone votes on it after the fact. Updates
    // `rawComments` (the source of truth `comments` is derived from above),
    // so the mute-tag filter re-runs on the fresh data automatically.
    const refreshComment = useCallback(async (author: string, permlink: string) => {
        try {
            const fresh = await getPost(author, permlink);
            setRawComments(prev => prev.map(c =>
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

    return { comments, loadNextPage, isLoading, hasMore, hasFetchedOnce, refresh, refreshComment };
}
