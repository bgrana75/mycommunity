import { notFound } from 'next/navigation';
import PostPage from '@/components/blog/PostPage';
import { getPostForMetadata } from '@/lib/hive/metadata-functions';

export default async function PostView({ author, permlink }: { author: string; permlink: string }) {
  // Client PostPage can show a soft error, but crawlers need a real 404 when
  // Hive has no content for this author/permlink.
  const post = await getPostForMetadata(author, permlink);
  if (!post) notFound();
  return <PostPage author={author} permlink={permlink} />;
}
