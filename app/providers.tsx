'use client';

import { useEffect } from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import { Aioha } from '@aioha/aioha';
import { AiohaProvider } from '@aioha/react-ui';
import { ThemeProvider } from './themeProvider';

const aioha = new Aioha();

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    aioha.registerKeychain();
    aioha.registerLedger();
    aioha.registerPeakVault();
    aioha.registerHiveAuth({
      name: process.env.NEXT_PUBLIC_COMMUNITY_NAME || 'MyCommunity',
      description: '',
    });
    aioha.loadAuth();
  }, []);

  return (
    <ThemeProvider>
      <AiohaProvider aioha={aioha}>{children}</AiohaProvider>
    </ThemeProvider>
  );
}
