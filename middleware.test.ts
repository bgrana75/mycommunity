import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware, TOP_LEVEL_ROUTES } from './middleware';

const run = (path: string) => middleware(new NextRequest(`https://snapie.io${path}`));

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
