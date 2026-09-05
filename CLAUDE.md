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

Two independently deployed services share one Supabase (PostgreSQL) database:

**Web app** (`src/`) — SvelteKit + TypeScript, deployed via `Dockerfile` + `fly.toml`
- API routes under `src/routes/api/` handle CRUD for tracked flights
- Pages: `/` (dashboard with grid/timeline toggle for past flights), `/flights/[id]` (detail + timeline), `/logs` (poll log viewer + API usage chart)
- `src/lib/server/` holds shared server-only utilities (db, aeroapi, telegram, poll)
- `src/lib/components/` — `FlightCard.svelte` (compact dashboard card), `FlightCardExpanded.svelte` (expanded card with mini Leaflet route map for timeline view), `PastFlightsTimeline.svelte` (timeline view with month groupings and proportional date gaps), `FlightTimeline.svelte` (detail page timeline), `ApiUsageChart.svelte` (Chart.js usage chart on /logs), `AllRoutesMap.svelte` (all-routes map on /logs with a map/globe toggle and date-range filters; mobile-responsive), `BackButton.svelte` (shared pill "← All flights" back link used on /logs and /flights/[id])
- Layout (`src/routes/+layout.svelte`) shows brand (logo + "Contrail" + "Your Flight. Tracked." tagline) with a status dot (green = worker running) and last-updated tooltip using `lastChecked` + `workerState` from layout server load. `/logs` has no global nav link — reach it directly by URL.

**Worker** (`worker/`) — plain Node.js/TypeScript, deployed via `worker/Dockerfile` + `fly.worker.toml`
- Runs continuously; loops every 10 min
- `worker/poller.ts` owns all polling logic and dispatches Telegram notifications on status transitions
- Skips AeroAPI calls for terminal flights ('arrived', 'cancelled') and flights departing >4 hours away (saves AeroAPI quota); otherwise polls AeroAPI each cycle
- Run locally with `npm run worker`

**Data flow:**
1. User adds a flight (flightId + date) via the dashboard → stored in `TrackedFlight` table
2. Web app immediately polls AeroAPI once on add (`src/lib/server/poll.ts`); if the flight is already arrived, also fetches and persists track data
3. Worker polls AeroAPI every 10 min; on status change, upserts `FlightStatus` and sends Telegram message
4. When a flight arrives at gate, worker fetches and persists the flight track (`trackData` JSON on `FlightStatus`) so the route map works without future API calls

## Key external APIs

- **AeroAPI** (`src/lib/server/aeroapi.ts`) — flight status. Auth via `x-apikey` header using `AEROAPI_KEY`. Free tier: 500 req/month, 10 QPM. Rate limiter enforces 6.5s between calls. Three AeroAPI call types are logged as `ApiCall.endpoint`: the flights/status lookup ('status'), the track/route fetch ('route'), and the schedules lookup ('schedule', used to resolve future-flight and multi-segment candidates when a flight isn't yet in the live feed).
- **Telegram Bot API** (`src/lib/server/telegram.ts`) — notifications. Requires `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. Only fires on status transitions; excludes 'scheduled'.
- **Fly.io Machines API** (`src/lib/server/flyio.ts`) — reads worker machine state (`getWorkerState`) for the header status dot and the `/logs` active-flights indicator. Requires `FLY_API_TOKEN` and `FLY_WORKER_APP`. Returns `'unknown'` silently if vars are absent (dev).

## Database

Four tables: `TrackedFlight`, `FlightStatus` (1:1 with TrackedFlight, cascade delete), `PollLog`, `ApiCall`.
- `FlightStatus` includes `trackData` (JSON flight route points, persisted on arrival), `departureCity`/`arrivalCity` (city names resolved from AeroAPI origin/destination).
- `PollLog` records every poll event with `level` (info/warn/error), optional `flightId`, `message`, `timestamp`. Pruned to last 500 records automatically (`src/lib/server/logger.ts`).
- `ApiCall` logs every AeroAPI call with `endpoint` ('status' | 'route' | 'schedule'), `flightId`, `durationMs`, `success`, `httpStatus`. Logged fire-and-forget from `aeroapi.ts`. Not auto-pruned — usage history is kept long-term. Visualized on the `/logs` page via Chart.js. The chart and its "This month" summary bucket by **UTC** (server runs UTC; client uses `getUTC*` + `timeZone: 'UTC'`).
- All timestamps stored as ISO strings; TypeScript types in `src/lib/types.ts` reflect this (no `Date` objects in API responses).

## Environment variables

Copy `.env.example` to `.env` and fill in:
```
DATABASE_URL=
AEROAPI_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
FLY_API_TOKEN=       # Fly.io auth token — for reading worker machine state
FLY_WORKER_APP=      # Worker app name, e.g. myflighttracker-worker
```

`DATABASE_URL` points at the Supabase Postgres pooler. Note: the **session-mode** pooler (port `5432`) works from local dev; the **transaction** pooler (port `6543`) is unreachable from local dev here (TCP opens but the TLS handshake never completes) — validate anything pooler-related from prod, not locally.

## Deployment (Fly.io)

Pushing to `main` triggers `.github/workflows/fly-deploy.yml` which deploys both apps automatically (`flyctl deploy --remote-only` for web, then worker).

For first-time setup instructions see README.md.

Web app Dockerfile runs `prisma db push` on startup (before `node build`) to apply schema changes on deploy.
