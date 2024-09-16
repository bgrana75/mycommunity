'use client'
import React, { useState, useEffect } from 'react';
import { Box, Heading, Text, Spinner, Alert, AlertIcon, Image, Container, Flex, Icon } from '@chakra-ui/react';
import useHiveAccount from '@/hooks/useHiveAccount';
import { FaGlobe } from 'react-icons/fa';
import usePosts from '@/hooks/usePosts';
import PostGrid from '@/components/blog/PostGrid';
import { getProfile } from '@/lib/hive/client-functions';

interface ProfilePageProps {
  username: string;
}

export default function ProfilePage({ username }: ProfilePageProps) {
  const { hiveAccount, isLoading, error } = useHiveAccount(username);
  const [profileImage, setProfileImage] = useState<string>('');
  const [profileCoverImage, setProfileCoverImage] = useState<string>('');
  const [profileWebsite, setProfileWebsite] = useState<string>('');
  const [profileInfo, setProfileInfo] = useState<any>(null); // Adjust type as needed
  const [query, setQuery] = useState("blog");
  const tag = [{ tag: username, limit: 20 }];
  const { posts } = usePosts(query, tag);

  useEffect(() => {
    if (hiveAccount && hiveAccount.json_metadata) {
      try {
        const profileMetadata = JSON.parse(hiveAccount.posting_json_metadata);
        setProfileImage(profileMetadata.profile?.profile_image || '');
        setProfileCoverImage(profileMetadata.profile?.cover_image || '');
        setProfileWebsite(profileMetadata.profile?.website || '');
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

  if (isLoading) {
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

  if (!hiveAccount) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Text fontSize="xl" color="text">No account information available.</Text>
      </Box>
    );
  }

  // Format description text
  const followers = profileInfo?.stats?.followers || 0;
  const following = profileInfo?.stats?.following || 0;
  const location = profileInfo?.metadata?.profile?.location || '';
  const about = profileInfo?.metadata?.profile?.about || '';

  const descriptionLine1 = `Following: ${following} | Followers: ${followers} | Location: ${location}`;
  const descriptionLine2 = about;

  return (
    <Box color="text" maxW="container.lg" mx="auto">
      <Box position="relative" height="200px">
        {/* Cover Image */}
        <Container id='cover' maxW="container.lg" p={0} overflow="hidden" position="relative" height="100%">
          <Image
            src={profileCoverImage}
            alt={`${hiveAccount.name} cover`}
            width="100%"
            height="100%"
            objectFit="cover"
            mb={4}
          />
        </Container>
      </Box>

      {/* Avatar and user info over the cover image */}
      <Flex 
        mt={-16} 
        p={4} 
        alignItems="center" 
        bg="muted" 
        boxShadow="lg"
        opacity={0.85}  // Adjust transparency
        zIndex={2}      // Ensure it's on top
        position="relative"  // Position it over the image
      >
        {/* Avatar */}
        <Image
          src={profileImage}
          alt={hiveAccount.name}
          borderRadius="full"   // Keeps the avatar rounded
          boxSize="100px"
          mr={4}
          zIndex={3}  // Ensure the avatar is above the semi-transparent background
        />

        {/* User Info */}
        <Box>
          <Flex alignItems="center">
            {/* Username */}
            <Heading as="h2" size="lg" color="blue.700" mr={2}>
              {profileInfo?.metadata.profile.name}
            </Heading>

            {/* Reputation as a small square */}
            <Box 
              display="flex" 
              alignItems="center" 
              justifyContent="center" 
              width="15px"  // Much smaller square size
              height="15px" 
              bg="gray.200" 
              fontWeight="bold" 
              fontSize="xs"
            >
              {profileInfo?.reputation ? Math.round(profileInfo.reputation) : hiveAccount.reputation}
            </Box>
          </Flex>

          {/* Description */}
          <Text fontSize="sm" color="gray.600" mt={2}>
            {descriptionLine1}
            <br />
            {descriptionLine2}
          </Text>

          {/* Website Link */}
          {profileWebsite && (
            <Flex alignItems="center">
              <Icon as={FaGlobe} w={3} h={3} onClick={() => window.open(profileWebsite, '_blank')} style={{ cursor: 'pointer' }} />
              <Text ml={2} fontSize="sm" color="blue.500">{profileWebsite}</Text>
            </Flex>
          )}
        </Box>
      </Flex>

      <Container maxW="container.lg" mt={8}>
        {posts ? (
          <PostGrid posts={posts} columns={3} />
        ) : (
          <></>
        )}
      </Container>
    </Box>
  );
}
