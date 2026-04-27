#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTAINER_NAME="${CUBRID_CONTAINER_NAME:-11.2}"
DB_NAME="${CUBRID_DB:-carbonet}"
DB_USER="${CUBRID_USER:-dba}"
SCHEMA_SQL="${BLOCKLIST_SCHEMA_SQL:-$ROOT_DIR/docs/sql/20260328_blocklist_persistence.sql}"

if ! command -v docker >/dev/null 2>&1; then
  echo "[cubrid-blocklist-schema] docker command not found" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  echo "[cubrid-blocklist-schema] CUBRID container is not running: $CONTAINER_NAME" >&2
  exit 1
fi

if [[ ! -f "$SCHEMA_SQL" ]]; then
  echo "[cubrid-blocklist-schema] schema SQL not found: $SCHEMA_SQL" >&2
  exit 1
fi

table_exists() {
  local table_name="$1"
  docker exec "$CONTAINER_NAME" bash -lc \
    "csql -u '$DB_USER' '$DB_NAME' -c \"select count(*) from $table_name;\" >/tmp/cubrid-${table_name}.check 2>&1"
}

print_count() {
  local table_name="$1"
  docker exec "$CONTAINER_NAME" bash -lc \
    "csql -u '$DB_USER' '$DB_NAME' -c \"select count(*) as row_count from $table_name;\""
}

entry_exists=false
action_exists=false
if table_exists "COMTNBLOCKLISTENTRY"; then
  entry_exists=true
fi
if table_exists "COMTNBLOCKLISTACTIONHIST"; then
  action_exists=true
fi

if [[ "$entry_exists" == "true" && "$action_exists" == "true" ]]; then
  echo "[cubrid-blocklist-schema] blocklist persistence tables already exist"
elif [[ "$entry_exists" == "false" && "$action_exists" == "false" ]]; then
  echo "[cubrid-blocklist-schema] applying $SCHEMA_SQL to $CONTAINER_NAME/$DB_NAME"
  docker exec -i "$CONTAINER_NAME" bash -lc "csql -u '$DB_USER' '$DB_NAME'" < "$SCHEMA_SQL"
else
  echo "[cubrid-blocklist-schema] partial blocklist schema detected: COMTNBLOCKLISTENTRY=$entry_exists COMTNBLOCKLISTACTIONHIST=$action_exists" >&2
  echo "[cubrid-blocklist-schema] resolve the partial schema manually before applying the full SQL file" >&2
  exit 1
fi

echo "[cubrid-blocklist-schema] COMTNBLOCKLISTENTRY count"
print_count "COMTNBLOCKLISTENTRY"
echo "[cubrid-blocklist-schema] COMTNBLOCKLISTACTIONHIST count"
print_count "COMTNBLOCKLISTACTIONHIST"
echo "[cubrid-blocklist-schema] blocklist schema check OK"
