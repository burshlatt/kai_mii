#!/bin/sh
set -eu

if [ -z "${DEPLOY_HOST:-}" ] || [ -z "${DEPLOY_USER:-}" ] || [ -z "${DEPLOY_SSH_KEY:-}" ]; then
  echo "DEPLOY_HOST, DEPLOY_USER and DEPLOY_SSH_KEY are required" >&2
  exit 1
fi

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
DEST="${DEPLOY_PATH:-/opt/deadline}"
KEY="$HOME/.ssh/deadline_deploy"

mkdir -p "$HOME/.ssh"
printf '%s\n' "$DEPLOY_SSH_KEY" > "$KEY"
chmod 600 "$KEY"

SSH="ssh -i $KEY -o StrictHostKeyChecking=accept-new"

$SSH "$DEPLOY_USER@$DEPLOY_HOST" "mkdir -p '$DEST'"

rsync -az --delete \
  -e "$SSH" \
  --exclude '.git/' \
  --exclude '.env' \
  --exclude '.pgdata/' \
  --exclude 'node_modules/' \
  --exclude 'frontend/node_modules/' \
  --exclude 'backend/node_modules/' \
  --exclude 'frontend/dist/' \
  --exclude 'backend/dist/' \
  --exclude 'coverage/' \
  "$ROOT/" "$DEPLOY_USER@$DEPLOY_HOST:$DEST/"

$SSH "$DEPLOY_USER@$DEPLOY_HOST" "cd '$DEST' && \
  if [ ! -f .env ]; then echo '.env is missing on the server' >&2; exit 1; fi && \
  docker compose up -d --build && \
  docker compose exec -T -e HEALTH_URL=http://127.0.0.1:3001/api/health api node dist/monitor-cli.js --once"
