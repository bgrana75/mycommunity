import { getWordCount, stripMarkdownToPlainText } from '@/lib/utils/readingStats';

/** Long Reads drops anything older than this. */
export const LONG_READS_MAX_AGE_DAYS = 30;

/** Minimum body words after markdown and HTML are stripped. */
export const LONG_READS_MIN_WORDS = 300;

/**
 * A body at or below this word count (after stripping) is near-empty:
 * a caption, an image with no text, or a one-line test note.
 */
export const LONG_READS_NEAR_EMPTY_MAX_WORDS = 8;

/** How many qualifying posts one sidebar fetch tries to collect. */
export const LONG_READS_TARGET = 8;

/**
 * Created-sort page size. Larger than the target so short posts can be
 * dropped without immediately asking for another page.
 */
export const LONG_READS_PAGE_SIZE = 20;

/** Pages walked per fetch before the sidebar waits for another scroll. */
export const LONG_READS_MAX_PAGES = 4;

/** Trending and For You rows kept after the same filter. */
export const LONG_READS_BLEND_KEEP = 4;

/** Rows requested from each blend source so the keep-count can still fill. */
export const LONG_READS_BLEND_FETCH = 20;

const DAY_MS = 24 * 60 * 60 * 1000;

export const LONG_READS_MAX_AGE_MS = LONG_READS_MAX_AGE_DAYS * DAY_MS;

/**
 * A title or body made only of these tokens is an obvious test post.
 * Plurals are included so "tests tests tests" does not slip past "test".
 */
const TEST_TOKENS = new Set(['test', 'tests', 'teste', 'testes', 'testing']);

export interface LongReadCandidate {
  title?: string;
  body?: string;
  created?: string;
  parent_author?: string;
  author?: string;
  permlink?: string;
}

export interface LongReadOptions {
  now?: Date;
  minWords?: number;
  maxAgeMs?: number;
  nearEmptyMaxWords?: number;
}

function resolveOptions(options?: LongReadOptions) {
  return {
    now: options?.now ?? new Date(),
    minWords: options?.minWords ?? LONG_READS_MIN_WORDS,
    maxAgeMs: options?.maxAgeMs ?? LONG_READS_MAX_AGE_MS,
    nearEmptyMaxWords: options?.nearEmptyMaxWords ?? LONG_READS_NEAR_EMPTY_MAX_WORDS,
  };
}

/** Hive `created` has no timezone suffix. Parse it as UTC. */
export function parseHiveCreatedMs(created: string | undefined | null): number | null {
  if (!created || typeof created !== 'string') return null;
  const trimmed = created.trim();
  if (!trimmed) return null;
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(trimmed) ? trimmed : `${trimmed}Z`;
  const ms = Date.parse(normalized);
  return Number.isNaN(ms) ? null : ms;
}

export function isWithinLongReadWindow(
  created: string | undefined | null,
  now: Date = new Date(),
  maxAgeMs: number = LONG_READS_MAX_AGE_MS,
): boolean {
  const ms = parseHiveCreatedMs(created);
  if (ms === null) return false;
  return now.getTime() - ms <= maxAgeMs;
}

export function textTokens(text: string | undefined | null): string[] {
  const plain = stripMarkdownToPlainText(typeof text === 'string' ? text : '');
  return plain.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** True when the text is two or more tokens and every token is a test word. */
export function isRepeatedTestTokenText(text: string | undefined | null): boolean {
  const tokens = textTokens(text);
  if (tokens.length < 2) return false;
  return tokens.every((token) => TEST_TOKENS.has(token));
}

export function isNearEmptyBody(
  body: string | undefined | null,
  nearEmptyMaxWords: number = LONG_READS_NEAR_EMPTY_MAX_WORDS,
): boolean {
  const source = typeof body === 'string' ? body : '';
  return getWordCount(source) <= nearEmptyMaxWords;
}

export function isObviousTestPost(
  title: string | undefined | null,
  body: string | undefined | null,
  nearEmptyMaxWords: number = LONG_READS_NEAR_EMPTY_MAX_WORDS,
): boolean {
  return isRepeatedTestTokenText(title)
    || isRepeatedTestTokenText(body)
    || isNearEmptyBody(body, nearEmptyMaxWords);
}

export function qualifiesAsLongRead(post: LongReadCandidate, options?: LongReadOptions): boolean {
  if (post.parent_author) return false;
  const { now, minWords, maxAgeMs, nearEmptyMaxWords } = resolveOptions(options);
  if (!isWithinLongReadWindow(post.created, now, maxAgeMs)) return false;
  if (isObviousTestPost(post.title, post.body, nearEmptyMaxWords)) return false;
  const body = typeof post.body === 'string' ? post.body : '';
  return getWordCount(body) >= minWords;
}

export interface AcceptLongReadPageOptions<T> extends LongReadOptions {
  pageSize: number;
  target?: number;
  /** Mutes, replies already handled elsewhere, duplicates. Runs before the long-read checks. */
  include?: (post: T) => boolean;
}

export interface AcceptLongReadPageResult<T> {
  add: T[];
  /** Cursor for the next page: the last post this call fully considered. */
  resumeAfter: T | null;
  /** A later page cannot add another qualifying post. */
  exhausted: boolean;
}

function postIdentity(post: LongReadCandidate): string {
  return `${post.author ?? ''}/${post.permlink ?? ''}`;
}

/**
 * Keep qualifying posts from one created-sort page, and say whether the
 * caller should request another page to fill `target`.
 *
 * Created-sort is newest first, so once the oldest post on a fully consumed
 * page is outside the recency window, older pages are too. A short page is
 * the end of the tag. Filling the target in the middle of a page leaves
 * `exhausted` false and sets `resumeAfter` to the last post considered, so
 * the rest of that page is still fetched later.
 */
export function acceptLongReadPage<T extends LongReadCandidate>(
  page: T[],
  selectedCount: number,
  options: AcceptLongReadPageOptions<T>,
): AcceptLongReadPageResult<T> {
  const target = options.target ?? LONG_READS_TARGET;
  const include = options.include ?? (() => true);
  const { now, maxAgeMs } = resolveOptions(options);
  const add: T[] = [];
  const seen = new Set<string>();
  let consumedThrough = -1;

  for (let i = 0; i < page.length; i++) {
    if (selectedCount + add.length >= target) break;
    consumedThrough = i;
    const post = page[i];
    const key = postIdentity(post);
    if (key !== '/' && seen.has(key)) continue;
    if (key !== '/') seen.add(key);
    if (!include(post)) continue;
    if (!qualifiesAsLongRead(post, options)) continue;
    add.push(post);
  }

  const consumedAll = page.length === 0 || consumedThrough === page.length - 1;
  const oldest = page.length > 0 ? page[page.length - 1] : undefined;
  const oldestOutside = page.length > 0 && !isWithinLongReadWindow(oldest?.created, now, maxAgeMs);
  const shortPage = page.length < options.pageSize;
  const exhausted = page.length === 0 || (consumedAll && (shortPage || oldestOutside));
  const resumeAfter = consumedThrough >= 0 ? page[consumedThrough] : null;

  return { add, resumeAfter, exhausted };
}
