#!/usr/bin/env bash
set -Eeuo pipefail
umask 027
{ set +x; } 2>/dev/null

ROOT_DIR="${RESONANCE_ROOT:-/opt/Resonance}"
CONTROL_PLANE_BIN="${RESONANCE_CONTROL_PLANE_BIN:-/opt/resonance-data/control-plane/bin}"
AUDIT_WRAPPER="${RESONANCE_AUDIT_WRAPPER:-$CONTROL_PLANE_BIN/resonance-all-process-contract-audit.sh}"
AUDIT_ENGINE="${RESONANCE_AUDIT_ENGINE:-$CONTROL_PLANE_BIN/resonance-all-process-contract-audit.mjs}"
REPORT_DIR="${RESONANCE_AUDIT_REPORT_DIR:-/opt/resonance-data/control-plane/reports/process-contract-audit}"
LATEST_REPORT="${RESONANCE_AUDIT_LATEST_REPORT:-$REPORT_DIR/latest.json}"
LOCK_FILE="${RESONANCE_AUDIT_LOCK_FILE:-/opt/resonance-data/control-plane/run/all-process-contract-audit.lock}"
HEAVY_DB_LOCK_FILE="${RESONANCE_HEAVY_DB_LOCK_FILE:-/opt/resonance-data/control-plane/run/heavy-db-automation.lock}"
AUDIT_TIMEOUT_SECONDS="${RESONANCE_AUDIT_TIMEOUT_SECONDS:-85}"

log() {
  printf '[all-process-contract-audit-hourly] %s\n' "$*" >&2
}

write_error_report() {
  local target="$1"
  local code="$2"
  local reason="$3"
  local elapsed="$4"
  AUDIT_ERROR_CODE="$code" AUDIT_ERROR_REASON="$reason" AUDIT_ELAPSED_SECONDS="$elapsed" \
    node -e '
      const fs = require("node:fs");
      const report = {
        generatedAt: new Date().toISOString(),
        auditMode: "READ_ONLY_INVENTORY",
        businessExecutionPerformed: false,
        status: "ERROR",
        error: {
          code: process.env.AUDIT_ERROR_CODE || "AUDIT_EXECUTION_FAILED",
          reason: process.env.AUDIT_ERROR_REASON || "audit execution failed",
        },
        elapsedSeconds: Number(process.env.AUDIT_ELAPSED_SECONDS || 0),
      };
      fs.writeFileSync(process.argv[1], `${JSON.stringify(report, null, 2)}\n`, { mode: 0o640 });
    ' "$target"
}

for required_command in node flock timeout mktemp; do
  command -v "$required_command" >/dev/null 2>&1 || {
    log "$required_command is required"
    exit 2
  }
done

[[ "$AUDIT_TIMEOUT_SECONDS" =~ ^[1-9][0-9]*$ ]] || {
  log 'RESONANCE_AUDIT_TIMEOUT_SECONDS must be a positive integer'
  exit 2
}
[[ -f "$AUDIT_WRAPPER" ]] || { log 'audit wrapper is missing'; exit 2; }
[[ -f "$AUDIT_ENGINE" ]] || { log 'audit engine is missing'; exit 2; }

mkdir -p "$REPORT_DIR" "$(dirname "$LOCK_FILE")" "$(dirname "$HEAVY_DB_LOCK_FILE")"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log 'another audit is already running; duplicate execution skipped'
  exit 0
fi
exec 7>"$HEAVY_DB_LOCK_FILE"
if ! flock -n 7; then
  log 'heavy DB automation is already running; audit deferred to the next timer run'
  exit 0
fi

temp_report="$(mktemp "$REPORT_DIR/.latest.XXXXXX.json")"
cleanup() {
  rm -f "$temp_report"
}
trap cleanup EXIT

started_at="$(date +%s)"
set +e
RESONANCE_ROOT="$ROOT_DIR" RESONANCE_AUDIT_ENGINE="$AUDIT_ENGINE" \
  timeout --signal=TERM --kill-after=5s "${AUDIT_TIMEOUT_SECONDS}s" \
  bash "$AUDIT_WRAPPER" >"$temp_report"
audit_rc=$?
set -e
elapsed_seconds=$(( $(date +%s) - started_at ))

json_status=''
if [[ -s "$temp_report" ]]; then
  set +e
  json_status="$(node -e '
    const fs = require("node:fs");
    const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (!["PASS", "BLOCKED", "ERROR"].includes(value.status)) process.exit(2);
    process.stdout.write(value.status);
  ' "$temp_report" 2>/dev/null)"
  json_rc=$?
  set -e
else
  json_rc=2
fi

final_rc="$audit_rc"
if [[ "$json_rc" -ne 0 ]]; then
  write_error_report "$temp_report" 'INVALID_AUDIT_OUTPUT' \
    'audit command did not produce a valid status JSON document' "$elapsed_seconds"
  final_rc=2
elif [[ "$audit_rc" -eq 0 && "$json_status" != 'PASS' ]]; then
  write_error_report "$temp_report" 'STATUS_EXIT_MISMATCH' \
    'exit 0 requires PASS status' "$elapsed_seconds"
  final_rc=2
elif [[ "$audit_rc" -eq 3 && "$json_status" != 'BLOCKED' ]]; then
  write_error_report "$temp_report" 'STATUS_EXIT_MISMATCH' \
    'exit 3 requires BLOCKED status' "$elapsed_seconds"
  final_rc=2
elif [[ "$audit_rc" -ne 0 && "$audit_rc" -ne 3 && "$json_status" != 'ERROR' ]]; then
  write_error_report "$temp_report" 'AUDIT_EXECUTION_FAILED' \
    "audit command failed with exit code $audit_rc" "$elapsed_seconds"
  final_rc="$audit_rc"
fi

chmod 0640 "$temp_report"
mv -f "$temp_report" "$LATEST_REPORT"
trap - EXIT

case "$final_rc" in
  0)
    log "PASS saved atomically in ${elapsed_seconds}s"
    ;;
  3)
    log "BLOCKED saved atomically in ${elapsed_seconds}s"
    ;;
  *)
    log "ERROR saved atomically in ${elapsed_seconds}s (exit=$final_rc)"
    ;;
esac
exit "$final_rc"
