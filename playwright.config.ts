import { defineConfig, devices } from '@playwright/test';

// Own port so it never collides with (or reuses) a logged-in `pnpm dev` on 3310.
const PORT = 3311;
const CI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Phones are the point: isMobile + hasTouch also makes `(pointer: coarse)` true,
  // which is what turns the on-screen game controls on.
  projects: [
    { name: 'phone-portrait', use: { ...devices['Pixel 7'] } },
    { name: 'phone-landscape', use: { ...devices['Pixel 7 landscape'] } },
  ],
  webServer: {
    // CI builds first (see .github/workflows/test.yml); locally the dev server is fine.
    command: CI ? `npx next start -p ${PORT}` : `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_ENABLE_GAMES: 'true',
      NEXT_PUBLIC_ENABLE_POINTS: 'true',
      CHAT_JWT_SECRET: process.env.CHAT_JWT_SECRET ?? 'e2e-placeholder',
    },
  },
});
