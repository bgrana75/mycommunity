import type { MetadataRoute } from 'next'

// Allow every page. A Disallow for /settings/admin, /compose, /edit, or
// /test-sanitize makes Lighthouse treat those URLs as blocked from indexing
// (is-crawlable), so they cannot score 100.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: 'https://snapie.io/sitemap.xml',
  }
}
