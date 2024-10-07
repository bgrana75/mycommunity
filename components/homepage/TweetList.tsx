import React, { useState, useRef, useEffect } from 'react';
import { Box, Spinner, VStack, Text } from '@chakra-ui/react';
import { useComments } from '@/hooks/useComments';
import Tweet from './Tweet';
import { Comment } from '@hiveio/dhive';

interface TweetListProps {
  author: string;
  permlink: string;
  setConversation: (conversation: Comment) => void;
  onOpen: () => void;
  setReply: (reply: Comment) => void;
  newComment: Comment | null; // Add this prop
  post?: boolean;
}

export default function TweetList({
  author,
  permlink,
  setConversation,
  onOpen,
  setReply,
  newComment,
  post = false,
}: TweetListProps) {
  const { comments, isLoading, error } = useComments(author, permlink, post);
  const [isFetchingMore, setIsFetchingMore] = useState(false); // State for infinite scroll
  const listRef = useRef<HTMLDivElement>(null); // Ref for the scrollable container
  const isFetching = useRef(false); // To prevent multiple fetches at once

  // Simulate loading more tweets
  const fetchMoreTweets = async () => {
    if (isFetching.current) return;
    isFetching.current = true;
    setIsFetchingMore(true);

    // Add your logic here for loading more comments
    // For now, it's just simulating the fetching state
    await new Promise((resolve) => setTimeout(resolve, 1000));

    isFetching.current = false;
    setIsFetchingMore(false);
  };

  useEffect(() => {
    const handleScroll = () => {
      const container = listRef.current;
      if (container) {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const threshold = 200; // Trigger when 200px from the bottom

        if (scrollTop + clientHeight >= scrollHeight - threshold && !isFetchingMore) {
          fetchMoreTweets(); // Call function to load more tweets
        }
      }
    };

    const container = listRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [isFetchingMore]);

  if (isLoading) {
    return (
      <Box textAlign="center" mt={4}>
        <Spinner size="xl" />
        <Text>Loading tweets...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box textAlign="center" mt={4}>
        <Text color="red.500">Failed to load tweets: {error}</Text>
      </Box>
    );
  }

  comments.sort((a: Comment, b: Comment) => {
    return new Date(b.created).getTime() - new Date(a.created).getTime();
  });

  const updatedComments = newComment ? [newComment, ...comments] : comments;

  return (
    <Box
      ref={listRef} // Attach the ref to the container
      h="100vh" // Give it a fixed height to allow scrolling
      pt={2}
    >
      <VStack spacing={2} align="stretch" mx="auto">
        {updatedComments.map((comment: Comment) => (
          <Tweet
            key={comment.permlink}
            comment={comment}
            onOpen={onOpen}
            setReply={setReply}
            {...(!post ? { setConversation } : {})}
          />
        ))}
      </VStack>

      {isFetchingMore && (
        <Box display="flex" justifyContent="center" alignItems="center" mt={4}>
          <Spinner size="lg" />
        </Box>
      )}
    </Box>
  );
}
