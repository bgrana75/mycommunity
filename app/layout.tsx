import { Suspense } from 'react';
import { ColorModeScript } from '@chakra-ui/react';
import { Providers } from './providers';
import LayoutContent from './LayoutContent';
import type { Metadata, Viewport } from 'next';
import './sidebarSlot.css';
import '@/components/homepage/feedChrome.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Lets env(safe-area-inset-*) resolve under the notch and home indicator
  // when the app is launched standalone. In a normal browser tab those
  // insets are 0, so the padding is a no-op.
  viewportFit: 'cover',
  themeColor: '#1a2332',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://snapie.io'),
  title: {
    default: 'Snapie',
    template: '%s | Snapie',
  },
  description: 'Decentralized social on Hive',
  applicationName: 'Snapie',
  appleWebApp: {
    capable: true,
    title: 'Snapie',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'Snapie',
    description: 'Decentralized social on Hive',
    siteName: 'Snapie',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    site: '@SnapieApp',
    title: 'Snapie',
    description: 'Decentralized social on Hive',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* aioha-modal.css (Tailwind v4 preflight) loads when the login modal
          opens, so it is not a render-blocking stylesheet on first paint. */}
      <body suppressHydrationWarning>
        {/* Chakra color-mode script: sets the color-mode class on <html>
            synchronously before hydration so server + client render match. */}
        <ColorModeScript initialColorMode="dark" />
        <Providers>
          <Suspense fallback={null}>
            <LayoutContent>{children}</LayoutContent>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
