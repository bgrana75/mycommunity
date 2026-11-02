// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getAccounts: vi.fn() }));

vi.mock('@/lib/hive/hiveclient', () => ({
  default: { database: { getAccounts: (...args: unknown[]) => mocks.getAccounts(...args) } },
}));

import useHiveAccount from './useHiveAccount';

beforeEach(() => mocks.getAccounts.mockReset());

describe('useHiveAccount', () => {
  it('returns the account with parsed metadata', async () => {
    mocks.getAccounts.mockResolvedValue([{ name: 'alice', posting_json_metadata: '{"profile":{"name":"Alice"}}' }]);
    const { result } = renderHook(() => useHiveAccount('alice'));
    await waitFor(() => expect(result.current.hiveAccount?.name).toBe('alice'));
    expect(result.current.hiveAccount?.metadata).toEqual({ profile: { name: 'Alice' } });
    expect(result.current.error).toBeNull();
  });

  it('reports "User not found" when Hive returns no account, instead of an empty account', async () => {
    mocks.getAccounts.mockResolvedValue([]);
    const { result } = renderHook(() => useHiveAccount('nouserxyz9q'));
    await waitFor(() => expect(result.current.error).toBe('User not found'));
    expect(result.current.hiveAccount).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('rejects an invalid-length name without calling the node', async () => {
    const { result } = renderHook(() => useHiveAccount('nonexistentuser12345'));
    await waitFor(() => expect(result.current.error).toBe('User not found'));
    expect(mocks.getAccounts).not.toHaveBeenCalled();
  });
});
