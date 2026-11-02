import { test as base, expect, type Page } from '@playwright/test';

/**
 * Safe-by-default page: signed in as a fake Snapie Auth user, and every
 * non-GET request to our API is refused. Tests can't sign in as a real
 * account, save a score, award points or broadcast anything, even by accident.
 */
const FAKE_USER = {
  id: 'e2e-user',
  name: 'E2E Tester',
  picture: null,
  hiveUsername: 'e2e-tester',
  custodyMode: 'custodial',
  isAdmin: false,
  email: null,
  accountValueUsd: null,
  emancipationRequired: false,
};

export async function signInAsFakeUser(page: Page) {
  // Already onboarded, so the "What are you into?" modal doesn't cover the page.
  await page.route('**/api/user/interests**', (route) =>
    route.fulfill({ json: { interestTags: [], interestsOnboardedAt: '2026-01-01T00:00:00.000Z', isNewAccount: false } }),
  );
  await page.route('**/api/snapie-auth/auth/me', (route) =>
    route.fulfill({ json: { user: FAKE_USER } }),
  );
}

/** The fake user makes the page try to start a chat session; that is expected and harmless once blocked. */
export const unexpectedWrites = (writes: string[]) => writes.filter((w) => !w.includes('/api/chat/'));

export const test = base.extend<{ blockedWrites: string[] }>({
  blockedWrites: async ({}, use) => {
    await use([]);
  },
  page: async ({ page, blockedWrites }, use) => {
    // Later routes win, so the write guard goes first and the auth mock after it.
    await page.route('**/api/**', (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method())) return route.fallback();
      // Hive reads go through /api/hive-rpc as POSTed JSON-RPC. Let reads through,
      // never a broadcast.
      if (path === '/api/hive-rpc' && !/broadcast/i.test(req.postData() ?? '')) return route.fallback();
      blockedWrites.push(`${req.method()} ${path}`);
      return route.fulfill({ status: 403, json: { error: 'blocked-by-e2e' } });
    });
    await signInAsFakeUser(page);
    await use(page);
  },
});

export { expect };
