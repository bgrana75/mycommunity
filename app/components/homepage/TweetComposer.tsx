// components/homepage/TweetComposer.tsx
import React from 'react';
import { Box, Input, HStack, Button, Textarea } from '@chakra-ui/react';

export default function TweetComposer() {
    return (
        <Box bg="muted" p={4} borderRadius="md" mb={3}>
            <Textarea
                placeholder="What's happening?"
                bg="background"
                borderColor="border"
                mb={3}
                _placeholder={{ color: 'text' }}
            />
            <HStack justify="space-between">
                <HStack>
                    <Button variant="ghost">Image</Button>
                    <Button variant="ghost">GIF</Button>
                    <Button variant="ghost">Poll</Button>
                </HStack>
                <Button variant="solid" colorScheme="primary">
                    Tweet
                </Button>
            </HStack>
        </Box>
    );
}
