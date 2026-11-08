import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPost: vi.fn(),
  getProfile: vi.fn(),
  loadPost: vi.fn(),
  exists: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('@/lib/hive/metadata-functions', () => ({
  getPostForMetadata: (...args: unknown[]) => mocks.getPost(...args),
  getProfileForMetadata: (...args: unknown[]) => mocks.getProfile(...args),
  loadPostForPage: (...args: unknown[]) => mocks.loadPost(...args),
}));

vi.mock('@/lib/hive/profileSeed', () => ({
  accountExists: (...args: unknown[]) => mocks.exists(...args),
}));

import { metadataForSlug } from './metadata';

const post = { title: 'Hello', body: 'Body text', author: 'alice', permlink: 'p1', json_metadata: '{}' };

beforeEach(() => {
  for (const m of Object.values(mocks)) m.mockReset();
});

describe('metadataForSlug', () => {
  it('builds post metadata for /@author/permlink from the page lookup', async () => {
    mocks.loadPost.mockResolvedValue({ status: 'found', post });
    expect((await metadataForSlug(['@alice', 'p1'])).title).toBe('Hello');
    expect(mocks.loadPost).toHaveBeenCalledWith('alice', 'p1');
    expect(mocks.getPost).not.toHaveBeenCalled();
  });

  it('builds post metadata for a community-prefixed URL', async () => {
    mocks.loadPost.mockResolvedValue({ status: 'found', post });
    expect((await metadataForSlug(['hive-178315', '@alice', 'p1'])).title).toBe('Hello');
    expect(mocks.loadPost).toHaveBeenCalledWith('alice', 'p1');
  });

  it('calls notFound when Hive says the post is missing', async () => {
    mocks.loadPost.mockResolvedValue({ status: 'missing' });
    await expect(metadataForSlug(['@nosuch', 'gone'])).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('falls back to the cached copy, not a 404, when the node fails', async () => {
    mocks.loadPost.mockResolvedValue({ status: 'unknown' });
    mocks.getPost.mockResolvedValue(post);
    expect((await metadataForSlug(['@alice', 'p1'])).title).toBe('Hello');
  });

  it('calls notFound for a profile only when the account does not exist', async () => {
    mocks.getProfile.mockResolvedValue(null);
    mocks.exists.mockResolvedValue(false);
    await expect(metadataForSlug(['@nosuch'])).rejects.toThrow('NEXT_NOT_FOUND');

    mocks.exists.mockResolvedValue('unknown');
    expect(await metadataForSlug(['@alice'])).toEqual({});
  });

  it('returns nothing for a bare segment that is not an @username', async () => {
    expect(await metadataForSlug(['wallet'])).toEqual({});
    expect(mocks.getProfile).not.toHaveBeenCalled();
  });
});
