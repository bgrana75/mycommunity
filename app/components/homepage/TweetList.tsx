// components/TweetList.tsx
import React, { useState } from 'react';
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
}

export default function TweetList({ author, permlink, setConversation, onOpen, setReply, newComment }: TweetListProps) {
    const { comments, isLoading, error } = useComments(author, permlink);

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

    // Sort comments by date using comment.created
    comments.sort((a: any, b: any) => {
        return new Date(b.created).getTime() - new Date(a.created).getTime();
    });

    return (
        <VStack spacing={2} align="stretch">
            {newComment && (
                <Tweet
                    key={newComment.permlink}
                    comment={newComment}
                    onOpen={onOpen}
                    setReply={setReply}
                    setConversation={setConversation}
                />
            )}
            {comments.map((comment: any) => (
                <Tweet key={comment.permlink} comment={comment} onOpen={onOpen} setReply={setReply} setConversation={setConversation} />
            ))}
        </VStack>
    );
}