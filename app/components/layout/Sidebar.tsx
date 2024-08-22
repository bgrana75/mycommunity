import { Box, VStack, Button, Link } from '@chakra-ui/react';


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
                <Button as={Link} href="/" variant="ghost" w="full">
                    Home
                </Button>
                {isBusiness && (
                    <Button as={Link} href="/buy" variant="ghost" w="full">
                        Store
                    </Button>
                )}
                <Button as={Link} href="/explore" variant="ghost" w="full">
                    Explore
                </Button>
                <Button as={Link} href="/wallet" variant="ghost" w="full">
                    Wallet
                </Button>
                <Button as={Link} href="/profile" variant="ghost" w="full">
                    Profile
                </Button>
                <Button as={Link} href="/more" variant="ghost" w="full">
                    More
                </Button>
                <Button as={Link} href="/blog" variant="ghost" w="full">
                    Blog
                </Button>
            </VStack>
        </Box>
    );
}
