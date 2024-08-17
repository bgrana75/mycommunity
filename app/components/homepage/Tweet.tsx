// components/homepage/Tweet.tsx
import { Box, Text, HStack, Button } from '@chakra-ui/react';

export default function Tweet() {
    return (
        <Box bg="muted" p={4} borderRadius="md">
            <Text fontWeight="bold" mb={2}>
                HackerUser
            </Text>
            <Text>
                Just hacked into the mainframe! #HackerLife #Code
            </Text>
            <HStack justify="space-between" mt={3}>
                <Button variant="ghost">Like</Button>
                <Button variant="ghost">Comment</Button>
                <Button variant="ghost">Share</Button>
            </HStack>
        </Box>
    );
}
