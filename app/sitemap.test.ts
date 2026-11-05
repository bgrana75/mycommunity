import { beforeEach, describe, expect, it, vi } from 'vitest'

const call = vi.fn()
const databaseCall = vi.fn()

vi.mock('@/lib/hive/hiveclient', () => ({
  default: {
    call: (...args: unknown[]) => call(...args),
    database: { call: (...args: unknown[]) => databaseCall(...args) },
  },
}))

import sitemap from './sitemap'

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
})
