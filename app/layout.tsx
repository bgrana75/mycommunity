'use client'
import { Box, Container, Flex } from '@chakra-ui/react';
import { VT323 } from 'next/font/google';
import Sidebar from '@/components/layout/Sidebar';
import FooterNavigation from '@/components/layout/FooterNavigation';
import { Providers } from './providers';

// Initialize the VT323 font
const vt323 = VT323({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-vt323',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${vt323.variable}`}>
      <body>
        <Providers>
          <Container maxW={{ base: '100%', md: 'container.xl' }} p={0}>
            {/* <Header /> */}
            <Flex direction={{ base: 'column', md: 'row' }} minH="100vh">
              <Sidebar />
              <Box flex="1">
                {children}
              </Box>
            </Flex>
            <FooterNavigation />
          </Container>
        </Providers>
      </body>
    </html>
  );
}
