'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Heading, Text, Spinner, Alert, AlertIcon, Container,
  Flex, Icon, Tabs, TabList, Tab, TabPanels, TabPanel,
  Button, useDisclosure,
} from '@chakra-ui/react';
import { FiEdit2, FiAward } from 'react-icons/fi';
import NextLink from 'next/link';
import { usePointsSummary } from '@/hooks/usePointsSummary';
import { POINTS_FEATURE_FLAG } from '@/lib/points/config';
import EditProfileModal from '@/components/wallet/EditProfileModal';
import { Comment } from '@hiveio/dhive';
import useHiveAccount from '@/hooks/useHiveAccount';
import { FaGlobe } from 'react-icons/fa';
import { getProfile, findPosts, getAccountPosts } from '@/lib/hive/client-functions';
import PostGrid from '../blog/PostGrid';
import InfiniteScroll from 'react-infinite-scroll-component';
import UserActionButtons from './UserActionButtons';
import FollowersModal from './FollowersModal';
import SnapList from '@/components/homepage/SnapList';
import Conversation from '@/components/homepage/Conversation';
import SnapReplyModal from '@/components/homepage/SnapReplyModal';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthorMuteGate } from '@/hooks/useAuthorMuteGate';
import MutedAuthorNotice from '@/components/shared/MutedAuthorNotice';
import { Avatar } from '@/components/shared/Avatar';
import { MoodBadgeIcon } from '@/components/shared/MoodBadgeIcon';
import { useMoodBadges } from '@/hooks/useMoodBadges';
import { useProfileSnaps } from '@/hooks/useProfileSnaps';
import { ExtendedComment } from '@/hooks/useComments';
import CurationQualityCard from './CurationQualityCard';
import CombflowInsights from './CombflowInsights';
import { useUserPresence } from '@/hooks/useUserPresence';
import { useHangout } from '@/contexts/HangoutContext';
import { usePatronStatus } from '@/hooks/usePatronStatus';
import PatronBadge from '@/components/shared/PatronBadge';
import WitnessBadge from '@/components/shared/WitnessBadge';
import AccountBadges from './AccountBadges';
import type { ProfileSeedAccount } from '@/lib/hive/profileSeed';
import ProfileCover from '@/components/shared/ProfileCover';

interface ProfilePageProps {
  username: string;
  /** Server-rendered header. Without it the first paint is a spinner. */
  initialAccount?: ProfileSeedAccount | null;
  initialProfile?: any;
}

export default function ProfilePage({ username, initialAccount = null, initialProfile = null }: ProfilePageProps) {
  const { username: user } = useCurrentUser();
  const { hiveAccount: fetchedAccount, isLoading, error } = useHiveAccount(username);
  const hiveAccount = fetchedAccount ?? initialAccount;
  const muteGate = useAuthorMuteGate(username);
  const [profileInfo, setProfileInfo] = useState<any>(initialProfile);

  // Posts tab state
  const [posts, setPosts] = useState<any[]>([]);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const isFetching = useRef(false);
  const tag = process.env.NEXT_PUBLIC_HIVE_COMMUNITY_TAG;
  const params = useRef({
    author: username,
    start_permlink: '',
    before_date: new Date().toISOString().split('.')[0],
    limit: 12,
  });

  // Reblogs tab state — lazily loaded the first time the tab is opened (see
  // handleTabChange) so we don't hit the blog-feed API for visitors who never
  // look at it. The cursor tracks the last RAW blog-feed item (own post or
  // reblog) so paging advances through the whole feed even when a page happens
  // to contain no reblogs after filtering.
  const REBLOG_PAGE_LIMIT = 20;
  const [reblogs, setReblogs] = useState<any[]>([]);
  const [hasMoreReblogs, setHasMoreReblogs] = useState(true);
  const [isLoadingReblogs, setIsLoadingReblogs] = useState(false);
  const isFetchingReblogs = useRef(false);
  const reblogsLoaded = useRef(false);
  const reblogParams = useRef({ start_author: '', start_permlink: '' });

  // Followers modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'followers' | 'following'>('followers');

  // Points badge (Stage 2) — a profile's all-time earnings, gated on the flag.
  const profilePoints = usePointsSummary(POINTS_FEATURE_FLAG ? username : null);

  // Snaps tab state
  const profileSnaps = useProfileSnaps(username);
  const [conversation, setConversation] = useState<Comment | undefined>();
  const [reply, setReply] = useState<ExtendedComment | undefined>();
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const [conversationRefreshTrigger, setConversationRefreshTrigger] = useState(0);

  async function fetchPosts() {
    if (isFetching.current) return;
    isFetching.current = true;
    setIsLoadingPosts(true);
    try {
      const newPosts = await findPosts('author_before_date', params.current);
      if (newPosts.length > 0) {
        setPosts(prev => {
          const seen = new Set(prev.map((p: any) => `${p.author}/${p.permlink}`));
          return [...prev, ...newPosts.filter((p: any) => !seen.has(`${p.author}/${p.permlink}`))];
        });
        params.current = {
          author: username,
          start_permlink: newPosts[newPosts.length - 1].permlink,
          before_date: newPosts[newPosts.length - 1].created,
          limit: 12,
        };
        if (newPosts.length < params.current.limit) setHasMorePosts(false);
      } else {
        setHasMorePosts(false);
      }
    } catch (err) {
      console.error('Failed to fetch posts', err);
    } finally {
      isFetching.current = false;
      setIsLoadingPosts(false);
    }
  }

  async function fetchReblogs() {
    if (isFetchingReblogs.current) return;
    isFetchingReblogs.current = true;
    setIsLoadingReblogs(true);
    try {
      const batch = await getAccountPosts(
        username,
        REBLOG_PAGE_LIMIT,
        user || '',
        reblogParams.current.start_author,
        reblogParams.current.start_permlink,
      );
      if (Array.isArray(batch) && batch.length > 0) {
        // A reblog is someone else's post surfaced on this account's blog.
        const onlyReblogs = batch.filter((p: any) => p.author !== username);
        setReblogs(prev => {
          const seen = new Set(prev.map((p: any) => `${p.author}/${p.permlink}`));
          return [...prev, ...onlyReblogs.filter((p: any) => !seen.has(`${p.author}/${p.permlink}`))];
        });
        const last = batch[batch.length - 1];
        reblogParams.current = { start_author: last.author, start_permlink: last.permlink };
        // Fewer than a full page means we've reached the end of the blog feed.
        if (batch.length < REBLOG_PAGE_LIMIT) setHasMoreReblogs(false);
      } else {
        setHasMoreReblogs(false);
      }
    } catch (err) {
      console.error('Failed to fetch reblogs', err);
    } finally {
      isFetchingReblogs.current = false;
      setIsLoadingReblogs(false);
    }
  }

  // Load reblogs the first time the Reblogs tab (index 2) is opened.
  function handleTabChange(index: number) {
    if (index === 2 && !reblogsLoaded.current) {
      reblogsLoaded.current = true;
      fetchReblogs();
    }
  }

  // Reset posts when username changes
  useEffect(() => {
    setPosts([]);
    setHasMorePosts(true);
    isFetching.current = false;
    params.current = {
      author: username,
      start_permlink: '',
      before_date: new Date().toISOString().split('.')[0],
      limit: 12,
    };
    // Reset reblogs too, so switching profiles re-fetches on next tab open.
    setReblogs([]);
    setHasMoreReblogs(true);
    isFetchingReblogs.current = false;
    reblogsLoaded.current = false;
    reblogParams.current = { start_author: '', start_permlink: '' };
  }, [username]);

  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  useEffect(() => {
    const fetchProfileInfo = async () => {
      try {
        const profileData = await getProfile(username, user || '');
        setProfileInfo(profileData);
      } catch (err) {
        console.error('Failed to fetch profile info', err);
      }
    };
    if (username) fetchProfileInfo();
  }, [username, user]);

  const isOwner = !!user && user === username;
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const presence = useUserPresence(username);
  const { getTier } = usePatronStatus();
  const { getEquippedBadge } = useMoodBadges();
  const { openRoom } = useHangout();

  const profileMeta = profileInfo?.metadata?.profile || {};
  const followers = profileInfo?.stats?.followers || 0;
  const following = profileInfo?.stats?.following || 0;
  const postCount = profileInfo?.post_count ?? null;
  const memberSince = profileInfo?.created ? new Date(profileInfo.created).getFullYear() : null;
  const location = profileMeta.location || '';
  const about = profileMeta.about || '';
  const coverImage = profileMeta.cover_image || '';
  const website = profileMeta.website?.trim() || '';
  const hasWebsite = website.replace(/^https?:\/\//i, '').trim().length > 0;

  const handleSnapReply = () => {
    setTimeout(() => {
      profileSnaps.refresh?.();
      setConversationRefreshTrigger(t => t + 1);
    }, 3000);
  };

  // A server seed already has the header. Waiting on the client mute check
  // and the account refetch would put a spinner in the first HTML again.
  const seeded = initialAccount != null && initialProfile != null;
  if (error && !hiveAccount) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Alert status="error" borderRadius="md" variant="solid">
          <AlertIcon />
          {error}
        </Alert>
      </Box>
    );
  }

  if (!hiveAccount || (!seeded && (isLoading || muteGate.isChecking))) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Spinner size="xl" color="primary" />
      </Box>
    );
  }

  if (muteGate.isMuted) {
    return (
      <MutedAuthorNotice
        author={username}
        canUnmute={muteGate.canUnmute}
        isRelationshipLoading={muteGate.isRelationshipLoading}
        isProcessing={muteGate.isProcessing}
        onUnmute={muteGate.unmute}
      />
    );
  }

  return (
    <Box
      id="scrollableDiv"
      h="100vh"
      overflowY="auto"
      overflowX="hidden"
      sx={{
        '&::-webkit-scrollbar': { display: 'none' },
        scrollbarWidth: 'none',
      }}
    >
    <Box color="text" maxW="container.lg" mx="auto" w="100%">
      {/* Cover image */}
      <Box position="relative" height="200px">
        <Container id="cover" maxW="container.lg" p={0} overflow="hidden" position="relative" height="100%">
          <ProfileCover
            url={coverImage}
            alt={`${hiveAccount?.name} cover`}
            fallback={
              <Box
                width="100%"
                height="100%"
                bgGradient="linear(to-br, blue.700, purple.600, teal.500)"
              />
            }
          />
        </Container>
      </Box>

      {/* Profile header */}
      <Flex position="relative" mt={-16} p={4} alignItems="center" boxShadow="lg" justifyContent="space-between">
        <Box position="absolute" top={0} left={0} right={0} bottom={0} bg="muted" opacity={0.85} zIndex={1} />

        <Flex alignItems="center" zIndex={2} position="relative">
          <Avatar
            username={username}
            size="100px"
            sx={{ marginRight: '16px' }}
            overlay={
              getEquippedBadge(username)
                ? <MoodBadgeIcon sku={getEquippedBadge(username)!} username={username} size="44px" />
                : undefined
            }
          />
          <Box>
            <Flex alignItems="center" gap={2} flexWrap="wrap">
              <Heading as="h2" size="lg" color="primary" mr={2}>
                {profileMeta.name || username}
              </Heading>
              <Box display="flex" alignItems="center" justifyContent="center" width="15px" height="15px" bg="gray.200" color="gray.700" fontWeight="bold" fontSize="xs">
                {profileInfo?.reputation ? Math.round(profileInfo.reputation) : 0}
              </Box>
              <PatronBadge tier={getTier(username)} />
              <WitnessBadge voted={hiveAccount?.witness_votes?.includes('snapie')} />
              {presence?.online && (
                <Box
                  as="button"
                  display="inline-flex"
                  alignItems="center"
                  gap={1}
                  px={2}
                  py={0.5}
                  borderRadius="full"
                  bg="rgba(229, 57, 53, 0.15)"
                  border="1px solid rgba(229, 57, 53, 0.4)"
                  onClick={() => presence.roomName && openRoom(presence.roomName)}
                  cursor={presence.roomName ? 'pointer' : 'default'}
                  _hover={presence.roomName ? { bg: 'rgba(229, 57, 53, 0.25)' } : {}}
                  transition="background 0.15s"
                >
                  <Box w="6px" h="6px" borderRadius="full" bg="red.500" flexShrink={0} />
                  <Text fontSize="xs" fontWeight={600} color="red.400" lineHeight={1}>
                    {presence.roomTitle ? `Live: ${presence.roomTitle}` : 'Live now'}
                  </Text>
                </Box>
              )}
            </Flex>

            <Text fontSize="xs" color="text">
              <Text
                as="span"
                cursor="pointer"
                _hover={{ textDecoration: 'underline', color: 'primary' }}
                onClick={() => { setModalType('following'); setModalOpen(true); }}
              >
                Following: {following}
              </Text>
              {' | '}
              <Text
                as="span"
                cursor="pointer"
                _hover={{ textDecoration: 'underline', color: 'primary' }}
                onClick={() => { setModalType('followers'); setModalOpen(true); }}
              >
                Followers: {followers}
              </Text>
              {postCount != null && (
                <>{' | '}Posts: {postCount.toLocaleString()}</>
              )}
              {location && <>{' | '}Location: {location}</>}
              {memberSince && <>{' | '}Member since {memberSince}</>}
              {about && <><br />{about}</>}
            </Text>

            <AccountBadges username={username} />

            {POINTS_FEATURE_FLAG && profilePoints && profilePoints.lifetimeEarned > 0 && (
              <Flex
                as={NextLink}
                href="/leaderboard"
                display="inline-flex"
                alignItems="center"
                gap={2}
                mt={2}
                px={3}
                py={1}
                borderRadius="full"
                bg="rgba(28, 161, 241, 0.1)"
                border="1px solid"
                borderColor="rgba(28, 161, 241, 0.3)"
                w="fit-content"
                _hover={{ bg: 'rgba(28, 161, 241, 0.16)' }}
                transition="background 0.15s"
              >
                <Icon as={FiAward} boxSize={4} color="primary" />
                <Text fontSize="sm" fontWeight="medium" color="text">
                  {profilePoints.lifetimeEarned.toLocaleString()} Snapie Points
                  {profilePoints.rank != null && ` · #${profilePoints.rank}`}
                </Text>
              </Flex>
            )}

            {hasWebsite && (
              <Flex alignItems="center">
                <Icon as={FaGlobe} w={2} h={2} onClick={() => window.open(website, '_blank')} style={{ cursor: 'pointer' }} />
                <Text ml={2} fontSize="xs" color="primary">{website}</Text>
              </Flex>
            )}
          </Box>
        </Flex>

        <Box zIndex={2} position="relative">
          {isOwner ? (
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<Icon as={FiEdit2} boxSize={3.5} />}
              onClick={onEditOpen}
              color="overlay.500"
              borderRadius="full"
              px={3}
              _hover={{ color: 'primary', bg: 'rgba(24,168,255,0.08)' }}
            >
              Edit Profile
            </Button>
          ) : (
            <UserActionButtons targetUsername={username} currentUsername={user || null} />
          )}
        </Box>
      </Flex>

      {/* Curation score + content profile */}
      <Container maxW="container.lg" mt={4} px={4}>
        <CurationQualityCard username={username} />
        <CombflowInsights username={username} />
      </Container>

      {/* Tabs */}
      <Container maxW="container.lg" mt={3} px={0}>
        <Tabs defaultIndex={0} colorScheme="blue" isLazy onChange={handleTabChange}>
          <TabList px={4}>
            <Tab>Snaps</Tab>
            <Tab>Posts</Tab>
            <Tab>Reblogs</Tab>
          </TabList>

          <TabPanels>
            {/* Snaps tab */}
            <TabPanel px={0} pt={2}>
              {conversation ? (
                <Conversation
                  comment={conversation}
                  setConversation={setConversation}
                  onOpen={() => setIsReplyOpen(true)}
                  setReply={(c) => setReply(c as ExtendedComment)}
                  refreshTrigger={conversationRefreshTrigger}
                />
              ) : (
                <SnapList
                  author="peak.snaps"
                  permlink="snaps"
                  setConversation={setConversation}
                  onOpen={() => setIsReplyOpen(true)}
                  setReply={(c) => setReply(c as ExtendedComment)}
                  data={profileSnaps}
                />
              )}
            </TabPanel>

            {/* Posts tab */}
            <TabPanel px={0}>
              {!isLoadingPosts && posts.length === 0 && !hasMorePosts && (
                <Box textAlign="center" mt={8} color="gray.500">
                  <Text fontSize="lg">No posts yet.</Text>
                </Box>
              )}
              <InfiniteScroll
                dataLength={posts.length}
                next={fetchPosts}
                hasMore={hasMorePosts}
                scrollableTarget="scrollableDiv"
                loader={
                  <Box display="flex" justifyContent="center" alignItems="center" py={8}>
                    <Spinner size="xl" color="primary" />
                  </Box>
                }
              >
                {posts && <PostGrid posts={posts} columns={3} />}
              </InfiniteScroll>
            </TabPanel>

            {/* Reblogs tab */}
            <TabPanel px={0}>
              {!isLoadingReblogs && reblogs.length === 0 && !hasMoreReblogs && (
                <Box textAlign="center" mt={8} color="gray.500">
                  <Text fontSize="lg">No reblogs yet.</Text>
                </Box>
              )}
              <InfiniteScroll
                dataLength={reblogs.length}
                next={fetchReblogs}
                hasMore={hasMoreReblogs}
                scrollableTarget="scrollableDiv"
                loader={
                  <Box display="flex" justifyContent="center" alignItems="center" py={8}>
                    <Spinner size="xl" color="primary" />
                  </Box>
                }
              >
                {reblogs && <PostGrid posts={reblogs} columns={3} />}
              </InfiniteScroll>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Container>

      <FollowersModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        username={username}
        type={modalType}
      />

      {isReplyOpen && (
        <SnapReplyModal
          isOpen={isReplyOpen}
          onClose={() => setIsReplyOpen(false)}
          comment={reply}
          onNewReply={handleSnapReply}
        />
      )}

      {isOwner && (
        <EditProfileModal
          isOpen={isEditOpen}
          onClose={onEditClose}
          username={username}
          initialData={{
            name: profileMeta.name || '',
            about: profileMeta.about || '',
            location: profileMeta.location || '',
            website: profileMeta.website || '',
            profileImage: profileMeta.profile_image || '',
            coverImage: profileMeta.cover_image || '',
          }}
          onSaved={() => {
            onEditClose();
            // Re-fetch profile to reflect the changes
            getProfile(username, user || '').then(setProfileInfo).catch(() => {});
          }}
        />
      )}
    </Box>
    </Box>
  );
}
