#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ! -f .env ]]; then
  echo "Missing .env. Copy .env.example and configure production secrets first." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker Engine is required." >&2
  exit 1
fi

docker compose config --quiet
docker compose pull postgres caddy
docker compose build --pull api
docker compose up -d postgres
docker compose up -d api caddy
docker compose ps

echo "Deployment started. Check the configured production domain at /health and /health/db after the API becomes healthy."
