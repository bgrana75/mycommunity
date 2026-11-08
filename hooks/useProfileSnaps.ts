import HiveClient from '@/lib/hive/hiveclient';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ExtendedComment } from './useComments';
import { getPost } from '@/lib/hive/client-functions';

const PAGE_SIZE = 10;   // snaps to collect before yielding a page
const FETCH_LIMIT = 20; // comments to request per API call
const MAX_ITERATIONS = 20; // safety cap to avoid infinite loops when a user has few snaps

export function useProfileSnaps(username: string, initialComments: ExtendedComment[] = []) {
  const [snaps, setSnaps] = useState<ExtendedComment[]>(initialComments);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  // Seeded profiles start at page 0 so we do not immediately re-fetch the
  // first HTML page; loadNextPage increments from there. Unseeded profiles
  // flip to 1 in the username effect below.
  const [page, setPage] = useState(0);

  const cursorRef = useRef(initialComments.at(-1)?.permlink ?? '');
  const exhaustedRef = useRef(false);
  const fetchingRef = useRef(false);
  const versionRef = useRef(0); // incremented on refresh to invalidate in-flight requests

  // Reset everything when the target user changes
  useEffect(() => {
    const seeded = initialComments.length > 0;
    cursorRef.current = seeded ? (initialComments.at(-1)?.permlink ?? '') : '';
    exhaustedRef.current = false;
    fetchingRef.current = false;
    setSnaps(seeded ? initialComments : []);
    setHasMore(true);
    // Seeded: wait for scroll. Unseeded: fetch page 1 immediately.
    setPage(seeded ? 0 : 1);
    // initialComments is the server seed for this username; re-read when the
    // profile route changes, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  // Fetch a page of snaps whenever `page` increments
  useEffect(() => {
    if (page === 0 || !username || fetchingRef.current || exhaustedRef.current) return;

    fetchingRef.current = true;
    setIsLoading(true);
    const requestVersion = versionRef.current;

    const run = async () => {
      try {
        const collected: ExtendedComment[] = [];
        let cursor = cursorRef.current;
        let iterations = 0;

        while (collected.length < PAGE_SIZE && iterations < MAX_ITERATIONS) {
          iterations++;

          const results: ExtendedComment[] = await HiveClient.database.call(
            'get_discussions_by_comments',
            [{ start_author: username, start_permlink: cursor, limit: FETCH_LIMIT }]
          );

          if (!results?.length) {
            exhaustedRef.current = true;
            break;
          }

          // On paginated calls the API returns the cursor item again — skip it
          const items = cursor === '' ? results : results.slice(1);
          if (items.length === 0) {
            exhaustedRef.current = true;
            break;
          }

          collected.push(...items.filter(c => c.parent_author === 'peak.snaps'));

          cursor = results[results.length - 1].permlink;

          // Fewer results than requested means we've hit the end
          if (results.length < FETCH_LIMIT) {
            exhaustedRef.current = true;
            break;
          }
        }

        // Discard results if a refresh was triggered while this fetch was in flight
        if (versionRef.current !== requestVersion) return;

        cursorRef.current = cursor;

        setSnaps(prev => {
          const seen = new Set(prev.map(c => c.permlink));
          return [...prev, ...collected.filter(c => !seen.has(c.permlink))];
        });

        if (exhaustedRef.current) setHasMore(false);
      } catch (err) {
        console.error('useProfileSnaps fetch error:', err);
      } finally {
        if (versionRef.current === requestVersion) {
          fetchingRef.current = false;
          setIsLoading(false);
        }
      }
    };

    run();
  }, [page, username]);

  const loadNextPage = () => {
    if (!isLoading && hasMore && !fetchingRef.current) {
      setPage(p => p + 1);
    }
  };

  const refresh = () => {
    versionRef.current++;
    cursorRef.current = '';
    exhaustedRef.current = false;
    fetchingRef.current = false;
    setSnaps([]);
    setHasMore(true);
    setPage(p => p + 1);
  };

  // See the identical helper in useSnaps.ts for why this exists — snaps
  // fetched into `snaps` above are never revisited, so votes cast by anyone
  // after a snap was first loaded never show up until refresh() (a full
  // reset). Reconciles one item's optimistic vote against the real settled
  // value after casting a vote, without disturbing the rest of the list.
  const refreshComment = useCallback(async (author: string, permlink: string) => {
    try {
      const fresh = await getPost(author, permlink);
      setSnaps(prev => prev.map(c =>
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

  return { comments: snaps, isLoading, hasMore, loadNextPage, refresh, refreshComment };
}
