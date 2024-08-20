
// path: app/profile/%5Busername%5D/page.tsx
import React from 'react';

import { Box, VStack, Button, Link } from '@chakra-ui/react';


interface ProfilePageProps {
  params: {
    username: string
  }
}

export async function generateMetadata({
  params
}: ProfilePageProps) {
  return {
    title: `Profile: ${params.username}`,
    description: `View the profile of ${params.username}`
  };
}

export default function ProfilePage({ params }: ProfilePageProps) {
  const username = params.username;
  const userProfile = {
    username: username,
    bio: 'This is a user profile',
    followers: 100,
    following: 200,
    posts: 300
  };

  return (
    <Box>
      <VStack spacing={4} align="start">
        <Box>
          <h1>{userProfile.username}</h1>
          <p>{userProfile.bio}</p>
        </Box>
        <Box>
          <h2>Followers: {userProfile.followers}</h2>
          <h2>Following: {userProfile.following}</h2>
          <h2>Posts: {userProfile.posts}</h2>
        </Box>
      </VStack>
    </Box>
  );
}