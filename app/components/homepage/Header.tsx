// components/homepage/Header.tsx
import React from 'react';
import { Box, Flex, Text, Input, Button, useColorMode } from '@chakra-ui/react';

import { useState } from 'react'


interface HeaderProps {
    onLoginClick?: () => void;
}

export default function Header({ onLoginClick }: HeaderProps) {
    const { colorMode } = useColorMode()
    const [modalDisplayed, setModalDisplayed] = useState(false)


    const CommunityName = process.env.NEXT_PUBLIC_COMMUNITY_NAME || 'My Community';
    return (
        <Box bg="secondary" px={{ base: 4, md: 6 }} py={4}>
            <Flex justify="space-between" align="center">
                <Text fontSize={{ base: 'xl', md: '2xl' }} fontWeight="bold">
                    {CommunityName}
                </Text>
                <Input
                    placeholder="Search HackerFeed"
                    maxW="400px"
                    bg="muted"
                    borderColor="border"
                    _placeholder={{ color: 'text' }}
                    display={{ base: 'none', md: 'block' }}
                />

            </Flex>
        </Box>
    );
}
