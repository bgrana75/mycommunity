import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const call = vi.fn();

vi.mock('@/lib/hive/hiveclient', () => ({
  default: {
    database: { call: (...args: unknown[]) => call(...args) },
  },
}));

import { loadPostForPage } from './metadata-functions';

beforeEach(() => {
  call.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('loadPostForPage', () => {
  it('is found when get_content returns a post', async () => {
    call.mockResolvedValue({ author: 'alice', permlink: 'p1' });
    await expect(loadPostForPage('alice', 'p1')).resolves.toEqual({
      status: 'found',
      post: { author: 'alice', permlink: 'p1' },
    });
  });

  it('is missing when get_content answers with an empty post', async () => {
    call.mockResolvedValue({ author: '', permlink: '' });
    await expect(loadPostForPage('nosuch', 'gone')).resolves.toEqual({ status: 'missing' });
  });

  it('is unknown when the node errors', async () => {
    call.mockRejectedValue(new Error('fetch failed'));
    await expect(loadPostForPage('alice', 'p1')).resolves.toEqual({ status: 'unknown' });
  });

  it('is unknown when the node never answers', async () => {
    vi.useFakeTimers();
    call.mockReturnValue(new Promise(() => {}));
    const pending = loadPostForPage('alice', 'slow');
    await vi.advanceTimersByTimeAsync(5000);
    await expect(pending).resolves.toEqual({ status: 'unknown' });
  });
});
