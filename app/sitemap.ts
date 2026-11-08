import type { MetadataRoute } from 'next'
import HiveClient from '@/lib/hive/hiveclient'
import { withTimeout } from '@/lib/utils/withTimeout'

// Refresh hourly. Trending tags and recent posts change often enough that a
// daily sitemap would lag; a full rebuild on every request is unnecessary.
export const revalidate = 3600

const SITE = 'https://snapie.io'
const TAG_LIMIT = 30
const POST_LIMIT = 40
// Each Hive lookup gets its own bound so a stalled node cannot hold the
// prerender past Next's 60s static generation limit. The race does not cancel
// the request; a timed-out lookup just contributes no entries.
const LOOKUP_TIMEOUT_MS = 8000

const STATIC_PATHS: Array<{
  path: string
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  priority: number
}> = [
  { path: '/', changeFrequency: 'hourly', priority: 1 },
  { path: '/blog', changeFrequency: 'hourly', priority: 0.9 },
  { path: '/explore', changeFrequency: 'hourly', priority: 0.9 },
  { path: '/shorts', changeFrequency: 'hourly', priority: 0.8 },
  { path: '/changelog', changeFrequency: 'weekly', priority: 0.5 },
  { path: '/join', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/support', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/leaderboard', changeFrequency: 'daily', priority: 0.5 },
  { path: '/hangouts', changeFrequency: 'daily', priority: 0.5 },
  { path: '/factory', changeFrequency: 'weekly', priority: 0.4 },
  { path: '/games', changeFrequency: 'weekly', priority: 0.5 },
  { path: '/games/snapie-rush', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/games/snapie-jump', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/games/snapie-info-war', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/games/snapie-blast', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/games/snapie-blocks', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/games/puff-quest', changeFrequency: 'monthly', priority: 0.3 },
]

type TrendingTag = { name?: string }
type RankedPost = { author?: string; permlink?: string; last_update?: string; created?: string }

function entry(
  path: string,
  opts: Pick<MetadataRoute.Sitemap[number], 'changeFrequency' | 'priority' | 'lastModified'>,
): MetadataRoute.Sitemap[number] {
  return { url: `${SITE}${path}`, ...opts }
}

/**
 * Hive returns UTC timestamps with no zone ("2026-01-02T00:00:00"), which
 * `new Date` would read as local time. Treat zone-free values as UTC, keep
 * explicit offsets, and return undefined for anything unparseable so the
 * caller's fallback applies (an Invalid Date would throw in toISOString).
 */
function parseHiveTime(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const v = value.trim()
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(v)
  const date = new Date(hasZone ? v : `${v}Z`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

async function trendingTagPaths(): Promise<string[]> {
  try {
    const tags = (await withTimeout(
      HiveClient.database.call('get_trending_tags', ['', TAG_LIMIT]),
      LOOKUP_TIMEOUT_MS,
    )) as TrendingTag[]
    if (!Array.isArray(tags)) return []
    return tags
      .map((t) => (typeof t?.name === 'string' ? t.name.trim() : ''))
      .filter((name) => name && name !== '')
      .map((name) => `/explore/${encodeURIComponent(name)}`)
  } catch {
    return []
  }
}

async function recentPostPaths(): Promise<Array<{ path: string; lastModified?: Date }>> {
  try {
    const posts = (await withTimeout(
      HiveClient.call('bridge', 'get_ranked_posts', {
        sort: 'trending',
        tag: '',
        limit: POST_LIMIT,
        start_author: '',
        start_permlink: '',
      }),
      LOOKUP_TIMEOUT_MS,
    )) as RankedPost[]
    if (!Array.isArray(posts)) return []
    return posts
      .filter((p) => p?.author && p?.permlink)
      .map((p) => ({
        path: `/@${p.author}/${p.permlink}`,
        lastModified: parseHiveTime(p.last_update) ?? parseHiveTime(p.created),
      }))
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const [tagPaths, postPaths] = await Promise.all([trendingTagPaths(), recentPostPaths()])

  const staticEntries = STATIC_PATHS.map(({ path, changeFrequency, priority }) =>
    entry(path, { lastModified: now, changeFrequency, priority }),
  )

  const tagEntries = tagPaths.map((path) =>
    entry(path, { lastModified: now, changeFrequency: 'daily', priority: 0.6 }),
  )

  const postEntries = postPaths.map(({ path, lastModified }) =>
    entry(path, {
      lastModified: lastModified ?? now,
      changeFrequency: 'daily',
      priority: 0.7,
    }),
  )

  // Deduplicate by URL (a static path could theoretically overlap a tag path).
  const seen = new Set<string>()
  const out: MetadataRoute.Sitemap = []
  for (const item of [...staticEntries, ...tagEntries, ...postEntries]) {
    if (seen.has(item.url)) continue
    seen.add(item.url)
    out.push(item)
  }
  return out
}
