import { beforeEach, describe, expect, it, vi } from 'vitest';

const getPost = vi.fn();

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('@/lib/hive/metadata-functions', () => ({
  getPostForMetadata: (...args: unknown[]) => getPost(...args),
}));

vi.mock('@/components/blog/PostPage', () => ({
  default: function PostPage(props: { initialPost?: { author: string } | null }) {
    return props;
  },
}));

import PostView from './PostView';

beforeEach(() => {
  getPost.mockReset();
});

describe('PostView', () => {
  it('passes the server post into PostPage for the first HTML', async () => {
    const post = { author: 'alice', permlink: 'p1', title: 'Hello', body: 'World' };
    getPost.mockResolvedValue(post);
    const element = await PostView({ author: 'alice', permlink: 'p1' });
    expect(element).toMatchObject({
      props: { author: 'alice', permlink: 'p1', initialPost: post },
    });
  });

  it('returns a real 404 when the post does not exist', async () => {
    getPost.mockResolvedValue(null);
    await expect(PostView({ author: 'nosuch', permlink: 'missing' })).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
