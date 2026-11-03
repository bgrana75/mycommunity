import type { Metadata } from 'next';
import { getPostForMetadata, getProfileForMetadata } from '@/lib/hive/metadata-functions';
import { buildPostMetadata, buildProfileMetadata } from '@/lib/utils/buildMetadata';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export async function metadataForSlug(slug: string[]): Promise<Metadata> {
  if (!slug || slug.length === 0) return {};

  // A community-prefixed post (/hive-178315/@author/permlink) starts with the
  // community, so check it before requiring an @ on the first segment.
  if (slug.length === 3 && decodeURIComponent(slug[1]).startsWith('@')) {
    const author = decodeURIComponent(slug[1]).substring(1);
    const permlink = decodeURIComponent(slug[2]);
    const post = await withTimeout(getPostForMetadata(author, permlink), 5000);
    if (post) return buildPostMetadata(post);
    return {};
  }

  const firstSegment = decodeURIComponent(slug[0]);
  if (!firstSegment.startsWith('@')) return {};

  const username = firstSegment.substring(1);

  if (slug.length === 2 && slug[1] !== 'wallet' && slug[1] !== 'notifications') {
    const permlink = decodeURIComponent(slug[1]);
    const post = await withTimeout(getPostForMetadata(username, permlink), 5000);
    if (post) return buildPostMetadata(post);
  }

  if (slug.length === 1) {
    const profile = await withTimeout(getProfileForMetadata(username), 5000);
    if (profile) return buildProfileMetadata(profile);
  }

  return {};
}
