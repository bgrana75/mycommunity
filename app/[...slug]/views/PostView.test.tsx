import { beforeEach, describe, expect, it, vi } from 'vitest';

const getPost = vi.fn();
const communityMuted = vi.fn();

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('@/lib/hive/metadata-functions', () => ({
  loadPostForPage: (...args: unknown[]) => getPost(...args),
}));

vi.mock('@/lib/hive/muted-accounts', () => ({
  isCommunityRoleMuted: (...args: unknown[]) => communityMuted(...args),
}));

vi.mock('@/components/blog/PostPage', () => ({
  default: function PostPage(props: { initialPost?: { author: string } | null }) {
    return props;
  },
}));

import PostView from './PostView';

beforeEach(() => {
  getPost.mockReset();
  communityMuted.mockReset();
  communityMuted.mockResolvedValue(false);
});

describe('PostView', () => {
  it('passes the server post into PostPage for the first HTML', async () => {
    const post = { author: 'alice', permlink: 'p1', title: 'Hello', body: 'World' };
    getPost.mockResolvedValue({ status: 'found', post });
    const element = await PostView({ author: 'alice', permlink: 'p1' });
    expect(element).toMatchObject({
      props: { author: 'alice', permlink: 'p1', initialPost: post },
    });
  });

  it('returns a real 404 when Hive answers that the post is empty', async () => {
    getPost.mockResolvedValue({ status: 'missing' });
    await expect(PostView({ author: 'nosuch', permlink: 'missing' })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('renders without a server body when the node times out or errors', async () => {
    getPost.mockResolvedValue({ status: 'unknown' });
    const element = await PostView({ author: 'alice', permlink: 'p1' });
    expect(element).toMatchObject({
      props: { author: 'alice', permlink: 'p1' },
    });
    expect(element).not.toMatchObject({ props: { initialPost: expect.anything() } });
    expect(communityMuted).not.toHaveBeenCalled();
  });

  it('keeps a community-muted author out of the server HTML', async () => {
    const post = { author: 'muted', permlink: 'p1', body: 'secret' };
    getPost.mockResolvedValue({ status: 'found', post });
    communityMuted.mockResolvedValue(true);
    const element = await PostView({ author: 'muted', permlink: 'p1' });
    expect(element).not.toMatchObject({ props: { initialPost: expect.anything() } });
  });

  it('keeps the body out of the HTML when the mute list cannot be loaded', async () => {
    const post = { author: 'alice', permlink: 'p1', body: 'maybe muted' };
    getPost.mockResolvedValue({ status: 'found', post });
    communityMuted.mockResolvedValue('unknown');
    const element = await PostView({ author: 'alice', permlink: 'p1' });
    expect(element).not.toMatchObject({ props: { initialPost: expect.anything() } });
  });
});
