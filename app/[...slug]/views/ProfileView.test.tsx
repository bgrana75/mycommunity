import { describe, expect, it, vi, beforeEach } from 'vitest';

const loadSeed = vi.fn();
const exists = vi.fn();

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('@/lib/hive/profileSeed', () => ({
  loadProfileSeed: (...args: unknown[]) => loadSeed(...args),
  accountExists: (...args: unknown[]) => exists(...args),
}));

vi.mock('@/components/profile/ProfilePage', () => ({
  default: function ProfilePage() {
    return null;
  },
}));

import ProfileView from './ProfileView';

beforeEach(() => {
  loadSeed.mockReset();
  exists.mockReset();
});

describe('ProfileView', () => {
  it('renders when the profile seed loads', async () => {
    loadSeed.mockResolvedValue({ account: { name: 'alice' }, profile: { name: 'alice' } });
    expect(await ProfileView({ username: 'alice' })).toBeTruthy();
    expect(exists).not.toHaveBeenCalled();
  });

  it('returns a real 404 when the account does not exist', async () => {
    loadSeed.mockResolvedValue(null);
    exists.mockResolvedValue(false);
    await expect(ProfileView({ username: 'nosuchuser' })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(exists).toHaveBeenCalledWith('nosuchuser');
  });

  it('still renders when seed timed out but the account exists', async () => {
    loadSeed.mockResolvedValue(null);
    exists.mockResolvedValue(true);
    expect(await ProfileView({ username: 'alice' })).toBeTruthy();
  });

  it('still renders when existence cannot be confirmed', async () => {
    loadSeed.mockResolvedValue(null);
    exists.mockResolvedValue('unknown');
    expect(await ProfileView({ username: 'alice' })).toBeTruthy();
  });
});
