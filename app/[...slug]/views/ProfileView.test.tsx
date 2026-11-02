import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadSeed = vi.fn();
const exists = vi.fn();
const loadSnaps = vi.fn();

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('@/lib/hive/profileSeed', () => ({
  loadProfileSeed: (...args: unknown[]) => loadSeed(...args),
  accountExists: (...args: unknown[]) => exists(...args),
}));

vi.mock('@/lib/hive/profileSnapSeed', () => ({
  loadProfileSnapSeed: (...args: unknown[]) => loadSnaps(...args),
}));

vi.mock('@/components/profile/ProfilePage', () => ({
  default: function ProfilePage(props: unknown) {
    return props;
  },
}));

import ProfileView from './ProfileView';

beforeEach(() => {
  loadSeed.mockReset();
  exists.mockReset();
  loadSnaps.mockReset();
  loadSnaps.mockResolvedValue([]);
});

describe('ProfileView', () => {
  it('passes header seed and snap seed into ProfilePage', async () => {
    const snaps = [{ author: 'alice', permlink: 's1', body: 'hi', bodyHtml: '<p>hi</p>' }];
    loadSeed.mockResolvedValue({ account: { name: 'alice' }, profile: { name: 'alice' } });
    loadSnaps.mockResolvedValue(snaps);

    const element = await ProfileView({ username: 'alice' });
    expect(element).toMatchObject({
      props: {
        username: 'alice',
        initialAccount: { name: 'alice' },
        initialProfile: { name: 'alice' },
        initialSnaps: snaps,
      },
    });
    expect(exists).not.toHaveBeenCalled();
  });

  it('returns a real 404 when the account does not exist', async () => {
    loadSeed.mockResolvedValue(null);
    exists.mockResolvedValue(false);
    await expect(ProfileView({ username: 'nosuchuser' })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('still renders when seed timed out but the account exists', async () => {
    loadSeed.mockResolvedValue(null);
    exists.mockResolvedValue(true);
    loadSnaps.mockResolvedValue([]);
    expect(await ProfileView({ username: 'alice' })).toMatchObject({
      props: { username: 'alice', initialAccount: null, initialSnaps: [] },
    });
  });
});
