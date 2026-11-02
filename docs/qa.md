# QA before you ship

Every pull request goes through these gates. Automated ones run in CI; the manual ones are on you and are ticked off in the PR template.

## 1. Automated gate (run locally first)

Node 22, pnpm 9 (see [CONTRIBUTING](../CONTRIBUTING.md)):

```bash
pnpm install --frozen-lockfile
pnpm qa        # lint + typecheck + test + build — the same four jobs CI runs
```

`pnpm test:coverage` enforces the coverage floors in `vitest.config.ts`. New logic needs a test; bug fixes need a test that fails without the fix.

## 1b. Automated phone checks (Playwright)

```bash
pnpm e2e            # headless, phone portrait + landscape (Pixel 7)
pnpm e2e:ui         # watch it run / debug
npx playwright install chromium   # once, to get the browser
```

The suite (`e2e/`) starts its own server on port 3311, signs in as a **fake user** (the auth endpoint is mocked) and **refuses every API write** (scores, points, broadcasts), so it can't touch real accounts. Add a check for any new game in `e2e/games-mobile.spec.ts`. It currently asserts, in a real phone browser, that fullscreen fits the screen, every control is on screen, the start button is reachable, and nothing scrolls sideways. Blocks needs mocked matchmaking first (marked `fixme`).

## 2. Manual check in a browser

Run `pnpm dev` (port 3310) and exercise the change yourself. Type checks and tests don't prove a UI works.

> ⚠️ The dev server can be logged in with **real Hive credentials**. Anything that broadcasts (vote, post, follow, transfer) is a real, public transaction. Read the code path instead of clicking irreversible actions. See `tasks/lessons.md`.

- Golden path **and** the edge cases (empty, error, logged-out, slow network).
- Browser console is clean (no new errors/warnings).
- Light and dark theme.

## 3. Responsive / mobile check (any UI change)

In Chrome DevTools device mode (or a real phone on your LAN — preferred for games), check at **375×667 portrait**, **390×844 portrait**, and **844×390 landscape**:

- [ ] No horizontal scroll; nothing clipped or overlapping.
- [ ] Tap targets ≥ 44px; nothing relies on hover.
- [ ] Safe areas respected (notch / home indicator) — use a device with a notch or DevTools' device frame.
- [ ] Keyboard opening doesn't hide the input you're typing in.

## 4. Games checklist (any change under `components/games/` or `app/games/`)

Follow [games-mobile.md](./games-mobile.md). On a phone or DevTools touch emulation, for the game you touched:

- [ ] Starts, plays, game-over, retry and **Save Score** all work by touch alone.
- [ ] **Fullscreen in landscape: the whole picture is visible and every control is on screen and reachable.**
- [ ] Fullscreen in portrait: playable, "rotate" hint shown, controls on the letterbox not over the action.
- [ ] Two thumbs at once (move + jump/fire) work; lifting a finger releases that input (nothing sticks).
- [ ] Exit fullscreen restores the normal layout; no stuck controls after exit.
- [ ] Desktop keyboard still works.
- [ ] Sound starts after the first tap; screen doesn't sleep mid-run.

## 5. Ship it

- [ ] `lib/changelog.ts` entry for user-visible changes.
- [ ] Branch from `staging`, PR into `staging`, one focused change per PR.
- [ ] Fill in the PR template honestly — say what you did **not** test.
- [ ] After merge to `staging`, smoke-test the deployed staging site before the `staging` → `main` PR.
