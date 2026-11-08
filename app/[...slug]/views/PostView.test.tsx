import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ getPost: vi.fn() }));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('@/lib/hive/metadata-functions', () => ({
  loadPostForPage: (...args: unknown[]) => mocks.getPost(...args),
}));

vi.mock('@/components/blog/PostPage', () => ({
  default: function PostPage() {
    return null;
  },
}));

import PostView from './PostView';

beforeEach(() => {
  mocks.getPost.mockReset();
});

describe('PostView', () => {
  it('renders the post page when Hive returns content', async () => {
    mocks.getPost.mockResolvedValue({ status: 'found', post: { author: 'alice', permlink: 'p1', title: 'Hi', body: 'x' } });
    const element = await PostView({ author: 'alice', permlink: 'p1' });
    expect(element).toBeTruthy();
    expect(mocks.getPost).toHaveBeenCalledWith('alice', 'p1');
  });

  it('returns a real 404 when Hive answers that the post is empty', async () => {
    mocks.getPost.mockResolvedValue({ status: 'missing' });
    await expect(PostView({ author: 'nosuch', permlink: 'missing' })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('renders the page when the node times out or errors, so a live post is not 404d', async () => {
    mocks.getPost.mockResolvedValue({ status: 'unknown' });
    const element = await PostView({ author: 'alice', permlink: 'p1' });
    expect(element).toBeTruthy();
  });
});
