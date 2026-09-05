#!/usr/bin/env bash
set -euo pipefail

FACTORY_DB="${FACTORY_DB_NAME:-factory}"
RO_USER="${FACTORY_DB_READONLY_USER:-factory_readonly}"
RO_PASS="${FACTORY_DB_READONLY_PASSWORD:-factory_readonly_pw_change_me}"
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib"

echo "[factory-init] ensuring read-only role '${RO_USER}' exists…"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v ro_user="$RO_USER" -v ro_pass="$RO_PASS" <<'EOSQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'ro_user', :'ro_pass')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'ro_user')
\gexec
EOSQL

echo "[factory-init] ensuring database '${FACTORY_DB}' exists…"
if ! psql -tAqc "SELECT 1 FROM pg_database WHERE datname = '${FACTORY_DB}'" \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" | grep -q 1; then
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -c "CREATE DATABASE \"${FACTORY_DB}\";"
fi

echo "[factory-init] applying schema + seed to '${FACTORY_DB}'…"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$FACTORY_DB" \
  -v ro_user="$RO_USER" -v factory_db="$FACTORY_DB" \
  -f "${LIB_DIR}/factory-schema.sql" \
  -f "${LIB_DIR}/factory-seed.sql"

echo "[factory-init] done. Read-only user '${RO_USER}' can SELECT the factory tables (no writes)."
