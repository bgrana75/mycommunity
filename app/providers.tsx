// app/providers.tsx
'use client'

import { ChakraProvider } from '@chakra-ui/react'
import { forestTheme } from './themes/forest'
import { blueSkyTheme } from './themes/bluesky'
import { hackerTheme } from './themes/hacker'

const themeMap = {
  forest: forestTheme,
  bluesky: blueSkyTheme,
  hacker: hackerTheme,
}

type ThemeName = keyof typeof themeMap;

const themeName = (process.env.NEXT_PUBLIC_THEME as ThemeName) || 'hacker';
const selectedTheme = themeMap[themeName];

export function Providers({ children }: { children: React.ReactNode }) {
  return <ChakraProvider theme={selectedTheme}>{children}</ChakraProvider>
}
