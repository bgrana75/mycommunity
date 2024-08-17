// components/homepage/Sidebar.tsx
import React from 'react';
import { Box, VStack, Button } from '@chakra-ui/react';

export default function Sidebar() {
    return (
        <Box
            as="nav"
            bg="muted"
            p={4}
            w={{ base: 'full', md: '20%' }}
            minH={{ base: 'auto', md: '100vh' }}
            display={{ base: 'none', md: 'block' }}
        >
            <VStack spacing={4} align="start">
                <Button variant="ghost" w="full">
                    Home
                </Button>
                <Button variant="ghost" w="full">
                    Explore
                </Button>
                <Button variant="ghost" w="full">
                    Notifications
                </Button>
                <Button variant="ghost" w="full">
                    Messages
                </Button>
                <Button variant="ghost" w="full">
                    Profile
                </Button>
                <Button variant="ghost" w="full">
                    More
                </Button>
            </VStack>
        </Box>
    );
}
