import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const call = vi.fn();

vi.mock('@/lib/hive/hiveclient', () => ({
  default: {
    call: (...args: unknown[]) => call(...args),
  },
}));

import { isCommunityRoleMuted } from './muted-accounts';

const originalTag = process.env.NEXT_PUBLIC_HIVE_COMMUNITY_TAG;

beforeEach(() => {
  call.mockReset();
  process.env.NEXT_PUBLIC_HIVE_COMMUNITY_TAG = 'hive-173115';
});

afterEach(() => {
  vi.useRealTimers();
  if (originalTag === undefined) delete process.env.NEXT_PUBLIC_HIVE_COMMUNITY_TAG;
  else process.env.NEXT_PUBLIC_HIVE_COMMUNITY_TAG = originalTag;
});

describe('isCommunityRoleMuted', () => {
  it('is true when the community role list marks the author muted', async () => {
    call.mockResolvedValue([
      ['alice', 'member', ''],
      ['MutedAuthor', 'muted', ''],
    ]);
    await expect(isCommunityRoleMuted('mutedauthor')).resolves.toBe(true);
  });

  it('is false when the author has another role', async () => {
    call.mockResolvedValue([['alice', 'member', '']]);
    await expect(isCommunityRoleMuted('alice')).resolves.toBe(false);
  });

  it('is unknown when the role list fails', async () => {
    call.mockRejectedValue(new Error('timeout'));
    await expect(isCommunityRoleMuted('alice')).resolves.toBe('unknown');
  });

  it('is unknown when the role list never answers', async () => {
    vi.useFakeTimers();
    call.mockReturnValue(new Promise(() => {}));
    const pending = isCommunityRoleMuted('alice');
    await vi.advanceTimersByTimeAsync(5000);
    await expect(pending).resolves.toBe('unknown');
  });

  it('is false when no community is configured', async () => {
    delete process.env.NEXT_PUBLIC_HIVE_COMMUNITY_TAG;
    await expect(isCommunityRoleMuted('alice')).resolves.toBe(false);
    expect(call).not.toHaveBeenCalled();
  });
});
