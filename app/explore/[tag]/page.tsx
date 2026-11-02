'use client';
import { Box, Text, Flex, Button, Icon, IconButton } from '@chakra-ui/react';
import { useState, useRef, useEffect, use } from 'react';
import { Discussion } from '@hiveio/dhive';
import { findPosts, getCommunityInfo } from '@/lib/hive/client-functions';
import { mutedAccountsManager } from '@/lib/hive/muted-accounts';
import { hasMutedTag } from '@/lib/hive/mutedTags';
import { useHiveUser } from '@/contexts/UserContext';
import { useUserSettings } from '@/hooks/useUserSettings';
import NextLink from 'next/link';
import { FiArrowLeft } from 'react-icons/fi';
import { FaTh, FaBars } from 'react-icons/fa';
import PostInfiniteScroll from '@/components/blog/PostInfiniteScroll';
import JoinCommunityButton from '@/components/explore/JoinCommunityButton';

const SORT_OPTIONS = [
  { label: 'Trending', value: 'trending', icon: '📈' },
  { label: 'Hot',      value: 'hot',      icon: '🔥' },
  { label: 'New',      value: 'created',  icon: '✨' },
  { label: 'Top',      value: 'payout',   icon: '💰' },
];

export default function ExploreTagPage(props: { params: Promise<{ tag: string }> }) {
  const params = use(props.params);
  const tag = decodeURIComponent(params.tag);
  const isCommunity = /^hive-\d+$/.test(tag);
  const { hiveUser } = useHiveUser();
  const { settings } = useUserSettings();
  const mutedTagsKey = settings.mutedTags.join(',');

  const [communityTitle, setCommunityTitle] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [query, setQuery] = useState('trending');
  const [allPosts, setAllPosts] = useState<Discussion[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [mutedLoaded, setMutedLoaded] = useState(false);
  const isFetching = useRef(false);
  const mutedSetRef = useRef<Set<string>>(new Set());

  const fetchParams = useRef({
    tag,
    limit: 20,
    start_author: '',
    start_permlink: '',
  });

  useEffect(() => {
    if (!isCommunity) return;
    getCommunityInfo(tag)
      .then(info => { if (info?.title) setCommunityTitle(info.title); })
      .catch(() => {});
  }, [tag, isCommunity]);

  async function fetchPosts() {
    if (isFetching.current) return;
    isFetching.current = true;
    try {
      const posts = await findPosts(query, fetchParams.current);
      if (posts.length === 0) {
        setHasMore(false);
        isFetching.current = false;
        return;
      }
      const filtered = posts.filter((post: Discussion) =>
        !post.parent_author &&
        !mutedSetRef.current.has(post.author.toLowerCase()) &&
        !hasMutedTag(post.json_metadata, settings.mutedTags)
      );
      setAllPosts(prev => [...prev, ...filtered]);
      const last = posts[posts.length - 1];
      fetchParams.current = {
        tag,
        limit: 20,
        start_author: last?.author || '',
        start_permlink: last?.permlink || '',
      };
      if (posts.length < 20) setHasMore(false);
    } catch (e) {
      // Hivemind rejects a tag with no posts ("Tag <x> does not exist"), but
      // dhive often drops that text and leaves only "category=hivemind".
      const message = e instanceof Error ? e.message : String(e);
      if (/does not exist|hivemind/i.test(message)) setHasMore(false);
      else console.error('Failed to fetch explore posts:', message);
    } finally {
      isFetching.current = false;
    }
  }

  useEffect(() => {
    setMutedLoaded(false);
    mutedAccountsManager.getMutedList(hiveUser?.name).then(set => {
      mutedSetRef.current = set;
      setMutedLoaded(true);
    });
  }, [hiveUser?.name]);

  useEffect(() => {
    if (!mutedLoaded) return;
    setAllPosts([]);
    setHasMore(true);
    fetchParams.current = { tag, limit: 20, start_author: '', start_permlink: '' };
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, mutedLoaded, tag, mutedTagsKey]);

  const displayName = communityTitle || (isCommunity ? tag : `#${tag}`);

  return (
    <Box
      id="scrollableDiv"
      mt="3"
      px={4}
      h="100vh"
      overflowY="auto"
      sx={{
        '&::-webkit-scrollbar': { display: 'none' },
        scrollbarWidth: 'none',
      }}
    >
      {/* Header */}
      <Flex align="center" gap={2} mb={4}>
        <Button
          as={NextLink}
          href="/explore"
          variant="ghost"
          size="sm"
          leftIcon={<Icon as={FiArrowLeft} />}
          px={2}
          borderRadius="10px"
          color="overlay.700"
          _hover={{ bg: 'rgba(28, 161, 241, 0.1)', color: 'white' }}
          flexShrink={0}
        >
          Explore
        </Button>
        <Text fontWeight="bold" fontSize="lg" color="text" noOfLines={1}>
          {displayName}
        </Text>
        {isCommunity && <JoinCommunityButton communityId={tag} />}
      </Flex>

      {/* Sort + view mode bar */}
      <Flex gap={2} flexWrap="wrap" align="center" mb={4}>
        {SORT_OPTIONS.map((opt) => {
          const isActive = query === opt.value;
          return (
            <Button
              key={opt.value}
              size="sm"
              variant="ghost"
              borderRadius="full"
              bg={isActive ? 'muted' : 'transparent'}
              color={isActive ? 'text' : 'gray.500'}
              borderWidth="1px"
              borderColor={isActive ? 'primary' : 'border'}
              _hover={{ bg: 'muted', color: 'text' }}
              onClick={() => setQuery(opt.value)}
              leftIcon={<Text as="span" fontSize="sm">{opt.icon}</Text>}
            >
              {opt.label}
            </Button>
          );
        })}
        <Flex gap={2} ml="auto">
          <IconButton
            aria-label="Grid view"
            icon={<FaTh />}
            size="sm"
            variant="ghost"
            bg={viewMode === 'grid' ? 'muted' : 'transparent'}
            color="text"
            borderRadius="10px"
            _hover={{ bg: 'muted' }}
            onClick={() => setViewMode('grid')}
          />
          <IconButton
            aria-label="List view"
            icon={<FaBars />}
            size="sm"
            variant="ghost"
            bg={viewMode === 'list' ? 'muted' : 'transparent'}
            color="text"
            borderRadius="10px"
            _hover={{ bg: 'muted' }}
            onClick={() => setViewMode('list')}
          />
        </Flex>
      </Flex>

      <PostInfiniteScroll
        allPosts={allPosts}
        fetchPosts={fetchPosts}
        viewMode={viewMode}
        hasMore={hasMore}
        searchMode={false}
      />
      {!hasMore && allPosts.length === 0 && (
        <Text color="overlay.500" fontSize="sm" textAlign="center" py={10} wordBreak="break-word">
          No posts found for {displayName}
        </Text>
      )}
    </Box>
  );
}
