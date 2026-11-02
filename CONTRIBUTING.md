# Contributing

## Branch from staging

Create your branch from `staging` and open the pull request against `staging`.

`staging` deploys to the staging site. `main` is production and is updated by a separate `staging` → `main` pull request. Keep each pull request small and focused on one change.

## Before opening a pull request

Use the same toolchain as CI: **Node.js 22** and **pnpm 9** (the repo pins `pnpm@9.15.9`). From a clean install:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
```

Or run all four plus the production build with `pnpm qa`. The full QA flow — manual browser checks, the mobile/responsive checklist and the games checklist — is in [docs/qa.md](docs/qa.md), and the pull request template mirrors it. Games must follow [docs/games-mobile.md](docs/games-mobile.md).

`pnpm typecheck` writes the gitignored `next-env.d.ts` (ambient types for static asset imports) and then runs `tsc --noEmit`, matching CI. A fresh checkout fails `tsc` alone because that file is not committed.

## Feed and performance changes

When a change can affect feed loading, layout shift, or other user-visible performance, include before/after [Lighthouse](https://developer.chrome.com/docs/lighthouse/overview/) notes in the pull request (scores and the relevant metrics, plus what you measured). Skip this when the change cannot affect those paths.
