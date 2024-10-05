import React from 'react';
import { Box, VStack, Button, Icon } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { useAioha } from '@aioha/react-ui';
import { FiHome, FiBell, FiUser, FiShoppingCart, FiBook, FiCreditCard } from 'react-icons/fi';
import { useEffect, useState } from 'react';
import { Notifications } from '@hiveio/dhive';
import { fetchNewNotifications } from '@/lib/hive/client-functions';
import { motion } from 'framer-motion';
import { FaGear } from 'react-icons/fa6';


export default function Sidebar() {
    const { user } = useAioha();
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notifications[]>([]);
    const isBusiness = process.env.NEXT_PUBLIC_SITE_TYPE === 'business';

    useEffect(() => {
        const loadNotifications = async () => {
            if (user) {
                try {
                    const newNotifications = await fetchNewNotifications(user);
                    setNotifications(newNotifications);
                } catch (error) {
                    console.error("Failed to fetch notifications:", error);
                }
            }
        };

        loadNotifications();
    }, [user]);

    const handleNavigation = (path: string) => {
        if (router) {
            router.push(path);
        }
    };

    return (
        <Box
            as="nav"
            bg="muted"
            p={1}
            w={{ base: 'full', md: '20%' }}
            minH={{ base: 'auto', md: '100vh' }}
            display={{ base: 'none', md: 'block' }}
            sx={
                {
                    '&::-webkit-scrollbar': {
                        display: 'none',
                    },
                    scrollbarWidth: 'none',
                }
            }
        >
            <VStack spacing={4} align="start">
                <Button
                    onClick={() => handleNavigation("/")}
                    variant="ghost"
                    w="full"
                    justifyContent="flex-start"
                    leftIcon={<Icon as={FiHome} boxSize={4} />}
                    px={1}
                    mt={4}
                >
                    Home
                </Button>
                <Button
                    onClick={() => handleNavigation("/blog")}
                    variant="ghost"
                    w="full"
                    justifyContent="flex-start"
                    leftIcon={<Icon as={FiBook} boxSize={4} />}
                    px={1}
                >
                    Blog
                </Button>
                {user && (
                    <>
                        <Button
                            onClick={() => handleNavigation("/@" + user + "/notifications")}
                            variant="ghost"
                            w="full"
                            justifyContent="flex-start"
                            leftIcon={
                                notifications.length > 0 ? (
                                    <motion.div
                                        animate={{ rotate: [0, 45, 0, -45, 0] }}
                                        transition={{ duration: 0.6, repeat: Infinity }}
                                    >
                                        <Icon as={FiBell} boxSize={4} color="red" />
                                    </motion.div>
                                ) : (
                                    <Icon as={FiBell} boxSize={4} />
                                )
                            }
                            px={1}
                        >
                            Notifications
                        </Button>
                        <Button
                            onClick={() => handleNavigation("/@" + user)}
                            variant="ghost"
                            w="full"
                            justifyContent="flex-start"
                            leftIcon={<Icon as={FiUser} boxSize={4} />}
                            px={1}
                        >
                            Profile
                        </Button>
                        <Button
                            onClick={() => handleNavigation("/@" + user + '/wallet')}
                            variant="ghost"
                            w="full"
                            justifyContent="flex-start"
                            leftIcon={<Icon as={FiCreditCard} boxSize={4} />}
                            px={1}
                        >
                            Wallet
                        </Button>
                    </>
                )}
                {isBusiness && (
                    <Button
                        onClick={() => handleNavigation("/buy")}
                        variant="ghost"
                        w="full"
                        justifyContent="flex-start"
                        leftIcon={<Icon as={FiShoppingCart} boxSize={4} />}
                        px={1}
                    >
                        Store
                    </Button>
                )}
                <Button
                    onClick={() => handleNavigation("/settings")}
                    variant="ghost"
                    w="full"
                    justifyContent="flex-start"
                    leftIcon={<Icon as={FaGear} boxSize={4} />}
                    px={1}
                >
                    Settings
                </Button>
            </VStack>
        </Box>
    );
}
