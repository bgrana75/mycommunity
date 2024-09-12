import { useAioha } from '@aioha/react-ui';
import { Box, HStack, Button, Link, Icon } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { FiBell, FiBook, FiHome, FiUser } from 'react-icons/fi';

export default function FooterNavigation() {

    const { user } = useAioha();
    const router = useRouter();
    const handleNavigation = (path: string) => {
        if (router) {
            router.push(path);
        }
    };

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
            <Button
                    onClick={() => handleNavigation("/")}
                    variant="ghost"
                    leftIcon={<Icon as={FiHome} boxSize={4} />}
                >
                    Home
                </Button>
                <Button
                    onClick={() => handleNavigation("/blog")}
                    variant="ghost"
                    leftIcon={<Icon as={FiBook} boxSize={4} />}
                >
                    Blog
                </Button>
                <Button
                    onClick={() => handleNavigation("/@" + user + "/notifications")}
                    variant="ghost"
                    leftIcon={<Icon as={FiBell} boxSize={4} />}
                >
                    Notifications
                </Button>
                <Button
                    onClick={() => handleNavigation("/@" + user)}
                    variant="ghost"
                    leftIcon={<Icon as={FiUser} boxSize={4} />}
                >
                    Profile
                </Button>
            </HStack>
        </Box>
    );
}
