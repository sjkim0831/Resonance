#!/usr/bin/env bash
# DEPRECATED: CUBRID 제거됨 — 사용 금지
# PostgreSQL 환경: postgres-patroni-0/1/2 (Patroni HA) + pg_dump 사용
echo "[DEPRECATED] resonance-cubrid-k8s-backup: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

set -euo pipefail

MODE="${1:-all}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
POD="${POD:-cubrid-carbonet-0}"
DB_NAME="${DB_NAME:-carbonet}"
DB_USER="${DB_USER:-dba}"
DB_PASSWORD="${DB_PASSWORD:-}"
HOST_BACKUP_ROOT="${HOST_BACKUP_ROOT:-/opt/util/cubrid/11.2/backup}"
CONTAINER_BACKUP_ROOT="${CONTAINER_BACKUP_ROOT:-/opt/util/cubrid/backup}"
SQL_RETENTION_DAYS="${SQL_RETENTION_DAYS:-7}"
PHYSICAL_RETENTION_DAYS="${PHYSICAL_RETENTION_DAYS:-15}"
LOCK_FILE="${LOCK_FILE:-/var/lock/resonance-cubrid-k8s-backup.lock}"
STAMP="$(date +%Y%m%d_%H%M%S)"

log() {
  printf '[cubrid-k8s-backup] %s %s\n' "$(date -Is)" "$*"
}

with_lock() {
  exec 9>"$LOCK_FILE"
  flock -n 9 || { log 'another backup is already running'; exit 0; }
}

kubectl_ready() {
  kubectl -n "$NAMESPACE" wait --for=condition=Ready "pod/$POD" --timeout="${WAIT_TIMEOUT:-180s}" >/dev/null
}

run_cubrid() {
  local remote_cmd="$1"
  kubectl -n "$NAMESPACE" exec "$POD" -- bash -lc "$remote_cmd"
}

sql_backup() {
  local out_dir="$CONTAINER_BACKUP_ROOT/sql/$STAMP"
  local password_arg=""
  if [[ -n "$DB_PASSWORD" ]]; then
    password_arg="-p$DB_PASSWORD"
  fi
  log "sql backup start $out_dir"
  run_cubrid "set -euo pipefail; rm -rf '$out_dir'; mkdir -p '$out_dir'; cubrid unloaddb -u '$DB_USER' $password_arg --output-path '$out_dir' --output-prefix 'db_backup_full_${DB_NAME}_${STAMP}' '$DB_NAME'; test -s '$out_dir/db_backup_full_${DB_NAME}_${STAMP}_schema'"
  find "$HOST_BACKUP_ROOT/sql" -mindepth 1 -maxdepth 1 -type d -mtime +"$SQL_RETENTION_DAYS" -exec rm -rf {} + 2>/dev/null || true
  log "sql backup complete $HOST_BACKUP_ROOT/sql/$STAMP"
}

physical_backup() {
  local out_dir="$CONTAINER_BACKUP_ROOT/physical/$STAMP"
  log "physical backup start $out_dir"
  run_cubrid "set -euo pipefail; rm -rf '$out_dir'; mkdir -p '$out_dir'; chmod 0777 '$out_dir'; cubrid backupdb -C -D '$out_dir' '$DB_NAME'; test -f '$out_dir/${DB_NAME}_bk0v000'"
  find "$HOST_BACKUP_ROOT/physical" -mindepth 1 -maxdepth 1 -type d -mtime +"$PHYSICAL_RETENTION_DAYS" -exec rm -rf {} + 2>/dev/null || true
  log "physical backup complete $HOST_BACKUP_ROOT/physical/$STAMP"
}

with_lock
mkdir -p "$HOST_BACKUP_ROOT/sql" "$HOST_BACKUP_ROOT/physical"
kubectl_ready
case "$MODE" in
  sql) sql_backup ;;
  physical) physical_backup ;;
  all) sql_backup; physical_backup ;;
  *) echo "usage: $0 [sql|physical|all]" >&2; exit 2 ;;
esac
