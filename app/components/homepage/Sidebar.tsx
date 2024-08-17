// components/homepage/Sidebar.tsx
import { Box, VStack, Button } from '@chakra-ui/react';
import Link from 'next/link';

export default function Sidebar() {
    const isBusiness = process.env.NEXT_PUBLIC_SITE_TYPE === 'business';
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
                <Link href="/" passHref>
                    <Button as="a" variant="ghost" w="full">
                        Home
                    </Button>
                </Link>
                {isBusiness && (
                    <Link href="/buy" passHref>
                        <Button as="a" variant="ghost" w="full">
                            Store
                        </Button>
                    </Link>
                )}
                <Link href="/explore" passHref>
                    <Button as="a" variant="ghost" w="full">
                        Explore
                    </Button>
                </Link>
                <Link href="/wallet" passHref>
                    <Button as="a" variant="ghost" w="full">
                        Wallet
                    </Button>
                </Link>
                <Link href="/profile" passHref>
                    <Button as="a" variant="ghost" w="full">
                        Profile
                    </Button>
                </Link>
                <Link href="/more" passHref>
                    <Button as="a" variant="ghost" w="full">
                        More
                    </Button>
                </Link>
                {/* Add the Community Blog link here */}
                <Link href="/blog" passHref>
                    <Button as="a" variant="ghost" w="full">
                        Blog
                    </Button>
                </Link>
            </VStack>
        </Box>
    );
}
