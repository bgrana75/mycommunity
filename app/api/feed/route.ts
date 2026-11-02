import { NextRequest, NextResponse } from 'next/server';
import { fetchSidecarFeed } from '@/lib/discovery/sidecarClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const before = request.nextUrl.searchParams.get('before');
  const limit = Number(request.nextUrl.searchParams.get('limit') ?? '20');

  const data = await fetchSidecarFeed({ before: before ?? undefined, limit });
  // A sidecar failure must not look like the end of the feed — the client
  // treats hasMore:false as "no more history" and stops paginating for good.
  if (data.failed) {
    return NextResponse.json(
      { items: [], hasMore: true, error: true },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  // Response varies per `before` cursor — never cache, same rule as /api/new-snaps.
  return NextResponse.json(data, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
