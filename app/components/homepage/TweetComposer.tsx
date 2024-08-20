// components/homepage/TweetComposer.tsx
import React from 'react';
import { Box, Input, HStack, Button, Textarea } from '@chakra-ui/react';
import { useAioha } from '@aioha/react-ui'
import { useRef } from 'react';

const parent_author = process.env.NEXT_PUBLIC_THREAD_AUTHOR || "skatedev";
const parent_permlink = process.env.NEXT_PUBLIC_THREAD_PERMLINK || "re-skatedev-sidr6t";

export default function TweetComposer() {
    const { aioha, user, provider } = useAioha()
    const postBodyRef = useRef<HTMLTextAreaElement>(null);

    async function handleComment() {

        console.log(parent_permlink)
        console.log(aioha.getCurrentUser())

        const permlink = new Date()
        .toISOString()
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();

        const commentBody = postBodyRef.current?.value

        if (commentBody) {
            const comment = await aioha.comment(parent_author, parent_permlink, permlink, '', commentBody, { app: 'mycommunity' })
            console.log(comment)
        }
        
    }

    return (
        <Box bg="muted" p={4} borderRadius="md" mb={3}>
            <Textarea
                placeholder="What's happening?"
                bg="background"
                borderColor="border"
                mb={3}
                ref={postBodyRef}
                _placeholder={{ color: 'text' }}
            />
            <HStack justify="space-between">
                <HStack>
                    <Button variant="ghost">Image</Button>
                    <Button variant="ghost">GIF</Button>
                    <Button variant="ghost">Poll</Button>
                </HStack>
                <Button variant="solid" colorScheme="primary" onClick={handleComment}>
                    Tweet
                </Button>
            </HStack>
        </Box>
    );
}
