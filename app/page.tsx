'use client';
import { Box, Flex, useDisclosure } from '@chakra-ui/react';
import Header from './components/homepage/Header';
import Sidebar from './components/homepage/Sidebar';
import MainFeed from './components/homepage/MainFeed';
import RightSidebar from './components/homepage/RightSideBar';
import FooterNavigation from './components/homepage/FooterNavigation';
import LoginModal from './components/modal/LoginModal';
import { useState } from 'react';
export default function Home() {
  const [isOpen, setIsOpen] = useState(false);

  const onOpen = () => setIsOpen(true);
  const onClose = () => setIsOpen(false);

  return (
    <Box bg="background" color="text" minH="100vh">
      <Header onLoginClick={onOpen} />

      <Flex direction={{ base: 'column', md: 'row' }}>
        <Sidebar />
        <MainFeed />
        <RightSidebar />
      </Flex>

      <FooterNavigation />

      <LoginModal isOpen={isOpen} onClose={onClose} />
    </Box>
  );
}
