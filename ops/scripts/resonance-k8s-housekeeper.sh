#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
EVENT_LOG="$ROOT_DIR/var/ai-runtime/k8s-housekeeper-events.jsonl"
LOCK_FILE="$ROOT_DIR/var/run/resonance-k8s-housekeeper.lock"
DISK_WARN_PCT="${DISK_WARN_PCT:-75}"
DISK_CRITICAL_PCT="${DISK_CRITICAL_PCT:-85}"
RELEASE_RETENTION_DAYS="${RELEASE_RETENTION_DAYS:-14}"
LOG_RETENTION_DAYS="${LOG_RETENTION_DAYS:-30}"
PRUNE_IMAGES="${PRUNE_IMAGES:-true}"

mkdir -p "$(dirname "$EVENT_LOG")" "$(dirname "$LOCK_FILE")"
exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

log_event() {
  local status="$1"
  local code="$2"
  local message="$3"
  printf '{"ts":"%s","script":"resonance-k8s-housekeeper","status":"%s","code":"%s","message":"%s"}\n' \
    "$(date -Iseconds)" "$(json_escape "$status")" "$(json_escape "$code")" "$(json_escape "$message")" >>"$EVENT_LOG"
}

root_cmd() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

disk_pct() {
  df -P "$1" | awk 'NR==2 {gsub(/%/,"",$5); print $5}'
}

cleanup_files() {
  find "$ROOT_DIR/var/logs" -type f -name '*.log' -mtime +"$LOG_RETENTION_DAYS" -delete 2>/dev/null || true
  find "$ROOT_DIR/var/backups/k8s" -type f -name '*.yaml' -mtime +"$RELEASE_RETENTION_DAYS" -delete 2>/dev/null || true
  find "$ROOT_DIR/var/ai-runtime" -type f -name '*.tmp' -mtime +3 -delete 2>/dev/null || true
}

cleanup_images() {
  if [[ "$PRUNE_IMAGES" != "true" ]]; then
    return 0
  fi
  root_cmd docker builder prune -af --filter "until=168h" >/dev/null 2>&1 || true
  root_cmd docker image prune -af --filter "until=168h" >/dev/null 2>&1 || true
  root_cmd crictl rmi --prune >/dev/null 2>&1 || true
}

cleanup_k8s() {
  kubectl -n carbonet-prod delete pod --field-selector=status.phase=Succeeded --ignore-not-found=true >/dev/null 2>&1 || true
  kubectl -n carbonet-prod delete pod --field-selector=status.phase=Failed --ignore-not-found=true >/dev/null 2>&1 || true
}

vacuum_journal() {
  root_cmd journalctl --vacuum-time=14d >/dev/null 2>&1 || true
}

main() {
  local root_before opt_before root_after opt_after status
  root_before="$(disk_pct /)"
  opt_before="$(disk_pct /opt)"
  cleanup_files
  cleanup_images
  cleanup_k8s
  vacuum_journal
  root_after="$(disk_pct /)"
  opt_after="$(disk_pct /opt)"
  status=OK
  if [[ "$root_after" -ge "$DISK_CRITICAL_PCT" || "$opt_after" -ge "$DISK_CRITICAL_PCT" ]]; then
    status=FAIL
  elif [[ "$root_after" -ge "$DISK_WARN_PCT" || "$opt_after" -ge "$DISK_WARN_PCT" ]]; then
    status=WARN
  fi
  log_event "$status" DISK_HOUSEKEEPING "root=${root_before}%->$root_after% opt=${opt_before}%->$opt_after%"
}

main "$@"
