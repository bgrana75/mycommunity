// components/homepage/Sidebar.tsx
import React from 'react';
import { Box, VStack, Button } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
export default function Sidebar() {
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
            w={{ base: 'full', md: '20%' }}
            minH={{ base: 'auto', md: '100vh' }}
            display={{ base: 'none', md: 'block' }}
        >
            <VStack spacing={4} align="start">
                <Button onClick={() => handleNavigation("/")} variant="ghost" w="full">
                    Home
                </Button>
                {isBusiness && (
                    <Button onClick={() => handleNavigation("/buy")} variant="ghost" w="full">
                        Store
                    </Button>
                )}
                <Button onClick={() => handleNavigation("/explore")} variant="ghost" w="full">
                    Explore
                </Button>

                <Button onClick={() => handleNavigation("/profile")} variant="ghost" w="full">
                    Profile
                </Button>

            </VStack>
        </Box>
    );
}