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

resolve_patroni_leader() {
  local pod recovery
  local -a leaders=()
  while IFS= read -r pod; do
    [[ -n "$pod" ]] || continue
    recovery="$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- \
      psql -h 127.0.0.1 -U postgres -d carbonet -X -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)"
    [[ "$recovery" == "f" ]] && leaders+=("$pod")
  done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni \
    -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}')
  if (( ${#leaders[@]} != 1 )); then
    echo "[auth-logout-live] expected exactly one writable Patroni leader; found=${#leaders[@]}" >&2
    return 1
  fi
  printf '%s\n' "${leaders[0]}"
}

pod="$(resolve_patroni_leader)" || exit 1
if [[ "${1:-}" == "--resolve-leader-only" ]]; then
  [[ "$#" == "1" ]] || { echo '[auth-logout-live] leader-only probe accepts no extra arguments' >&2; exit 2; }
  printf '%s\n' "$pod"
  exit 0
fi
[[ "$#" == "0" ]] || { echo '[auth-logout-live] unexpected argument' >&2; exit 2; }

carbonet_qa_login "$COOKIE_JAR" "$BASE_URL"
cp "$COOKIE_JAR" "$STALE_COOKIE_JAR"
user="$CARBONET_QA_AUTH_EFFECTIVE_USER"
[[ "$user" =~ ^[A-Za-z0-9_.-]+$ ]] || { echo '[auth-logout-live] invalid QA account identifier' >&2; exit 1; }
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
