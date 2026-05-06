#!/usr/bin/env bash
set -euo pipefail

# Apply DB migrations for a specific project and always write migration history.
# Usage:
#   bash ops/scripts/apply-project-db-migration.sh <PROJECT_ID> [RELEASE_DIR]
#
# Required layout:
#   <release-dir>/config/manifest.json
#   <release-dir>/db/*.sql
#
# Optional companion files:
#   <name>.check.sql     executed after <name>.sql succeeds
#   <name>.rollback.sql  recorded in history for rollback playbooks

PROJECT_ID="${1:-}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RELEASE_DIR="${2:-$ROOT_DIR/var/releases/$PROJECT_ID}"
DB_DIR="$RELEASE_DIR/db"
MANIFEST_FILE="$RELEASE_DIR/config/manifest.json"
TARGET_ENV="${TARGET_ENV:-${DEPLOY_TARGET:-LOCAL}}"
CSQL_BIN="${CSQL_BIN:-csql}"
CSQL_USER="${CSQL_USER:-dba}"
CSQL_PASSWORD="${CSQL_PASSWORD:-${CUBRID_PASSWORD:-}}"
DB_MIGRATION_BACKUP_PATH="${DB_MIGRATION_BACKUP_PATH:-}"
GIT_REVISION="${GIT_REVISION:-$(git -C "$ROOT_DIR" rev-parse --short=12 HEAD 2>/dev/null || true)}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "[db-migration] usage: bash ops/scripts/apply-project-db-migration.sh <PROJECT_ID> [RELEASE_DIR]" >&2
  exit 2
fi

if [[ ! -d "$DB_DIR" || ! -f "$MANIFEST_FILE" ]]; then
  echo "[db-migration] No DB directory or manifest found for $PROJECT_ID. Skipping."
  exit 0
fi

if ! command -v "$CSQL_BIN" >/dev/null 2>&1; then
  echo "[db-migration] missing csql command: $CSQL_BIN" >&2
  exit 1
fi

resolve_project_db_url() {
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$MANIFEST_FILE" <<'PY'
import json
import sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as fp:
    data = json.load(fp)

def walk(value):
    if isinstance(value, dict):
        project_db = value.get("projectDb")
        if isinstance(project_db, dict) and project_db.get("url"):
            print(project_db["url"])
            raise SystemExit(0)
        for child in value.values():
            walk(child)
    elif isinstance(value, list):
        for child in value:
            walk(child)

walk(data)
PY
    return
  fi

  grep -oE '"url"[[:space:]]*:[[:space:]]*"[^"]+"' "$MANIFEST_FILE" \
    | sed -E 's/.*"url"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/' \
    | head -n 1
}

sql_quote() {
  printf "%s" "${1:-}" | sed "s/'/''/g"
}

sanitize_id() {
  printf "%s" "$1" | tr -c '[:alnum:]_.:-' '_' | cut -c 1-128
}

run_csql_file() {
  local db_name="$1"
  local sql_file="$2"
  if [[ -n "$CSQL_PASSWORD" ]]; then
    "$CSQL_BIN" -u "$CSQL_USER" -p "$CSQL_PASSWORD" "$db_name" -i "$sql_file"
  else
    "$CSQL_BIN" -u "$CSQL_USER" "$db_name" -i "$sql_file"
  fi
}

csql_output_has_error() {
  grep -E 'ERROR CODE|ERROR:|SYNTAX ERROR|Semantic:|Cannot|Unable to' >/dev/null
}

run_csql_text() {
  local db_name="$1"
  local sql_text="$2"
  local sql_file
  local output
  sql_file="$(mktemp)"
  printf "%s\n" "$sql_text" > "$sql_file"
  if ! output="$(run_csql_file "$db_name" "$sql_file" 2>&1)"; then
    printf "%s\n" "$output" >&2
    rm -f "$sql_file"
    return 1
  fi
  if printf "%s\n" "$output" | csql_output_has_error; then
    printf "%s\n" "$output" >&2
    rm -f "$sql_file"
    return 1
  fi
  printf "%s\n" "$output"
  rm -f "$sql_file"
}

run_csql_scalar() {
  local db_name="$1"
  local sql_text="$2"
  local sql_file
  sql_file="$(mktemp)"
  printf "%s\n" "$sql_text" > "$sql_file"
  run_csql_file "$db_name" "$sql_file" 2>/dev/null \
    | awk '/^[[:space:]]*[0-9]+[[:space:]]*$/ { value=$1 } END { if (value != "") print value; }'
  rm -f "$sql_file"
}

ensure_history_table() {
  local db_name="$1"
  run_csql_text "$db_name" "
CREATE TABLE IF NOT EXISTS db_migration_history (
  migration_id VARCHAR(128) NOT NULL PRIMARY KEY,
  project_id VARCHAR(100) NOT NULL,
  target_env VARCHAR(100) NOT NULL,
  db_name VARCHAR(255) NOT NULL,
  sql_file_path VARCHAR(1000) NOT NULL,
  checksum_sha256 VARCHAR(64) NOT NULL,
  applied_status VARCHAR(30) NOT NULL,
  applied_by VARCHAR(255),
  started_at DATETIME,
  finished_at DATETIME,
  backup_path VARCHAR(1000),
  rollback_file_path VARCHAR(1000),
  check_file_path VARCHAR(1000),
  error_message VARCHAR(4000),
  git_revision VARCHAR(80),
  created_at DATETIME
);
"
}

insert_history_started() {
  local db_name="$1"
  local migration_id="$2"
  local sql_file="$3"
  local checksum="$4"
  local rollback_file="$5"
  local check_file="$6"
  run_csql_text "$db_name" "
INSERT INTO db_migration_history (
  migration_id,
  project_id,
  target_env,
  db_name,
  sql_file_path,
  checksum_sha256,
  applied_status,
  applied_by,
  started_at,
  backup_path,
  rollback_file_path,
  check_file_path,
  git_revision,
  created_at
) VALUES (
  '$(sql_quote "$migration_id")',
  '$(sql_quote "$PROJECT_ID")',
  '$(sql_quote "$TARGET_ENV")',
  '$(sql_quote "$db_name")',
  '$(sql_quote "$sql_file")',
  '$(sql_quote "$checksum")',
  'STARTED',
  '$(sql_quote "${USER:-unknown}")',
  CURRENT_DATETIME,
  '$(sql_quote "$DB_MIGRATION_BACKUP_PATH")',
  '$(sql_quote "$rollback_file")',
  '$(sql_quote "$check_file")',
  '$(sql_quote "$GIT_REVISION")',
  CURRENT_DATETIME
);
"
}

update_history_status() {
  local db_name="$1"
  local migration_id="$2"
  local status="$3"
  local error_message="${4:-}"
  run_csql_text "$db_name" "
UPDATE db_migration_history
SET applied_status = '$(sql_quote "$status")',
    finished_at = CURRENT_DATETIME,
    error_message = '$(sql_quote "$error_message")'
WHERE migration_id = '$(sql_quote "$migration_id")';
"
}

already_applied_successfully() {
  local db_name="$1"
  local checksum="$2"
  local count
  count="$(run_csql_scalar "$db_name" "
SELECT COUNT(*)
FROM db_migration_history
WHERE checksum_sha256 = '$(sql_quote "$checksum")'
  AND applied_status = 'SUCCESS';
" || true)"
  [[ "${count:-0}" -gt 0 ]]
}

DB_URL="$(resolve_project_db_url || true)"
if [[ -z "$DB_URL" ]]; then
  echo "[db-migration] Could not resolve project DB URL from manifest. Skipping."
  exit 0
fi

DB_NAME="$(printf "%s" "$DB_URL" | cut -d':' -f5)"
if [[ -z "$DB_NAME" ]]; then
  echo "[db-migration] Could not resolve DB name from URL: $DB_URL" >&2
  exit 1
fi

echo "[db-migration] Starting migration for project=$PROJECT_ID env=$TARGET_ENV db=$DB_NAME release=$RELEASE_DIR"
ensure_history_table "$DB_NAME"

mapfile -t SQL_FILES < <(find "$DB_DIR" -maxdepth 1 -type f -name '*.sql' \
  ! -name '*.check.sql' ! -name '*.rollback.sql' | sort)

if [[ "${#SQL_FILES[@]}" -eq 0 ]]; then
  echo "[db-migration] No migration SQL files found for $PROJECT_ID."
  exit 0
fi

for sql_file in "${SQL_FILES[@]}"; do
  checksum="$(sha256sum "$sql_file" | awk '{print $1}')"
  if already_applied_successfully "$DB_NAME" "$checksum"; then
    echo "[db-migration] Already applied checksum=$checksum file=$sql_file. Skipping."
    continue
  fi

  base="${sql_file%.sql}"
  rollback_file=""
  check_file=""
  [[ -f "$base.rollback.sql" ]] && rollback_file="$base.rollback.sql"
  [[ -f "$base.check.sql" ]] && check_file="$base.check.sql"
  migration_id="$(sanitize_id "${PROJECT_ID}-${TARGET_ENV}-$(basename "$base")-${checksum:0:12}-$(date '+%Y%m%d%H%M%S')")"

  echo "[db-migration] Applying file=$sql_file checksum=$checksum migrationId=$migration_id"
  insert_history_started "$DB_NAME" "$migration_id" "$sql_file" "$checksum" "$rollback_file" "$check_file"

  if ! migration_output="$(run_csql_file "$DB_NAME" "$sql_file" 2>&1)" \
    || printf "%s\n" "$migration_output" | csql_output_has_error; then
    printf "%s\n" "$migration_output" >&2
    update_history_status "$DB_NAME" "$migration_id" "FAILED" "$(printf "%s" "$migration_output" | tail -c 3500)"
    echo "[db-migration] Migration failed: $sql_file" >&2
    exit 1
  fi
  printf "%s\n" "$migration_output"

  if [[ -n "$check_file" ]]; then
    echo "[db-migration] Running check file=$check_file"
    if ! check_output="$(run_csql_file "$DB_NAME" "$check_file" 2>&1)" \
      || printf "%s\n" "$check_output" | csql_output_has_error; then
      printf "%s\n" "$check_output" >&2
      update_history_status "$DB_NAME" "$migration_id" "CHECK_FAILED" "$(printf "%s" "$check_output" | tail -c 3500)"
      echo "[db-migration] Check failed: $check_file" >&2
      exit 1
    fi
    printf "%s\n" "$check_output"
  fi

  update_history_status "$DB_NAME" "$migration_id" "SUCCESS" ""
  echo "[db-migration] Recorded SUCCESS migrationId=$migration_id"
done

echo "[db-migration] All migrations applied for $PROJECT_ID."
