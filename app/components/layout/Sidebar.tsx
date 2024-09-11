// components/homepage/Sidebar.tsx
import React from 'react';
import { Box, VStack, Button } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { useAioha } from '@aioha/react-ui';

export default function Sidebar() {
    const { user } = useAioha()
    const router = useRouter();
    const isBusiness = process.env.NEXT_PUBLIC_SITE_TYPE === 'business';
    const handleNavigation = (path: string) => {
        if (router) {

            router.push(path);
        }
    }
    return (
        <Box
            as="nav"
            bg="muted"
            p={4}
            w={{ base: 'full', md: '18%' }}
            minH={{ base: 'auto', md: '100vh' }}
            display={{ base: 'none', md: 'block' }}
        >
            <VStack spacing={4} align="start">
                <Button onClick={() => handleNavigation("/")} variant="ghost" w="full">
                    Home
                </Button>
                <Button onClick={() => handleNavigation("/blog")} variant="ghost" w="full">
                    Blog
                </Button>
                <Button onClick={() => handleNavigation("/notifications")} variant="ghost" w="full">
                    Notifications
                </Button>
                <Button onClick={() => handleNavigation("/@" + user)} variant="ghost" w="full">
                    Profile
                </Button>
                {isBusiness && (
                    <Button onClick={() => handleNavigation("/buy")} variant="ghost" w="full">
                        Store
                    </Button>
                )}
            </VStack>
        </Box>
    );
}