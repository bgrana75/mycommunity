import { beforeEach, describe, expect, it, vi } from 'vitest';

const databaseCall = vi.fn();

vi.mock('@/lib/hive/hiveclient', () => ({
  default: {
    database: { call: (...args: unknown[]) => databaseCall(...args) },
  },
}));

vi.mock('@/lib/hive/renderSnapBodyHtml', () => ({
  renderSnapBodyHtml: (body: string) => `<p>${body}</p>`,
}));

import { loadProfileSnapSeed } from './profileSnapSeed';

beforeEach(() => {
  databaseCall.mockReset();
});

describe('loadProfileSnapSeed', () => {
  it('returns peak.snaps comments with bodyHtml', async () => {
    databaseCall.mockResolvedValue([
      { author: 'alice', permlink: 'a', parent_author: 'peak.snaps', body: 'hello' },
      { author: 'alice', permlink: 'b', parent_author: 'someone', body: 'skip' },
    ]);

    const snaps = await loadProfileSnapSeed('alice');
    expect(snaps).toHaveLength(1);
    expect(snaps[0]).toMatchObject({
      permlink: 'a',
      bodyHtml: '<p>hello</p>',
    });
    expect(databaseCall).toHaveBeenCalledWith('get_discussions_by_comments', [
      { start_author: 'alice', start_permlink: '', limit: 20 },
    ]);
  });

  it('returns an empty list when Hive fails', async () => {
    databaseCall.mockRejectedValue(new Error('down'));
    await expect(loadProfileSnapSeed('alice')).resolves.toEqual([]);
  });
});
