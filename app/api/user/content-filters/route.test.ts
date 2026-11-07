import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// Auth is covered by lib/chat/auth tests; here the handler runs as "alice".
vi.mock('@/lib/chat/auth', () => ({
  withChatAuth: (handler: (req: NextRequest, ctx: { username: string }) => Promise<NextResponse>) =>
    (req: NextRequest) => handler(req, { username: 'alice' }),
}));

const db = vi.hoisted(() => ({ doc: null as null | { rules: unknown[]; presets: string[]; updatedAt: number } }));
vi.mock('@/lib/db/models/UserContentFilters', () => ({
  UserContentFilters: {
    findById: () => ({ lean: async () => db.doc }),
    updateOne: vi.fn(async (filter: { updatedAt: { $lte: number } }, update: { $set: typeof db.doc }) => {
      if (db.doc && db.doc.updatedAt > filter.updatedAt.$lte) throw Object.assign(new Error('dup'), { code: 11000 });
      db.doc = update.$set;
    }),
  },
}));

import { GET, PUT } from './route';

const ctx = { params: Promise.resolve({}) };
const put = (body: unknown) =>
  (PUT as unknown as (r: NextRequest, c: typeof ctx) => Promise<Response>)(
    new NextRequest('http://localhost/api/user/content-filters', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    ctx,
  );
const get = () =>
  (GET as unknown as (r: NextRequest, c: typeof ctx) => Promise<Response>)(new NextRequest('http://localhost/api/user/content-filters'), ctx);

beforeEach(() => { db.doc = null; });

describe('/api/user/content-filters', () => {
  it('returns null prefs for an account that never synced', async () => {
    expect(await (await get()).json()).toEqual({ prefs: null });
  });

  it('stores sanitized prefs and returns them', async () => {
    const res = await put({ prefs: { rules: [{ kind: 'tag', tag: '#Spam' }, { kind: 'bogus' }], presets: ['games'], updatedAt: 100 } });
    expect(await res.json()).toEqual({ applied: true, prefs: { v: 1, rules: [{ kind: 'tag', tag: 'spam' }], presets: ['games'], updatedAt: 100 } });
    expect((await (await get()).json()).prefs.rules).toEqual([{ kind: 'tag', tag: 'spam' }]);
  });

  it('keeps a newer stored copy and hands it back', async () => {
    db.doc = { rules: [{ kind: 'app', app: 'hiveword' }], presets: [], updatedAt: 500 };
    const res = await put({ prefs: { rules: [], presets: [], updatedAt: 400 } });
    const body = await res.json();
    expect(body.applied).toBe(false);
    expect(body.prefs.rules).toEqual([{ kind: 'app', app: 'hiveword' }]);
  });

  it('pulls a far-future clock back to now', async () => {
    const before = Date.now();
    await put({ prefs: { rules: [], presets: [], updatedAt: before + 10 * 24 * 3600_000 } });
    expect(db.doc!.updatedAt).toBeLessThanOrEqual(Date.now());
    expect(db.doc!.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it('rejects malformed and oversized bodies', async () => {
    expect((await put('{nope')).status).toBe(400);
    expect((await put({ prefs: { rules: 'x' } })).status).toBe(400);
    expect((await put({ prefs: { rules: [], presets: [], pad: 'x'.repeat(70 * 1024) } })).status).toBe(413);
  });
});
