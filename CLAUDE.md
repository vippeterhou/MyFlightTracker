# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- API routes under `src/routes/api/` handle CRUD for tracked flights and an SSE stream for live position
- Pages: `/` (dashboard), `/flights/[id]` (map + timeline)
- `src/lib/server/` holds shared server-only utilities (db, aeroapi, opensky, telegram) — these are also imported directly by the worker using relative paths

**Worker** (`worker/`) — plain Node.js/TypeScript, deployed via `worker/Dockerfile` + `fly.worker.toml`
- Two independent `setInterval` loops: status polling (AeroAPI, every 2 min) and position polling (OpenSky, every 30s)
- `worker/poller.ts` owns all polling logic and dispatches Telegram notifications on status transitions
- Run locally with `npm run worker`

**Data flow:**
1. User adds a flight (flightId + date) via the dashboard → stored in `TrackedFlight` table
2. Worker polls AeroAPI for status; on change, upserts `FlightStatus` and sends Telegram message
3. When airborne, worker also polls OpenSky and appends rows to `Position` table
4. Flight detail page opens SSE connection to `/api/position/[id]` which streams latest positions from DB every 30s → Leaflet map updates live

## Key external APIs

- **AeroAPI** (`src/lib/server/aeroapi.ts`) — flight status. Auth via `x-apikey` header using `AEROAPI_KEY`. Free tier: 500 req/month.
- **OpenSky** (`src/lib/server/opensky.ts`) — live aircraft position by callsign. No auth required.
- **Telegram Bot API** (`src/lib/server/telegram.ts`) — notifications. Requires `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.

## Environment variables

Copy `.env.example` to `.env` and fill in:
```
DATABASE_URL=
AEROAPI_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

## Deployment (Fly.io)

```bash
# First-time setup
fly auth login
fly postgres create --name myflighttracker-db
fly launch --no-deploy          # sets up web app
fly secrets set DATABASE_URL="..." AEROAPI_KEY="..." TELEGRAM_BOT_TOKEN="..." TELEGRAM_CHAT_ID="..."
fly deploy

# Worker (separate app)
fly launch --config fly.worker.toml --no-deploy
fly secrets set DATABASE_URL="..." AEROAPI_KEY="..." TELEGRAM_BOT_TOKEN="..." TELEGRAM_CHAT_ID="..." --app myflighttracker-worker
fly deploy --config fly.worker.toml
```
