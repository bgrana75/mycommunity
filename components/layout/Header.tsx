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
                const cachedProfileData = sessionStorage.getItem('profileData');
                if (cachedProfileData) {
                    setProfileInfo(JSON.parse(cachedProfileData));
                } else if (communityTag) {
                    const profileData = await getProfile(communityTag);
                    sessionStorage.setItem('profileData', JSON.stringify(profileData));
                    setProfileInfo(profileData);
                }

                const cachedCommunityData = sessionStorage.getItem('communityData');
                if (cachedCommunityData) {
                    setCommunityInfo(JSON.parse(cachedCommunityData));
                } else if (communityTag) {
                    const communityData = await getCommunityInfo(communityTag);
                    sessionStorage.setItem('communityData', JSON.stringify(communityData));
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

    return (
        <Box bg="secondary" px={{ base: 4, md: 6 }} py={2}>
            <Flex justify="space-between" align="center">
                <Flex align="center" gap={2}>
                    {/* Display profile image */}
                    {profileInfo?.metadata?.profile?.profile_image && (
                        <Image
                            src={profileInfo.metadata.profile.profile_image}
                            alt="Profile Image"
                            boxSize="80px" // Adjust the size as needed
                            borderRadius="full"
                            mr={2} // Reduced margin to bring elements closer
                        />
                    )}
                    <Flex direction="column">
                        <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="bold">
                            {communityInfo?.title}
                        </Text>
                        {/* Display description with limited width */}
                        {communityInfo?.about && (
                            <Text
                                fontSize="xs"
                                color="primary"
                                fontWeight="bold"
                                maxW="400px" // Limit the width of the description
                                whiteSpace="normal" // Allow line breaks
                                wordBreak="break-word" // Ensure long words break properly
                            >
                                {communityInfo.about}
                            </Text>
                        )}
                    </Flex>
                </Flex>
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
