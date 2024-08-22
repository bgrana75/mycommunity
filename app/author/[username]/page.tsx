'use client'
import React, { useState, useEffect } from 'react';
import { Box, Heading, Text, VStack, Spinner, Alert, AlertIcon, Image, Container } from '@chakra-ui/react';
import useHiveAccount from '@/hooks/useHiveAccount';
import { FaGlobe } from 'react-icons/fa';
import usePosts from '@/hooks/usePosts';
import PostGrid from '@/app/components/blog/PostGrid';

interface ProfilePageProps {
  params: {
    username: string;
  };
}

export default function ProfilePage({ params }: ProfilePageProps) {
  const username = String(params.username);
  const { hiveAccount, isLoading, error } = useHiveAccount(username);
  const [profileImage, setProfileImage] = useState<string>('');
  const [profileCoverImage, setProfileCoverImage] = useState<string>('');
  const [profileWebsite, setProfileWebsite] = useState<string>('');
  const [query, setQuery] = useState("blog")
  const tag = [{ tag: username, limit: 20 }]
  const { posts, setQueryCategory, setDiscussionQuery } = usePosts(query, tag)
  console.log(posts)
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

  return (
    <Box color="text" maxW="container.md" mx="auto" >
      <Box position="relative" height="200px">
        <Container id='cover' maxW="container.md" p={0} borderRadius="md" overflow="hidden" position="relative" height="100%">
          <Image
            src={profileCoverImage}
            alt={`${hiveAccount.name} cover`}
            width="100%"
            height="100%"
            objectFit="cover"
            borderRadius="md"
            mb={4}
          />
        </Container>
        <Image
          src={profileImage}
          alt={hiveAccount.name}
          borderRadius="full"
          boxSize="100px"
          position="absolute"
          bottom="-50px"
          left="50%"
          transform="translateX(-50%)"
          border="4px solid white"
        />
      </Box>
      <VStack spacing={2} align="start" mt={8}>
        <Heading as="h1" size="2xl">{hiveAccount.name}</Heading>
        <FaGlobe onClick={() => window.open(profileWebsite, '_blank')} style={{ cursor: 'pointer' }} />
      </VStack>
      <Container maxW="container.lg">
        {posts ? (
          <PostGrid posts={posts} columns={3} />
        ) : (
          <></>
        )}
      </Container>
    </Box>
  );
}
