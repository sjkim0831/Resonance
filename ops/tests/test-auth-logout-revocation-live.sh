#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://172.16.1.232}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
TMP_DIR="$(mktemp -d /tmp/auth-logout-revocation.XXXXXX)"
COOKIE_JAR="$TMP_DIR/cookies.txt"
STALE_COOKIE_JAR="$TMP_DIR/stale-cookies.txt"
LOGOUT_COMPLETED=0

# shellcheck source=ops/scripts/runtime-qa-auth-common.sh
source "$ROOT/ops/scripts/runtime-qa-auth-common.sh"

cleanup() {
  local original_status="${1:-$?}" logout_status=0
  local session_was_active="${CARBONET_QA_AUTH_SESSION_ACTIVE:-0}"
  set +e
  carbonet_qa_logout "$COOKIE_JAR" "$BASE_URL" || logout_status=$?
  if { (( logout_status != 0 )) || [[ "$session_was_active" != "1" && "$LOGOUT_COMPLETED" != "1" ]]; } \
     && [[ -s "$STALE_COOKIE_JAR" ]]; then
    CARBONET_QA_AUTH_SESSION_ACTIVE=1
    export CARBONET_QA_AUTH_SESSION_ACTIVE
    carbonet_qa_logout "$STALE_COOKIE_JAR" "$BASE_URL" || true
  fi
  rm -rf -- "$TMP_DIR"
  return "$original_status"
}
trap 'cleanup $?' EXIT

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

if [[ "${1:-}" == "--resolve-leader-only" ]]; then
  [[ "$#" == "1" ]] || { echo '[auth-logout-live] leader-only probe accepts no extra arguments' >&2; exit 2; }
  pod="$(resolve_patroni_leader)" || exit 1
  printf '%s\n' "$pod"
  exit 0
fi
[[ "$#" == "0" ]] || { echo '[auth-logout-live] unexpected argument' >&2; exit 2; }

# This verifier owns a dedicated Secret identity. The deploy service also
# carries actor-test credentials for unrelated process lanes; never let those
# inherited explicit fields bypass this Secret or seed stale session state.
unset CARBONET_QA_AUTH_USER CARBONET_QA_AUTH_PASSWORD CARBONET_ACTOR_TEST_PASSWORD
unset CARBONET_QA_AUTH_EFFECTIVE_USER CARBONET_QA_AUTH_SESSION_ACTIVE
export CARBONET_QA_AUTH_SECRET="${CARBONET_QA_AUTH_SECRET:-carbonet-usage-ledger-system-admin}"
EXPECTED_USER=qausageadmin26

carbonet_qa_login "$COOKIE_JAR" "$BASE_URL"
cp "$COOKIE_JAR" "$STALE_COOKIE_JAR"
user="$CARBONET_QA_AUTH_EFFECTIVE_USER"
[[ "$user" =~ ^[A-Za-z0-9_.-]+$ ]] || { echo '[auth-logout-live] invalid QA account identifier' >&2; exit 1; }
[[ "${user,,}" == "${EXPECTED_USER,,}" ]] || { echo '[auth-logout-live] authenticated QA account is not the dedicated usage-ledger administrator' >&2; exit 1; }

session_code="$(curl -sS -b "$COOKIE_JAR" -o "$TMP_DIR/session-before.json" -w '%{http_code}' "$BASE_URL/api/frontend/session")"
[[ "$session_code" == "200" ]] || { echo "[auth-logout-live] authenticated session probe http=$session_code" >&2; exit 1; }
jq -e --arg user "$user" '.authenticated==true and ((.actualUserId // .userId // "")|ascii_downcase)==($user|ascii_downcase)' "$TMP_DIR/session-before.json" >/dev/null \
  || { echo '[auth-logout-live] authenticated session identity mismatch' >&2; exit 1; }

PROTECTED_PATH='/admin/api/system/actor-process/system-test-report?compact=true&page=0&size=1'
protected_code="$(curl -sS -b "$COOKIE_JAR" -o "$TMP_DIR/protected-before.json" -w '%{http_code}' "$BASE_URL$PROTECTED_PATH")"
[[ "$protected_code" == "200" ]] || { echo "[auth-logout-live] authenticated protected API probe http=$protected_code" >&2; exit 1; }
jq -e '.success==true' "$TMP_DIR/protected-before.json" >/dev/null \
  || { echo '[auth-logout-live] authenticated protected API response mismatch' >&2; exit 1; }

token_count() {
  local current_leader
  current_leader="$(resolve_patroni_leader)" || return 1
  kubectl -n "$NAMESPACE" exec "$current_leader" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -At \
    -c "select count(*) from comtnauthtokenstore where lower(user_id)=lower('$user')"
}

[[ "$(token_count)" == "1" ]] || { echo '[auth-logout-live] login token row was not persisted exactly once' >&2; exit 1; }
carbonet_qa_logout "$COOKIE_JAR" "$BASE_URL" \
  || { echo '[auth-logout-live] authoritative logout failed' >&2; exit 1; }
[[ "$(token_count)" == "0" ]] || { echo '[auth-logout-live] token row survived logout' >&2; exit 1; }
LOGOUT_COMPLETED=1

protected_code="$(curl -sS -b "$STALE_COOKIE_JAR" -o "$TMP_DIR/protected-after.json" -w '%{http_code}' "$BASE_URL$PROTECTED_PATH")"
[[ "$protected_code" == "401" ]] || { echo "[auth-logout-live] stale access protected API http=$protected_code" >&2; exit 1; }
jq -e '.success==false and .message=="AUTHENTICATION_REQUIRED"' "$TMP_DIR/protected-after.json" >/dev/null \
  || { echo '[auth-logout-live] stale access denial response mismatch' >&2; exit 1; }

session_code="$(curl -sS -b "$STALE_COOKIE_JAR" -o "$TMP_DIR/session.json" -w '%{http_code}' "$BASE_URL/api/frontend/session")"
[[ "$session_code" == "200" ]] || { echo "[auth-logout-live] stale session probe http=$session_code" >&2; exit 1; }
jq -e '.authenticated==false' "$TMP_DIR/session.json" >/dev/null \
  || { echo '[auth-logout-live] stale session remained authenticated' >&2; exit 1; }

refresh_code="$(curl -sS -b "$STALE_COOKIE_JAR" -o "$TMP_DIR/refresh.json" -w '%{http_code}' -X POST "$BASE_URL/signin/refreshSession")"
[[ "$refresh_code" == "401" || "$refresh_code" == "403" ]] \
  || { echo "[auth-logout-live] stale refresh denial was not authoritative (http=$refresh_code)" >&2; exit 1; }

printf '[auth-logout-live] PASS account=%s leader=resolved-per-read tokenRows=1->0 oldAccess=protected401 oldSession=unauthenticated oldRefresh=401-or-403 logout=200\n' "$user"
