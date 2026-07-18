#!/usr/bin/env bash
# Nightly backup of the app Postgres database (docker-compose.app-db.yml, port 5433).
# Reads credentials from .env.app-db so nothing is hardcoded here.
# Usage: scripts/backup-app-db.sh [backup-dir]

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$APP_DIR/.env.app-db"
BACKUP_DIR="${1:-$APP_DIR/backups/app-db}"
RETENTION_DAYS=21

if [ ! -f "$ENV_FILE" ]; then
  echo "[backup-app-db] missing $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

DB_HOST="${APP_POSTGRES_HOST:-127.0.0.1}"
DB_PORT="${APP_POSTGRES_PORT:-5433}"
DB_NAME="${APP_POSTGRES_DATABASE:-nijahomzs}"
DB_USER="${APP_POSTGRES_USERNAME:-nijahomzs}"
export PGPASSWORD="${APP_POSTGRES_PASSWORD:?APP_POSTGRES_PASSWORD not set in .env.app-db}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$BACKUP_DIR/${DB_NAME}-${STAMP}.dump"

echo "[backup-app-db] dumping $DB_NAME@$DB_HOST:$DB_PORT -> $OUT_FILE"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -Fc -f "$OUT_FILE"

SIZE=$(du -h "$OUT_FILE" | cut -f1)
echo "[backup-app-db] wrote $OUT_FILE ($SIZE)"

# Prune backups older than RETENTION_DAYS
find "$BACKUP_DIR" -name "${DB_NAME}-*.dump" -mtime "+${RETENTION_DAYS}" -print -delete

echo "[backup-app-db] done"
