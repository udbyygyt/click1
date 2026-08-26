#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="/root/click1"
MAILU_DIR="/mailu"
OVERRIDE_DIR="$MAILU_DIR/overrides/nginx"
OVERRIDE_FILE="$OVERRIDE_DIR/click1.conf"
HOSTNAME="click1.nfthubcity.xyz"

if [[ "$(pwd)" != "$ROOT_DIR" ]]; then
  echo "Run this script from $ROOT_DIR" >&2
  exit 1
fi
if [[ ! -f "$ROOT_DIR/.env" ]]; then
  echo "Missing production $ROOT_DIR/.env" >&2
  exit 1
fi
if [[ ! -d "$MAILU_DIR" || ! -d "$OVERRIDE_DIR" ]]; then
  echo "Mailu directories are missing" >&2
  exit 1
fi
if ! docker network inspect mailu_default >/dev/null 2>&1; then
  echo "Docker network mailu_default is missing" >&2
  exit 1
fi

if ! grep -q '^HOSTNAMES=.*\bclick1\.nfthubcity\.xyz\b' "$MAILU_DIR/mailu.env"; then
  echo "Mailu HOSTNAMES does not include $HOSTNAME." >&2
  echo "Add it to /mailu/mailu.env and let Mailu issue the certificate before applying the proxy." >&2
  exit 1
fi

backup="$OVERRIDE_FILE.backup.$(date -u +%Y%m%dT%H%M%SZ)"
if [[ -f "$OVERRIDE_FILE" ]]; then
  cp -p "$OVERRIDE_FILE" "$backup"
  echo "Backed up existing override to $backup"
fi
install -m 0644 "$ROOT_DIR/deploy/mailu/click1.conf" "$OVERRIDE_FILE"

docker compose -f "$ROOT_DIR/docker-compose.yml" -f "$ROOT_DIR/docker-compose.mailu.yml" config --quiet
docker exec mailu-front-1 nginx -t

if [[ "${1:-}" != "--apply" ]]; then
  echo "Dry run complete. Re-run with --apply to restart only Mailu front and start Click+1 API/PostgreSQL."
  exit 0
fi

docker compose -f "$ROOT_DIR/docker-compose.yml" -f "$ROOT_DIR/docker-compose.mailu.yml" up -d postgres api
docker compose -f "$MAILU_DIR/docker-compose.yml" up -d front
docker compose -f "$ROOT_DIR/docker-compose.yml" -f "$ROOT_DIR/docker-compose.mailu.yml" ps
echo "Click+1 Mailu integration applied. Verify https://$HOSTNAME/health and /health/db."
