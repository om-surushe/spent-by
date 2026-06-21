#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/finance-tracker}"

cd "$APP_DIR"
git fetch origin main
git reset --hard origin/main

mkdir -p data

if [ ! -f .env.production ]; then
  echo "Missing $APP_DIR/.env.production" >&2
  exit 1
fi

sudo docker compose up -d --build
sudo docker image prune -f >/dev/null
curl -fsS http://127.0.0.1:3010/api/health
