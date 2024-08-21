// app/layout.tsx
'use client'
import { Box, Flex } from '@chakra-ui/react';
import Header from './components/homepage/Header';
import Sidebar from './components/homepage/Sidebar';
import FooterNavigation from './components/homepage/FooterNavigation';
import { useState } from 'react';
import { Providers } from './providers';

export default function RootLayout({ children } : { children: React.ReactNode }) {

  return (
    <html lang="en">
      <body>
        <Providers>
          <Box bg="background" color="text" minH="100vh">
            <Header />
            <Flex direction={{ base: 'column', md: 'row' }}>
              <Sidebar />
              <Box flex="1">
                {children}
              </Box>
            </Flex>
            <FooterNavigation />
          </Box>
        </Providers>
      </body>
    </html>
  );
}
