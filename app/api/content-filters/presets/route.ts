import { NextResponse } from 'next/server';
import { DEFAULT_PRESETS } from '@snapie/content-filter';

/** Public preset catalog ("Hide game results", …). HiveSnaps fetches this so
 *  new games can be added with a snapie.io deploy instead of an app release.
 *  Source of truth is the package's DEFAULT_PRESETS for now. */
export async function GET() {
  return NextResponse.json(
    { presets: Object.values(DEFAULT_PRESETS) },
    { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' } },
  );
}
