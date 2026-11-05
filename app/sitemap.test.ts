import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const call = vi.fn()
const databaseCall = vi.fn()

vi.mock('@/lib/hive/hiveclient', () => ({
  default: {
    call: (...args: unknown[]) => call(...args),
    database: { call: (...args: unknown[]) => databaseCall(...args) },
  },
}))

import sitemap from './sitemap'

const byUrl = (entries: Awaited<ReturnType<typeof sitemap>>, url: string) =>
  entries.find((e) => e.url === url)

beforeEach(() => {
  call.mockReset()
  databaseCall.mockReset()
})

describe('sitemap', () => {
  it('includes core static routes even when Hive is down', async () => {
    databaseCall.mockRejectedValue(new Error('down'))
    call.mockRejectedValue(new Error('down'))

    const entries = await sitemap()
    const urls = entries.map((e) => e.url)

    expect(urls).toContain('https://snapie.io/')
    expect(urls).toContain('https://snapie.io/blog')
    expect(urls).toContain('https://snapie.io/explore')
    expect(urls).toContain('https://snapie.io/games/snapie-blocks')
    expect(databaseCall).toHaveBeenCalled()
    expect(call).toHaveBeenCalled()
  })

  it('adds trending explore tags and recent post URLs', async () => {
    databaseCall.mockResolvedValue([{ name: 'photography' }, { name: 'hive-178315' }])
    call.mockResolvedValue([
      { author: 'alice', permlink: 'hello', last_update: '2026-01-02T00:00:00' },
      { author: 'bob', permlink: 'world', created: '2026-01-01T00:00:00' },
    ])

    const entries = await sitemap()
    const urls = entries.map((e) => e.url)

    expect(urls).toContain('https://snapie.io/explore/photography')
    expect(urls).toContain('https://snapie.io/explore/hive-178315')
    expect(urls).toContain('https://snapie.io/@alice/hello')
    expect(urls).toContain('https://snapie.io/@bob/world')
  })

  it('drops malformed tags and posts, and dedupes URLs', async () => {
    databaseCall.mockResolvedValue([{ name: '' }, { name: '  ' }, { name: 42 }, {}, { name: 'art' }, { name: 'art' }])
    call.mockResolvedValue([
      { author: 'alice', permlink: '' },
      { permlink: 'orphan' },
      { author: 'carol', permlink: 'dup' },
      { author: 'carol', permlink: 'dup' },
    ])

    const urls = (await sitemap()).map((e) => e.url)

    expect(urls.filter((u) => u === 'https://snapie.io/explore/art')).toHaveLength(1)
    expect(urls.filter((u) => u === 'https://snapie.io/@carol/dup')).toHaveLength(1)
    expect(urls.some((u) => u.includes('orphan') || u.endsWith('/@alice/'))).toBe(false)
    expect(urls.some((u) => u === 'https://snapie.io/explore/')).toBe(false)
  })

  it('returns only static entries when Hive answers with a non-array', async () => {
    databaseCall.mockResolvedValue({ error: 'nope' })
    call.mockResolvedValue(null)

    const urls = (await sitemap()).map((e) => e.url)
    expect(urls.every((u) => !u.includes('/explore/') && !u.includes('/@'))).toBe(true)
    expect(urls).toContain('https://snapie.io/')
  })

  it('reads zone-free Hive timestamps as UTC and falls back on bad dates', async () => {
    databaseCall.mockResolvedValue([])
    call.mockResolvedValue([
      { author: 'a', permlink: 'zone-free', last_update: '2026-01-02T03:04:05' },
      { author: 'a', permlink: 'offset', last_update: '2026-01-02T03:04:05+02:00' },
      { author: 'a', permlink: 'created-only', created: '2026-01-01T00:00:00' },
      { author: 'a', permlink: 'invalid', last_update: 'not-a-date' },
      { author: 'a', permlink: 'none' },
    ])

    const before = Date.now()
    const entries = await sitemap()
    const at = (p: string) => byUrl(entries, `https://snapie.io/@a/${p}`)?.lastModified as Date

    expect(at('zone-free').toISOString()).toBe('2026-01-02T03:04:05.000Z')
    expect(at('offset').toISOString()).toBe('2026-01-02T01:04:05.000Z')
    expect(at('created-only').toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(at('invalid').getTime()).toBeGreaterThanOrEqual(before)
    expect(at('none').getTime()).toBeGreaterThanOrEqual(before)
  })

  describe('with a stalled Hive node', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('times out each lookup and still returns static entries', async () => {
      databaseCall.mockReturnValue(new Promise(() => {}))
      call.mockReturnValue(new Promise(() => {}))

      const pending = sitemap()
      await vi.advanceTimersByTimeAsync(8000)
      const urls = (await pending).map((e) => e.url)

      expect(urls).toContain('https://snapie.io/')
      expect(urls.some((u) => u.includes('/explore/') || u.includes('/@'))).toBe(false)
    })
  })
})
