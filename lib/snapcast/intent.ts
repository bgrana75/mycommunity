/** One-shot hand-off from the Snap-Cast button on a snap card to the
 *  Conversation view it opens, so the "go live" request doesn't have to be
 *  threaded through every component between the two. */
let pending: string | null = null;

const key = (author: string, permlink: string) => `${author}/${permlink}`;

export function requestSnapCast(author: string, permlink: string) {
  pending = key(author, permlink);
}

/** Whether the thread was opened via a Snap-Cast button. Pure (safe in a
 *  state initializer under StrictMode); pair with clearSnapCastRequest(). */
export function hasSnapCastRequest(author: string, permlink: string): boolean {
  return pending === key(author, permlink);
}

export function clearSnapCastRequest() {
  pending = null;
}

/** A thread with a reply in the last few minutes is "active" — the only
 *  discovery signal available without writing a marker to the chain. */
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

export function isRecentlyActive(comment: { active?: string; children?: number }): boolean {
  if (!comment.children || !comment.active) return false;
  const iso = comment.active.endsWith('Z') ? comment.active : `${comment.active}Z`;
  const ts = Date.parse(iso);
  return Number.isFinite(ts) && Date.now() - ts < ACTIVE_WINDOW_MS;
}
