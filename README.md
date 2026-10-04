# MyFlightTracker

A personal flight tracker that monitors flight status in real time and sends Telegram notifications on status changes.

## Features

- Track flights by flight number and date
- Live status updates: boarding, departed, airborne, landed, arrived, delayed, diverted, cancelled
- Telegram push notifications on every status transition
- Flight timeline with scheduled vs actual times
- Live in-flight duration counter
- Past flights timeline view with month groupings, proportional date gaps, and mini route maps
- Route map on detail page (persisted track data, no extra API calls)
- API usage dashboard with Chart.js charts on the logs page
- Poll log viewer with filterable log levels (all, status, API calls, telegram, errors)

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
# Fill in DATABASE_URL, AEROAPI_KEY, notification credentials, and Fly.io credentials
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (from Supabase) |
| `AEROAPI_KEY` | FlightAware AeroAPI key |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `TELEGRAM_CHAT_ID` | Telegram chat ID to send notifications to |
| `RESEND_API_KEY` | Resend API key with sending permission |
| `EMAIL_FROM` | Sender on a verified Resend domain |
| `EMAIL_TO` | Email recipient; comma-separated addresses are supported |

### 2. Set up database

For a new, isolated development database/schema only:

```bash
npm install
npm run db:push
```

Check `DATABASE_URL` before running this command. Do not use `db:push` against
production or a schema containing another application's tables: Prisma can propose
dropping tables that are not defined in `prisma/schema.prisma`. Never bypass these
warnings with `--accept-data-loss` or use `--force-reset` on an existing database.
For an existing production database, follow the database safety guidance below.

### 3. Deploy to Fly.io

```bash
fly auth login

# Web app
fly launch --no-deploy
fly secrets set DATABASE_URL="..." AEROAPI_KEY="..." TELEGRAM_BOT_TOKEN="..." TELEGRAM_CHAT_ID="..." RESEND_API_KEY="..." EMAIL_FROM="..." EMAIL_TO="..." --app myflighttracker
fly deploy

# Worker
fly launch --config fly.worker.toml --no-deploy
fly secrets set DATABASE_URL="..." AEROAPI_KEY="..." TELEGRAM_BOT_TOKEN="..." TELEGRAM_CHAT_ID="..." RESEND_API_KEY="..." EMAIL_FROM="..." EMAIL_TO="..." --app myflighttracker-worker
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

## Production database safety

The web container starts with `node build`; neither service applies schema changes
on startup. Deploying application code does not synchronize or migrate the database.
Schema changes must be prepared and applied separately before deploying code that
requires them.

- Verify that the web app and worker target the intended Supabase project and schema.
  Separate application repositories and table-name prefixes do not isolate tables.
  Use a dedicated database/project, or a dedicated PostgreSQL schema and restricted
  runtime role for this application.
- Runtime credentials should permit only the application data operations they need,
  not own tables or have schema-changing privileges. Use separate migration
  credentials for approved DDL. Role changes and moving existing tables require a
  reviewed migration plan; changing `DATABASE_URL` alone does not move existing data.
- Before production schema changes, confirm backup/PITR availability and retention,
  and test restoration to a separate database. Take an appropriate backup before
  moving tables or changing schema ownership.
- This repository does not yet have a Prisma migration history. Before adopting
  `prisma migrate deploy`, establish a reviewed baseline of the existing application
  schema, test it against a restored copy, and mark the baseline as applied only
  after verifying it matches production. Do not run development migrations or reset
  an existing production database.
- Review migration SQL for destructive operations and references to other
  applications' tables. Apply only approved migrations using migration credentials;
  never use `prisma db push` as a production deployment step.