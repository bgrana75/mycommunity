// app/providers.tsx
'use client'

import { ChakraProvider } from '@chakra-ui/react'
import { forestTheme } from './themes/forest'
import { blueSkyTheme } from './themes/bluesky'
import { hackerTheme } from './themes/hacker'
import { nounsDaoTheme } from './themes/nounish'

import { Aioha } from '@aioha/aioha'
import { AiohaProvider } from '@aioha/react-ui'

import { useEffect } from 'react'
import { windows95Theme } from './themes/windows95'

const aioha = new Aioha()

const themeMap = {
  forest: forestTheme,
  bluesky: blueSkyTheme,
  hacker: hackerTheme,
  nounish: nounsDaoTheme,
  windows95: windows95Theme
}

type ThemeName = keyof typeof themeMap;

const themeName = (process.env.NEXT_PUBLIC_THEME as ThemeName) || 'hacker';
const selectedTheme = themeMap[themeName];

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    aioha.registerKeychain()
    aioha.registerLedger()
    aioha.registerPeakVault()
    aioha.registerHiveAuth({
      name: process.env.NEXT_PUBLIC_COMMUNITY_NAME || 'MyCommunity',
      description: ''
    })
    aioha.loadAuth()
  })
  return (
    <ChakraProvider theme={selectedTheme}>
      <AiohaProvider aioha={aioha}>
        {children}
      </AiohaProvider>
    </ChakraProvider>
  )
}
