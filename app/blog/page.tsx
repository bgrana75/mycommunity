'use client';
import { Box, Text } from '@chakra-ui/react';
import { useState, useRef, useEffect } from 'react';
import { Discussion } from '@hiveio/dhive';
import { findPosts, findFeedPosts, searchPosts } from '@/lib/hive/client-functions';
import { mutedAccountsManager } from '@/lib/hive/muted-accounts';
import { contentFilterStore } from '@/lib/contentFilter/store';
import { useContentFilter } from '@/hooks/useContentFilter';
import { useHiveUser } from '@/contexts/UserContext';
import TopBar, { FeedSource } from '@/components/blog/TopBar';
import PostInfiniteScroll from '@/components/blog/PostInfiniteScroll';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import NextLink from 'next/link';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserSettings } from '@/hooks/useUserSettings';
import { isDiscoveryEnabledFor } from '@/lib/discovery/config';

export default function Blog() {
    const { hiveUser } = useHiveUser();
    const { username } = useCurrentUser();
    const { settings } = useUserSettings();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [query, setQuery] = useState('created');
    const [feedSource, setFeedSource] = useState<FeedSource>('snapie');
    const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
    const [activeSearchTerm, setActiveSearchTerm] = useState(searchParams.get('q') || '');
    const [allPosts, setAllPosts] = useState<Discussion[]>([]);
    const [hasMore, setHasMore] = useState(true);
    const [mutedLoaded, setMutedLoaded] = useState(false);
    const isFetching = useRef(false);
    const mutedSetRef = useRef<Set<string>>(new Set());
    const forYouOffsetRef = useRef(0);
    // Persistent memory of every post ever appended to allPosts for the
    // current tab/search, across every page fetched. Same fix as
    // RightSideBar.tsx's Long Reads widget (see tasks/lessons for that bug):
    // cursor-based pagination can legitimately re-return the
    // start_author/start_permlink post as the first item of the next page,
    // and nothing here previously guarded against that across appends.
    const seenKeysRef = useRef<Set<string>>(new Set());

    function postKey(post: Discussion): string {
        return `${post.author}/${post.permlink}`;
    }

    // Discovery Engine — same flag+allowlist gate as everywhere else this
    // feature appears (see lib/discovery/config.ts).
    const showForYouTab = isDiscoveryEnabledFor(username);
    const interestTagsKey = settings.interestTags.join(',');
    const { key: mutedTagsKey } = useContentFilter();
    const isForYouCold = feedSource === 'foryou' && settings.interestTags.length === 0;
    const hasSetDefaultTab = useRef(false);

    const tag = process.env.NEXT_PUBLIC_HIVE_SEARCH_TAG
    // Snapie tab (and "For You" before any interests are picked, which
    // falls through to the same community-scoped chronological fetch — see
    // fetchPosts below) is scoped to the community tag; Following/Trending
    // span all of Hive.
    const feedTag = (feedSource === 'snapie' || isForYouCold) ? tag : '';

    // Default allowlisted accounts to "For You" instead of "Snapie" — but
    // only once, on the first render where we learn the account qualifies,
    // so a manual tab switch afterward is never fought. Non-allowlisted
    // accounts can't see/select 'foryou' at all, so they keep the original
    // 'snapie' default untouched.
    useEffect(() => {
        if (hasSetDefaultTab.current) return;
        if (showForYouTab) {
            hasSetDefaultTab.current = true;
            setFeedSource('foryou');
        }
    }, [showForYouTab]);

    const params = useRef({
        tag: tag,
        limit: 20,
        start_author: '',
        start_permlink: '',
    });

    useEffect(() => {
        const initial = searchParams.get('q') || '';
        setSearchTerm(initial);
        setActiveSearchTerm(initial);
    }, [searchParams]);

    async function fetchPosts() {
        if (isFetching.current) return;
        isFetching.current = true;
        try {
            if (activeSearchTerm) {
                // truncate: 0 — asks hivesense-api for untruncated bodies.
                // Its own server-side truncation is a plain character cut,
                // not markdown-aware, and can land mid-tag (e.g. right after
                // "![alt](" with no closing paren at all) — no client-side
                // regex can repair a markdown token whose closing bracket
                // was already cut off. Confirmed live: a search result
                // showed a raw, unclosed "![images (18).jpeg](" fragment.
                // PostCard's own stripping + CSS noOfLines clamp already
                // handles visual truncation safely on the complete text,
                // the same way every non-search path already works.
                const results = await searchPosts(activeSearchTerm, {
                    limit: 20,
                    truncate: 0,
                    fullPosts: 10,
                    observer: hiveUser?.name || '',
                });

                const seenKeys = new Set<string>();
                const topLevelResults = results.filter((post: Discussion) => {
                    const title = typeof post.title === 'string' ? post.title.trim() : '';
                    const body = typeof post.body === 'string' ? post.body.trim() : '';
                    const isTopLevel = !post.parent_author;
                    const isMuted = mutedSetRef.current.has(post.author.toLowerCase());
                    const isMutedTag = contentFilterStore.getState().filter(post);
                    const author = post.author || '';
                    const permlink = post.permlink || '';
                    const dedupeKey = `${author}/${permlink}`;
                    const hasRenderableContent = Boolean(title && body);
                    const hasGarbageNaN = /na+a+n/i.test(title) || /na+a+n/i.test(body);
                    const isDuplicate = seenKeys.has(dedupeKey);
                    if (!isDuplicate && author && permlink) seenKeys.add(dedupeKey);
                    return (
                        isTopLevel &&
                        !isMuted &&
                        !isMutedTag &&
                        !isDuplicate &&
                        Boolean(author && permlink) &&
                        hasRenderableContent &&
                        !hasGarbageNaN
                    );
                }).sort((a: Discussion, b: Discussion) => {
                    const aTime = a.created ? new Date(a.created).getTime() : 0;
                    const bTime = b.created ? new Date(b.created).getTime() : 0;
                    return bTime - aTime;
                });

                setAllPosts(topLevelResults);
                setHasMore(false);
                isFetching.current = false;
                return;
            }

            if (feedSource === 'following' && !hiveUser?.name) {
                // Logged out: the page renders a login prompt instead of a feed
                setHasMore(false);
                isFetching.current = false;
                return;
            }

            // Cold "For You" (no interestTags picked yet) deliberately falls
            // through to the same fetch path as 'snapie' below, rather than
            // returning an empty result — an empty default landing tab was
            // explicitly rejected in favor of a graceful fallback. Only the
            // warm case (tags present) hits the dedicated route.
            if (feedSource === 'foryou' && settings.interestTags.length > 0) {
                const qs = new URLSearchParams({
                    limit: '20',
                    offset: String(forYouOffsetRef.current),
                    tags: settings.interestTags.join(','),
                });
                if (username) qs.set('username', username);
                const res = await fetch(`/api/discovery/blog-foryou?${qs.toString()}`, { cache: 'no-store' });
                const data: { items: Discussion[]; hasMore: boolean } = await res.json();
                const topLevelPosts = data.items.filter((post: Discussion) =>
                    !mutedSetRef.current.has(post.author.toLowerCase()) &&
                    !contentFilterStore.getState().filter(post) &&
                    !seenKeysRef.current.has(postKey(post)),
                );
                topLevelPosts.forEach((post: Discussion) => seenKeysRef.current.add(postKey(post)));
                setAllPosts(prevPosts => [...prevPosts, ...topLevelPosts]);
                forYouOffsetRef.current += data.items.length;
                setHasMore(data.hasMore);
                isFetching.current = false;
                return;
            }

            const posts = feedSource === 'following'
                ? await findFeedPosts(hiveUser!.name, params.current)
                : await findPosts(feedSource === 'trending' ? 'trending' : query, params.current);

            if (posts.length === 0) {
                setHasMore(false);
                isFetching.current = false;
                return;
            }

            // Filter out comments, muted accounts, and anything already
            // shown this tab/search — seenKeysRef catches Hive's cursor
            // pagination legitimately re-returning the boundary post as the
            // first item of the next page, across every fetchPosts() call.
            const topLevelPosts = posts.filter((post: Discussion) => {
                const isTopLevel = !post.parent_author;
                const isMuted = mutedSetRef.current.has(post.author.toLowerCase());
                const isMutedTag = contentFilterStore.getState().filter(post);
                const isDuplicate = seenKeysRef.current.has(postKey(post));
                return isTopLevel && !isMuted && !isMutedTag && !isDuplicate;
            });
            topLevelPosts.forEach((post: Discussion) => seenKeysRef.current.add(postKey(post)));

            setAllPosts(prevPosts => [...prevPosts, ...topLevelPosts]);

            // Advance cursor to last post from the API batch (not filtered list)
            // so we don't re-fetch posts that were filtered out
            const lastPost = posts[posts.length - 1];
            params.current = {
                tag: feedTag,
                limit: 20,
                start_author: lastPost?.author || '',
                start_permlink: lastPost?.permlink || '',
            };

            if (posts.length < 20) setHasMore(false);

            isFetching.current = false;
        } catch (error) {
            console.log(error);
            isFetching.current = false;
        }
    }

    useEffect(() => {
        const next = new URLSearchParams(searchParams.toString());
        if (activeSearchTerm) next.set('q', activeSearchTerm);
        else next.delete('q');

        const queryString = next.toString();
        router.replace(queryString ? `${pathname}?${queryString}` : pathname);
    }, [activeSearchTerm, pathname, router, searchParams]);

    // Load muted accounts on mount and when user changes (login/logout)
    useEffect(() => {
        setMutedLoaded(false);
        const loadMutedAccounts = async () => {
            const mutedSet = await mutedAccountsManager.getMutedList(hiveUser?.name);
            mutedSetRef.current = mutedSet;
            setMutedLoaded(true);
        };
        loadMutedAccounts();
    }, [hiveUser?.name]);

    useEffect(() => {
        if (!mutedLoaded) return; // Wait for muted accounts to load
        
        setAllPosts([]);
        setHasMore(!activeSearchTerm);
        params.current = {
            tag: feedTag,
            limit: 20,
            start_author: '',
            start_permlink: '',
        };
        forYouOffsetRef.current = 0;
        seenKeysRef.current.clear();
        fetchPosts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, feedSource, mutedLoaded, tag, activeSearchTerm, hiveUser?.name, interestTagsKey, mutedTagsKey]); // fetchPosts excluded - callback identity changes each render

    const handleFeedSourceChange = (source: FeedSource) => {
        hasSetDefaultTab.current = true; // any manual switch cancels the auto-default effect
        setFeedSource(source);
    };

    const submitSearch = () => {
        setActiveSearchTerm(searchTerm.trim());
    };

    const clearSearch = () => {
        setSearchTerm('');
        setActiveSearchTerm('');
    };

    return (
        <Box
            id="scrollableDiv"
            mt="3"
            px={4}
            h="100vh"
            overflowY="auto"
            sx={{
                '&::-webkit-scrollbar': {
                    display: 'none',
                },
                scrollbarWidth: 'none',
            }}
        >
            <TopBar
                viewMode={viewMode}
                setViewMode={setViewMode}
                activeQuery={query}
                setQuery={setQuery}
                feedSource={feedSource}
                setFeedSource={handleFeedSourceChange}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                onSearchSubmit={submitSearch}
                onSearchClear={clearSearch}
                showForYou={showForYouTab}
            />
            {activeSearchTerm && (
                <Text fontSize="sm" color="text" opacity={0.75} mb={3}>
                    {`Search results for "${activeSearchTerm}" (${allPosts.length})`}
                </Text>
            )}
            {isForYouCold && !activeSearchTerm && (
                <Text fontSize="sm" color="gray.500" mb={3}>
                    Showing Snapie community posts —{' '}
                    <Text as={NextLink} href="/settings" color="primary" fontWeight="semibold" display="inline">
                        pick some interests
                    </Text>
                    {' '}to personalize this tab.
                </Text>
            )}
            {feedSource === 'following' && !hiveUser?.name && !activeSearchTerm ? (
                <Box textAlign="center" py={16} px={4}>
                    <Text fontSize="3xl" mb={3}>👥</Text>
                    <Text fontSize="lg" fontWeight="semibold" mb={2}>Your follow feed lives here</Text>
                    <Text fontSize="sm" color="gray.500">
                        Log in to see the latest blog posts from the people you follow on Hive.
                    </Text>
                </Box>
            ) : (
                <PostInfiniteScroll
                    allPosts={allPosts}
                    fetchPosts={fetchPosts}
                    viewMode={viewMode}
                    hasMore={hasMore}
                    searchMode={Boolean(activeSearchTerm)}
                />
            )}
        </Box>
    );
}
