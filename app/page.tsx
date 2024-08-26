// app/page.tsx
'use client';

import { Box, Container, Flex } from '@chakra-ui/react';
import TweetList from './components/homepage/TweetList';
import TweetComposer from './components/homepage/TweetComposer';
import RightSidebar from './components/layout/RightSideBar';
import { useState } from 'react';
import { Comment } from '@hiveio/dhive'; // Ensure this import is consistent
import Conversation from './components/homepage/Conversation';
import TweetReplyModal from './components/homepage/TweetReplyModal';

export default function Home() {
  const thread_author = process.env.NEXT_PUBLIC_THREAD_AUTHOR || 'skatedev';
  const thread_permlink = process.env.NEXT_PUBLIC_THREAD_PERMLINK || 're-skatedev-sidr6t';

  const [conversation, setConversation] = useState<Comment | undefined>();
  const [reply, setReply] = useState<Comment>();
  const [isOpen, setIsOpen] = useState(false);
  const [newComment, setNewComment] = useState<Comment | null>(null); // Define the state

  const onOpen = () => setIsOpen(true);
  const onClose = () => setIsOpen(false);

  const handleNewComment = (newComment: Partial<Comment> | CharacterData) => {
    setNewComment(newComment as Comment); // Type assertion
  };


  return (
    <Box bg="background" color="text" minH="100vh">
      <Flex direction={{ base: 'column', md: 'row' }}>
        <Box flex="1" p={4}>
          <Container maxW="container.sm">
            {!conversation ? (
              <>
                <TweetComposer pa={thread_author} pp={thread_permlink} onNewComment={handleNewComment} />
                <TweetList
                  author={thread_author}
                  permlink={thread_permlink}
                  setConversation={setConversation}
                  onOpen={onOpen}
                  setReply={setReply}
                  newComment={newComment} // Pass the newComment to TweetList
                />
              </>
            ) : (
              <Conversation comment={conversation} setConversation={setConversation} onOpen={onOpen} setReply={setReply} />
            )}
          </Container>
        </Box>
        <RightSidebar />
      </Flex>
      {isOpen && <TweetReplyModal isOpen={isOpen} onClose={onClose} comment={reply} onNewReply={handleNewComment} />}
    </Box>
  );
}
