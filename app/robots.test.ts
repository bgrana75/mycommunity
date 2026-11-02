import { describe, expect, it } from 'vitest'
import robots from './robots'

describe('robots', () => {
  it('allows the whole site and points crawlers at the sitemap', () => {
    const result = robots()
    expect(result.rules).toEqual({ userAgent: '*', allow: '/' })
    expect(result.sitemap).toBe('https://snapie.io/sitemap.xml')
  })
})
