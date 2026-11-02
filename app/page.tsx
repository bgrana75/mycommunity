import type { Metadata } from 'next';
import { preload } from 'react-dom';
import HomePage from '@/components/homepage/HomePage';
import { loadHomeInitialSnapPage } from '@/lib/hive/homeInitialFeed';
import { firstScreenLcpImageUrl } from '@/lib/images/feedLcp';
import { SSR_PAINTED_SNAP_COUNT } from '@/lib/hive/publicSnapPage';

// Short window: the public first page is shared by every logged-out visitor.
// Logged-in mutes and following still load on the client.
export const revalidate = 30;

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  // Next replaces (not merges) nested metadata objects, so repeat the layout's fields.
  openGraph: {
    title: 'Snapie',
    description: 'Decentralized social on Hive',
    siteName: 'Snapie',
    type: 'website',
    url: '/',
    images: ['/icons/icon-512.png'],
  },
  twitter: {
    card: 'summary',
    site: '@SnapieApp',
    title: 'Snapie',
    description: 'Decentralized social on Hive',
    images: ['/icons/icon-512.png'],
  },
};

// Same clip pattern Chakra's VisuallyHidden uses; keeps the server-rendered
// HTML with one <h1> without changing the feed layout.
const srOnly = {
  position: 'absolute', width: 1, height: 1, margin: -1, padding: 0,
  overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
} as const;

export default async function Page() {
  // Blended Latest and the snaps walk both seed a real first page. A null
  // seed is only the source having nothing to paint, which leaves the
  // client fetch in place.
  const initialSnapPage = await loadHomeInitialSnapPage();
  // A photo in the first screen is the home LCP element once it paints.
  // Card 0 is often text; the next painted snap's image is then larger.
  // Preload that URL from this server component so it matches next/image.
  const lcpImage = firstScreenLcpImageUrl(
    (initialSnapPage?.comments ?? []).slice(0, SSR_PAINTED_SNAP_COUNT).map((comment) => comment.body),
  );
  if (lcpImage) {
    preload(lcpImage, { as: 'image', fetchPriority: 'high' });
  }
  return (
    <>
      <h1 style={srOnly}>Snapie</h1>
      <HomePage initialSnapPage={initialSnapPage} />
    </>
  );
}
