import { describe, it, expect, afterEach } from 'vitest';
import { requestSnapCast, hasSnapCastRequest, clearSnapCastRequest, isRecentlyActive } from './intent';

afterEach(() => clearSnapCastRequest());

describe('snap-cast intent', () => {
  it('only matches the requested thread, until cleared', () => {
    requestSnapCast('alice', 'post-1');
    expect(hasSnapCastRequest('alice', 'post-1')).toBe(true);
    expect(hasSnapCastRequest('alice', 'post-2')).toBe(false);
    clearSnapCastRequest();
    expect(hasSnapCastRequest('alice', 'post-1')).toBe(false);
  });
});

describe('isRecentlyActive', () => {
  // Hive timestamps carry no trailing Z
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString().replace('Z', '');
  it('is true for a thread with replies active within 5 minutes', () => {
    expect(isRecentlyActive({ children: 2, active: ago(60_000) })).toBe(true);
  });
  it('is false when stale or without replies', () => {
    expect(isRecentlyActive({ children: 2, active: ago(10 * 60_000) })).toBe(false);
    expect(isRecentlyActive({ children: 0, active: ago(1000) })).toBe(false);
  });
});
