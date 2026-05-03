# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commit style
Do not add Co-Authored-By lines to commits.

## Commands

```bash
# Install dependencies
npm install

# Generate Prisma client (required after schema changes)
npm run db:generate

# Push schema to database (dev)
npm run db:push

# Dev server (web app)
npm run dev

# Run background worker (dev, with watch)
npm run worker

# Type-check
npm run check

# Production build
npm run build
```

## Architecture

Two independently deployed services share one PostgreSQL database:

**Web app** (`src/`) — SvelteKit + TypeScript, deployed via `Dockerfile` + `fly.toml`
- API routes under `src/routes/api/` handle CRUD for tracked flights
- Pages: `/` (dashboard), `/flights/[id]` (detail + timeline), `/logs` (poll log viewer)
- `src/lib/server/` holds shared server-only utilities (db, aeroapi, telegram, poll)
- `src/lib/components/` — `FlightCard.svelte` (dashboard card), `FlightTimeline.svelte` (detail timeline)
- Layout (`src/routes/+layout.svelte`) shows a "next poll in X:XX" countdown using `lastChecked` + `activeCount` from layout server load

**Worker** (`worker/`) — plain Node.js/TypeScript, deployed via `worker/Dockerfile` + `fly.worker.toml`
- Single polling loop: status polling (AeroAPI, every 10 min)
- `worker/poller.ts` owns all polling logic and dispatches Telegram notifications on status transitions
- Skips flights with terminal statuses ('arrived', 'cancelled') and flights departing >4 hours away (saves AeroAPI quota)
- Calls `process.exit(0)` when no active flights remain — Fly.io does NOT restart on clean exit, so the worker stays stopped until the next flight is added
- Run locally with `npm run worker`

**Data flow:**
1. User adds a flight (flightId + date) via the dashboard → stored in `TrackedFlight` table
2. Web app immediately polls AeroAPI once on add (`src/lib/server/poll.ts`) and calls `startWorker()` (`src/lib/server/flyio.ts`) to wake the worker if it stopped
3. Worker polls AeroAPI every 10 min; on status change, upserts `FlightStatus` and sends Telegram message

## Key external APIs

- **AeroAPI** (`src/lib/server/aeroapi.ts`) — flight status. Auth via `x-apikey` header using `AEROAPI_KEY`. Free tier: 500 req/month, 10 QPM. Rate limiter enforces 6.5s between calls.
- **Telegram Bot API** (`src/lib/server/telegram.ts`) — notifications. Requires `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. Only fires on status transitions; excludes 'scheduled'.
- **Fly.io Machines API** (`src/lib/server/flyio.ts`) — starts a stopped worker machine when a new flight is added. Requires `FLY_API_TOKEN` and `FLY_WORKER_APP`. Silently skips in dev if vars are absent.

## Database

Three tables: `TrackedFlight`, `FlightStatus` (1:1 with TrackedFlight, cascade delete), `PollLog`.
- `PollLog` records every poll event with `level` (info/warn/error), optional `flightId`, `message`, `timestamp`. Pruned to last 500 records automatically (`src/lib/server/logger.ts`).
- All timestamps stored as ISO strings; TypeScript types in `src/lib/types.ts` reflect this (no `Date` objects in API responses).

## Environment variables

Copy `.env.example` to `.env` and fill in:
```
DATABASE_URL=
AEROAPI_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
FLY_API_TOKEN=        # Fly.io Machines API — for waking the worker on new flight add
FLY_WORKER_APP=       # Worker app name, e.g. myflighttracker-worker
```

## Deployment (Fly.io)

Pushing to `main` triggers `.github/workflows/fly-deploy.yml` which deploys both apps automatically (`flyctl deploy --remote-only` for web, then worker).

```bash
# First-time setup
fly auth login
fly postgres create --name myflighttracker-db
fly launch --no-deploy          # sets up web app
fly secrets set DATABASE_URL="..." AEROAPI_KEY="..." TELEGRAM_BOT_TOKEN="..." TELEGRAM_CHAT_ID="..." FLY_API_TOKEN="..." FLY_WORKER_APP="myflighttracker-worker"
fly deploy

# Worker (separate app)
fly launch --config fly.worker.toml --no-deploy
fly secrets set DATABASE_URL="..." AEROAPI_KEY="..." TELEGRAM_BOT_TOKEN="..." TELEGRAM_CHAT_ID="..." --app myflighttracker-worker
fly deploy --config fly.worker.toml
```

Web app Dockerfile runs `prisma db push` on startup (before `node build`) to apply schema changes on deploy.
