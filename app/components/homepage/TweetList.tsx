// components/TweetList.tsx
'use client';
import React from 'react';
import { Button, Box, Spinner, VStack, Text, Container } from '@chakra-ui/react';
import { useComments } from '@/hooks/useComments';
import Tweet from './Tweet';

interface TweetListProps {
    author: string;
    permlink: string;
}


export default function TweetList({ author, permlink }: TweetListProps) {
    const { comments, isLoading, error, loadMoreComments } = useComments(author, permlink);

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

    //if (!isLoading) {
        return (
            <>
            <Text align="right">Sort comments by rewards</Text>
            <Text align="right">Sort comments by newest</Text>
            <Text align="right">Sort comments by oldest</Text>
            <VStack spacing={2} align="stretch">
                {comments.map((comment: any) => (
                    <Tweet key={comment.permlink} comment={comment} />
                ))}
                
                <Button onClick={loadMoreComments}>Load More Comments</Button>
            </VStack>
            </>
        );
    //}
}
