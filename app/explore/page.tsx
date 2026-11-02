'use client';
import { useEffect, useState } from 'react';
import {
  Box, Text, SimpleGrid, Flex, Input, InputGroup, InputRightElement,
  CloseButton, Button, Icon, Wrap, WrapItem, Tag, TagLabel, Spinner, HStack, VStack,
} from '@chakra-ui/react';
import { FiSearch, FiCompass } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { Discussion } from '@hiveio/dhive';
import { getCommunityInfo } from '@/lib/hive/client-functions';
import HiveClient from '@/lib/hive/hiveclient';
import CommunityCard from '@/components/explore/CommunityCard';
import TrendingPostCard from '@/components/explore/TrendingPostCard';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCombflowSummary } from '@/hooks/useCombflowSummary';

const COMMUNITY_TAG = process.env.NEXT_PUBLIC_HIVE_COMMUNITY_TAG || '';
type TrendingScope = 'community' | 'global';

interface TrendingTag {
  name: string;
  comments: number;
  top_posts: number;
  total_payouts: string;
}

interface ResolvedCommunity extends TrendingTag {
  title: string;
  about: string;
  subscribers: number;
}

export default function ExplorePage() {
  const router = useRouter();
  const { username: currentUser } = useCurrentUser();
  const { summary: mySummary } = useCombflowSummary(currentUser ?? '');
  const [searchTerm, setSearchTerm] = useState('');
  const [communities, setCommunities] = useState<ResolvedCommunity[]>([]);
  const [tags, setTags] = useState<TrendingTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [trendingPosts, setTrendingPosts] = useState<Discussion[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingScope, setTrendingScope] = useState<TrendingScope>('community');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/trending-tags');
        const data: TrendingTag[] = await res.json();

        const communityEntries = data.filter(t => /^hive-\d+$/.test(t.name));
        const plainEntries = data.filter(t => !/^hive-\d+$/.test(t.name));
        setTags(plainEntries);

        const resolved = await Promise.allSettled(
          communityEntries.map(async (t) => {
            const info = await getCommunityInfo(t.name);
            return {
              ...t,
              title: info?.title || t.name,
              about: info?.about || '',
              subscribers: info?.subscribers || 0,
            } as ResolvedCommunity;
          })
        );

        const successful = resolved
          .filter((r): r is PromiseFulfilledResult<ResolvedCommunity> => r.status === 'fulfilled')
          .map(r => r.value);

        setCommunities(successful);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    async function loadTrending() {
      setTrendingLoading(true);
      try {
        const posts = await HiveClient.database.getDiscussions('trending', {
          tag: trendingScope === 'community' ? COMMUNITY_TAG : '',
          limit: 20,
          start_author: '',
          start_permlink: '',
        });
        // Filter out posts with no title (those are snaps, not blog posts)
        setTrendingPosts((posts as Discussion[]).filter(p => p.title?.trim()));
      } catch (e) {
        console.error('Failed to load trending posts:', e);
      } finally {
        setTrendingLoading(false);
      }
    }
    loadTrending();
  }, [trendingScope]);

  const handleSearch = () => {
    const term = searchTerm.trim();
    if (term) router.push(`/explore/${encodeURIComponent(term)}`);
  };

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
      <Flex align="center" gap={2} mb={5}>
        <Icon as={FiCompass} boxSize={5} color="primary" />
        <Text fontSize="xl" fontWeight="bold" color="text" letterSpacing="-0.02em">
          Explore Hive
        </Text>
      </Flex>

      {/* Search */}
      <Flex gap={2} mb={8}>
        <InputGroup flex={1}>
          <Input
            placeholder="Search any tag or community..."
            maxLength={50}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            bg="muted"
            borderColor="border"
            borderRadius="10px"
            color="text"
            _placeholder={{ color: 'gray.500' }}
            _focus={{ boxShadow: 'none', borderColor: 'primary' }}
          />
          {searchTerm && (
            <InputRightElement>
              <CloseButton size="sm" onClick={() => setSearchTerm('')} />
            </InputRightElement>
          )}
        </InputGroup>
        <Button
          onClick={handleSearch}
          leftIcon={<Icon as={FiSearch} />}
          colorScheme="blue"
          borderRadius="10px"
          flexShrink={0}
        >
          Go
        </Button>
      </Flex>

      {/* Personalised interests — logged-in users only */}
      {currentUser && mySummary && mySummary.top_categories.length > 0 && (
        <Box mb={8}>
          <Text
            fontSize="xs"
            fontWeight="bold"
            color="overlay.500"
            letterSpacing="widest"
            textTransform="uppercase"
            mb={3}
          >
            Based on Your Interests
          </Text>
          <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={3}>
            {mySummary.top_categories.map(cat => (
              <Box
                key={cat.id}
                as="button"
                onClick={() => router.push(`/explore/${encodeURIComponent(cat.name)}`)}
                bg="rgba(28, 161, 241, 0.06)"
                border="1px solid rgba(28, 161, 241, 0.15)"
                borderRadius="12px"
                p={4}
                textAlign="left"
                cursor="pointer"
                _hover={{ bg: 'rgba(28, 161, 241, 0.14)', borderColor: 'rgba(28, 161, 241, 0.35)', transform: 'translateY(-1px)' }}
                transition="all 0.15s"
              >
                <Text fontWeight="bold" fontSize="sm" color="text" textTransform="capitalize" mb={1}>
                  {cat.name}
                </Text>
                <Text fontSize="xs" color="overlay.500">
                  {cat.count.toLocaleString()} of your posts
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        </Box>
      )}

      {loading ? (
        <Flex justify="center" py={20}>
          <Spinner size="lg" color="primary" />
        </Flex>
      ) : (
        <>
          {/* Trending Communities */}
          {communities.length > 0 && (
            <Box mb={8}>
              <Text
                fontSize="xs"
                fontWeight="bold"
                color="overlay.500"
                letterSpacing="widest"
                textTransform="uppercase"
                mb={3}
              >
                Trending Communities
              </Text>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                {communities.map((c) => (
                  <CommunityCard
                    key={c.name}
                    tag={c.name}
                    title={c.title}
                    about={c.about}
                    subscribers={c.subscribers}
                    topPosts={c.top_posts}
                    totalPayouts={c.total_payouts}
                  />
                ))}
              </SimpleGrid>
            </Box>
          )}

          {/* Trending Tags */}
          {tags.length > 0 && (
            <Box mb={8}>
              <Text
                fontSize="xs"
                fontWeight="bold"
                color="overlay.500"
                letterSpacing="widest"
                textTransform="uppercase"
                mb={3}
              >
                Trending Tags
              </Text>
              <Wrap spacing={2}>
                {tags.map((t) => (
                  <WrapItem key={t.name}>
                    <Tag
                      as="button"
                      size="md"
                      borderRadius="full"
                      bg="rgba(28, 161, 241, 0.08)"
                      border="1px solid rgba(28, 161, 241, 0.15)"
                      color="overlay.800"
                      cursor="pointer"
                      _hover={{ bg: 'rgba(28, 161, 241, 0.18)', borderColor: 'rgba(28, 161, 241, 0.35)' }}
                      transition="all 0.15s"
                      onClick={() => router.push(`/explore/${encodeURIComponent(t.name)}`)}
                      px={3}
                      py={2}
                    >
                      <TagLabel>#{t.name}</TagLabel>
                    </Tag>
                  </WrapItem>
                ))}
              </Wrap>
            </Box>
          )}

          {/* Trending Posts */}
          <Box mb={8}>
            <Flex align="center" justify="space-between" mb={3} wrap="wrap" gap={2}>
              <Text
                fontSize="xs"
                fontWeight="bold"
                color="overlay.500"
                letterSpacing="widest"
                textTransform="uppercase"
              >
                Trending Posts
              </Text>
              <HStack spacing={2}>
                {(['community', 'global'] as const).map(scope => (
                  <Button
                    key={scope}
                    size="xs"
                    variant="ghost"
                    borderRadius="full"
                    bg={trendingScope === scope ? 'muted' : 'transparent'}
                    color={trendingScope === scope ? 'text' : 'gray.500'}
                    borderWidth="1px"
                    borderColor={trendingScope === scope ? 'primary' : 'border'}
                    _hover={{ bg: 'muted', color: 'text' }}
                    onClick={() => setTrendingScope(scope)}
                  >
                    {scope === 'community' ? 'This Community' : 'All of Hive'}
                  </Button>
                ))}
              </HStack>
            </Flex>
            {trendingLoading ? (
              <Flex justify="center" py={10}>
                <Spinner size="md" color="primary" />
              </Flex>
            ) : (
              <VStack spacing={2} align="stretch">
                {trendingPosts.map(post => (
                  <TrendingPostCard key={`${post.author}/${post.permlink}`} post={post} />
                ))}
              </VStack>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}
