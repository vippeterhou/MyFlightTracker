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

deploy_web() {
  echo "→ Deploying web app..."
  fly deploy
  echo "  ✓ https://$WEB_APP.fly.dev"
}

deploy_worker() {
  echo "→ Deploying worker..."
  fly deploy --config fly.worker.toml
  echo "  ✓ Worker deployed"
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
  deploy_web

  echo ""
  deploy_worker

  echo ""
  echo "✓ Setup complete!"

else
  echo "What would you like to deploy?"
  echo "  1) Web app only"
  echo "  2) Worker only"
  echo "  3) Both"
  echo ""
  read -p "Choice [1/2/3]: " choice

  echo ""
  case $choice in
    1) deploy_web ;;
    2) deploy_worker ;;
    3) deploy_web && echo "" && deploy_worker ;;
    *) echo "Invalid choice. Exiting."; exit 1 ;;
  esac

  echo ""
  echo "✓ Done!"
fi
