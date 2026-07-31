#!/usr/bin/env bash
set -euo pipefail

REPORT_ROOT="${RESTORE_DRILL_ROOT:-/opt/resonance-data/restore-drills}/reports"
API_BASE="${RESTORE_DRILL_RECOVERY_API_BASE:-https://backstage.172.16.1.232.nip.io/api/resonance-recovery}"
CA_CERT="${RESTORE_DRILL_RECOVERY_CA_CERT:-/opt/resonance-data/pki/resonance-internal-ca/ca.crt}"
REPORTER_ID="${RESTORE_DRILL_REPORTER_ID:-$(hostname)-isolated-postgres}"
NAMESPACE="${RESONANCE_OPS_NAMESPACE:-resonance-ops}"

report="${1:-}"
if [[ -z "$report" ]]; then
  report="$(find "$REPORT_ROOT" -maxdepth 1 -type f -name '*.json' -printf '%T@ %p\n' |
    sort -nr | head -1 | cut -d' ' -f2-)"
fi
[[ -f "$report" && -r "$CA_CERT" ]] || {
  echo "[restore-drill-report] report or CA certificate unavailable" >&2
  exit 2
}

backup_name="$(jq -r '.backup // ""' "$report")"
status="$(jq -r '.status // "FAIL"' "$report")"
duration="$(jq -r '.durationSeconds // 0' "$report")"
schemas="$(jq -r '.schemas // 0' "$report")"
tables="$(jq -r '.tables // 0' "$report")"
backup_root="${RESTORE_DRILL_BACKUP_ROOT:-/opt/resonance-data/backups/postgres/primary/hourly}"
checksum_file="$backup_root/$backup_name.sha256"
[[ -f "$checksum_file" ]] || {
  echo "[restore-drill-report] backup checksum unavailable: $backup_name" >&2
  exit 3
}
checksum="$(cut -d' ' -f1 "$checksum_file")"
finished_epoch="$(stat -c %Y "$report")"
started_epoch=$((finished_epoch - duration))
reported_status="VERIFIED"
error_message=""
if [[ "$status" != "PASS" ]]; then
  reported_status="FAILED"
  error_message="restore integrity checks failed"
fi

token="$(
  kubectl -n "$NAMESPACE" get secret resonance-ops-bridge \
    -o jsonpath='{.data.RESONANCE_RECOVERY_WORKER_TOKEN}' | base64 -d
)"
[[ "${#token}" -ge 32 ]] || {
  echo "[restore-drill-report] service token unavailable" >&2
  exit 4
}

payload="$(
  jq -nc \
    --arg reporterId "$REPORTER_ID" \
    --arg status "$reported_status" \
    --arg backupName "$backup_name" \
    --arg sha256 "$checksum" \
    --arg isolation "KUBERNETES_EPHEMERAL_POSTGRES" \
    --arg startedAt "$(date -u -d "@$started_epoch" +%FT%TZ)" \
    --arg finishedAt "$(date -u -d "@$finished_epoch" +%FT%TZ)" \
    --arg errorMessage "$error_message" \
    --argjson durationSeconds "$duration" \
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
  --cacert "$CA_CERT" \
  -H "authorization: Bearer $token" \
  -H 'content-type: application/json' \
  -d "$payload" \
  "$API_BASE/worker/offsite-restore-drill"
