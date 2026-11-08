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

  // Shape of the RPCError dhive throws today for /@nosuchuser/nosuchpost.
  function hivedAssert(expression: string) {
    return Object.assign(new Error(' category=hivemind'), {
      name: 'RPCError',
      jse_info: { code: 10, name: 'assert_exception', message: 'Assert Exception', extension: { assertion_expression: expression } },
    });
  }

  it('is missing when hived asserts that the post does not exist', async () => {
    call.mockRejectedValue(hivedAssert('Post nosuch/gone does not exist'));
    await expect(loadPostForPage('nosuch', 'gone')).resolves.toEqual({ status: 'missing' });
  });

  it('is unknown for any other hived assert', async () => {
    call.mockRejectedValue(hivedAssert('permlink cannot be blank'));
    await expect(loadPostForPage('alice', 'blank')).resolves.toEqual({ status: 'unknown' });
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
