import type { MetadataRoute } from 'next';

/**
 * Installable web app manifest. Icons are generated from app/favicon.ico.
 * No service worker is registered here — push stays on
 * public/firebase-messaging-sw.js, and offline caching is a later change.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Snapie',
    short_name: 'Snapie',
    description: 'Decentralized social on Hive',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#1a2332',
    theme_color: '#1a2332',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
