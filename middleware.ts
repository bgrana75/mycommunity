import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_EXACT = [
  'https://snapie.io',
  'https://www.snapie.io',
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_EXACT.includes(origin)) return true;
  // Allow any subdomain of 3speak.tv (covers dev branches, staging, etc.)
  try {
    const { hostname } = new URL(origin);
    return hostname === '3speak.tv' || hostname.endsWith('.3speak.tv');
  } catch {
    return false;
  }
}

// Single-segment routes that exist under app/. app/loading.tsx streams the
// shell before a page can call notFound(), so an unknown /segment would be a
// 200 soft 404; middleware answers it with a real 404 instead. A test keeps
// this list in sync with the app/ directory.
export const TOP_LEVEL_ROUTES = [
  'api', 'blog', 'changelog', 'chat', 'compose', 'edit', 'explore', 'factory',
  'games', 'hangouts', 'join', 'leaderboard', 'profile', 'settings', 'shorts',
  'support', 'test-sanitize',
];

export function middleware(req: NextRequest) {
  const segments = req.nextUrl.pathname.split('/');
  if (segments.length === 2 && segments[1] && !/^[@_]|\./.test(segments[1]) && !TOP_LEVEL_ROUTES.includes(segments[1])) {
    return NextResponse.rewrite(new URL('/_not-found', req.url), { status: 404 });
  }

  // Hive account names are lowercase, so /@SNAPIE is the same page as /@snapie.
  // Only the username segment is lowercased; permlinks are case-sensitive.
  const [, user, ...rest] = req.nextUrl.pathname.split('/');
  if (user.startsWith('@') && user !== user.toLowerCase()) {
    const url = req.nextUrl.clone();
    url.pathname = ['', user.toLowerCase(), ...rest].join('/');
    return NextResponse.redirect(url, 308);
  }

  const origin = req.headers.get('origin') ?? '';
  const allowed = isAllowedOrigin(origin);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(origin, allowed),
    });
  }

  const res = NextResponse.next();
  if (allowed) {
    for (const [k, v] of Object.entries(corsHeaders(origin, allowed))) {
      res.headers.set(k, v);
    }
  }
  return res;
}

function corsHeaders(origin: string, allowed: boolean): Record<string, string> {
  if (!allowed) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

export const config = {
  matcher: [
    // One bare segment: not an @user, not a file (has a dot), not /_next.
    '/:segment([^/.@_][^/.]*)',
    '/api/chat/:path*',
    '/api/upload-image',
    // Only /@names containing an uppercase letter, so other pages skip middleware.
    '/:user(@[^/]*[A-Z][^/]*)/:path*',
  ],
};
