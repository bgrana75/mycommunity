'use client';
import { useEffect, useMemo, useState } from 'react';
import { ExtendedComment } from './useComments';
import type { ContentFilter } from '@snapie/content-filter';

const NO_FILTER: ContentFilter = () => false;

interface UseDiscoveryCandidatesProps {
    enabled: boolean;
    limit?: number;
    /** How often to refetch a fresh candidate pool while mounted. */
    refetchIntervalMs?: number;
    /** Applies this viewer's personal mutes on top of the shared cached
     *  pool (community mutes are already baked in server-side). Omit for a
     *  logged-out viewer, who only has community mutes to begin with. */
    username?: string;
    /** The viewer's content filter (muted tags/apps, presets). It's personal,
     *  so it can never be baked into the shared server-cached pool; applied
     *  client-side here. Pass a stable reference (useContentFilter().filter). */
    filter?: ContentFilter;
}

const DEFAULT_LIMIT = 10;
const DEFAULT_REFETCH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Fetches a small pool of discovery candidates (trending snaps, later:
 * category-match posts). Deliberately owns no pagination/cursor state —
 * this is not shaped like useSnaps/useBlendedFeed's InfiniteScrollData and
 * never will be; it's a fixed-size pool an interleave step draws from.
 */
export function useDiscoveryCandidates({
    enabled,
    limit = DEFAULT_LIMIT,
    refetchIntervalMs = DEFAULT_REFETCH_INTERVAL_MS,
    username,
    filter = NO_FILTER,
}: UseDiscoveryCandidatesProps) {
    const [rawCandidates, setRawCandidates] = useState<ExtendedComment[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // A memo, not a fetch dependency — muting a tag re-filters the
    // already-fetched pool instantly instead of waiting for the next poll.
    const candidates = useMemo(
        () => rawCandidates.filter(item => !filter(item)),
        [rawCandidates, filter],
    );

    useEffect(() => {
        if (!enabled) {
            setRawCandidates([]);
            return;
        }

        // Both flags are local to this effect instance on purpose — a useRef
        // would survive React StrictMode's dev-only mount/cleanup/remount
        // cycle, so a still-in-flight fetch from the cleaned-up first
        // instance would block the surviving second instance from ever
        // fetching, while its own (too-late) result gets thrown away by
        // `cancelled`. Net effect: the request always succeeds but the
        // result never lands. Scoping both to this closure means each
        // instance starts clean.
        let cancelled = false;
        let isFetching = false;

        async function fetchCandidates() {
            if (isFetching) return;
            isFetching = true;
            setIsLoading(true);
            try {
                const usernameParam = username ? `&username=${encodeURIComponent(username)}` : '';
                const res = await fetch(`/api/discovery/snap-candidates?limit=${limit}${usernameParam}`, { cache: 'no-store' });
                const data = await res.json();
                if (!cancelled) setRawCandidates(Array.isArray(data.items) ? data.items : []);
            } catch {
                if (!cancelled) setRawCandidates([]);
            } finally {
                isFetching = false;
                if (!cancelled) setIsLoading(false);
            }
        }

        fetchCandidates();
        const interval = setInterval(fetchCandidates, refetchIntervalMs);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [enabled, limit, refetchIntervalMs, username]);

    return { candidates, isLoading };
}
