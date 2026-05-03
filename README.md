# MyFlightTracker

A personal flight tracker that monitors flight status in real time and sends Telegram notifications on status changes.

## Features

- Track flights by flight number and date
- Live status updates: boarding, departed, airborne, landed, arrived, delayed, diverted, cancelled
- Telegram push notifications on every status transition
- Flight timeline with scheduled vs actual times
- Live in-flight duration counter
- Poll log viewer

## Stack

- **Web app** — SvelteKit + TypeScript, deployed on Fly.io
- **Worker** — Node.js polling loop, deployed on Fly.io (separate app)
- **Database** — Supabase (PostgreSQL) via Prisma
- **Flight data** — FlightAware AeroAPI
- **Notifications** — Telegram Bot API

## How it works

1. Add a flight (flight number + date) on the dashboard
2. The web app fetches the initial status from AeroAPI immediately
3. A background worker polls AeroAPI every 10 minutes
4. On any status change, the worker upserts the new status and sends a Telegram message
5. The worker shuts down automatically when no active flights remain, and wakes up when a new flight is added

---

## First-time setup

### Prerequisites

- Node.js 20+
- [Supabase](https://supabase.com) project (or any PostgreSQL database)
- [FlightAware AeroAPI](https://flightaware.com/commercial/aeroapi/) key
- Telegram bot token + chat ID
- [Fly.io](https://fly.io) account + `flyctl` CLI (`brew install flyctl`)

### 1. Configure environment

```bash
cp .env.example .env
# Fill in DATABASE_URL, AEROAPI_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (from Supabase) |
| `AEROAPI_KEY` | FlightAware AeroAPI key |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `TELEGRAM_CHAT_ID` | Telegram chat ID to send notifications to |

### 2. Set up database

```bash
npm install
npm run db:push
```

### 3. Deploy to Fly.io

```bash
fly auth login

# Web app
fly launch --no-deploy
fly secrets set DATABASE_URL="..." AEROAPI_KEY="..." TELEGRAM_BOT_TOKEN="..." TELEGRAM_CHAT_ID="..." --app myflighttracker
fly deploy

# Worker
fly launch --config fly.worker.toml --no-deploy
fly secrets set DATABASE_URL="..." AEROAPI_KEY="..." TELEGRAM_BOT_TOKEN="..." TELEGRAM_CHAT_ID="..." --app myflighttracker-worker
fly deploy --config fly.worker.toml
```

### 4. Enable worker auto-wake (optional)

Allows the web app to restart the worker when a new flight is added:

```bash
fly secrets set FLY_API_TOKEN="..." FLY_WORKER_APP="myflighttracker-worker" --app myflighttracker
```

### 5. Set up GitHub Actions for continuous deployment

Generate a Fly.io API token (`fly tokens create deploy`) and add it as `FLY_API_TOKEN` in your GitHub repository secrets (Settings → Secrets → Actions). Subsequent pushes to `main` will automatically deploy both apps.

---

## Day-to-day development

For UI development, running the web app is enough:

```bash
npm run dev                # ← starts the web app on localhost:5173

npm install                # [optional] first time or after dependency changes
npm run worker             # [optional] second terminal — tests polling and notification flow
npm run check              # [optional] pre-commit type checking and linting
```

Pushing to `main` automatically deploys both the web app and worker via GitHub Actions.