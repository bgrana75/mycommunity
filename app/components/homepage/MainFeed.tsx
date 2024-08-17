// components/homepage/MainFeed.tsx
import { Box, VStack } from '@chakra-ui/react';
import TweetComposer from './TweetComposer';
import Tweet from './Tweet';

export default function MainFeed() {
    return (
        <Box flex="1" p={4}>
            <VStack spacing={4} align="stretch">
                <TweetComposer />
                <Tweet />
                {/* Add more <Tweet /> components to display additional tweets */}
            </VStack>
        </Box>
    );
}
