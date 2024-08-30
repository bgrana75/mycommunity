// app/page.tsx
// 'use client';
import { Box, Container, Flex } from '@chakra-ui/react';
//import TweetList from './components/homepage/TweetList';
import TweetPage from './components/tweets/page';// ./c/tweets/page";
import TweetList from './components/tweets/TweetList';

//import TweetComposer from './components/homepage/TweetComposer';
import RightSidebar from './components/homepage/RightSideBar';

export default function Home() {
  const thread_author = process.env.NEXT_PUBLIC_THREAD_AUTHOR || 'xvlad';
  const thread_permlink = process.env.NEXT_PUBLIC_THREAD_PERMLINK || 'nxvsjarvmp';

  return (
    <Box bg="background" color="text" minH="100vh">
      <Flex direction={{ base: 'column', md: 'row' }}>
        <Box flex="1" p={4}>
          <Container maxW="container.sm">
            {/* <TweetComposer /> */}
            <TweetPage/>
          </Container>
        </Box>
        <RightSidebar />
      </Flex>
    </Box>
  );
}
