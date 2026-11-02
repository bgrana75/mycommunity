import HiveClient from '@/lib/hive/hiveclient';
import { renderSnapBodyHtml } from '@/lib/hive/renderSnapBodyHtml';
import { withTimeout } from '@/lib/utils/withTimeout';
import type { ExtendedComment } from '@/hooks/useComments';

const SEED_TIMEOUT_MS = 2500;
const PAGE_SIZE = 10;
const FETCH_LIMIT = 20;
const MAX_ITERATIONS = 8;

/**
 * First page of a user's snaps for the profile SSR HTML. Matches
 * useProfileSnaps filtering (peak.snaps parent) and attaches bodyHtml so
 * Snap cards paint markdown without waiting on the client renderer.
 */
export async function loadProfileSnapSeed(username: string): Promise<ExtendedComment[]> {
  try {
    return await withTimeout(fetchSnaps(username), SEED_TIMEOUT_MS);
  } catch (error) {
    console.error('Profile snap seed failed', error);
    return [];
  }
}

async function fetchSnaps(username: string): Promise<ExtendedComment[]> {
  const collected: ExtendedComment[] = [];
  let cursor = '';
  let iterations = 0;

  while (collected.length < PAGE_SIZE && iterations < MAX_ITERATIONS) {
    iterations++;
    const results: ExtendedComment[] = await HiveClient.database.call(
      'get_discussions_by_comments',
      [{ start_author: username, start_permlink: cursor, limit: FETCH_LIMIT }],
    );

    if (!results?.length) break;

    const items = cursor === '' ? results : results.slice(1);
    if (items.length === 0) break;

    collected.push(...items.filter((c) => c.parent_author === 'peak.snaps'));
    cursor = results[results.length - 1].permlink;

    if (results.length < FETCH_LIMIT) break;
  }

  return collected.slice(0, PAGE_SIZE).map((comment) => ({
    ...comment,
    bodyHtml: renderSnapBodyHtml(comment.body || '', comment.author),
  }));
}
