import { NextResponse } from 'next/server';

const WITNESS = 'snapie';
const NODES = ['https://api.hive.blog', 'https://api.deathwing.me', 'https://api.openhive.network'];
const CACHE_MS = 3000;

export const dynamic = 'force-dynamic';

let cache: { at: number; body: { lastBlock: number } } | null = null;

async function fetchWitness() {
  for (const node of NODES) {
    try {
      const res = await fetch(node, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'condenser_api.get_witness_by_account',
          params: [WITNESS],
          id: 1,
        }),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) continue;
      const { result } = await res.json();
      if (result?.last_confirmed_block_num != null) {
        return { lastBlock: Number(result.last_confirmed_block_num) };
      }
    } catch {
      // try next node
    }
  }
  return null;
}

/** Shared 3s cache so N open sidebars cost one RPC call, not N. */
export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_MS) return NextResponse.json(cache.body);
  const body = await fetchWitness();
  if (!body) return NextResponse.json(cache?.body ?? { lastBlock: null }, { status: 200 });
  cache = { at: Date.now(), body };
  return NextResponse.json(body);
}
