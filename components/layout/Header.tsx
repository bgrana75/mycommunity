'use client'
import React, { useEffect, useState } from 'react';
import { Box, Flex, Text, Input, Button, Image, useColorMode } from '@chakra-ui/react';

import { useAioha, AiohaModal } from '@aioha/react-ui';
import { KeyTypes } from '@aioha/aioha';
import '@aioha/react-ui/dist/build.css';
import { getCommunityInfo, getProfile } from '@/lib/hive/client-functions';

export default function Header() {
    const { colorMode } = useColorMode();
    const [modalDisplayed, setModalDisplayed] = useState(false);
    const [profileInfo, setProfileInfo] = useState<any>();
    const [communityInfo, setCommunityInfo] = useState<any>();
    const { user } = useAioha();

    const communityTag = process.env.NEXT_PUBLIC_HIVE_COMMUNITY_TAG;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const cachedProfileData = localStorage.getItem('profileData');
                if (cachedProfileData) {
                    setProfileInfo(JSON.parse(cachedProfileData));
                } else if (communityTag) {
                    const profileData = await getProfile(communityTag);
                    localStorage.setItem('profileData', JSON.stringify(profileData));
                    setProfileInfo(profileData);
                }

                const cachedCommunityData = localStorage.getItem('communityData');
                if (cachedCommunityData) {
                    setCommunityInfo(JSON.parse(cachedCommunityData));
                } else if (communityTag) {
                    const communityData = await getCommunityInfo(communityTag);
                    localStorage.setItem('communityData', JSON.stringify(communityData));
                    setCommunityInfo(communityData);
                }
            } catch (error) {
                console.error('Failed to fetch data', error);
            }
        };

        if (communityTag) {
            fetchData();
        }
    }, [communityTag]);

    /*
    useEffect(() => {
        if (profileInfo && communityInfo) {
            console.log(profileInfo, communityInfo);
        }
    }, [profileInfo, communityInfo]);
    */

    return (
        <Box bg="secondary" px={{ base: 4, md: 6 }} py={2}>
            <Flex justify="space-between" align="center">
                <Flex align="center">
                    {/* Display profile image */}
                    {profileInfo?.metadata?.profile?.profile_image && (
                        <Image
                            src={profileInfo.metadata.profile.profile_image}
                            alt="Profile Image"
                            boxSize="60px" // Adjust the size as needed
                            borderRadius="full"
                            mr={4} // Add some margin to the right of the image
                        />
                    )}
                    <Flex direction="column">
                        <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="bold">
                            {communityInfo?.title}
                        </Text>
                        {/* Display description next to title */}
                        {communityInfo?.description && (
                            <Text fontSize="xs" color="primary" fontWeight="bold">
                                {communityInfo.about}
                            </Text>
                        )}
                    </Flex>
                </Flex>
                <Input
                    placeholder="Search..."
                    maxW="300px"
                    bg="muted"
                    borderColor="border"
                    _placeholder={{ color: 'text' }}
                    display={{ base: 'none', md: 'block' }}
                />
                <Button onClick={() => setModalDisplayed(true)}>
                    {user ?? 'Login'}
                </Button>
            </Flex>
            <div className={colorMode}>
                <AiohaModal
                    displayed={modalDisplayed}
                    loginOptions={{
                        msg: 'Login',
                        keyType: KeyTypes.Posting,
                        loginTitle: 'Login',
                    }}
                    onLogin={console.log}
                    onClose={setModalDisplayed}
                />
            </div>
        </Box>
    );
}
