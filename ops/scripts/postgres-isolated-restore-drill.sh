#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${RESTORE_DRILL_NAMESPACE:-carbonet-restore-drill}"
BACKUP_ROOT="${RESTORE_DRILL_BACKUP_ROOT:-/opt/resonance-data/backups/postgres/primary/hourly}"
DRILL_ROOT="${RESTORE_DRILL_ROOT:-/opt/resonance-data/restore-drills}"
IMAGE="${RESTORE_DRILL_IMAGE:-postgres:16}"
TIMEOUT="${RESTORE_DRILL_TIMEOUT:-3600s}"
KEEP_DATA="${RESTORE_DRILL_KEEP_DATA:-false}"
PRODUCTION_HEALTH_URL="${RESTORE_DRILL_PRODUCTION_HEALTH_URL:-http://127.0.0.1/actuator/health}"
RUNTIME_RECOVERY_SCRIPT="${RESTORE_DRILL_RUNTIME_RECOVERY_SCRIPT:-/opt/resonance-data/control-plane/bin/reconcile-post-reboot-runtime.sh}"
RECOVERY_API_BASE="${RESTORE_DRILL_RECOVERY_API_BASE:-https://backstage.172.16.1.232.nip.io/api/resonance-recovery}"
RECOVERY_CA_CERT="${RESTORE_DRILL_RECOVERY_CA_CERT:-/opt/resonance-data/pki/resonance-internal-ca/ca.crt}"
REPORTER_ID="${RESTORE_DRILL_REPORTER_ID:-$(hostname)-isolated-postgres}"
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

production_health="$(curl -fsS --max-time 10 "$PRODUCTION_HEALTH_URL" || true)"
[[ "$production_health" == *'"status":"UP"'* ]] || {
  echo "[restore-drill] refused because production health is not UP" >&2
  exit 3
}

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
          cpu: "2"
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
  pg_restore -U postgres --exit-on-error --no-owner --no-acl --jobs=2 \
  --dbname=carbonet_restore "/backup/$backup_name"
completed_epoch="$(date +%s)"

metrics="$(
  kubectl -n "$NAMESPACE" exec -i "$POD" -- psql -U postgres -d carbonet_restore \
    -v ON_ERROR_STOP=1 -At -F '|' <<'SQL'
select count(*) from information_schema.tables where table_schema='public';
select count(*) from information_schema.schemata where schema_name not in ('pg_catalog','information_schema') and schema_name not like 'pg_toast%';
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
schemas="${values[1]:-0}"
indexes="${values[2]:-0}"
constraints="${values[3]:-0}"
invalid_indexes="${values[4]:-0}"
unvalidated_constraints="${values[5]:-0}"
database_bytes="${values[6]:-0}"
failed_migrations="${values[7]:-0}"

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
  "schemas": int("$schemas"),
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

cleanup
trap - EXIT

production_health="$(curl -fsS --max-time 10 "$PRODUCTION_HEALTH_URL" || true)"
if [[ "$production_health" != *'"status":"UP"'* && -x "$RUNTIME_RECOVERY_SCRIPT" ]]; then
  echo "[restore-drill] production health degraded; invoking bounded runtime recovery" >&2
  bash "$RUNTIME_RECOVERY_SCRIPT"
  production_health="$(curl -fsS --max-time 10 "$PRODUCTION_HEALTH_URL" || true)"
fi
[[ "$production_health" == *'"status":"UP"'* ]] || {
  echo "[restore-drill] production health did not recover" >&2
  exit 31
}

token="$(
  kubectl -n resonance-ops get secret resonance-ops-bridge \
    -o jsonpath='{.data.RESONANCE_RECOVERY_WORKER_TOKEN}' | base64 -d
)"
[[ "${#token}" -ge 32 && -r "$RECOVERY_CA_CERT" ]] || {
  echo "[restore-drill] Backstage recovery reporter credential is unavailable" >&2
  exit 32
}
checksum="$(awk 'NR==1 {print $1}' "$backup.sha256")"
reported_status="VERIFIED"
error_message=""
if [[ "$status" != "PASS" ]]; then
  reported_status="FAILED"
  error_message="restore integrity checks failed"
fi
payload="$(
  jq -nc \
    --arg reporterId "$REPORTER_ID" \
    --arg status "$reported_status" \
    --arg backupName "$backup_name" \
    --arg sha256 "$checksum" \
    --arg isolation "KUBERNETES_EPHEMERAL_POSTGRES" \
    --arg startedAt "$(date -u -d "@$started_epoch" +%FT%TZ)" \
    --arg finishedAt "$(date -u -d "@$completed_epoch" +%FT%TZ)" \
    --arg errorMessage "$error_message" \
    --argjson durationSeconds "$((completed_epoch - started_epoch))" \
    --argjson schemaCount "$schemas" \
    --argjson tableCount "$tables" \
    '{
      reporterId:$reporterId,
      status:$status,
      backupName:$backupName,
      sha256:$sha256,
      isolation:$isolation,
      durationSeconds:$durationSeconds,
      schemaCount:$schemaCount,
      tableCount:$tableCount,
      traceEventCount:0,
      unifiedAssetCount:0,
      errorMessage:$errorMessage,
      startedAt:$startedAt,
      finishedAt:$finishedAt
    }'
)"
curl --silent --show-error --fail --retry 3 --retry-delay 5 \
  --cacert "$RECOVERY_CA_CERT" \
  -H "authorization: Bearer $token" \
  -H 'content-type: application/json' \
  -d "$payload" \
  "$RECOVERY_API_BASE/worker/offsite-restore-drill" >/dev/null
echo "[restore-drill] Backstage recovery dashboard synchronized"

[[ "$status" == "PASS" ]]
