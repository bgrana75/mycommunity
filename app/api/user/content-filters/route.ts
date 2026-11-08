import { NextRequest, NextResponse } from 'next/server';
import { sanitizePrefs, type ContentFilterPrefs } from '@snapie/content-filter';
import { withChatAuth } from '@/lib/chat/auth';
import { UserContentFilters } from '@/lib/db/models/UserContentFilters';

// 500 rules × ~100 bytes, with headroom.
const MAX_BODY_BYTES = 64 * 1024;
// A device with a fast clock must not be able to lock every other device out
// of last-write-wins, so future timestamps are pulled back to now.
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

async function readPrefs(username: string): Promise<ContentFilterPrefs | null> {
  const doc = await UserContentFilters.findById(username).lean();
  return doc ? sanitizePrefs({ rules: doc.rules, presets: doc.presets, updatedAt: doc.updatedAt }) : null;
}

/** Authed: mute lists are personal. Called by snapie.io and HiveSnaps.
 *  `prefs: null` means this account has never synced. */
export const GET = withChatAuth(async (_req, { username }) => {
  return NextResponse.json({ prefs: await readPrefs(username) });
});

/** Replaces the user's prefs, unless the stored copy is newer (another device
 *  wrote since this one last loaded) — then the stored copy is kept and
 *  returned with `applied: false`. */
export const PUT = withChatAuth(async (req: NextRequest, { username }) => {
  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 });

  let body: { prefs?: unknown };
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const prefs = sanitizePrefs(body?.prefs);
  if (!prefs) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const now = Date.now();
  if (prefs.updatedAt > now + MAX_CLOCK_SKEW_MS) prefs.updatedAt = now;

  // Single conditional write: matches when no doc exists yet (upsert) or the
  // stored clock is not newer. A newer stored doc makes the filter miss, and
  // the upsert then collides on _id (E11000) — that's the "stale" signal.
  try {
    await UserContentFilters.updateOne(
      { _id: username, updatedAt: { $lte: prefs.updatedAt } },
      { $set: { rules: prefs.rules, presets: prefs.presets, updatedAt: prefs.updatedAt } },
      { upsert: true },
    );
  } catch (err) {
    if ((err as { code?: number })?.code !== 11000) throw err;
    return NextResponse.json({ applied: false, prefs: await readPrefs(username) });
  }
  return NextResponse.json({ applied: true, prefs });
});
