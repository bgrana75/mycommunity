// components/RightSidebar.tsx
import React from 'react';
import { Box, VStack, Text, Button } from '@chakra-ui/react';

export default function RightSidebar() {
    return (
        <Box
            bg="muted"
            p={4}
            m={0}
            w={{ base: 'full', md: '30%' }}
            minH={{ base: 'auto', md: '100vh' }}
            display={{ base: 'none', lg: 'block' }} // Visible only on large screens
        >
            <VStack spacing={4} align="start">
                <Text fontWeight="bold" mb={4}>
                    Trends for you
                </Text>
                <Button variant="ghost" w="full">
                    #HackerLife
                </Button>
                <Button variant="ghost" w="full">
                    #Code
                </Button>
                <Button variant="ghost" w="full">
                    #TechNews
                </Button>
                <Button variant="ghost" w="full">
                    #OpenSource
                </Button>
            </VStack>
        </Box>
    );
}
