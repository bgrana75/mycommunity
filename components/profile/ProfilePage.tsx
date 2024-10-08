'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Box, Heading, Text, Spinner, Alert, AlertIcon, Image, Container, Flex, Icon, Avatar } from '@chakra-ui/react';
import useHiveAccount from '@/hooks/useHiveAccount';
import { FaGlobe } from 'react-icons/fa';
import { getProfile, findPosts } from '@/lib/hive/client-functions';
import PostGrid from '../blog/PostGrid';
import InfiniteScroll from 'react-infinite-scroll-component';

interface ProfilePageProps {
  username: string;
}

export default function ProfilePage({ username }: ProfilePageProps) {
  const { hiveAccount, isLoading, error } = useHiveAccount(username);
  const [profileMetadata, setProfileMetadata] = useState<{ profileImage: string; coverImage: string; website: string }>({
    profileImage: '',
    coverImage: '',
    website: '',
  });
  const [profileInfo, setProfileInfo] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const isFetching = useRef(false);

  const tag = process.env.NEXT_PUBLIC_HIVE_COMMUNITY_TAG;
  const params = useRef([
      username,
      '',
      new Date().toISOString().split('.')[0],
      12
  ]);

  async function fetchPosts() {
    if (isFetching.current) return; // Prevent multiple fetches
    isFetching.current = true;
    try {
      const newPosts = await findPosts('author_before_date', params.current);
      setPosts((prevPosts) => [...prevPosts, ...newPosts]);
      params.current = [
        username,
        newPosts[newPosts.length - 1].permlink,
        newPosts[newPosts.length - 1].created,
        12
      ]
      isFetching.current = false;
    } catch (err) {
      console.error('Failed to fetch posts', err);
      isFetching.current = false;
    }
  }

  useEffect(() => {
    fetchPosts();
  }, [username]);

  useEffect(() => {
    if (hiveAccount?.json_metadata) {
      try {
        const parsedMetadata = JSON.parse(hiveAccount.posting_json_metadata);
        const profile = parsedMetadata?.profile || {};
        setProfileMetadata({
          profileImage: profile.profile_image || '',
          coverImage: profile.cover_image || '',
          website: profile.website || '',
        });
      } catch (err) {
        console.error('Failed to parse profile metadata', err);
      }
    }
  }, [hiveAccount]);

  useEffect(() => {
    const fetchProfileInfo = async () => {
      try {
        const profileData = await getProfile(username);
        setProfileInfo(profileData);
      } catch (err) {
        console.error('Failed to fetch profile info', err);
      }
    };

    if (username) {
      fetchProfileInfo();
    }
  }, [username]);

  const followers = profileInfo?.stats?.followers || 0;
  const following = profileInfo?.stats?.following || 0;
  const location = profileInfo?.metadata?.profile?.location || '';
  const about = profileInfo?.metadata?.profile?.about || '';

  if (isLoading || !hiveAccount) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Spinner size="xl" color="primary" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Alert status="error" borderRadius="md" variant="solid">
          <AlertIcon />
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box color="text" maxW="container.lg" mx="auto">
      <Box position="relative" height="200px">
        {/* Cover Image */}
        <Container id="cover" maxW="container.lg" p={0} overflow="hidden" position="relative" height="100%">
          <Image
            src={profileMetadata.coverImage}
            alt={`${hiveAccount?.name} cover`}
            width="100%"
            height="100%"
            objectFit="cover"
            mb={4}
            fallback={(<div></div>)}
          />
        </Container>
      </Box>
      <Flex position="relative" mt={-16} p={4} alignItems="center" boxShadow="lg">
  <Box
    position="absolute"
    top={0}
    left={0}
    right={0}
    bottom={0}
    bg="muted"
    opacity={0.85}
    zIndex={1}  // Lower z-index to place the background below content
  />

  <Flex alignItems="center" zIndex={2} position="relative">

    <Avatar
      src={profileMetadata.profileImage}
      name={hiveAccount?.name}
      borderRadius="full"
      boxSize="100px"
      mr={4}
    />

    <Box>
      <Flex alignItems="center">
        {/* Username */}
        <Heading as="h2" size="lg" color="primary" mr={2}>
          {profileInfo?.metadata.profile.name || username}
        </Heading>

        {/* Reputation */}
        <Box display="flex" alignItems="center" justifyContent="center" width="15px" height="15px" bg="gray.200" fontWeight="bold" fontSize="xs">
          {profileInfo?.reputation ? Math.round(profileInfo.reputation) : 0}
        </Box>
      </Flex>

      {/* Description */}
      <Text fontSize="xs" color="text">
        Following: {following} | Followers: {followers} | Location: {location}
        <br />
        {about}
      </Text>

      {/* Website Link */}
      {profileMetadata.website && (
        <Flex alignItems="center">
          <Icon as={FaGlobe} w={2} h={2} onClick={() => window.open(profileMetadata.website, '_blank')} style={{ cursor: 'pointer' }} />
          <Text ml={2} fontSize="xs" color="primary">
            {profileMetadata.website}
          </Text>
        </Flex>
      )}
    </Box>
  </Flex>
</Flex>

      <Container maxW="container.lg" mt={8}>
        <InfiniteScroll
          dataLength={posts.length}
          next={fetchPosts}
          hasMore={true}
          loader={
            <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
              <Spinner size="xl" color="primary" />
            </Box>
          }
        >
          {posts && <PostGrid posts={posts} columns={3} />}
        </InfiniteScroll>
      </Container>
    </Box>
  );
}
