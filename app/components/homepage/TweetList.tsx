// components/TweetList.tsx
import React from 'react';
import { Box, Spinner, VStack, Text, Container } from '@chakra-ui/react';
import { useComments } from '@/hooks/comments';
import Tweet from './Tweet';
interface TweetListProps {
    author: string;
    permlink: string;
}


export default function TweetList({ author, permlink }: TweetListProps) {
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

    return (
        <VStack spacing={4} align="stretch">
            <Container maxW="container.sm">
                {comments.map((comment: any) => (
                    <Tweet key={comment.permlink} comment={comment} />
                ))}
            </Container>
        </VStack>
    );
}
