#!/bin/bash
set -e

# ─────────────────────────────────────────────
# MyFlightTracker — Fly.io deploy script
#
# First-time setup:  ./deploy.sh --setup
# Redeploy:          ./deploy.sh
# ─────────────────────────────────────────────

WEB_APP="myflighttracker"
WORKER_APP="myflighttracker-worker"

# Load secrets from .env
if [ ! -f .env ]; then
  echo "Error: .env file not found. Copy .env.example and fill in your values."
  exit 1
fi

export $(grep -v '^#' .env | xargs)

if [ -z "$DATABASE_URL" ] || [ -z "$AEROAPI_KEY" ] || [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ]; then
  echo "Error: Missing required env vars. Check your .env file."
  exit 1
fi

set_secrets() {
  local app=$1
  echo "→ Setting secrets for $app..."
  fly secrets set \
    DATABASE_URL="$DATABASE_URL" \
    AEROAPI_KEY="$AEROAPI_KEY" \
    TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN" \
    TELEGRAM_CHAT_ID="$TELEGRAM_CHAT_ID" \
    --app "$app"
}

if [ "$1" == "--setup" ]; then
  echo "=== First-time setup ==="

  echo ""
  echo "→ Creating web app: $WEB_APP"
  fly launch --no-deploy --name "$WEB_APP" --copy-config

  echo ""
  set_secrets "$WEB_APP"

  echo ""
  echo "→ Creating worker app: $WORKER_APP"
  fly launch --no-deploy --name "$WORKER_APP" --config fly.worker.toml --copy-config

  echo ""
  set_secrets "$WORKER_APP"

  echo ""
  echo "→ Running database migrations..."
  npm run db:push

  echo ""
  echo "→ Deploying web app..."
  fly deploy

  echo ""
  echo "→ Deploying worker..."
  fly deploy --config fly.worker.toml

  echo ""
  echo "✓ Setup complete!"
  echo "  Web app: https://$WEB_APP.fly.dev"

else
  echo "=== Deploying ==="

  echo ""
  echo "→ Deploying web app..."
  fly deploy

  echo ""
  echo "→ Deploying worker..."
  fly deploy --config fly.worker.toml

  echo ""
  echo "✓ Done!"
  echo "  Web app: https://$WEB_APP.fly.dev"
fi
