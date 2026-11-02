import { test, expect, unexpectedWrites } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * The mobile-games standard (docs/games-mobile.md), checked in a real phone
 * browser: fullscreen fits the screen, every control is on screen, no
 * horizontal scroll. This is the class of bug that broke Info War.
 */
const GAMES = [
  { slug: 'snapie-info-war', name: 'Info War', controls: true },
  { slug: 'snapie-rush', name: 'Rush', controls: true },
  { slug: 'puff-quest', name: 'Puff Quest', controls: true },
  { slug: 'snapie-jump', name: 'Jump', controls: false },
  { slug: 'snapie-blast', name: 'Blast', controls: false },
];

const TOL = 1; // sub-pixel rounding

async function expectInViewport(page: Page, selector: string, what: string) {
  const vp = page.viewportSize()!;
  const boxes = await page.locator(selector).evaluateAll((els) =>
    els
      .filter((e) => (e as HTMLElement).offsetParent !== null || getComputedStyle(e).position === 'fixed')
      .map((e) => {
        const r = e.getBoundingClientRect();
        return { label: e.getAttribute('aria-label') ?? e.textContent ?? e.tagName, x: r.x, y: r.y, r: r.right, b: r.bottom };
      }),
  );
  expect(boxes.length, `${what}: nothing found for ${selector}`).toBeGreaterThan(0);
  for (const b of boxes) {
    expect(b.x, `${what}: "${b.label}" left edge`).toBeGreaterThanOrEqual(-TOL);
    expect(b.y, `${what}: "${b.label}" top edge`).toBeGreaterThanOrEqual(-TOL);
    expect(b.r, `${what}: "${b.label}" right edge`).toBeLessThanOrEqual(vp.width + TOL);
    expect(b.b, `${what}: "${b.label}" bottom edge`).toBeLessThanOrEqual(vp.height + TOL);
  }
}

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

for (const game of GAMES) {
  test.describe(game.name, () => {
    test('is playable inline and fits fullscreen on a phone', async ({ page, blockedWrites }) => {
      await page.goto(`/games/${game.slug}`);
      const canvas = page.locator('canvas').first();
      await expect(canvas).toBeVisible();

      // Inline: no sideways scroll, and the control bar fits the screen width.
      expect(await noHorizontalScroll(page), 'inline: horizontal scroll').toBe(true);
      if (game.controls) {
        // Inline the bar may sit below the fold; only its width must fit the phone.
        const vp = page.viewportSize()!;
        const rights = await page.locator('[data-touch-overlay] button').evaluateAll((els) => els.map((x) => x.getBoundingClientRect().right));
        expect(rights.length, 'inline controls rendered').toBeGreaterThan(0);
        for (const r of rights) expect(r, 'inline control overflows the screen width').toBeLessThanOrEqual(vp.width + TOL);
      }

      // Fullscreen: real browser fullscreen.
      await page.locator('[aria-label="Enter fullscreen"]').first().click();
      await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
      // Let the fullscreen layout settle.
      await page.waitForTimeout(500);

      await expectInViewport(page, 'canvas', 'fullscreen canvas');
      // The way to start the game must be reachable (Jump's PLAY was once pushed off a landscape screen).
      const start = page.getByRole('button', { name: /^(play|start)$/i });
      if (await start.count()) await expectInViewport(page, 'button:text-matches("^(play|start)$", "i")', 'fullscreen start button');
      if (game.controls) {
        await expectInViewport(page, '[data-touch="dpad"]', 'fullscreen D-pad');
        await expectInViewport(page, '[data-touch-overlay] button', 'fullscreen buttons');
        // Floating over the game, not a bar eating height.
        const pos = await page.locator('[data-touch-overlay]').first().evaluate((e) => getComputedStyle(e).position);
        expect(pos).toBe('fixed');
      }

      // Back out: the layout returns to normal.
      await page.locator('[aria-label="Exit fullscreen"]').first().click();
      await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
      expect(await noHorizontalScroll(page), 'after exit: horizontal scroll').toBe(true);

      // The suite must never write.
      expect(unexpectedWrites(blockedWrites), 'unexpected API writes during the test').toEqual([]);
    });
  });
}

// Blocks starts a match through API writes; it needs a mocked matchmaking queue first.
test.fixme('Blocks fits fullscreen on a phone (needs mocked matchmaking)', async () => {});
