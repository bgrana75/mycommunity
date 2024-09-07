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
    post?: boolean;
}

export default function TweetList({ author, permlink, setConversation, onOpen, setReply, newComment, post = false }: TweetListProps) {
    const { comments, isLoading, error } = useComments(author, permlink, post);

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
        <VStack spacing={2} align="stretch">
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
    );
}
