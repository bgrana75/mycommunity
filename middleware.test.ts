import { readdirSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, type NextResponse } from 'next/server';

const hive = vi.hoisted(() => ({ account: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/http/crawlerNotFound', () => ({
  hiveAccountStatus: (...args: unknown[]) => hive.account(...args),
  hivePostStatus: (...args: unknown[]) => hive.post(...args),
}));

import { middleware, TOP_LEVEL_ROUTES } from './middleware';

const run = (path: string) => middleware(new NextRequest(`https://snapie.io${path}`)) as NextResponse;

const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const crawl = (path: string, ua = GOOGLEBOT) =>
  Promise.resolve(middleware(new NextRequest(`https://snapie.io${path}`, { headers: { 'user-agent': ua } })));

beforeEach(() => {
  hive.account.mockReset();
  hive.post.mockReset();
});

describe('middleware username canonicalisation', () => {
  it('redirects an uppercase @username to lowercase', () => {
    const res = run('/@SNAPIE');
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('https://snapie.io/@snapie');
  });

  it('lowercases only the username, keeping permlink case and the query string', () => {
    const res = run('/@Snapie/Hello-World?x=1');
    expect(res.headers.get('location')).toBe('https://snapie.io/@snapie/Hello-World?x=1');
  });

  it('leaves a lowercase username and other paths alone', () => {
    expect(run('/@snapie').headers.get('location')).toBeNull();
    expect(run('/api/chat/Foo').headers.get('location')).toBeNull();
  });
});

describe('middleware soft-404 guard', () => {
  it('rewrites an unknown bare segment to a 404', () => {
    const res = run('/definitely-not-a-page');
    expect(res.status).toBe(404);
    expect(res.headers.get('x-middleware-rewrite')).toContain('/_not-found');
  });

  it('leaves files and @users alone', () => {
    expect(run('/robots.txt').status).toBe(200);
    expect(run('/manifest.webmanifest').status).toBe(200);
    expect(run('/@snapie').status).toBe(200);
  });

  it('lets real routes through', () => {
    expect(run('/explore').status).toBe(200);
  });

  it('knows every top-level route under app/', () => {
    const dirs = readdirSync('app', { withFileTypes: true })
      .filter(d => d.isDirectory() && !/^[[(]/.test(d.name))
      .map(d => d.name);
    expect([...TOP_LEVEL_ROUTES].sort()).toEqual(dirs.sort());
  });
});

describe('middleware crawler 404s', () => {
  it('404s a crawler on a post Hive says is missing', async () => {
    hive.post.mockResolvedValue('missing');
    const res = await crawl('/@jongolson/gone');
    expect(res.status).toBe(404);
    expect(res.headers.get('x-middleware-rewrite')).toContain('/_not-found');
    expect(hive.post).toHaveBeenCalledWith('jongolson', 'gone');
  });

  it('404s a crawler on a missing account', async () => {
    hive.account.mockResolvedValue('missing');
    expect((await crawl('/@nosuchuser-xq7z')).status).toBe(404);
    expect(hive.account).toHaveBeenCalledWith('nosuchuser-xq7z');
  });

  it('checks a community-prefixed post as the same post', async () => {
    hive.post.mockResolvedValue('missing');
    expect((await crawl('/hive-178315/@jongolson/gone')).status).toBe(404);
    expect(hive.post).toHaveBeenCalledWith('jongolson', 'gone');
  });

  it('lets found and unknown answers render the page', async () => {
    hive.post.mockResolvedValue('found');
    expect((await crawl('/@jongolson/p1')).status).toBe(200);
    hive.post.mockResolvedValue('unknown');
    expect((await crawl('/@jongolson/p1')).status).toBe(200);
  });

  it('never makes a visitor wait on Hive', async () => {
    const res = await crawl('/@nosuchuser-xq7z/gone', CHROME);
    expect(res.status).toBe(200);
    expect(hive.post).not.toHaveBeenCalled();
    expect(hive.account).not.toHaveBeenCalled();
  });

  it('skips wallet and notification subpages', async () => {
    expect((await crawl('/@meno/wallet')).status).toBe(200);
    expect((await crawl('/@meno/notifications')).status).toBe(200);
    expect(hive.post).not.toHaveBeenCalled();
  });
});
