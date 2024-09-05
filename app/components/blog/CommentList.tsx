// components/TweetList.tsx
import React, { useState } from 'react';
import { Box, Spinner, VStack, Text } from '@chakra-ui/react';
import { useComments } from '@/hooks/useComments';
import CommentDetail from './CommentDetail';
import { Comment } from '@hiveio/dhive';

interface CommentListProps {
    author: string;
    permlink: string;
}

export default function CommentList({ author, permlink }: CommentListProps) {
    const { comments, isLoading, error } = useComments(author, permlink, true);

    if (isLoading) {
        return (
            <Box textAlign="center" mt={4}>
                <Spinner size="xl" />
                <Text>Loading comments...</Text>
            </Box>
        );
    }

    if (error) {
        return (
            <Box textAlign="center" mt={4}>
                <Text color="red.500">Failed to load comments: {error}</Text>
            </Box>
        );
    }

    // Sort comments by date using comment.created
    comments.sort((a: any, b: any) => {
        return new Date(b.created).getTime() - new Date(a.created).getTime();
    });

    return (
        <VStack spacing={2} align="stretch">
            {comments.map((comment: any) => (
                <CommentDetail key={comment.permlink} comment={comment} />
            ))}
        </VStack>
    );
}