// app/page.tsx
'use client';

import { Box, Container, Flex } from '@chakra-ui/react';
import TweetList from './components/homepage/TweetList';
import TweetComposer from './components/homepage/TweetComposer';
import RightSidebar from './components/homepage/RightSideBar';

export default function Home() {
  const thread_author = process.env.NEXT_PUBLIC_THREAD_AUTHOR || 'canna-curate';
  const thread_permlink = process.env.NEXT_PUBLIC_THREAD_PERMLINK || '4onk12-the-cannabis-community-of-the-hive-block-chain';

  return (
    <Box bg="background" color="text" minH="100vh">
      <Flex direction={{ base: 'column', md: 'row' }}>
        <Box flex="1" p={4}>
          <Container maxW="container.sm">
            <TweetComposer />
            <TweetList author={thread_author} permlink={thread_permlink} />
          </Container>
        </Box>
        <RightSidebar />
      </Flex>
    </Box>
  );
}
