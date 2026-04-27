#!/usr/bin/env bash

set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/ops/scripts/runtime-url-common.sh"
CONFIG_ENV="${ROOT_DIR}/ops/config/carbonet-18000.env"
if [[ -f "$CONFIG_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$CONFIG_ENV"
  set +a
fi

usage() {
  echo "Usage: $0 <payload.json|-> [base_url]"
  echo
  echo "Environment:"
  echo "  SECURITY_CODEX_API_KEY   Required API key"
  echo "  CODEX_BASE_URL           Optional base URL, default: runtime-derived local URL"
  echo "  CODEX_LOGIN_CHECK        Optional, true to call /signin/codex/login first"
}

if [ "${1:-}" = "" ] || [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 1
fi

PAYLOAD_SOURCE="$1"
BASE_URL="${2:-${CODEX_BASE_URL:-$(carbonet_runtime_base_url)}}"
API_KEY="${SECURITY_CODEX_API_KEY:-}"
LOGIN_CHECK="${CODEX_LOGIN_CHECK:-true}"
carbonet_set_curl_args

if [ -z "$API_KEY" ]; then
  echo "SECURITY_CODEX_API_KEY is required." >&2
  exit 2
fi

TMP_PAYLOAD=""
cleanup() {
  if [ -n "$TMP_PAYLOAD" ] && [ -f "$TMP_PAYLOAD" ]; then
    rm -f "$TMP_PAYLOAD"
  fi
}
trap cleanup EXIT

if [ "$PAYLOAD_SOURCE" = "-" ]; then
  TMP_PAYLOAD="$(mktemp)"
  cat > "$TMP_PAYLOAD"
  PAYLOAD_FILE="$TMP_PAYLOAD"
else
  PAYLOAD_FILE="$PAYLOAD_SOURCE"
fi

if [ ! -f "$PAYLOAD_FILE" ]; then
  echo "Payload file not found: $PAYLOAD_FILE" >&2
  exit 3
fi

header_args=(
  -H "Content-Type: application/json"
  -H "X-CODEX-API-KEY: $API_KEY"
)

if [ "$LOGIN_CHECK" = "true" ]; then
  echo "[1/2] Checking Codex API authentication..."
  login_response="$(curl "${CARBONET_CURL_ARGS[@]}" -sS -X POST "${BASE_URL%/}/signin/codex/login" "${header_args[@]}")"
  echo "$login_response"
fi

echo "[2/2] Sending provision request..."
response="$(curl "${CARBONET_CURL_ARGS[@]}" -sS -X POST "${BASE_URL%/}/signin/codex/provision" "${header_args[@]}" --data @"$PAYLOAD_FILE")"
echo "$response"

if command -v jq >/dev/null 2>&1; then
  echo
  echo "Summary:"
  echo "$response" | jq '{status, requestId, createdCount, existingCount, skippedCount, securityMetadataReloaded}'
fi
