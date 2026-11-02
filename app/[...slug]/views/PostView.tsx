import { notFound } from 'next/navigation';
import PostPage from '@/components/blog/PostPage';
import { getPostForMetadata } from '@/lib/hive/metadata-functions';
import type { Discussion } from '@hiveio/dhive';

export default async function PostView({ author, permlink }: { author: string; permlink: string }) {
  const post = await getPostForMetadata(author, permlink);
  if (!post) notFound();
  return <PostPage author={author} permlink={permlink} initialPost={post as Discussion} />;
}
