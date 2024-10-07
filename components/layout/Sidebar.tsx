'use client';
import React, { useEffect, useState } from 'react';
import { Box, VStack, Button, Icon, Image, Spinner, Flex, Text, useColorMode, transition } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { AiohaModal, useAioha } from '@aioha/react-ui';
import { FiHome, FiBell, FiUser, FiShoppingCart, FiBook, FiCreditCard } from 'react-icons/fi';
import { Notifications } from '@hiveio/dhive';
import { fetchNewNotifications, getCommunityInfo, getProfile } from '@/lib/hive/client-functions';
import { animate, color, motion, px } from 'framer-motion';
import { FaGear } from 'react-icons/fa6';
import { KeyTypes } from '@aioha/aioha';
import '@aioha/react-ui/dist/build.css';
import src from '@emotion/styled';
import base from '@emotion/styled/base';
import { profile, log } from 'console';
import { title } from 'process';



interface ProfileInfo {
    metadata: {
        profile: {
            profile_image: string; // Profile-specific image
        };
    };
}

interface CommunityInfo {
    title: string;
    about: string;
    // No avatar_url since it's not used
}

const communityTag = process.env.NEXT_PUBLIC_HIVE_COMMUNITY_TAG;

export default function Sidebar() {
    const { user } = useAioha();
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notifications[]>([]);
    const [communityInfo, setCommunityInfo] = useState<CommunityInfo | null>(null); // State to hold community info
    const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null); // State to hold profile info
    const [loading, setLoading] = useState(true); // Loading state
    const isBusiness = process.env.NEXT_PUBLIC_SITE_TYPE === 'business';
    const { colorMode } = useColorMode();
    const [modalDisplayed, setModalDisplayed] = useState(false);

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

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            if (communityTag) {
                try {
                    // Fetching community data
                    const communityData = await getCommunityInfo(communityTag);
                    console.log('Fetched Community Data:', communityData);
                    sessionStorage.setItem('communityData', JSON.stringify(communityData));
                    setCommunityInfo(communityData);

                    // Fetching profile data
                    const profileData = await getProfile(communityTag);
                    console.log('Fetched Profile Data:', profileData);
                    sessionStorage.setItem('profileData', JSON.stringify(profileData));
                    setProfileInfo(profileData);
                } catch (error) {
                    console.error('Failed to fetch data', error);
                } finally {
                    setLoading(false);
                }
            }
        };

        fetchData();
    }, [communityTag]);

    const handleNavigation = (path: string) => {
        if (router) {
            router.push(path);
        }
    };
    console.log(user);
    return (
        <Box
            as="nav"
            bg="muted"
            p={1}
            w={{ base: 'full', md: '20%' }}
            // minH={{ base: 'auto', md: '100vh' }}
            h={"100vh"}
            display={{ base: 'none', md: 'block' }}
            sx={{
                '&::-webkit-scrollbar': {
                    display: 'none',
                },
                scrollbarWidth: 'none',
            }}
        >
            <Flex direction="column" justify="space-between" height="100%">
                <VStack spacing={4} align="start" ml={4}>
                    {loading ? (
                        <Spinner size="sm" />
                    ) : (
                        <>
                            <Flex align="center" mb={4}>
                                {profileInfo?.metadata?.profile?.profile_image && (
                                    <Image
                                        src={profileInfo.metadata.profile.profile_image}
                                        alt="Profile Image"
                                        boxSize="50px"
                                        borderRadius="full"
                                        mr={2}
                                    />
                                )}
                                <Text fontSize="lg" fontWeight="bold">{communityInfo?.title}</Text>
                            </Flex>
                            {/* <Text fontSize="sm" color="gray.500">{communityInfo?.about}</Text> */}
                        </>
                    )}

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
                                leftIcon={
                                    user ? (
                                        <Image
                                            src={`https://images.hive.blog/u/${user}/avatar`}
                                            alt="Profile Image"
                                            boxSize={4}
                                            borderRadius="full"
                                        />
                                    ) : (
                                        <Icon as={FiUser} boxSize={4} />
                                    )
                                }
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
                <div className={colorMode}>
                    <AiohaModal
                        displayed={modalDisplayed}
                        loginOptions={{
                            msg: 'Login',
                            keyType: KeyTypes.Posting,
                            loginTitle: 'Login',
                        }}
                        onLogin={console.log}
                        onClose={() => setModalDisplayed(false)}
                    />
                </div>
                <Button
                    onClick={() => setModalDisplayed(true)}
                    variant="solid"
                    colorScheme="teal"
                    w="full"
                    mt="auto"
                >
                    {user ? 'Logout' : 'Login'}
                </Button>
            </Flex>
        </Box>
    );

}
