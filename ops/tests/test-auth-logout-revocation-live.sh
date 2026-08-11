#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://172.16.1.232}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
TMP_DIR="$(mktemp -d /tmp/auth-logout-revocation.XXXXXX)"
COOKIE_JAR="$TMP_DIR/cookies.txt"
STALE_COOKIE_JAR="$TMP_DIR/stale-cookies.txt"

# shellcheck source=ops/scripts/runtime-qa-auth-common.sh
source "$ROOT/ops/scripts/runtime-qa-auth-common.sh"

cleanup() {
  carbonet_qa_logout "$COOKIE_JAR" "$BASE_URL"
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

command -v kubectl >/dev/null 2>&1 || { echo '[auth-logout-live] kubectl is required' >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo '[auth-logout-live] jq is required' >&2; exit 1; }

carbonet_qa_login "$COOKIE_JAR" "$BASE_URL"
cp "$COOKIE_JAR" "$STALE_COOKIE_JAR"
user="$CARBONET_QA_AUTH_EFFECTIVE_USER"
[[ "$user" =~ ^[A-Za-z0-9_.-]+$ ]] || { echo '[auth-logout-live] invalid QA account identifier' >&2; exit 1; }
pod="$(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o jsonpath='{.items[0].metadata.name}')"
token_count() {
  kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -At \
    -c "select count(*) from comtnauthtokenstore where lower(user_id)=lower('$user')"
}

[[ "$(token_count)" == "1" ]] || { echo '[auth-logout-live] login token row was not persisted exactly once' >&2; exit 1; }
carbonet_qa_logout "$COOKIE_JAR" "$BASE_URL" \
  || { echo '[auth-logout-live] authoritative logout failed' >&2; exit 1; }
[[ "$(token_count)" == "0" ]] || { echo '[auth-logout-live] token row survived logout' >&2; exit 1; }

session_code="$(curl -sS -b "$STALE_COOKIE_JAR" -o "$TMP_DIR/session.json" -w '%{http_code}' "$BASE_URL/api/frontend/session")"
[[ "$session_code" == "200" || "$session_code" == "401" ]] || { echo "[auth-logout-live] stale access check http=$session_code" >&2; exit 1; }
if [[ "$session_code" == "200" ]]; then
  jq -e '.authenticated != true' "$TMP_DIR/session.json" >/dev/null || { echo '[auth-logout-live] stale access token remained authenticated' >&2; exit 1; }
fi

refresh_code="$(curl -sS -b "$STALE_COOKIE_JAR" -o "$TMP_DIR/refresh.json" -w '%{http_code}' -X POST "$BASE_URL/signin/refreshSession")"
[[ "$refresh_code" != "200" ]] || { echo '[auth-logout-live] stale refresh token issued a new session' >&2; exit 1; }

printf '[auth-logout-live] PASS tokenRows=1->0 oldAccess=rejected oldRefresh=rejected logout=200\n'
