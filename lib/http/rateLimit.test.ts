import { describe, expect, it } from 'vitest';
import { checkRateLimit, trustedClientIp } from './rateLimit';

describe('trustedClientIp', () => {
  it('keys on cf-connecting-ip and ignores a spoofed x-forwarded-for prefix', () => {
    const headers = new Headers({
      'cf-connecting-ip': '203.0.113.8',
      'x-forwarded-for': '198.51.100.9, 203.0.113.8',
    });
    expect(trustedClientIp(headers)).toBe('203.0.113.8');
  });

  it('accepts an IPv6 Cloudflare address', () => {
    const headers = new Headers({ 'cf-connecting-ip': '2001:db8::8' });
    expect(trustedClientIp(headers)).toBe('2001:db8::8');
  });

  it('without Cloudflare, keys on the hop nginx appended, never the client-supplied first one', () => {
    const headers = new Headers({
      'x-forwarded-for': '198.51.100.9, 203.0.113.8',
    });
    expect(trustedClientIp(headers)).toBe('203.0.113.8');
    // Rotating the spoofed prefix must not mint new buckets.
    expect(trustedClientIp(new Headers({ 'x-forwarded-for': '10.0.0.1, 203.0.113.8' }))).toBe('203.0.113.8');
  });

  it('gives direct-to-nginx visitors their own buckets (#335)', () => {
    const a = trustedClientIp(new Headers({ 'x-forwarded-for': '203.0.113.8' }));
    const b = trustedClientIp(new Headers({ 'x-forwarded-for': '203.0.113.9' }));
    expect(a).not.toBe(b);
    expect(trustedClientIp(new Headers({ 'x-forwarded-for': '2001:db8::9' }))).toBe('2001:db8::9');
  });

  it('falls back to the x-forwarded-for hop when cf-connecting-ip is not a single IP', () => {
    const xff = { 'x-forwarded-for': '198.51.100.1, 203.0.113.8' };
    expect(trustedClientIp(new Headers({ ...xff, 'cf-connecting-ip': '198.51.100.1, 203.0.113.8' }))).toBe('203.0.113.8');
    expect(trustedClientIp(new Headers({ ...xff, 'cf-connecting-ip': 'not-an-ip' }))).toBe('203.0.113.8');
  });

  it('shares one bucket only when neither header holds an IP', () => {
    expect(trustedClientIp(new Headers({ 'cf-connecting-ip': 'not-an-ip' }))).toBe('unknown');
    expect(trustedClientIp(new Headers({ 'x-forwarded-for': '198.51.100.1, garbage' }))).toBe('unknown');
    expect(trustedClientIp(new Headers({ 'x-forwarded-for': '' }))).toBe('unknown');
    expect(trustedClientIp(new Headers())).toBe('unknown');
  });
});

describe('checkRateLimit', () => {
  it('allows up to the limit inside the window, then blocks', () => {
    const buckets = new Map();
    expect(checkRateLimit(buckets, '203.0.113.8', 2, 1_000, 0)).toBe(true);
    expect(checkRateLimit(buckets, '203.0.113.8', 2, 1_000, 10)).toBe(true);
    expect(checkRateLimit(buckets, '203.0.113.8', 2, 1_000, 20)).toBe(false);
  });

  it('opens a new window after the previous one expires', () => {
    const buckets = new Map();
    expect(checkRateLimit(buckets, '203.0.113.8', 1, 1_000, 0)).toBe(true);
    expect(checkRateLimit(buckets, '203.0.113.8', 1, 1_000, 999)).toBe(false);
    expect(checkRateLimit(buckets, '203.0.113.8', 1, 1_000, 1_000)).toBe(true);
  });

  it('prunes expired buckets so rotated keys do not stick', () => {
    const buckets = new Map();
    expect(checkRateLimit(buckets, 'a', 5, 1_000, 0)).toBe(true);
    expect(checkRateLimit(buckets, 'b', 5, 1_000, 0)).toBe(true);
    expect(buckets.size).toBe(2);
    expect(checkRateLimit(buckets, 'c', 5, 1_000, 1_000)).toBe(true);
    expect([...buckets.keys()]).toEqual(['c']);
  });
});
