#!/usr/bin/env bash
set -euo pipefail

# Apply a PostgreSQL migration while the application remains available.
# Usage: patroni-online-migrate.sh path/to/migration.sql

SQL_FILE="${1:-}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
DATABASE="${DATABASE:-carbonet}"
DB_USER="${DB_USER:-carbonet_migrator}"
LOCK_TIMEOUT="${LOCK_TIMEOUT:-3s}"
STATEMENT_TIMEOUT="${STATEMENT_TIMEOUT:-5min}"
MAX_LAG_BYTES="${MAX_LAG_BYTES:-16777216}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1/actuator/health}"
ALLOW_BLOCKING_DDL="${ALLOW_BLOCKING_DDL:-false}"
CHECK_ONLY="${CHECK_ONLY:-false}"

die() { echo "[patroni-migrate] ERROR: $*" >&2; exit 1; }

[[ -f "$SQL_FILE" ]] || die "SQL file not found: $SQL_FILE"
command -v kubectl >/dev/null 2>&1 || die "kubectl is required"

leader_pod() {
  while read -r pod ip; do
    [[ -n "$pod" ]] || continue
    if kubectl -n "$NAMESPACE" exec "$pod" -- \
      curl -fsS http://127.0.0.1:8008/master >/dev/null 2>&1; then
      echo "$pod"
      return 0
    fi
  done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni \
    -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.status.podIP}{"\n"}{end}')
  return 1
}

check_cluster() {
  local leader="$1"
  local members lag
  members="$(kubectl -n "$NAMESPACE" exec "$leader" -- patronictl list -f json)"
  [[ "$(grep -oE '"State"[[:space:]]*:[[:space:]]*"(running|streaming)"' <<<"$members" | wc -l)" -eq 3 ]] ||
    die "all three Patroni members must be running"
  lag="$(kubectl -n "$NAMESPACE" exec "$leader" -- psql -h 127.0.0.1 -U postgres -d "$DATABASE" -Atc \
    "select coalesce(max(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)),0)::bigint from pg_stat_replication;")"
  [[ "$lag" =~ ^[0-9]+$ ]] || die "could not read replication lag"
  (( lag <= MAX_LAG_BYTES )) || die "replication lag is ${lag} bytes"
  echo "[patroni-migrate] cluster healthy; max replication lag=${lag} bytes"
}

if [[ "$ALLOW_BLOCKING_DDL" != "true" ]] &&
   grep -Eiq '(^|;)[[:space:]]*(DROP[[:space:]]+(TABLE|COLUMN|DATABASE)|TRUNCATE|ALTER[[:space:]]+TABLE.*(SET[[:space:]]+DATA[[:space:]]+TYPE|ALTER[[:space:]]+COLUMN.*TYPE)|CREATE[[:space:]]+(UNIQUE[[:space:]]+)?INDEX)' "$SQL_FILE"; then
  die "potentially blocking/destructive DDL denied; use an expand-contract migration"
fi

LEADER="$(leader_pod)" || die "Patroni leader not found"
check_cluster "$LEADER"
curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null || die "application preflight failed"
if [[ "$CHECK_ONLY" == "true" ]]; then
  echo "[patroni-migrate] preflight passed; no SQL applied"
  exit 0
fi

echo "[patroni-migrate] applying $(basename "$SQL_FILE") through $LEADER"
kubectl -n "$NAMESPACE" exec -i "$LEADER" -- \
  psql -h 127.0.0.1 -U "$DB_USER" -d "$DATABASE" -v ON_ERROR_STOP=1 \
  -c "SET lock_timeout='$LOCK_TIMEOUT'; SET statement_timeout='$STATEMENT_TIMEOUT';" \
  -1 < "$SQL_FILE"

check_cluster "$LEADER"
curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null || die "application postflight failed"
echo "[patroni-migrate] migration complete without application restart"
