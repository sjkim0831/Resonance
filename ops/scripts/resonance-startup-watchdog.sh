#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET_URL="${TARGET_URL:-http://127.0.0.1:17890/?token=qwer1234}"
EVENT_LOG="${EVENT_LOG:-$ROOT_DIR/var/ai-runtime/startup-watchdog-events.jsonl}"
START_SCRIPT="${START_SCRIPT:-$ROOT_DIR/ops/scripts/resonance-start-best-effort.sh}"

mkdir -p "$(dirname "$EVENT_LOG")"

json_escape() {
  printf '"%s"' "$(printf '%s' "${1-}" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g')"
}

log_event() {
  local status="$1"
  local action="$2"
  local detail="$3"
  printf '{"schemaVersion":"1.0","eventType":"startup-watchdog","timestamp":%s,"status":%s,"action":%s,"detail":%s,"targetUrl":%s}\n' \
    "$(json_escape "$(date -Iseconds)")" \
    "$(json_escape "$status")" \
    "$(json_escape "$action")" \
    "$(json_escape "$detail")" \
    "$(json_escape "$TARGET_URL")" >>"$EVENT_LOG"
}

if curl -fsS --max-time 10 "$TARGET_URL" >/dev/null 2>&1; then
  log_event "PASS" "probe" "target already reachable"
  exit 0
fi

log_event "WARN" "probe-failed" "target unreachable; invoking best-effort startup"
bash "$START_SCRIPT"
if curl -fsS --max-time 10 "$TARGET_URL" >/dev/null 2>&1; then
  log_event "PASS" "recover" "target restored after best-effort startup"
  exit 0
fi

log_event "FAIL" "recover-failed" "target still unreachable after best-effort startup"
exit 1
