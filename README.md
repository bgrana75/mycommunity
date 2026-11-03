# Snapie.io

Snapie.io is a Next.js app for Hive-native social experiences: short-form Snaps, blog feeds, community discovery, OpenPods hangouts, and a real-time chat system with channels, DMs, and groups.

## What This App Includes

- Hive-first feed experience (Snaps + Blog)
- Community and following-based filtering
- Wallet/auth flows through Aioha providers
- OpenPods/Hangouts integration (LiveKit-backed)
- Real-time chat with:
  - Public channels
  - Direct messages (DMs)
  - Custom group chats (public/private)
  - Mute/block controls
  - Push notifications (FCM, optional)
  - Encrypted Hive memo fallback for DM delivery nudges

## Tech Stack

- Next.js 14 (App Router)
- React 18 + TypeScript
- Chakra UI
- MongoDB + Mongoose (chat state)
- Hive APIs via `@hiveio/dhive`
- Aioha wallet/auth providers
- Firebase Cloud Messaging (optional, chat push)

## Quick Start

CI installs with **pnpm 9.15.9** on **Node.js 22** (`pnpm-lock.yaml`). Use that pair locally.

### Requirements

- Node.js 22 (`.nvmrc`)
- pnpm 9.15.9 (`packageManager` in `package.json`; Corepack can activate it)

### Install and run

```bash
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install --frozen-lockfile
cp .env.local.example .env.local
pnpm dev
```

App runs on `http://localhost:3310`.

### Docker Compose preview (no host Node)

Apple Silicon and other arm64 machines can boot the app and MongoDB with Docker only. The images are official multi-arch builds (`node:22-bookworm`, `mongo:7.0`); dependencies install inside the image, so nothing is copied from an x86_64 `node_modules`.

```bash
docker compose up --build
```

Open [http://localhost:3310/games/snapie-blocks](http://localhost:3310/games/snapie-blocks). The app listens on host port **3310**. MongoDB stays on the compose network and is not published to the host.

The `web` service uses the `mongo` service's network namespace. In that namespace mongod is on **127.0.0.1**, not the hostname `mongo` (Docker publishes that name as the bridge address, and mongoose times out on it). Compose sets `MONGODB_URI` to `mongodb://127.0.0.1:27017/snapiechat?directConnection=true`. The entrypoint rewrites whatever host is in that variable to `127.0.0.1`, keeps `directConnection=true`, logs `effective MONGODB_URI=...`, and waits for the handshake before Next starts. No `.env` edit is required. Port **3310** is published on the `mongo` service because that service owns the namespace; Mongo's port is not published.

Compose turns on `NEXT_PUBLIC_ENABLE_GAMES` and `NEXT_PUBLIC_ENABLE_POINTS`. Optional overrides live in [`.env.example`](.env.example) — copy to `.env` if you need them. Do not commit `.env` or real secrets. `CHAT_JWT_SECRET` defaults to the local placeholder `local-dev-not-a-secret`.

Two browsers, one match:

1. Start the stack and wait until the Next dev server is ready.
2. Open the Blocks URL in a normal window and again in a private window (or a second browser).
3. Both click **Quick match**. They pair on the public queue within a poll or two (~400ms). No room code.
4. Clearing 2, 3, or 4 lines sends garbage (1, 2, or 4). The other board receives it on the next poll, and the opponent panel shows lines sent plus an HP meter. There is no live mini-board.
5. Topping out, forfeiting, or closing the tab (disconnect) ends the match. The last board standing wins.
6. A logged-in winner is credited **20 Snapie Points** once, by the server, on the match document. A guest can finish the match and is not credited. Log in with Hive in one window before queueing if you want to see the points toast.

`docker compose down` stops the stack. Add `-v` if you also want to drop the Mongo volume.

### Configure env

```bash
cp .env.local.example .env.local
```

The example boots a **feed-only** dev path: community defaults are set, `CHAT_JWT_SECRET` is a non-empty local placeholder, and `MONGODB_URI` is unset. `CHAT_JWT_SECRET` must be non-empty even for `pnpm build` — `lib/chat/auth.ts` throws at import, and Next loads that module during `next build`. CI sets `CHAT_JWT_SECRET=ci-build-placeholder` for the build job. Use the **chat profile** section in `.env.local.example` when hangouts or chat need Mongo, LiveKit, or push. Do not commit `.env.local` or real secrets.

## Scripts

- `pnpm dev` - start local dev server on port `3310`
- `pnpm build` - production build (`CHAT_JWT_SECRET` must be non-empty)
- `pnpm start` - run production server on port `3310`
- `pnpm lint` - run Next.js ESLint
- `pnpm typecheck` - write gitignored `next-env.d.ts`, then `tsc --noEmit` (same as CI)
- `pnpm test` - run Vitest
- `pnpm chat:backfill` - backfill legacy chat docs with current schema fields (needs `MONGODB_URI`)

## Environment Variables

Use `.env.local` for local development.

### Core App / Community

- `NEXT_PUBLIC_THEME` - UI theme name
  - available: `bluesky`, `hacker`, `forest`, `cannabis`, `mengao`, `nounish`, `hivebr`, `windows95`
- `NEXT_PUBLIC_HIVE_COMMUNITY_TAG` - default community tag (e.g. `hive-167980`)
- `NEXT_PUBLIC_HIVE_SEARCH_TAG` - search/feed tag (often same as community tag)
- `NEXT_PUBLIC_HIVE_USER` - default/seed Hive username (without `@`)
- `NEXT_PUBLIC_DISPLAY_CURRENCY` - optional payout display currency

### Media Upload / External APIs

- `NEXT_PUBLIC_3SPEAK_API_KEY` - 3Speak upload access
- `NEXT_PUBLIC_IMAGE_SERVER_API_KEY` - fallback image server key

### Build (required even for a feed-only checkout)

- `CHAT_JWT_SECRET` - must be **non-empty** for `pnpm dev` once chat routes are compiled and for every `pnpm build` / `next build`. `lib/chat/auth.ts` throws `CHAT_JWT_SECRET is not defined` at import time. The example file ships a local placeholder (`local-dev-not-a-secret`). CI uses `ci-build-placeholder`. Use a strong random value in any shared or deployed environment. This is not a `NEXT_PUBLIC_` variable.

### Chat profile (hangouts + chat)

Not required to boot the feed. Leave `MONGODB_URI` unset and chat connects only when a route calls it. See the chat profile section of `.env.local.example`.

- `MONGODB_URI` - MongoDB connection string. Example for a local database: `mongodb://127.0.0.1:27017/snapiechat`. Leave unset for a feed-only checkout.
- `MONGODB_DB_NAME` - chat database name (default in code: `snapiechat`)
- `NEXT_PUBLIC_CHAT_DEFAULT_CHANNEL` - initial channel id/name (e.g. `general`)

### Hangouts / OpenPods

Part of the chat profile in `.env.local.example`. Public endpoints; the feed does not need them, and they do not need Mongo.

- `NEXT_PUBLIC_HANGOUTS_API_URL` - hangouts API base URL
- `NEXT_PUBLIC_LIVEKIT_URL` - LiveKit websocket URL
- `NEXT_PUBLIC_HANGOUTS_TOKEN_STORAGE` - `none`, `session`, or `local`

### Chat sign-in with ButrAuth (Optional)

Lets an app that signs its users in through [ButrAuth](https://butrauth.com) put
them in chat with their ButrAuth access token instead of a Hive signature. This
is the only way **warm-up users** (a ButrAuth identity, no Hive account yet) can
chat: they appear as `~<butrauth userId>`, shown by their handle, and their
conversations move to their Hive name the first time they sign in after
graduating.

Off unless both of these are set **and** `@mantequilla-soft/butrauth-client`
(>= 0.6.0) is installed; it is loaded at runtime, so a build without it is fine.

- `BUTRAUTH_URL` - the ButrAuth deployment, e.g. `https://butrauth.com`
- `BUTRAUTH_CHAT_AUDIENCES` - comma-separated clientIds whose tokens are accepted; a token issued to any other app is refused
- `BUTRAUTH_ISSUER` - expected `iss` (default `butrauth`)

The app's **server** calls `POST /api/chat/auth/butrauth { accessToken }` (or
`client.authenticateWithButrAuth(token)` in `@snapie/chat-client`) and passes the
returned `token` + `username` to the browser's `client.useSession(...)`.

### In-app feedback (Optional)

The feedback form (sidebar, the mobile menu, and Settings) posts to
`POST /api/feedback`. The server opens an issue with `GITHUB_FEEDBACK_TOKEN`.
That value is server-only — do not prefix it with `NEXT_PUBLIC_`. Leave it
unset locally; the form stays in the UI and shows a friendly error.

- `GITHUB_FEEDBACK_TOKEN` - GitHub token that can create issues and labels on the feedback repo
- `GITHUB_FEEDBACK_REPO` - `owner/repo` (default `Mantequilla-Soft/snapie-io`)

Signed-in Hive usernames come from the chat session token or the Snapie Auth
cookie. Guests are filed without an account. The issue does not include email,
IP, or cookies. Submissions are limited to about 5 per hour per IP and session.

### Translation (Optional)

Snapie supports per-snap inline translation via a self-hosted [LibreTranslate](https://github.com/LibreTranslate/LibreTranslate) instance. When configured, a translate button appears below each snap's text content and detects the user's browser language automatically.

- `LIBRETRANSLATE_URL` - base URL of your LibreTranslate instance (e.g. `http://localhost:5000` if on the same server)
- `LIBRETRANSLATE_KEY` - API key for the instance (required when `LT_API_KEYS=true`)

**Self-hosting LibreTranslate (Docker):**

```bash
docker run -d \
  --name libretranslate \
  -p 127.0.0.1:5000:5000 \
  -e LT_API_KEYS=true \
  -e LT_API_KEYS_DB_PATH=/app/db/api_keys.db \
  -v lt-db:/app/db \
  --restart unless-stopped \
  libretranslate/libretranslate
```

Wait for `Listening at: http://[::]:5000` in the logs, then generate an API key:

```bash
docker exec libretranslate ltmanage keys add snapie
```

Copy the printed key into `LIBRETRANSLATE_KEY`. If these vars are not set, the translate button is silently disabled and the rest of the app is unaffected.

### Chat Push Notifications (Optional but recommended)

- `FIREBASE_SERVICE_ACCOUNT` - base64-encoded Firebase Admin service account JSON
- `NEXT_PUBLIC_FIREBASE_CONFIG` - JSON stringified Firebase web config
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY` - VAPID key for browser push tokens

If these are not set, chat still works and falls back to polling behavior.

## Chat Architecture (Current)

### Client

- Chat UI: `components/chat/ChatPanel.tsx`
- Client API wrapper: `lib/chat/ChatService.ts`
- FCM browser integration: `lib/chat/fcmClient.ts`
- Service worker: `public/firebase-messaging-sw.js`

### Server

- Auth:
  - `POST /api/chat/auth/challenge`
  - `POST /api/chat/auth/verify`
- Conversations:
  - `GET /api/chat/conversations`
  - `GET /api/chat/unread`
- Channels:
  - `GET/POST /api/chat/channels`
  - `POST /api/chat/channels/[id]/join`
  - `POST /api/chat/channels/[id]/leave`
  - `GET/POST /api/chat/channels/[id]/messages`
- DMs:
  - `POST /api/chat/dm`
  - `GET/POST /api/chat/dm/[id]/messages`
  - `POST /api/chat/dm/[id]/memo-fallback`
- Groups:
  - `GET/POST /api/chat/groups`
  - `POST/DELETE /api/chat/groups/[id]/members`
- Preferences/devices:
  - `GET/POST /api/chat/preferences`
  - `POST /api/chat/register-device`

### Data Models

- `lib/db/models/ChatUser.ts`
- `lib/db/models/Channel.ts`
- `lib/db/models/Message.ts`
- `lib/db/models/Challenge.ts`

## Backfill / Migration Helper

When updating from older chat data, run:

```bash
pnpm chat:backfill
```

This script normalizes missing fields in existing `channels` and `chatusers` documents.

## Project Structure

- `app/` - routes and API endpoints
- `components/` - UI, including chat and hangouts
- `contexts/` - shared React context (e.g. hangouts)
- `hooks/` - feed, hangout, and UI hooks
- `lib/` - Hive, chat, DB, and utility logic
- `scripts/` - maintenance scripts (chat backfill)
- `public/` - static assets and service worker

## Deployment Notes

- This project is deployable on Vercel or any Node-compatible host.
- Ensure all required env vars are configured in your deployment platform.
- For chat push notifications in production, both server-side and client-side Firebase env vars must be present.
- Production and staging must be served through Cloudflare. The per-visitor rate limits take the client address only from `cf-connecting-ip` (see `lib/http/rateLimit.ts`); `x-forwarded-for` is client-controlled and is never trusted. A request without that header (a direct `pnpm start` or Docker deployment, or a hit on the origin that bypasses Cloudflare) gets the address `unknown`:
  - `/api/image-proxy`, `/api/feed-lcp` and the games session route key on the address alone, so on such a host all visitors share each route's limit.
  - `/api/feedback` keys on the address plus the Hive username (`lib/feedback/limit.ts`), so signed-in users keep their own buckets and only guests share one.
  - `/api/snapie-auth` does not limit locally. It forwards the address to snapie-auth as `X-Forwarded-For`, and sends no such header when the address is `unknown`.

## Troubleshooting

- `next build` or a chat route throws `CHAT_JWT_SECRET is not defined`: set a non-empty `CHAT_JWT_SECRET`. An empty value fails the same way. The example file and CI both use placeholders; shared environments need their own secret.
- Chat auth failing (`401`): verify `CHAT_JWT_SECRET`, challenge/verify flow, and wallet signature support.
- Feed loads with `MONGODB_URI` unset. Chat requests then fail with `MONGODB_URI is not defined` until the chat profile sets `MONGODB_URI` (and optionally `MONGODB_DB_NAME`).
- No push notifications: verify:
  - `NEXT_PUBLIC_FIREBASE_CONFIG`
  - `NEXT_PUBLIC_FIREBASE_VAPID_KEY`
  - `FIREBASE_SERVICE_ACCOUNT`
  - browser notification permission + service worker registration
- Backfill script says `MONGODB_URI is required`: ensure `.env.local` exists and includes chat DB values.
- Translate button shows "Translation service not configured": set `LIBRETRANSLATE_URL` in your env vars.
- Translate button shows "Translation service unreachable": check that the LibreTranslate container is running (`docker ps`) and the URL is correct.
- Translate returning wrong language: LibreTranslate auto-detects source language — ensure the model for the target language was downloaded (check `docker logs libretranslate`).

## Contributing

Branch from `staging` and open the pull request against `staging`. Keep it small. Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` before opening. Feed or performance changes should include before/after Lighthouse notes when relevant. Details: [CONTRIBUTING.md](CONTRIBUTING.md).

