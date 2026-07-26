#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
SOURCE_DIR="$ROOT_DIR/projects/carbonet-frontend/source"
SECRET_FILE="/etc/resonance/secrets/admin-smoke.env"
STATE_DIR="$ROOT_DIR/var/run"
LOCK_FILE="$STATE_DIR/react-route-self-heal.lock"
ATTEMPT_FILE="$STATE_DIR/react-route-self-heal.last-attempt"
MIN_RETRY_SECONDS="${MIN_RETRY_SECONDS:-900}"

mkdir -p "$STATE_DIR"
exec 9>"$LOCK_FILE"
flock -n 9 || exit 0
[[ -r "$SECRET_FILE" ]] || { echo "[react-route-self-heal] smoke credential is unavailable" >&2; exit 2; }
set -a
# shellcheck disable=SC1090
source "$SECRET_FILE"
set +a

if (cd "$SOURCE_DIR" && BASE_URL=http://127.0.0.1 node "$ROOT_DIR/ops/scripts/verify-react-mount.mjs"); then
  echo "[react-route-self-heal] route fingerprints are healthy"
  exit 0
fi

now="$(date +%s)"
last="$(cat "$ATTEMPT_FILE" 2>/dev/null || echo 0)"
if (( now - last < MIN_RETRY_SECONDS )); then
  echo "[react-route-self-heal] mismatch persists; rebuild cooldown is active" >&2
  exit 3
fi
printf '%s\n' "$now" >"$ATTEMPT_FILE"
echo "[react-route-self-heal] route mismatch detected; start one guarded incremental rebuild" >&2
FRONTEND_TYPECHECK_MODE=noemit bash "$ROOT_DIR/ops/scripts/resonance-screen-overlay-apply.sh"
