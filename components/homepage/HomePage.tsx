'use client';

import { Box, Flex } from '@chakra-ui/react';
import SnapList from '@/components/homepage/SnapList';
import ScrollToTopButton from '@/components/homepage/ScrollToTopButton';
import { Suspense, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Comment } from '@hiveio/dhive'; // Ensure this import is consistent
import { ExtendedComment } from '@/hooks/useComments';
import Conversation from '@/components/homepage/Conversation';
import { useSnaps, SnapFilterType } from '@/hooks/useSnaps';
import { useBlendedFeed } from '@/hooks/useBlendedFeed';
import FeedTabFilter from '@/components/homepage/FeedTabFilter';
import NewSnapsBanner from '@/components/homepage/NewSnapsBanner';
import ScrollJumpProbe from '@/components/homepage/ScrollJumpProbe';
import PendingRewardsBanner from '@/components/homepage/PendingRewardsBanner';
import { useNewSnapsAvailable } from '@/hooks/useNewSnapsAvailable';
import OpenPodsLiveStrip from '@/components/hangouts/OpenPodsLiveStrip';
import UpcomingEventsStrip from '@/components/hangouts/UpcomingEventsStrip';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getCommunityInfo } from '@/lib/hive/client-functions';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDiscoveryCandidates } from '@/hooks/useDiscoveryCandidates';
import { useTrendingFeed } from '@/hooks/useTrendingFeed';
import { useUserSettings } from '@/hooks/useUserSettings';
import { isDiscoveryEnabledFor, DISCOVERY_INTERLEAVE_EVERY_N } from '@/lib/discovery/config';
import { homePaintedSnapCount, shouldPaintHomeFeedSeed, type PublicSnapPage } from '@/lib/hive/publicSnapPage';
import { afterLcpPaint } from '@/lib/perf/afterLcpPaint';

const RightSidebar = dynamic(() => import('@/components/layout/RightSideBar'), { ssr: false });
const SnapReplyModal = dynamic(() => import('@/components/homepage/SnapReplyModal'), { ssr: false });

/** Right column (post cards, swiper) waits until the LCP image has painted,
 *  and never mounts below the md breakpoint. Phones were downloading Swiper
 *  for a column that stays display:none. */
function DeferredRightSidebar({ engagedAuthors }: { engagedAuthors: Set<string> }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 48em)');
    let cancel = false;
    const apply = () => {
      if (!mq.matches) {
        setReady(false);
        return;
      }
      afterLcpPaint().then(() => {
        if (!cancel && mq.matches) setReady(true);
      });
    };
    apply();
    mq.addEventListener('change', apply);
    return () => {
      cancel = true;
      mq.removeEventListener('change', apply);
    };
  }, []);
  if (!ready) return null;
  return <RightSidebar engagedAuthors={engagedAuthors} />;
}

interface CommunityInfo {
  title: string;
  about: string;
}

/**
 * Manual scroll anchoring for async content that pops in ABOVE the feed,
 * inside the same scroll container (pods/events strips, rewards banner).
 * Each of those renders null until its fetch resolves, then appears —
 * inserting 50–200px above the user's scroll position, which visually
 * throws them back up the feed ("scrolling keeps jumping me back to the
 * top", mobile). Browsers' native overflow-anchor can't be relied on here:
 * iOS Safari doesn't implement it in overflow containers, and react-virtuoso
 * disables it to run its own (list-internal-only) anchoring. So: observe the
 * wrapper's height and compensate scrollTop by exactly the delta. The
 * ResizeObserver callback runs after layout but before paint, so the
 * correction is invisible. Skipped at the top of the feed (scrollTop ≈ 0),
 * where content appearing in place is what the user expects to see.
 */
function useAnchoredAboveFeed(scrollableId: string) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (el === null || typeof ResizeObserver === 'undefined') return;
    let prevHeight = el.getBoundingClientRect().height;
    const observer = new ResizeObserver(() => {
      const nextHeight = el.getBoundingClientRect().height;
      const delta = nextHeight - prevHeight;
      prevHeight = nextHeight;
      if (delta === 0) return;
      const scroller = document.getElementById(scrollableId);
      if (!scroller || scroller.scrollTop <= 1) return;
      scroller.scrollTop += delta;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollableId]);
  return ref;
}

/** Query-string behavior lives in its own suspense boundary. Calling
 *  useSearchParams from the page itself bails the nearest suspense out to
 *  client rendering, which is the layout shell — the feed HTML never ships. */
function HomeSearchParams() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get('focus') !== 'composer') return;
    router.replace('/');
    document.getElementById('scrollableDiv')?.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      document.querySelector<HTMLTextAreaElement>('#snap-composer textarea')?.focus();
    }, 400);
  }, [searchParams, router]);

  if (searchParams.get('scrolldebug') !== '1') return null;
  return <ScrollJumpProbe scrollableId="scrollableDiv" />;
}

export default function Home({ initialSnapPage = null }: { initialSnapPage?: PublicSnapPage | null }) {
  //console.log('author', process.env.NEXT_PUBLIC_THREAD_AUTHOR);
  const thread_author = 'peak.snaps';
  const thread_permlink = 'snaps';
  const communityTag = process.env.NEXT_PUBLIC_HIVE_COMMUNITY_TAG;

  const [conversation, setConversation] = useState<Comment | undefined>();
  const [reply, setReply] = useState<Comment>();
  const [isOpen, setIsOpen] = useState(false);
  const [conversationRefreshTrigger, setConversationRefreshTrigger] = useState(0);
  // Optimistic reply feedback (no full feed refetch — see handleReply):
  // per-snap reply-count deltas, keyed by "author/permlink", applied when
  // rendering the feed list; and a just-posted reply to inject straight into
  // an open conversation's thread, when the reply target is that thread's
  // top snap (the common case — see handleReply for the nested-reply cutoff).
  const [replyCountBumps, setReplyCountBumps] = useState<Map<string, number>>(new Map());
  const [pendingConversationReply, setPendingConversationReply] = useState<ExtendedComment | null>(null);
  const [activeFilter, setActiveFilter] = useState<SnapFilterType>('all');
  const [communityName, setCommunityName] = useState<string>('Community');

  const { username: user, isLoggedIn } = useCurrentUser();
  const { settings } = useUserSettings();

  useEffect(() => {
    const loadCommunityInfo = async () => {
      if (communityTag) {
        try {
          // Check sessionStorage first
          const cachedData = sessionStorage.getItem('communityData');
          if (cachedData) {
            const communityData = JSON.parse(cachedData) as CommunityInfo;
            setCommunityName(communityData.title);
          } else {
            // Fetch if not cached
            const communityData = await getCommunityInfo(communityTag);
            setCommunityName(communityData.title);
            sessionStorage.setItem('communityData', JSON.stringify(communityData));
          }
        } catch (error) {
          console.error('Failed to fetch community info', error);
        }
      }
    };

    loadCommunityInfo();
  }, [communityTag]);

  const onOpen = () => setIsOpen(true);
  const onClose = () => setIsOpen(false);

  // Deliberately does NOT call activeFeedData.refresh() — replying to an
  // existing snap doesn't change which snaps are in the feed, and a full
  // refetch there used to blow away the whole loaded list (and the user's
  // scroll position) for zero benefit. Instead: bump the replied-to snap's
  // count locally, and — when replying to the top snap of a currently-open
  // conversation — inject the real new comment straight into that thread,
  // instantly, no chain read needed (mirrors the optimistic pattern
  // useComments.addComment/updateComments already supports for exactly this).
  const handleReply = (newComment: Partial<Comment>) => {
    if (reply) {
      const parentKey = `${reply.author}/${reply.permlink}`;
      setReplyCountBumps(prev => {
        const next = new Map(prev);
        next.set(parentKey, (next.get(parentKey) ?? 0) + 1);
        return next;
      });

      // A reply to a nested comment within an open thread (not the thread's
      // top snap) intentionally skips instant injection here — it still
      // gets a real, chain-confirmed update via the refreshTrigger below,
      // just not the instant path. Keeps this fix scoped to the common case
      // (replying from the feed list, or to a thread's top snap) rather than
      // reworking the whole nested-reply tree.
      if (conversation && conversation.author === reply.author && conversation.permlink === reply.permlink) {
        setPendingConversationReply({
          ...newComment,
          parent_author: reply.author,
          parent_permlink: reply.permlink,
          children: 0,
          active_votes: [],
          json_metadata: newComment.json_metadata ?? '{}',
          replies: [],
          title: '',
        } as ExtendedComment);
      }
    }

    // Still gives an open thread a real, chain-confirmed refresh a few
    // seconds later — useComments merges rather than replaces, so this can't
    // duplicate or flash the comment already injected instantly above.
    setTimeout(() => {
      setConversationRefreshTrigger(t => t + 1);
    }, 3000);
  };

  const handleFilterChange = (filter: SnapFilterType) => {
    setActiveFilter(filter);
    setBlendedFailed(false); // retry the blended source fresh on every visit to "Latest"
    setConversation(undefined); // Close conversation view when changing filter
    if (filter === 'all') acknowledge();
  };

  // "Latest" blends snaps+waves via the sidecar's /feed endpoint when this flag
  // is on — see internal-docs/hive-activity-sidecar-feed.md. If the sidecar
  // isn't up yet (or hiccups), blendedFailed flips true and we fall back to
  // the plain snaps-only path below, so "Latest" never goes blank for visitors.
  const ENABLE_BLENDED_FEED = process.env.NEXT_PUBLIC_ENABLE_BLENDED_FEED === 'true';
  const [blendedFailed, setBlendedFailed] = useState(false);
  const showBlendedForAll = ENABLE_BLENDED_FEED && activeFilter === 'all' && !blendedFailed;

  // Discovery Engine Phase 1 — gated behind a flag + account allowlist (see
  // lib/discovery/config.ts), off for everyone else.
  const showTrendingTab = isDiscoveryEnabledFor(user);
  const isTrendingTab = activeFilter === 'trending';

  // Discovery Engine Phase 2 — "For You" 3-state design, gated to
  // allowlisted accounts (everyone else keeps today's exact
  // useSnaps('community') chronological behavior):
  //  - cold: no interest signal yet (never onboarded, or onboarded with
  //    nothing selected) — Snapie-community-scoped, engagement-ranked
  //    (fetchForYouSnapCandidates).
  //  - warm: has picked interest topics — cross-community, snaps+waves,
  //    ranked by interest-tag match + engagement (fetchWarmForYouCandidates).
  // An onboarded-but-empty-interestTags user (skipped onboarding) is treated
  // as cold — handing the warm pool an impossible "match nothing" request
  // would just waste a request for an empty result.
  const isColdStart = settings.interestsOnboardedAt === null || settings.interestTags.length === 0;
  const isForYouCold = showTrendingTab && activeFilter === 'community' && isColdStart;
  const isForYouWarm = showTrendingTab && activeFilter === 'community' && !isColdStart;
  const warmExtraQuery = `tags=${encodeURIComponent(settings.interestTags.join(','))}${user ? `&username=${encodeURIComponent(user)}` : ''}`;
  // Trending/cold-start For You share one cached pool across every visitor
  // (community mutes baked in) — this is how each request layers the
  // viewer's own personal mutes on top, same as the warm pool already does.
  const personalMuteQuery = user ? `username=${encodeURIComponent(user)}` : '';

  const snaps = useSnaps({
    filterType: activeFilter,
    username: user || undefined,
    skip: showBlendedForAll || isTrendingTab || isForYouCold || isForYouWarm, // covered by another source — don't duplicate the RPC walk
    // The blended seed is a different list. Handing it to the snaps walk
    // would paint waves, then paginate them as snap containers.
    initialPage: ENABLE_BLENDED_FEED ? null : initialSnapPage,
  });
  const blendedFeed = useBlendedFeed({
    username: user || undefined,
    enabled: ENABLE_BLENDED_FEED && activeFilter === 'all',
    initialPage: ENABLE_BLENDED_FEED ? initialSnapPage : null,
  });
  const trendingFeed = useTrendingFeed({ enabled: isTrendingTab, extraQuery: personalMuteQuery, mutedTags: settings.mutedTags });
  const forYouColdFeed = useTrendingFeed({ enabled: isForYouCold, endpoint: '/api/discovery/foryou-candidates', extraQuery: personalMuteQuery, mutedTags: settings.mutedTags });
  const forYouWarmFeed = useTrendingFeed({ enabled: isForYouWarm, endpoint: '/api/discovery/foryou-warm', extraQuery: warmExtraQuery, mutedTags: settings.mutedTags });
  const activeFeedData = showBlendedForAll ? blendedFeed : isTrendingTab ? trendingFeed : isForYouWarm ? forYouWarmFeed : isForYouCold ? forYouColdFeed : snaps;

  // Applies the optimistic reply-count bumps from handleReply on top of
  // whichever feed source is active, without any of the 5 feed-fetching
  // hooks needing their own patch/setter — just an overlay at render time.
  const feedComments = useMemo(() => {
    if (replyCountBumps.size === 0) return activeFeedData.comments;
    return activeFeedData.comments.map(c => {
      const bump = replyCountBumps.get(`${c.author}/${c.permlink}`);
      return bump ? { ...c, children: (c.children ?? 0) + bump } : c;
    });
  }, [activeFeedData.comments, replyCountBumps]);

  // Interleaving into the normal feed only makes sense for 'all' — 'For You'
  // is now itself an engagement-ranked pool for allowlisted accounts (no
  // point interleaving trending items into a feed that's already trending-
  // ordered), and 'following'/'patrons' are relationship-curated by design.
  // The dedicated 'trending' tab already *is* this same pool, so splicing it
  // into itself would just be confusing duplication.
  const discoveryEnabled = showTrendingTab && activeFilter === 'all';
  const { candidates: discoveryItems } = useDiscoveryCandidates({ enabled: discoveryEnabled, username: user || undefined, mutedTags: settings.mutedTags });

  // First-page probe: if the blended source comes back empty, fall back to
  // snaps-only for this session. Scoped to the first page only — a sidecar
  // outage is a launch-day/persistent condition worth guarding against; a
  // hiccup deep into scrolling is the same class of "ran out of results"
  // every filter's own scan cap can already legitimately produce.
  useEffect(() => {
    if (showBlendedForAll && blendedFeed.hasFetchedOnce && blendedFeed.comments.length === 0 && !blendedFeed.hasMore) {
      setBlendedFailed(true);
    }
  }, [showBlendedForAll, blendedFeed.hasFetchedOnce, blendedFeed.comments.length, blendedFeed.hasMore]);

  // Matches whatever "Latest" is actually showing right now — blended when
  // healthy, snap-only during the same fallback window the feed itself uses.
  const { newCount, acknowledge } = useNewSnapsAvailable({ source: showBlendedForAll ? 'blended' : 'snaps' });

  // Authors of snaps the current user has already upvoted in the currently
  // loaded feed — read from data already in memory for the feed itself, no
  // extra fetches. Passed down to bias the "Who to follow" widget's ranking.
  const engagedAuthors = useMemo(() => {
    const set = new Set<string>();
    if (!user) return set;
    for (const comment of activeFeedData.comments) {
      if (comment.active_votes?.some(vote => vote.voter === user)) {
        set.add(comment.author);
      }
    }
    return set;
  }, [activeFeedData.comments, user]);

  // `activeFeedData`'s identity changes on every render (it's a plain
  // object literal from whichever hook is currently active, not memoized) —
  // the effect below only runs once ([] deps), so it must read the latest
  // value through a ref rather than closing over it directly, or it'd keep
  // calling refresh() on the very first render's (possibly stale) feed.
  const activeFeedDataRef = useRef(activeFeedData);
  activeFeedDataRef.current = activeFeedData;

  // Clicking the Home button while already on `/` dispatches this event so the
  // nav components (which live outside this component tree) can trigger a reset
  // without needing direct access to our state setters.
  useEffect(() => {
    const handler = () => {
      setActiveFilter('all');
      setConversation(undefined);
      // Previously scroll-and-reset only — clicking Home while already home
      // should also pull current chain data, not just reset the UI. Same
      // full-reset refresh() already used by handleViewNewSnaps below.
      activeFeedDataRef.current.refresh?.();
      document.getElementById('scrollableDiv')?.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('snapie:go-home', handler);
    return () => window.removeEventListener('snapie:go-home', handler);
  }, []);

  // Scroll-anchor the async pop-in regions above the feed — see
  // useAnchoredAboveFeed. Two separate wrappers because the sticky tab
  // filter sits between them in the layout and must not be wrapped (a
  // wrapper would clip its sticky range).
  const stripsAnchorRef = useAnchoredAboveFeed('scrollableDiv');
  const rewardsAnchorRef = useAnchoredAboveFeed('scrollableDiv');

  // Measure the sticky tab strip so the banner can dock just below it
  // (rather than overlapping) once both are pinned to the top while scrolling.
  const tabFilterRef = useRef<HTMLDivElement>(null);
  const [tabFilterHeight, setTabFilterHeight] = useState(0);

  useEffect(() => {
    const el = tabFilterRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setTabFilterHeight(el.offsetHeight));
    observer.observe(el);
    setTabFilterHeight(el.offsetHeight);
    return () => observer.disconnect();
  }, []);

  const handleViewNewSnaps = () => {
    // A snap posted without the Snapie community tag never shows up under the
    // "For You" filter — jump to "Latest" so the new snap is guaranteed to be
    // visible. If already on "Latest", filterType won't change so it won't
    // auto-refetch — refresh explicitly in that case.
    if (activeFilter === 'all') {
      activeFeedData.refresh?.();
    } else {
      handleFilterChange('all');
    }
    acknowledge();
    document.getElementById('scrollableDiv')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Floating "back to top" button — appears once scrolled past roughly one
  // screen, matching RightSideBar.tsx's handleScroll pattern (plain
  // addEventListener, no debounce needed at this frequency).
  const [showScrollTop, setShowScrollTop] = useState(false);
  const handleScrollTopVisibility = useCallback(() => {
    const el = document.getElementById('scrollableDiv');
    if (el) setShowScrollTop(el.scrollTop > el.clientHeight);
  }, []);
  useEffect(() => {
    const el = document.getElementById('scrollableDiv');
    if (!el) return;
    el.addEventListener('scroll', handleScrollTopVisibility);
    return () => el.removeEventListener('scroll', handleScrollTopVisibility);
  }, [handleScrollTopVisibility]);

  const handleScrollTopClick = () => {
    // Same combined "scroll to top + pull fresh data" behavior as
    // handleViewNewSnaps/the Home-click handler above — clicking a
    // dedicated "start over" control already implies a reload is expected.
    activeFeedDataRef.current.refresh?.();
    document.getElementById('scrollableDiv')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const discoveryFeed = isTrendingTab || isForYouCold || isForYouWarm;
  const paintHomeSeed = shouldPaintHomeFeedSeed({
    blendedEnabled: ENABLE_BLENDED_FEED,
    showBlendedForAll,
    activeFilter,
    discoveryFeed,
    seedCount: initialSnapPage?.comments.length ?? 0,
  });
  const paintedCount = homePaintedSnapCount(initialSnapPage?.comments.length ?? 0, paintHomeSeed);

  return (
    <Flex direction={{ base: 'column', md: 'row' }} gap={{ base: 0, md: 4 }} px={{ base: 0, md: 4 }}>
      <Suspense fallback={null}>
        <HomeSearchParams />
      </Suspense>
      <Box
        h="100vh"
        overflowY="auto"
        px={{ base: 2, md: 3 }}
        flex="1"
        minW={0}
        sx={
          {
            '&::-webkit-scrollbar': {
              display: 'none',
            },
            scrollbarWidth: 'none',
          }
        }
        id='scrollableDiv'>
        {/* Anchored: both strips pop in when their fetches resolve — see
            useAnchoredAboveFeed. */}
        <Box ref={stripsAnchorRef}>
          <OpenPodsLiveStrip />
          <UpcomingEventsStrip />
        </Box>
        <Box ref={tabFilterRef}>
          <FeedTabFilter
            activeFilter={activeFilter}
            onFilterChange={handleFilterChange}
            communityName={communityName}
            isLoggedIn={isLoggedIn}
            showTrending={showTrendingTab}
          />
        </Box>
        {!conversation ? (
          <>
            {/* Anchored: pops in when the rewards fetch finds something
                unclaimed — see useAnchoredAboveFeed. */}
            <Box ref={rewardsAnchorRef}>
              <PendingRewardsBanner />
            </Box>
            <NewSnapsBanner count={newCount} onClick={handleViewNewSnaps} top={tabFilterHeight} />
            <SnapList
              author={thread_author}
              permlink={thread_permlink}
              setConversation={setConversation}
              onOpen={onOpen}
              setReply={setReply}
              data={{...activeFeedData, comments: feedComments, refresh: activeFeedData.refresh}}
              emptyMessage={
                activeFilter === 'patrons' ? 'No patrons yet — be the first to support Snapie!' :
                isTrendingTab ? 'Nothing trending right now — check back soon.' :
                isForYouWarm ? 'Nothing matching your interests right now — check back soon.' :
                isForYouCold ? 'Nothing trending in the Snapie community right now — check back soon.' :
                showBlendedForAll ? 'No snaps or waves yet.' : undefined
              }
              discoveryItems={discoveryEnabled ? discoveryItems : undefined}
              discoveryEveryN={DISCOVERY_INTERLEAVE_EVERY_N}
              paintedCount={paintedCount}
              optimizeHomeLcp
              // scrollableDiv grows to its content (flex min-height), so the
              // element that actually clips the feed is the layout scroller.
              // Observing the inner box treated the sentinel as already
              // visible and fetched the next page during the first paint.
              scrollableTargetId="app-scroll-container"
            />
          </>
        ) : (
          <Conversation
            comment={conversation}
            setConversation={setConversation}
            onOpen={onOpen}
            setReply={setReply}
            refreshTrigger={conversationRefreshTrigger}
            pendingReply={pendingConversationReply}
            onConsumedPendingReply={() => setPendingConversationReply(null)}
          />
        )}
      </Box>
      <DeferredRightSidebar engagedAuthors={engagedAuthors} />
      {isOpen && <SnapReplyModal isOpen={isOpen} onClose={onClose} comment={reply} onNewReply={handleReply} />}
      <ScrollToTopButton visible={showScrollTop && !conversation} onClick={handleScrollTopClick} />
    </Flex>
  );
}