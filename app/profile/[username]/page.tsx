'use client';
import React, { useState, useEffect } from 'react';
import { Box, Heading, Text, VStack, Spinner, Alert, AlertIcon, Image, Container } from '@chakra-ui/react';
import useHiveAccount from '@/hooks/useHiveAccount';

interface ProfilePageProps {
  params: {
    username: string;
  };
}

export default function ProfilePage({ params }: ProfilePageProps) {
  const { hiveAccount, isLoading, error } = useHiveAccount(params.username);

  const [profileImage, setProfileImage] = useState<string>('');
  const [profileCoverImage, setProfileCoverImage] = useState<string>('');

  useEffect(() => {
    if (hiveAccount && hiveAccount.json_metadata) {
      try {
        const profileMetadata = JSON.parse(hiveAccount.posting_json_metadata);
        setProfileImage(profileMetadata.profile?.profile_image || '');
        setProfileCoverImage(profileMetadata.profile?.cover_image || '');
        console.log(profileMetadata);
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
    <Box p={4} bg="background" color="text" maxW="container.md" mx="auto" border="1px solid" borderColor="border" borderRadius="md" shadow="md">
      <Image src={profileCoverImage} alt={`${hiveAccount.name} cover`} width="100%" borderRadius="md" mb={4} />

      <VStack spacing={4} align="start">
        <Image src={profileImage} alt={hiveAccount.name} borderRadius="full" boxSize="100px" />

        <Heading as="h1" size="2xl" fontFamily="mono">{hiveAccount.name}</Heading>
        <Text fontSize="lg">Created: {new Date(hiveAccount.created).toLocaleDateString()}</Text>
        <Text fontSize="lg">Post Count: {hiveAccount.post_count}</Text>
        <Text fontSize="lg">Reputation: {hiveAccount.reputation}</Text>
        <Text fontSize="lg">Balance: {hiveAccount.balance.toString()}</Text>
        <Text fontSize="lg">Voting Power: {hiveAccount.voting_power}</Text>
        {hiveAccount.json_metadata && (
          <Container textOverflow={'ellipsis'}>
            <Box mt={4} p={4} border="1px solid" borderColor="border" borderRadius="md">
              <Heading as="h3" size="lg" mb={2}>Metadata</Heading>
              <Text textOverflow={'ellipsis'}>{JSON.stringify(hiveAccount.metadata, null, 2)}</Text>
            </Box>
          </Container>
        )}
      </VStack>
    </Box>
  );
}
