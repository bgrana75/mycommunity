import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPostForMetadata, getProfileForMetadata, loadPostForPage } from '@/lib/hive/metadata-functions';
import { accountExists } from '@/lib/hive/profileSeed';
import { buildPostMetadata, buildProfileMetadata } from '@/lib/utils/buildMetadata';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/** After a failed page lookup, the cached copy only gets a short wait. */
const FALLBACK_TIMEOUT_MS = 2000;

// Missing posts and users must 404 here, not only in the page. The loading.tsx
// boundaries let the page stream, so its 200 shell is already sent by the time
// PostView/ProfileView can call notFound(). Crawlers get blocking metadata, so
// notFound() from generateMetadata is what sets their status code.
// notFound() is only called once Hive confirms the post or account is missing.
// A timeout or node error renders the page normally.
async function postMetadata(author: string, permlink: string): Promise<Metadata> {
  const lookedUp = await loadPostForPage(author, permlink);
  if (lookedUp.status === 'missing') notFound();
  if (lookedUp.status === 'found') {
    return buildPostMetadata(lookedUp.post as Parameters<typeof buildPostMetadata>[0]);
  }
  // Node trouble: a last good copy still beats a generic preview card.
  const post = await withTimeout(getPostForMetadata(author, permlink), FALLBACK_TIMEOUT_MS);
  return post ? buildPostMetadata(post) : {};
}

export async function metadataForSlug(slug: string[]): Promise<Metadata> {
  if (!slug || slug.length === 0) return {};

  // A community-prefixed post (/hive-178315/@author/permlink) starts with the
  // community, so check it before requiring an @ on the first segment.
  if (slug.length === 3 && decodeURIComponent(slug[1]).startsWith('@')) {
    return postMetadata(decodeURIComponent(slug[1]).substring(1), decodeURIComponent(slug[2]));
  }

  const firstSegment = decodeURIComponent(slug[0]);
  if (!firstSegment.startsWith('@')) return {};

  const username = firstSegment.substring(1);

  if (slug.length === 2 && slug[1] !== 'wallet' && slug[1] !== 'notifications') {
    return postMetadata(username, decodeURIComponent(slug[1]));
  }

  if (slug.length === 1) {
    const profile = await withTimeout(getProfileForMetadata(username), 5000);
    if (profile) return buildProfileMetadata(profile);
    if ((await accountExists(username)) === false) notFound();
  }

  return {};
}
