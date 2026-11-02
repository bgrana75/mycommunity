import { ExtendedComment } from '@/hooks/useComments';

const SIDECAR_URL = process.env.HIVE_ACTIVITY_SIDECAR_URL ?? 'http://127.0.0.1:3099';

export interface SidecarFeedItem {
    source: 'snap' | 'wave';
    author: string;
    permlink: string;
    created: string;
    parentAuthor: string;
    parentPermlink: string;
    body?: string;
    json_metadata?: string;
    active_votes?: ExtendedComment['active_votes'];
    children?: number;
}

export interface SidecarFeedResult {
    items: SidecarFeedItem[];
    hasMore: boolean;
    /** Cursor for the next page — the created time of the last item the
     *  sidecar *selected*, which can be later than the last item it managed
     *  to hydrate. Absent from older sidecar builds. */
    before?: string;
    /** True when the sidecar could not be reached or answered badly. An
     *  empty result with `failed` is an outage, not the end of the feed. */
    failed?: boolean;
}

const FAILED: SidecarFeedResult = { items: [], hasMore: false, failed: true };

// The sidecar hydrates every item in a page with a Hive RPC; when a node is
// slow a deep page legitimately takes several seconds. 3s turned those
// into silent "end of feed" responses.
const SIDECAR_TIMEOUT_MS = 8000;

/** Fetch + timeout + graceful-fallback wrapper around the external sidecar
 *  process's unfiltered, cursor-paginated /feed endpoint (see
 *  internal-docs/hive-activity-sidecar-feed.md). Used both by
 *  app/api/feed/route.ts (the existing "Latest" blended feed) and by the
 *  warm "For You" pool builder (lib/discovery/forYouWarm.ts) — extracted so
 *  both share identical timeout/degrade behavior instead of duplicating it.
 *  The sidecar is a separate, unmodifiable process — any failure (down,
 *  slow, malformed response) degrades to an empty result, never throws. */
export async function fetchSidecarFeed(params: { before?: string; limit: number }): Promise<SidecarFeedResult> {
    try {
        const qs = new URLSearchParams({ limit: String(params.limit) });
        if (params.before) qs.set('before', params.before);
        const res = await fetch(`${SIDECAR_URL}/feed?${qs.toString()}`, {
            signal: AbortSignal.timeout(SIDECAR_TIMEOUT_MS),
        });
        if (!res.ok) return FAILED;
        const data = await res.json();
        if (!data || !Array.isArray(data.items)) return FAILED;
        return data;
    } catch {
        return FAILED;
    }
}
