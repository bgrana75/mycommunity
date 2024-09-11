import { Box, HStack, Button, Link } from '@chakra-ui/react';

export default function FooterNavigation() {
    return (
        <Box
            as="nav"
            position="fixed"
            bottom="0"
            left="0"
            right="0"
            bg="secondary"
            p={2}
            borderTop="1px solid"
            borderColor="border"
            display={{ base: 'block', md: 'none' }}
        >
            <HStack justify="space-around">
                <Button variant="ghost">
                    Home
                </Button>
                <Button variant="ghost">
                    Explore
                </Button>
                <Button variant="ghost">
                    Notifications
                </Button>
                <Button variant="ghost">
                    Messages
                </Button>
            </HStack>
        </Box>
    );
}
