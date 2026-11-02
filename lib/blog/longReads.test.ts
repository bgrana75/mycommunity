import { describe, expect, it } from 'vitest';
import { getWordCount } from '@/lib/utils/readingStats';
import {
  acceptLongReadPage,
  isObviousTestPost,
  isRepeatedTestTokenText,
  isWithinLongReadWindow,
  LONG_READS_MAX_AGE_MS,
  LONG_READS_MIN_WORDS,
  parseHiveCreatedMs,
  qualifiesAsLongRead,
  type LongReadCandidate,
} from './longReads';

const NOW = new Date('2026-10-06T12:00:00Z');

function words(count: number, prefix = 'word'): string {
  return Array.from({ length: count }, (_, index) => `${prefix}${index}`).join(' ');
}

function post(overrides: Partial<LongReadCandidate> = {}): LongReadCandidate {
  return {
    author: 'author',
    permlink: 'a-real-essay',
    title: 'A real essay about building software',
    body: words(LONG_READS_MIN_WORDS),
    created: '2026-10-01T12:00:00',
    parent_author: '',
    ...overrides,
  };
}

describe('parseHiveCreatedMs', () => {
  it('parses a Hive timestamp with no timezone as UTC', () => {
    expect(parseHiveCreatedMs('2024-09-10T14:43:33')).toBe(Date.parse('2024-09-10T14:43:33Z'));
  });

  it('keeps an explicit timezone', () => {
    expect(parseHiveCreatedMs('2024-09-10T14:43:33Z')).toBe(Date.parse('2024-09-10T14:43:33Z'));
    expect(parseHiveCreatedMs('2024-09-10T14:43:33+00:00')).toBe(Date.parse('2024-09-10T14:43:33Z'));
  });

  it('rejects empty and unparseable values', () => {
    expect(parseHiveCreatedMs('')).toBeNull();
    expect(parseHiveCreatedMs('   ')).toBeNull();
    expect(parseHiveCreatedMs('not-a-date')).toBeNull();
    expect(parseHiveCreatedMs(undefined)).toBeNull();
  });
});

describe('isWithinLongReadWindow', () => {
  it('includes a post created exactly 30 days ago', () => {
    const createdMs = NOW.getTime() - LONG_READS_MAX_AGE_MS;
    const created = new Date(createdMs).toISOString().replace(/\.\d{3}Z$/, '');
    expect(isWithinLongReadWindow(created, NOW)).toBe(true);
  });

  it('excludes a post one millisecond older than 30 days', () => {
    const createdMs = NOW.getTime() - LONG_READS_MAX_AGE_MS - 1;
    const created = new Date(createdMs).toISOString().replace(/\.\d{3}Z$/, '');
    expect(isWithinLongReadWindow(created, NOW)).toBe(false);
  });

  it('excludes a missing timestamp', () => {
    expect(isWithinLongReadWindow(undefined, NOW)).toBe(false);
  });
});

describe('obvious test posts', () => {
  it('treats a title or body of repeated test tokens as a test post', () => {
    expect(isRepeatedTestTokenText('teste teste teste')).toBe(true);
    expect(isRepeatedTestTokenText('teste **teste** *teste*')).toBe(true);
    expect(isRepeatedTestTokenText('test test test')).toBe(true);
    expect(isRepeatedTestTokenText('Testing testing')).toBe(true);
    expect(isRepeatedTestTokenText('tests tests tests')).toBe(true);
    expect(getWordCount('teste **teste** *teste*')).toBe(3);
  });

  it('does not flag a real sentence that merely contains the word test', () => {
    expect(isRepeatedTestTokenText('Testing the camera on a long walk')).toBe(false);
    expect(isRepeatedTestTokenText('This is a test of the emergency broadcast system')).toBe(false);
    expect(isRepeatedTestTokenText('Test Post! Getting started')).toBe(false);
  });

  it('treats a near-empty or image-only body as obvious filler', () => {
    expect(isObviousTestPost('Notes', '')).toBe(true);
    expect(isObviousTestPost('Notes', '   ')).toBe(true);
    expect(isObviousTestPost('Notes', '![shot](https://cdn.example/a.jpg)')).toBe(true);
    expect(isObviousTestPost('Notes', '<p>Hi</p>')).toBe(true);
    expect(isObviousTestPost('A real essay', words(40))).toBe(false);
  });
});

describe('qualifiesAsLongRead', () => {
  it('rejects the 2024 repeated-teste post', () => {
    const reported: LongReadCandidate = {
      author: 'skatehacker',
      permlink: 'teste-teste-teste',
      title: 'teste teste teste',
      body: 'teste **teste** *teste*',
      created: '2024-09-10T14:43:33',
      parent_author: '',
    };
    expect(isWithinLongReadWindow(reported.created, NOW)).toBe(false);
    expect(isObviousTestPost(reported.title, reported.body)).toBe(true);
    expect(qualifiesAsLongRead(reported, { now: NOW })).toBe(false);
  });

  it('keeps a recent post with 300 words of real body text', () => {
    expect(qualifiesAsLongRead(post(), { now: NOW })).toBe(true);
  });

  it('drops a recent post under the word minimum', () => {
    expect(qualifiesAsLongRead(post({ body: words(299) }), { now: NOW })).toBe(false);
    expect(qualifiesAsLongRead(post({ body: words(84) }), { now: NOW })).toBe(false);
  });

  it('counts words after markdown and HTML are stripped', () => {
    const body = `<p>${words(LONG_READS_MIN_WORDS)}</p>\n![alt words here](https://cdn.example/a.jpg)`;
    expect(getWordCount(body)).toBe(LONG_READS_MIN_WORDS);
    expect(qualifiesAsLongRead(post({ body }), { now: NOW })).toBe(true);
  });

  it('drops a 300-word body that is only the word test repeated', () => {
    expect(qualifiesAsLongRead(post({
      title: 'Notes from the lab',
      body: 'test '.repeat(LONG_READS_MIN_WORDS),
    }), { now: NOW })).toBe(false);
  });

  it('drops a long recent post whose title is only repeated test tokens', () => {
    expect(qualifiesAsLongRead(post({ title: 'teste teste teste' }), { now: NOW })).toBe(false);
  });

  it('keeps a long recent post whose title uses test as an ordinary word', () => {
    expect(qualifiesAsLongRead(post({
      title: 'Testing the camera on a long walk',
      body: `This is a test of the emergency system. ${words(LONG_READS_MIN_WORDS)}`,
    }), { now: NOW })).toBe(true);
  });

  it('drops replies and posts outside the recency window', () => {
    expect(qualifiesAsLongRead(post({ parent_author: 'someone' }), { now: NOW })).toBe(false);
    expect(qualifiesAsLongRead(post({ created: '2024-09-10T14:43:33' }), { now: NOW })).toBe(false);
    expect(qualifiesAsLongRead(post({ created: '' }), { now: NOW })).toBe(false);
  });
});

describe('acceptLongReadPage', () => {
  it('drops a short page of old test posts and stops paging', () => {
    const page = [
      post({
        author: 'skatehacker',
        permlink: 'teste-teste-teste',
        title: 'teste teste teste',
        body: 'teste **teste** *teste*',
        created: '2024-09-10T14:43:33',
      }),
      post({
        author: 'skatehacker',
        permlink: 'one-more-test',
        title: 'One more test and thats it!',
        body: 'Testing a photo upload',
        created: '2024-09-02T22:37:48',
      }),
    ];
    const result = acceptLongReadPage(page, 0, { now: NOW, pageSize: 20, target: 8 });
    expect(result.add).toEqual([]);
    expect(result.exhausted).toBe(true);
  });

  it('asks for another page when the first full page is still inside the window', () => {
    const page = Array.from({ length: 20 }, (_, index) => post({
      permlink: `p-${index}`,
      body: index < 2 ? words(LONG_READS_MIN_WORDS) : words(40),
      created: '2026-10-05T00:00:00',
    }));
    const first = acceptLongReadPage(page, 0, { now: NOW, pageSize: 20, target: 8 });
    expect(first.add.map((item) => item.permlink)).toEqual(['p-0', 'p-1']);
    expect(first.exhausted).toBe(false);

    const secondPage = Array.from({ length: 20 }, (_, index) => post({
      permlink: `q-${index}`,
      body: index < 6 ? words(LONG_READS_MIN_WORDS) : words(20),
      created: '2026-09-20T00:00:00',
    }));
    const second = acceptLongReadPage(secondPage, first.add.length, { now: NOW, pageSize: 20, target: 8 });
    expect(second.add).toHaveLength(6);
    expect(first.add.length + second.add.length).toBe(8);
  });

  it('stops at the page that crosses the recency window and keeps the newer long posts', () => {
    const page = [
      post({ permlink: 'new-1', created: '2026-10-04T00:00:00' }),
      post({ permlink: 'new-short', body: words(12), created: '2026-10-03T00:00:00' }),
      post({ permlink: 'new-2', created: '2026-09-12T00:00:00' }),
      post({ permlink: 'old', created: '2024-09-10T14:43:33' }),
    ];
    const result = acceptLongReadPage(page, 0, { now: NOW, pageSize: 4, target: 8 });
    expect(result.add.map((item) => item.permlink)).toEqual(['new-1', 'new-2']);
    expect(result.exhausted).toBe(true);
  });

  it('leaves the unread tail of a page for the next fetch once the target is full', () => {
    const page = [
      post({ permlink: 'keep' }),
      post({ permlink: 'also' }),
      post({ permlink: 'later' }),
    ];
    const result = acceptLongReadPage(page, 0, { now: NOW, pageSize: 3, target: 1 });
    expect(result.add.map((item) => item.permlink)).toEqual(['keep']);
    expect(result.resumeAfter?.permlink).toBe('keep');
    expect(result.exhausted).toBe(false);
  });

  it('skips posts the caller rejects and dedupes a cursor repeat', () => {
    const page = [
      post({ permlink: 'muted', author: 'muted-user' }),
      post({ permlink: 'kept' }),
      post({ permlink: 'kept', author: 'author' }),
    ];
    const result = acceptLongReadPage(page, 0, {
      now: NOW,
      pageSize: 20,
      target: 8,
      include: (item) => item.author !== 'muted-user',
    });
    expect(result.add.map((item) => item.permlink)).toEqual(['kept']);
    expect(result.exhausted).toBe(true);
  });
});
