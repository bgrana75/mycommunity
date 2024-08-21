// app/page.tsx
'use client';

import { Box, Container, Flex } from '@chakra-ui/react';
import TweetList from './components/homepage/TweetList';
import TweetComposer from './components/homepage/TweetComposer';
import RightSidebar from './components/homepage/RightSideBar';
import { useEffect, useState } from 'react';
import { Comment } from '@hiveio/dhive';
import Conversation from './components/homepage/Conversation';

export default function Home() {
  const thread_author = process.env.NEXT_PUBLIC_THREAD_AUTHOR || 'canna-curate';
  const thread_permlink = process.env.NEXT_PUBLIC_THREAD_PERMLINK || '4onk12-the-cannabis-community-of-the-hive-block-chain';
  const [conversation, setConversation] = useState<Comment>()

  return (
    <Box bg="background" color="text" minH="100vh">
      <Flex direction={{ base: 'column', md: 'row' }}>
        <Box flex="1" p={4}>
          <Container maxW="container.sm">
            {!conversation ? (
              <>
                <TweetComposer />
                <TweetList author={thread_author} permlink={thread_permlink} setConversation={setConversation} />
              </>
            ) : (
              <>
                <Conversation comment={conversation} />
              </>
            )}
          </Container>
        </Box>
        <RightSidebar />
      </Flex>
    </Box>
  );
}
