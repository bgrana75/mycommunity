// components/TweetList.tsx
'use client';
import React from 'react';
import { Box, Spinner, VStack, Text, Container } from '@chakra-ui/react';
import { useComments } from '@/hooks/useComments';
import Tweet from './Tweet';
import TweetReplyModal from './TweetReplyModal';
import { useState } from 'react';
import { Comment } from '@hiveio/dhive';

interface TweetListProps {
    author: string;
    permlink: string;
    setConversation: (conversation: Comment) => void;
}


export default function TweetList({ author, permlink, setConversation }: TweetListProps) {
    const { comments, isLoading, error } = useComments(author, permlink, true);
    const [reply, setReply] = useState<Comment>();
    const [isOpen, setIsOpen] = useState(false);
    const onOpen = () => setIsOpen(true);
    const onClose = () => setIsOpen(false);


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
        <>
        <VStack spacing={2} align="stretch">
            {comments.map((comment: any) => (
                <Tweet key={comment.permlink} comment={comment} onOpen={onOpen} setReply={setReply} setConversation={setConversation} />
            ))}
        </VStack>
        <TweetReplyModal isOpen={isOpen} onClose={onClose} comment={reply} />
        </>
    );
}
