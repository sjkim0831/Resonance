#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${RESTORE_DRILL_NAMESPACE:-carbonet-restore-drill}"
BACKUP_ROOT="${RESTORE_DRILL_BACKUP_ROOT:-/opt/resonance-data/backups/postgres/primary/hourly}"
DRILL_ROOT="${RESTORE_DRILL_ROOT:-/opt/resonance-data/restore-drills}"
IMAGE="${RESTORE_DRILL_IMAGE:-postgres:16}"
TIMEOUT="${RESTORE_DRILL_TIMEOUT:-3600s}"
KEEP_DATA="${RESTORE_DRILL_KEEP_DATA:-false}"
RUN_ID="${RESTORE_DRILL_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"
POD="postgres-restore-${RUN_ID,,}"
POD="${POD//[^a-z0-9-]/-}"
POD="${POD:0:63}"
WORK_DIR="$DRILL_ROOT/work/$RUN_ID"
REPORT_DIR="$DRILL_ROOT/reports"
REPORT="$REPORT_DIR/$RUN_ID.json"

mkdir -p "$WORK_DIR/data" "$REPORT_DIR"
chmod 0770 "$WORK_DIR"
# This directory is short-lived and mounted only by the isolated restore Pod.
# The stock postgres image runs as uid 999 while the host automation runs as
# sjkim, so it must be writable across that uid boundary.
chmod 0777 "$WORK_DIR/data"

backup="$(find "$BACKUP_ROOT" -maxdepth 1 -type f -name '*.dump' -printf '%T@ %p\n' |
  sort -nr | head -1 | cut -d' ' -f2-)"
[[ -n "$backup" && -f "$backup.sha256" ]] || {
  echo "[restore-drill] latest backup or checksum not found" >&2
  exit 2
}
backup_name="$(basename "$backup")"

cleanup() {
  kubectl -n "$NAMESPACE" delete pod "$POD" --ignore-not-found --wait=false >/dev/null 2>&1 || true
  if [[ "$KEEP_DATA" != "true" ]]; then
    sudo -n rm -rf -- "$WORK_DIR"
  fi
}
trap cleanup EXIT

(cd "$BACKUP_ROOT" && sha256sum -c "$backup_name.sha256")
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f - >/dev/null

cat <<YAML | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: $POD
  namespace: $NAMESPACE
  labels:
    app: carbonet-postgres-restore-drill
    run-id: "$RUN_ID"
spec:
  restartPolicy: Never
  securityContext:
    fsGroup: 999
  containers:
    - name: postgres
      image: $IMAGE
      imagePullPolicy: IfNotPresent
      env:
        - name: POSTGRES_HOST_AUTH_METHOD
          value: trust
        - name: POSTGRES_DB
          value: carbonet_restore
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
      args:
        - postgres
        - -c
        - fsync=off
        - -c
        - synchronous_commit=off
        - -c
        - full_page_writes=off
        - -c
        - max_wal_size=8GB
      resources:
        requests:
          cpu: "500m"
          memory: "1Gi"
        limits:
          cpu: "4"
          memory: "8Gi"
      readinessProbe:
        exec:
          command: [sh, -c, "pg_isready -U postgres -d carbonet_restore"]
        initialDelaySeconds: 5
        periodSeconds: 5
        failureThreshold: 30
      volumeMounts:
        - name: restore-data
          mountPath: /var/lib/postgresql/data
        - name: backup
          mountPath: /backup
          readOnly: true
  volumes:
    - name: restore-data
      hostPath:
        path: $WORK_DIR/data
        type: Directory
    - name: backup
      hostPath:
        path: $BACKUP_ROOT
        type: Directory
YAML

kubectl -n "$NAMESPACE" wait --for=condition=Ready "pod/$POD" --timeout=180s
started_epoch="$(date +%s)"
kubectl -n "$NAMESPACE" exec "$POD" -- \
  pg_restore -U postgres --exit-on-error --no-owner --no-acl --jobs=4 \
  --dbname=carbonet_restore "/backup/$backup_name"
completed_epoch="$(date +%s)"

metrics="$(
  kubectl -n "$NAMESPACE" exec -i "$POD" -- psql -U postgres -d carbonet_restore \
    -v ON_ERROR_STOP=1 -At -F '|' <<'SQL'
select count(*) from information_schema.tables where table_schema='public';
select count(*) from pg_indexes where schemaname='public';
select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public';
select count(*) from pg_index i join pg_class c on c.oid=i.indexrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not i.indisvalid;
select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and not c.convalidated;
select pg_database_size(current_database());
select count(*) from carbonet_flyway_schema_history where success is not true;
SQL
)"
mapfile -t values <<<"$metrics"
tables="${values[0]:-0}"
indexes="${values[1]:-0}"
constraints="${values[2]:-0}"
invalid_indexes="${values[3]:-0}"
unvalidated_constraints="${values[4]:-0}"
database_bytes="${values[5]:-0}"
failed_migrations="${values[6]:-0}"

status="PASS"
[[ "$tables" -gt 0 && "$invalid_indexes" == 0 &&
  "$unvalidated_constraints" == 0 && "$failed_migrations" == 0 ]] || status="FAIL"

python3 - "$REPORT" <<PY
import json, pathlib
report = {
  "runId": "$RUN_ID",
  "status": "$status",
  "isolated": True,
  "backup": "$backup_name",
  "backupBytes": int("$(stat -c %s "$backup")"),
  "durationSeconds": $((completed_epoch - started_epoch)),
  "tables": int("$tables"),
  "indexes": int("$indexes"),
  "constraints": int("$constraints"),
  "invalidIndexes": int("$invalid_indexes"),
  "unvalidatedConstraints": int("$unvalidated_constraints"),
  "failedMigrations": int("$failed_migrations"),
  "restoredDatabaseBytes": int("$database_bytes"),
  "temporaryDataRetained": "$KEEP_DATA" == "true",
}
path = pathlib.Path("$REPORT")
path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(report, ensure_ascii=False))
PY

[[ "$status" == "PASS" ]]
