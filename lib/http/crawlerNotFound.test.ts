import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCrawlerNotFoundCache, hiveAccountStatus, hivePostStatus } from './crawlerNotFound';

const reply = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

// What hived answers today for /@nosuchuser/nosuchpost.
const missingPost = {
  error: {
    code: -32602,
    data: {
      name: 'assert_exception',
      extension: { assertion_expression: 'Post jongolson/gone does not exist' },
    },
  },
};

beforeEach(() => clearCrawlerNotFoundCache());

describe('hivePostStatus', () => {
  it('is found when get_content returns a post', async () => {
    const f = vi.fn(() => reply({ result: { author: 'jongolson', permlink: 'p1' } }));
    expect(await hivePostStatus('jongolson', 'p1', f)).toBe('found');
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ method: 'condenser_api.get_content', params: ['jongolson', 'p1'] });
  });

  it('is missing when hived asserts the post does not exist', async () => {
    expect(await hivePostStatus('jongolson', 'gone', vi.fn(() => reply(missingPost)))).toBe('missing');
  });

  it('is missing when get_content returns an empty post', async () => {
    expect(await hivePostStatus('jongolson', 'gone', vi.fn(() => reply({ result: { author: '' } })))).toBe('missing');
  });

  it('is unknown for any other RPC error', async () => {
    const f = vi.fn(() => reply({ error: { data: { name: 'assert_exception', extension: { assertion_expression: 'permlink cannot be blank' } } } }));
    expect(await hivePostStatus('jongolson', 'x', f)).toBe('unknown');
  });

  it('tries the next node, and is unknown when every node fails', async () => {
    const f = vi.fn(() => Promise.reject(new Error('timeout')));
    expect(await hivePostStatus('jongolson', 'p1', f)).toBe('unknown');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('uses the second node when the first one errors', async () => {
    const f = vi.fn()
      .mockImplementationOnce(() => Promise.resolve(new Response('bad gateway', { status: 502 })))
      .mockImplementationOnce(() => reply(missingPost));
    expect(await hivePostStatus('jongolson', 'gone', f)).toBe('missing');
  });

  it('caches definite answers but retries unknown ones', async () => {
    const f = vi.fn(() => reply({ result: { author: 'jongolson' } }));
    await hivePostStatus('jongolson', 'p1', f);
    await hivePostStatus('jongolson', 'p1', f);
    expect(f).toHaveBeenCalledTimes(1);

    const failing = vi.fn(() => Promise.reject(new Error('down')));
    await hivePostStatus('jongolson', 'p2', failing);
    await hivePostStatus('jongolson', 'p2', failing);
    expect(failing).toHaveBeenCalledTimes(4);
  });
});

describe('hiveAccountStatus', () => {
  it('is found for an existing account and missing for an empty result', async () => {
    expect(await hiveAccountStatus('meno', vi.fn(() => reply({ result: [{ name: 'meno' }] })))).toBe('found');
    expect(await hiveAccountStatus('nosuchuser-xq7z', vi.fn(() => reply({ result: [] })))).toBe('missing');
  });

  it('is missing without a lookup for a name no Hive account can have', async () => {
    const f = vi.fn();
    expect(await hiveAccountStatus('ab', f)).toBe('missing');
    expect(await hiveAccountStatus('this-name-is-way-too-long', f)).toBe('missing');
    expect(f).not.toHaveBeenCalled();
  });

  it('is unknown when the nodes fail', async () => {
    expect(await hiveAccountStatus('meno', vi.fn(() => Promise.reject(new Error('down'))))).toBe('unknown');
  });
});
