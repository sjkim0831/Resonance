#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/verify-admin-route-bootstrap.sh <route-path> [route-id] [payload-key] [base-url]

Example:
  bash ops/scripts/verify-admin-route-bootstrap.sh /admin/certificate/rec_check certificate-rec-check

Purpose:
  Verify that an authenticated admin route renders through the shell bootstrap path
  and that the matching /api/admin/app/bootstrap response is available.

Canonical app jar:
  apps/carbonet-api/target/carbonet-api.jar

Environment overrides:
  PORT
  RUNTIME_LOG
  K8S_NAMESPACE
  CARBONET_QA_AUTH_SECRET
  CARBONET_QA_AUTH_USER
  CARBONET_QA_AUTH_PASSWORD
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/ops/scripts/runtime-url-common.sh"
# shellcheck source=ops/scripts/runtime-qa-auth-common.sh
source "$ROOT_DIR/ops/scripts/runtime-qa-auth-common.sh"
ROUTE_PATH="${1:-}"
ROUTE_ID="${2:-}"
PAYLOAD_KEY="${3:-}"
PORT="${PORT:-18000}"
RUNTIME_LOG="${RUNTIME_LOG:-/tmp/carbonet-runtime-18000.log}"
TMP_DIR="$(mktemp -d /tmp/admin-route-bootstrap.XXXXXX)"
COOKIE_JAR="$TMP_DIR/cookies.txt"

cleanup() {
  if [[ -n "${BASE_URL:-}" ]]; then
    carbonet_qa_logout "$COOKIE_JAR" "$BASE_URL"
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

fail() {
  echo "[verify-admin-route-bootstrap] FAIL: $*" >&2
  exit 1
}

info() {
  echo "[verify-admin-route-bootstrap] $*"
}

retry_curl() {
  local output_file="$1"
  shift
  local attempt
  for attempt in $(seq 1 20); do
    if curl "${CARBONET_CURL_ARGS[@]}" -fsS "$@" > "$output_file"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

require_file() {
  local path="$1"
  [[ -f "$path" ]] || fail "required file not found: $path"
}

require_cmd() {
  local name="$1"
  command -v "$name" >/dev/null 2>&1 || fail "required command not found: $name"
}

[[ -n "$ROUTE_PATH" ]] || fail "route path is required"
if [[ -z "$ROUTE_ID" ]]; then
  ROUTE_ID="$(basename "$ROUTE_PATH" | tr '_' '-')"
fi

require_cmd curl
require_cmd rg
require_cmd jq

require_file "$RUNTIME_LOG"

BASE_URL="${4:-$(carbonet_runtime_base_url)}"
carbonet_set_curl_args
carbonet_qa_login "$COOKIE_JAR" "$BASE_URL" || fail "isolated QA login failed"
SESSION_JSON="$TMP_DIR/session.json"
HTML_FILE="$TMP_DIR/route.html"
BOOTSTRAP_JSON="$TMP_DIR/bootstrap.json"
NEW_LOG_LINES="$TMP_DIR/new-log-lines.txt"
LOG_MARKER="$(date '+%Y-%m-%d %H:%M:%S')"

info "verifying authenticated frontend session"
retry_curl "$SESSION_JSON" -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$BASE_URL/api/frontend/session" || fail "frontend session request failed"
jq -e --arg user "$CARBONET_QA_AUTH_EFFECTIVE_USER" '.authenticated == true and ((.actualUserId // .userId // "") | ascii_downcase) == ($user | ascii_downcase) and ((.authorCode // "") | length > 0)' "$SESSION_JSON" >/dev/null || fail "frontend QA session contract mismatch"

info "loading admin shell route"
retry_curl "$HTML_FILE" -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$BASE_URL$ROUTE_PATH" || fail "admin shell route request failed"
rg -q 'window\.__CARBONET_REACT_BOOTSTRAP__ = config\.reactBootstrapPayload \|\| \{\};' "$HTML_FILE" || fail "admin shell bootstrap assignment is missing"

info "loading route bootstrap payload"
retry_curl "$BOOTSTRAP_JSON" -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$BASE_URL/api/admin/app/bootstrap?route=$ROUTE_ID" || fail "bootstrap payload request failed"
rg -q "\"reactRoute\"[[:space:]]*:[[:space:]]*\"$ROUTE_ID\"" "$BOOTSTRAP_JSON" || fail "bootstrap route is not $ROUTE_ID"
if [[ -n "$PAYLOAD_KEY" ]]; then
  rg -q "\"$PAYLOAD_KEY\"" "$BOOTSTRAP_JSON" || fail "$PAYLOAD_KEY is missing from bootstrap payload"
fi

awk -v marker="$LOG_MARKER" '$0 >= marker { print }' "$RUNTIME_LOG" > "$NEW_LOG_LINES"

info "checking request log window after shell and bootstrap calls"
rg -q "uri=$ROUTE_PATH, status=200" "$NEW_LOG_LINES" || fail "admin route hit was not observed in runtime log"
rg -q 'uri=/api/admin/app/bootstrap, status=200' "$NEW_LOG_LINES" || fail "bootstrap API hit was not observed in runtime log"

info "session OK"
info "shell route OK: $ROUTE_PATH"
info "bootstrap route OK: $ROUTE_ID"
if [[ -n "$PAYLOAD_KEY" ]]; then
  info "bootstrap payload key OK: $PAYLOAD_KEY"
fi
info "verification completed"
