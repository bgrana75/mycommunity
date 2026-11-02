## What & why
<!-- One or two sentences. Link the issue. -->

## QA (see docs/qa.md — tick what applies, and say what you did NOT test)
- [ ] `pnpm qa` passes locally (lint, typecheck, test, build)
- [ ] Tests added/updated (bug fixes: fails without the fix)
- [ ] Tried it in a browser: golden path + edge cases, console clean, light & dark
- [ ] Mobile check: 375×667, 390×844, 844×390 — no clipping, targets ≥ 44px, safe areas
- [ ] **Games only** — [games checklist](../docs/qa.md#4-games-checklist-any-change-under-componentsgames-or-appgames) done, incl. fullscreen landscape + two-thumb input
- [ ] `lib/changelog.ts` entry (user-visible changes)
- [ ] PR targets `staging`

## Not tested / risks
<!-- Honest list. -->
