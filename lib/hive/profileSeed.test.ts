import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAccounts = vi.fn();

vi.mock('@/lib/hive/hiveclient', () => ({
  default: {
    database: { getAccounts: (...args: unknown[]) => getAccounts(...args) },
    call: vi.fn(),
  },
}));

import { accountExists } from './profileSeed';

beforeEach(() => {
  getAccounts.mockReset();
});

describe('accountExists', () => {
  it('is true when Hive returns an account', async () => {
    getAccounts.mockResolvedValue([{ name: 'alice' }]);
    expect(await accountExists('alice')).toBe(true);
  });

  it('is false when Hive returns no account', async () => {
    getAccounts.mockResolvedValue([]);
    expect(await accountExists('nosuch')).toBe(false);
  });

  it('is unknown when the node errors', async () => {
    getAccounts.mockRejectedValue(new Error('timeout'));
    expect(await accountExists('alice')).toBe('unknown');
  });
});
