import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Button, HStack, Spinner, Text } from '@chakra-ui/react';
import Snap from './Snap';
import { ExtendedComment, useComments } from '@/hooks/useComments';
import { useSnaps } from '@/hooks/useSnaps';
import SnapComposer from './SnapComposer';
import { getPayoutValue } from '@/lib/hive/client-functions';
import { interleaveAppendOnly, emptyStableInterleave, StableInterleaveState } from '@/lib/discovery/interleave';
import OffscreenGate from '@/components/shared/OffscreenGate';
import { HOME_FEED_LCP_SCAN } from '@/lib/images/feedLcp';
import { useHomeFeedLcp } from '@/hooks/useHomeFeedLcp';

type SortOrder = 'new' | 'top';

// Whole-card gate, much wider than Snap's own media gate (3000px) — this
// bounds total mounted cards for a long session (mobile browsers hard-kill
// a tab that crosses their memory ceiling; see OffscreenGate's doc comment
// for the full history). Wide on purpose: unmounting resets a card's local
// state (NSFW reveal, translation, edit mode), so this should only ever
// catch content genuinely far behind the user, never a normal scroll-back.
const CARD_GATE_MARGIN = '8000px 0px 8000px 0px';

// ── Architecture note ────────────────────────────────────────────────────
// This list deliberately keeps every card mounted for the life of the feed
// view. It replaced a react-virtuoso implementation that unmounted cards
// outside a scroll window: that kept memory flat, but every remount reset
// each embed to "size unknown" and its late re-settle (tweets, videos,
// 3Speak) shoved the scroll position — Virtuoso disables the browser's
// native scroll anchoring and its own compensation overcorrected (measured
// live on mobile: a 301px embed settle produced a 1579px upward throw),
// making doomscrolling unusable. Two OffscreenGate instances now bound
// memory instead: a tight one around just each card's media (inside Snap),
// and a much wider one around whole cards here (CARD_GATE_MARGIN) — mobile
// browsers hard-kill and silently reload a tab that stays fully mounted for
// an hour-plus session, which read as "the feed just stops going further."
//
// Infinite scroll and viewport-entry vote reconciliation are both driven by
// IntersectionObservers against the caller-owned scroll container.
// ─────────────────────────────────────────────────────────────────────────

const SORT_OPTIONS = ['new', 'top'] as const;

const snapKey = (c: ExtendedComment) => `${c.author}/${c.permlink}`;

function firstPaintedImageIndex(comments: ExtendedComment[], paintedCount: number): number {
  // Card 0 is always eager, even when a caller does not pass paintedCount.
  const limit = Math.max(paintedCount, 1);
  for (let i = 0; i < Math.min(limit, comments.length); i++) {
    if (/!\[[^\]]*]\([^)]*\)/.test(comments[i].body || '')) return i;
  }
  return -1;
}

interface SnapListProps {
  author: string
  permlink: string
  setConversation: (conversation: ExtendedComment) => void;
  onOpen: () => void;
  setReply: (reply: ExtendedComment) => void;
  post?: boolean;
  data: InfiniteScrollData
  /** Shown when a completed fetch comes back with zero comments. Lets callers
   *  give a filter-specific message (e.g. the Patrons tab) instead of the
   *  generic default. */
  emptyMessage?: React.ReactNode
  /** Discovery Engine Phase 1 — optional, undefined/empty changes nothing for
   *  any existing caller. Spliced in after sorting, only when sortOrder is
   *  'new' — see the interleave call below for why. */
  discoveryItems?: ExtendedComment[]
  discoveryEveryN?: number
  /** id of the ancestor element that actually scrolls, used as the
   *  IntersectionObserver root for pagination and reconciliation. Defaults
   *  to 'scrollableDiv', the local scroll box every caller except PostPage
   *  defines for itself — see PostPage's own call site for why it needs to
   *  pass something else. */
  scrollableTargetId?: string
  /** Home feed only. GIF, video, and oversized media are not the LCP image. */
  optimizeHomeLcp?: boolean
  /** Leading cards whose contents are in the first HTML. 0 keeps every card
   *  unmounted until the observer approaches it. */
  paintedCount?: number
}

interface InfiniteScrollData {
  comments: ExtendedComment[];
  loadNextPage: () => void; // Default can be an empty function in usage
  isLoading: boolean;
  hasMore: boolean; // Default can be `false` in usage
  /** True once at least one fetch attempt has completed (success or error).
   *  Distinct from `hasMore` — a capped fetch can legitimately come back
   *  empty while `hasMore` is still true (more unscanned history exists),
   *  so the empty state can't rely on `!hasMore` alone anymore. */
  hasFetchedOnce?: boolean;
  /** True when the last page fetch failed after retries. `hasMore` stays
   *  true so the feed can resume; this only drives a visible retry prompt. */
  loadError?: boolean;
  refresh?: () => void; // Function to refresh the feed
  /** Reconciles one comment's optimistic vote data against the real settled
   *  chain value — see the matching helper in useSnaps.ts/useProfileSnaps.ts
   *  for why this exists (a comment is otherwise never revisited once
   *  fetched). Optional since useComments.ts doesn't have one yet. */
  refreshComment?: (author: string, permlink: string) => void;
}

export default function SnapList(
  {
    author,
    permlink,
    setConversation,
    onOpen,
    setReply,
    post,
    data,
    emptyMessage = 'No snaps yet.',
    discoveryItems,
    discoveryEveryN = 5,
    scrollableTargetId = 'scrollableDiv',
    optimizeHomeLcp = false,
    paintedCount = 0,
}: SnapListProps) {
  const { comments, loadNextPage, isLoading, hasMore, hasFetchedOnce, loadError, refresh, refreshComment } = data
  // Older data sources (useComments, useProfileSnaps) don't track this yet —
  // fall back to the previous "!hasMore means done" inference for them.
  const fetchComplete = hasFetchedOnce ?? !hasMore;
  const [sortOrder, setSortOrder] = useState<SortOrder>('new');

  const [scrollParentEl, setScrollParentEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setScrollParentEl(document.getElementById(scrollableTargetId));
  }, [scrollableTargetId]);

  // `refresh`'s own identity changes every render (it's a plain closure
  // from useSnaps, not memoized) — read the latest value through a ref
  // rather than closing over it directly.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const handleNewComment = useCallback(() => {
    // Simple feed refresh after posting with delay for blockchain to catch up
    if (refreshRef.current) {
      setTimeout(() => {
        refreshRef.current?.();
      }, 3000); // 3 second delay to let Hive blockchain propagate the transaction
    }
  }, []);

  comments.sort((a: ExtendedComment, b: ExtendedComment) => {
    if (sortOrder === 'top') {
      return parseFloat(getPayoutValue(b)) - parseFloat(getPayoutValue(a));
    }
    return new Date(b.created).getTime() - new Date(a.created).getTime();
  });

  // Discovery candidates only make sense against the chronological view —
  // 'top' is an explicit request for payout ranking, and injecting
  // engagement-ranked items there would contradict what the user just asked
  // for. Must happen after the sort above, not before — comments.sort()
  // mutates in place and re-runs on every render, so anything spliced in
  // upstream of it would just get reshuffled back out.
  //
  // Append-only (interleaveAppendOnly, not interleaveCandidates): the
  // candidate pool is live — empty on first paint, filled a beat later, and
  // wholesale-replaced by useDiscoveryCandidates' periodic refetch. A
  // from-scratch recompute against that pool changed which item sat at
  // already-rendered positions mid-scroll, shifting content above the
  // user's viewport. The state ref lives for the feed view's lifetime;
  // interleaveAppendOnly itself detects a refresh() reset and starts over.
  const interleaveStateRef = useRef<StableInterleaveState<ExtendedComment>>(emptyStableInterleave());
  const displayComments = sortOrder === 'new'
    ? interleaveAppendOnly(interleaveStateRef.current, comments, discoveryItems ?? [], discoveryEveryN)
    : comments;

  // Leading snaps only. A photo further down the infinite list is not LCP.
  const homeLcp = useHomeFeedLcp(
    optimizeHomeLcp
      ? displayComments.slice(0, HOME_FEED_LCP_SCAN).map((comment) => comment.body)
      : null,
  );

  // ── Viewport-entry vote/payout reconciliation ──────────────────────────
  // A comment's vote data is frozen at fetch time (see refreshComment's doc
  // in the hooks); refresh each one once, when it first becomes visible.
  // Deferred to a scroll lull — firing setComments bursts mid-gesture used
  // to produce a new data array under the user's finger repeatedly, which
  // fought the browser's scroll physics (the original mobile scroll bug,
  // pre-virtualization). One refresh per item per session.
  const refreshedRef = useRef<Set<string>>(new Set());
  const pendingKeysRef = useRef<Set<string>>(new Set());
  const isScrollingRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshCommentRef = useRef(refreshComment);
  refreshCommentRef.current = refreshComment;

  const flushPending = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    const doRefresh = refreshCommentRef.current;
    if (!doRefresh) return;
    for (const key of Array.from(pendingKeysRef.current)) {
      pendingKeysRef.current.delete(key);
      if (refreshedRef.current.has(key)) continue;
      refreshedRef.current.add(key);
      const slash = key.indexOf('/');
      doRefresh(key.slice(0, slash), key.slice(slash + 1));
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (!isScrollingRef.current) {
      flushPending();
      return;
    }
    // Mid-scroll: wait for a brief lull instead of a full stop, so a long
    // flick-after-flick session still reconciles what it passes.
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(flushPending, 350);
  }, [flushPending]);

  // Track whether the user is actively scrolling the feed's container.
  // The same listener also drives pagination (see the sentinel section
  // below for why scroll events, not just observer transitions).
  useEffect(() => {
    if (!scrollParentEl) return;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      isScrollingRef.current = true;
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        isScrollingRef.current = false;
        flushPending();
      }, 200);

      const sentinel = sentinelRef.current;
      if (sentinel) {
        const rootBottom = scrollParentEl.getBoundingClientRect().bottom;
        if (sentinel.getBoundingClientRect().top - rootBottom < 2000) {
          loadNextPageRef.current();
        }
      }
    };
    scrollParentEl.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scrollParentEl.removeEventListener('scroll', onScroll);
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, [scrollParentEl, flushPending]);

  // Observe every card; queue its reconciliation the first time it enters
  // the viewport. The observer fires immediately for the initial screenful,
  // which covers the old explicit "bootstrap" pass.
  const listRef = useRef<HTMLDivElement | null>(null);
  const cardObserverRef = useRef<IntersectionObserver | null>(null);
  const observedCardsRef = useRef<WeakSet<Element>>(new WeakSet());

  useEffect(() => {
    if (!refreshComment) return;
    const observer = new IntersectionObserver(entries => {
      let queued = false;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const key = (entry.target as HTMLElement).dataset.snapKey;
        if (!key || refreshedRef.current.has(key)) continue;
        pendingKeysRef.current.add(key);
        queued = true;
      }
      if (queued) scheduleFlush();
    }, { root: scrollParentEl });
    cardObserverRef.current = observer;
    observedCardsRef.current = new WeakSet();
    return () => {
      observer.disconnect();
      cardObserverRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollParentEl, refreshComment ? true : false, scheduleFlush]);

  useEffect(() => {
    const observer = cardObserverRef.current;
    const listEl = listRef.current;
    if (!observer || !listEl) return;
    for (const el of Array.from(listEl.querySelectorAll<HTMLElement>('[data-snap-key]'))) {
      if (observedCardsRef.current.has(el)) continue;
      observedCardsRef.current.add(el);
      observer.observe(el);
    }
  }, [displayComments]);

  useEffect(() => () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
  }, []);

  // ── Infinite scroll ────────────────────────────────────────────────────
  // A sentinel below the list requests the next page as it approaches. Three
  // triggers, deliberately redundant, because each has a hole on its own:
  //  - The IntersectionObserver fires only on TRANSITIONS. In a continuous
  //    doomscroll the sentinel gets pushed down by each appended page but
  //    never actually leaves the 2000px margin, so after the first firing
  //    it can go silent forever (this stalled the feed at "about an hour
  //    deep" in production). It's still needed for the no-scroll cases —
  //    initial load, or a page short enough to leave the sentinel in view.
  //  - The scroll listener above re-checks proximity on every scroll event,
  //    which retries naturally; the data hooks' own isLoading/throttle
  //    guards make the repeated calls cheap no-ops.
  //  - The post-fetch effect below re-fires after each page lands, but a
  //    fetch usually finishes inside the hooks' 1s throttle window (which
  //    silently swallows the call), so it retries once again after the
  //    window has passed.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const sentinelVisibleRef = useRef(false);
  const loadNextPageRef = useRef(loadNextPage);
  loadNextPageRef.current = loadNextPage;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      sentinelVisibleRef.current = entry.isIntersecting;
      if (entry.isIntersecting) loadNextPageRef.current();
    }, { root: scrollParentEl, rootMargin: '2000px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollParentEl, hasMore]);

  useEffect(() => {
    if (isLoading || !hasMore) return;
    if (sentinelVisibleRef.current) loadNextPageRef.current();
    const retry = setTimeout(() => {
      if (sentinelVisibleRef.current) loadNextPageRef.current();
    }, 1100);
    return () => clearTimeout(retry);
  }, [isLoading, hasMore, comments.length]);

  if (isLoading && comments.length === 0) {
    return (
      <Box textAlign="center" mt={4}>
        <Spinner size="xl" />
        <Text>Loading posts...</Text>
      </Box>
    );
  }

  if (!isLoading && fetchComplete && comments.length === 0) {
    return (
      <Box textAlign="center" mt={8} color="gray.500">
        <Text fontSize="lg">{emptyMessage}</Text>
      </Box>
    );
  }

  const showSortToggle = post && comments.length > 1;

  return (
    <>
      {!post && <Box id="snap-composer"><SnapComposer pa={author} pp={permlink} onNewComment={handleNewComment} onClose={() => null} /></Box>}
      {showSortToggle && (
        <HStack spacing={2} px={2} pt={3} pb={1}>
          {SORT_OPTIONS.map(opt => (
            <Button
              key={opt}
              size="sm"
              variant="ghost"
              borderRadius="full"
              bg={sortOrder === opt ? 'muted' : 'transparent'}
              color={sortOrder === opt ? 'text' : 'gray.500'}
              borderWidth="1px"
              borderColor={sortOrder === opt ? 'primary' : 'border'}
              _hover={{ bg: 'muted', color: 'text' }}
              onClick={() => setSortOrder(opt)}
            >
              {opt === 'new' ? '✨ New' : '💰 Top'}
            </Button>
          ))}
        </HStack>
      )}
      <Box ref={listRef} mx="auto" px={{ base: 0, md: 2 }}>
        {displayComments.map((comment, index) => {
          const imagePriority = index === firstPaintedImageIndex(displayComments, paintedCount);
          return (
          // One element serves three roles: the data-snap-key anchor the
          // pagination/reconciliation observers track (must never
          // disappear), the content-visibility target (native
          // render-skipping for cards outside the viewport, whose own
          // scroll anchoring preserves each card's last-rendered size —
          // 'auto' in contain-intrinsic-size), and the wide-margin
          // whole-card gate that bounds total mounted cards for a long
          // session (see CARD_GATE_MARGIN above). Deliberately NOT three
          // nested divs — see OffscreenGate's doc comment for why a nested
          // IntersectionObserver target inside a content-visibility:auto
          // ancestor is fragile.
          // The leading `paintedCount` cards start mounted so their author,
          // body, and counts are in the server HTML. The rest reserve 400px
          // (the same stand-in as contain-intrinsic-size) so a collapsed
          // list doesn't pull the sentinel into the 2000px prefetch margin.
          // Card 0 is not gated and has no content-visibility. Every painted
          // card's photo is in the HTML too: a later card's image is often
          // the largest box in the first viewport, and a client-only mount
          // would make it the LCP after hydration.
          index === 0 ? (
            <Box key={snapKey(comment)} data-snap-key={snapKey(comment)}>
              <Snap
                comment={comment}
                onOpen={onOpen}
                setReply={setReply}
                refreshComment={refreshComment}
                priorityUrl={optimizeHomeLcp ? homeLcp.priorityUrl : null}
                deferUrls={optimizeHomeLcp ? homeLcp.deferUrls : undefined}
                reserveMediaSpace
                eagerMedia
                imagePriority={imagePriority}
                {...(!post ? { setConversation } : {})}
              />
            </Box>
          ) : (
          <OffscreenGate
            key={snapKey(comment)}
            data-snap-key={snapKey(comment)}
            rootMargin={CARD_GATE_MARGIN}
            initiallyMounted={index < paintedCount}
            unmountedMinHeight={paintedCount > 0 && index >= paintedCount ? 400 : 0}
            sx={index < paintedCount ? undefined : { contentVisibility: 'auto', containIntrinsicSize: 'auto 400px' }}
          >
            <Snap
              comment={comment}
              onOpen={onOpen}
              setReply={setReply}
              refreshComment={refreshComment}
              priorityUrl={optimizeHomeLcp ? homeLcp.priorityUrl : null}
              deferUrls={optimizeHomeLcp ? homeLcp.deferUrls : undefined}
              reserveMediaSpace={index < paintedCount}
              eagerMedia={index < paintedCount}
              imagePriority={imagePriority}
              {...(!post ? { setConversation } : {})}
            />
          </OffscreenGate>
          )
          );
        })}
      </Box>
      {hasMore && (
        <Box ref={sentinelRef} display="flex" justifyContent="center" alignItems="center" py={5}>
          {loadError && !isLoading ? (
            <Button size="sm" variant="outline" onClick={() => loadNextPageRef.current()}>
              Couldn&apos;t load more snaps. Tap to retry
            </Button>
          ) : (
            <Spinner size="xl" color="primary" />
          )}
        </Box>
      )}
    </>
  );
}
