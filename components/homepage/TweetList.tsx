import React from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import { Box, Spinner, VStack, Text } from '@chakra-ui/react';
import Tweet from './Tweet';
import { ExtendedComment, useComments } from '@/hooks/useComments';
import TweetComposer from './TweetComposer';

interface TweetListProps {
  author: string
  permlink: string
  setConversation: (conversation: ExtendedComment) => void;
  onOpen: () => void;
  setReply: (reply: ExtendedComment) => void;
  newComment: ExtendedComment | null;
  post?: boolean;
  data: InfiniteScrollData
}

interface InfiniteScrollData {
  comments: ExtendedComment[];
  loadNextPage: () => void; // Default can be an empty function in usage
  isLoading: boolean;
  hasMore: boolean; // Default can be `false` in usage
}

function handleNewComment() {

}

export default function TweetList(
  {
    author,
    permlink,
    setConversation,
    onOpen,
    setReply,
    newComment,
    post = false,
    data,
  }: TweetListProps) {

  const { comments, loadNextPage, isLoading, hasMore } = data

  comments.sort((a: ExtendedComment, b: ExtendedComment) => {
    return new Date(b.created).getTime() - new Date(a.created).getTime();
  });
  // Handle new comment addition
  //const updatedComments = newComment ? [newComment, ...comments] : comments;

  return (
    <VStack spacing={1} align="stretch" mx="auto">
      <TweetComposer pa={author} pp={permlink} onNewComment={handleNewComment} onClose={() => null} />

      {isLoading && comments.length === 0 ? (
        <Box textAlign="center" mt={4}>
          <Spinner size="xl" />
          <Text>Loading posts...</Text>
        </Box>
      ) : (
        <InfiniteScroll
          dataLength={comments.length}
          next={loadNextPage}
          hasMore={hasMore}
          loader={
            (<Box display="flex" justifyContent="center" alignItems="center" py={5}>
              <Spinner size="xl" color="primary" />
            </Box>
            )}
          scrollableTarget="scrollableDiv"
        >
          <VStack spacing={1} align="stretch">
            {comments.map((comment: ExtendedComment) => (
              <Tweet
                key={comment.permlink}
                comment={comment}
                onOpen={onOpen}
                setReply={setReply}
                {...(!post ? { setConversation } : {})}
              />
            ))}
          </VStack>
        </InfiniteScroll>
      )}
    </VStack>
  );
}
