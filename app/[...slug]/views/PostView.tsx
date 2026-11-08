import { notFound } from 'next/navigation';
import PostPage from '@/components/blog/PostPage';
import { loadPostForPage } from '@/lib/hive/metadata-functions';

export default async function PostView({ author, permlink }: { author: string; permlink: string }) {
  // Crawlers need a real 404 when Hive answers that this post is empty.
  // A timeout or a down node is not that answer: the client page can still load it.
  const lookedUp = await loadPostForPage(author, permlink);
  if (lookedUp.status === 'missing') notFound();
  return <PostPage author={author} permlink={permlink} />;
}
