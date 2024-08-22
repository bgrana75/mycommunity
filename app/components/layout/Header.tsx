// components/homepage/Header.tsx
import React from 'react';
import { Box, Flex, Text, Input, Button, useColorMode } from '@chakra-ui/react';

import { useState } from 'react'
import { useAioha, AiohaModal } from '@aioha/react-ui'
import { KeyTypes } from '@aioha/aioha'
import '@aioha/react-ui/dist/build.css'

export default function Header() {
    const { colorMode } = useColorMode()
    const [modalDisplayed, setModalDisplayed] = useState(false)
    const { user } = useAioha()

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
                <Button onClick={() => setModalDisplayed(true)}>
                    {user ?? 'Login'}
                </Button>
            </Flex>
            <div className={colorMode}>
                <AiohaModal
                    displayed={modalDisplayed}
                    loginOptions={{
                        msg: 'Login',
                        keyType: KeyTypes.Posting
                    }}
                    onLogin={console.log}
                    onClose={setModalDisplayed}
                />
            </div>
        </Box>
    );
}
