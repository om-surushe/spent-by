#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/finance-tracker}"

cd "$APP_DIR"
mkdir -p data

if [ ! -f .env.production ]; then
  echo "Missing $APP_DIR/.env.production" >&2
  exit 1
fi

sudo docker compose up -d --build
sudo docker image prune -f >/dev/null

for attempt in {1..20}; do
  if curl -fsS http://127.0.0.1:3010/api/health; then
    exit 0
  fi
  sleep 1
done

echo "Health check failed after deploy" >&2
sudo docker logs --tail 80 finance-tracker >&2
exit 1
