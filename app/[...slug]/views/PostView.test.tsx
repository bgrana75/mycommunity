import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ getPost: vi.fn() }));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('@/lib/hive/metadata-functions', () => ({
  getPostForMetadata: (...args: unknown[]) => mocks.getPost(...args),
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
    mocks.getPost.mockResolvedValue({ author: 'alice', permlink: 'p1', title: 'Hi', body: 'x' });
    const element = await PostView({ author: 'alice', permlink: 'p1' });
    expect(element).toBeTruthy();
    expect(mocks.getPost).toHaveBeenCalledWith('alice', 'p1');
  });

  it('returns a real 404 when the post does not exist', async () => {
    mocks.getPost.mockResolvedValue(null);
    await expect(PostView({ author: 'nosuch', permlink: 'missing' })).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
