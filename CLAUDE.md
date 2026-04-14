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
- Pages: `/` (dashboard), `/flights/[id]` (detail + timeline)
- `src/lib/server/` holds shared server-only utilities (db, aeroapi, telegram, poll)

**Worker** (`worker/`) — plain Node.js/TypeScript, deployed via `worker/Dockerfile` + `fly.worker.toml`
- Single polling loop: status polling (AeroAPI, every 10 min)
- `worker/poller.ts` owns all polling logic and dispatches Telegram notifications on status transitions
- Run locally with `npm run worker`

**Data flow:**
1. User adds a flight (flightId + date) via the dashboard → stored in `TrackedFlight` table
2. Web app immediately polls AeroAPI once on add (`src/lib/server/poll.ts`)
3. Worker polls AeroAPI every 10 min; on status change, upserts `FlightStatus` and sends Telegram message

## Key external APIs

- **AeroAPI** (`src/lib/server/aeroapi.ts`) — flight status. Auth via `x-apikey` header using `AEROAPI_KEY`. Free tier: 500 req/month, 10 QPM. Rate limiter enforces 6.5s between calls.
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
