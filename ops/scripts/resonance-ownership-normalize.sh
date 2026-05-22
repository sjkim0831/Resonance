#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
OWNER_USER="${OWNER_USER:-sjkim}"
OWNER_GROUP="${OWNER_GROUP:-sjkim}"
EVENT_LOG="${EVENT_LOG:-$ROOT_DIR/var/ai-runtime/ownership-normalize-events.jsonl}"

mkdir -p "$(dirname "$EVENT_LOG")"

json_escape() {
  printf '"%s"' "$(printf '%s' "${1-}" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g')"
}

log_event() {
  local status="$1"
  local detail="$2"
  printf '{"schemaVersion":"1.0","eventType":"ownership-normalize","timestamp":%s,"status":%s,"detail":%s}\n' \
    "$(json_escape "$(date -Iseconds)")" \
    "$(json_escape "$status")" \
    "$(json_escape "$detail")" >>"$EVENT_LOG"
}

if ! id "$OWNER_USER" >/dev/null 2>&1; then
  log_event "SKIP" "missing owner user: $OWNER_USER"
  exit 0
fi

targets=(
  "$ROOT_DIR/var/releases"
  "$ROOT_DIR/var/run"
  "$ROOT_DIR/var/logs"
  "$ROOT_DIR/var/ai-runtime"
  "$ROOT_DIR/var/backups"
  "$ROOT_DIR/var/k8s"
  "$ROOT_DIR/var/cloudflare-tunnel"
  "$ROOT_DIR/projects/carbonet-frontend/src/main/resources/static/react-app"
  "$ROOT_DIR/projects/carbonet-frontend/target/classes/static/react-app"
  "$ROOT_DIR/apps/carbonet-app/src/main/resources/static/react-app"
  "$ROOT_DIR/projects/carbonet-frontend/source/dist"
  "$ROOT_DIR/apps/project-runtime/target"
  "$ROOT_DIR/apps/carbonet-app/target"
  "$ROOT_DIR/projects/carbonet-adapter/target"
)

existing=()
for target in "${targets[@]}"; do
  [[ -e "$target" ]] && existing+=("$target")
done

if [[ "${#existing[@]}" -eq 0 ]]; then
  log_event "SKIP" "no ownership targets exist"
  exit 0
fi

chown -R "$OWNER_USER:$OWNER_GROUP" "${existing[@]}" 2>/dev/null || true
chmod -R u+rwX "${existing[@]}" 2>/dev/null || true
log_event "OK" "normalized ${#existing[@]} targets to $OWNER_USER:$OWNER_GROUP"
