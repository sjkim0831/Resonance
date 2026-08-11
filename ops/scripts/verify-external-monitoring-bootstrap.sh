#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/verify-external-monitoring-bootstrap.sh [base-url]

Purpose:
  Verify that /admin/external/monitoring uses bootstrap payload on first entry
  against the running local service.

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
RUNTIME_LOG="${RUNTIME_LOG:-/tmp/carbonet-runtime-18000.log}"
PORT="${PORT:-18000}"
TMP_DIR="$(mktemp -d /tmp/external-monitoring-bootstrap.XXXXXX)"
COOKIE_JAR="$TMP_DIR/cookies.txt"

cleanup() {
  if [[ -n "${BASE_URL:-}" ]]; then
    carbonet_qa_logout "$COOKIE_JAR" "$BASE_URL"
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

fail() {
  echo "[verify-external-monitoring-bootstrap] FAIL: $*" >&2
  exit 1
}

info() {
  echo "[verify-external-monitoring-bootstrap] $*"
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

require_cmd curl
require_cmd rg
require_cmd jq

require_file "$RUNTIME_LOG"

BASE_URL="${1:-$(carbonet_runtime_base_url)}"
carbonet_set_curl_args
carbonet_qa_login "$COOKIE_JAR" "$BASE_URL" || fail "isolated QA login failed"
LOG_MARKER="$(date '+%Y-%m-%d %H:%M:%S')"
info "using log marker $LOG_MARKER"

SESSION_JSON="$TMP_DIR/session.json"
HTML_FILE="$TMP_DIR/external-monitoring.html"
BOOTSTRAP_JSON="$TMP_DIR/bootstrap.json"
NEW_LOG_LINES="$TMP_DIR/new-log-lines.txt"

info "verifying authenticated frontend session"
retry_curl "$SESSION_JSON" -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$BASE_URL/api/frontend/session" || fail "frontend session request failed"
jq -e --arg user "$CARBONET_QA_AUTH_EFFECTIVE_USER" '.authenticated == true and ((.actualUserId // .userId // "") | ascii_downcase) == ($user | ascii_downcase) and ((.authorCode // "") | length > 0)' "$SESSION_JSON" >/dev/null || fail "frontend QA session contract mismatch"

info "loading admin shell route"
retry_curl "$HTML_FILE" -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$BASE_URL/admin/external/monitoring" || fail "admin shell route request failed"
rg -q 'window\.__CARBONET_REACT_BOOTSTRAP__ = config\.reactBootstrapPayload \|\| \{\};' "$HTML_FILE" || fail "admin shell bootstrap assignment is missing"

info "loading route bootstrap payload"
retry_curl "$BOOTSTRAP_JSON" -b "$COOKIE_JAR" -c "$COOKIE_JAR" "$BASE_URL/api/admin/app/bootstrap?route=external-monitoring" || fail "bootstrap payload request failed"
rg -q '"reactRoute"[[:space:]]*:[[:space:]]*"external-monitoring"' "$BOOTSTRAP_JSON" || fail "bootstrap route is not external-monitoring"
rg -q '"externalMonitoringPageData"' "$BOOTSTRAP_JSON" || fail "externalMonitoringPageData is missing from bootstrap payload"
rg -q '"overallStatus"[[:space:]]*:[[:space:]]*"' "$BOOTSTRAP_JSON" || fail "overallStatus is missing from bootstrap payload"

awk -v marker="$LOG_MARKER" '$0 >= marker { print }' "$RUNTIME_LOG" > "$NEW_LOG_LINES"

info "checking request log window after shell and bootstrap calls"
rg -q 'uri=/admin/external/monitoring, status=200' "$NEW_LOG_LINES" || fail "admin route hit was not observed in runtime log"
rg -q 'uri=/api/admin/app/bootstrap, status=200' "$NEW_LOG_LINES" || fail "bootstrap API hit was not observed in runtime log"
if rg -q 'uri=/admin/external/monitoring/page-data' "$NEW_LOG_LINES"; then
  fail "unexpected /admin/external/monitoring/page-data request observed after shell/bootstrap verification"
fi

info "verification completed"
