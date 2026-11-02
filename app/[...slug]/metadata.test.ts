import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getPost: vi.fn(), getProfile: vi.fn() }));

vi.mock('@/lib/hive/metadata-functions', () => ({
  getPostForMetadata: (...args: unknown[]) => mocks.getPost(...args),
  getProfileForMetadata: (...args: unknown[]) => mocks.getProfile(...args),
}));

import { metadataForSlug } from './metadata';

const post = { title: 'Hello', body: 'Body text', author: 'alice', permlink: 'p1', json_metadata: '{}' };

beforeEach(() => {
  mocks.getPost.mockReset();
  mocks.getProfile.mockReset();
});

describe('metadataForSlug', () => {
  it('builds post metadata for /@author/permlink', async () => {
    mocks.getPost.mockResolvedValue(post);
    expect((await metadataForSlug(['@alice', 'p1'])).title).toBe('Hello');
    expect(mocks.getPost).toHaveBeenCalledWith('alice', 'p1');
  });

  it('builds post metadata for a community-prefixed URL', async () => {
    mocks.getPost.mockResolvedValue(post);
    expect((await metadataForSlug(['hive-178315', '@alice', 'p1'])).title).toBe('Hello');
    expect(mocks.getPost).toHaveBeenCalledWith('alice', 'p1');
  });

  it('returns nothing for a bare segment that is not an @username', async () => {
    expect(await metadataForSlug(['wallet'])).toEqual({});
    expect(mocks.getProfile).not.toHaveBeenCalled();
  });
});
