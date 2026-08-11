#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HELPER="$ROOT/ops/scripts/runtime-qa-auth-common.sh"
POST_DEPLOY_VALIDATOR="$ROOT/ops/scripts/run-post-deploy-validation-groups.sh"
TMP_DIR="$(mktemp -d /tmp/runtime-qa-auth-concurrency.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

[[ -f "$HELPER" ]] || { echo '[runtime-qa-auth-concurrency] helper missing' >&2; exit 1; }
[[ -f "$POST_DEPLOY_VALIDATOR" ]] || { echo '[runtime-qa-auth-concurrency] post-deploy validator missing' >&2; exit 1; }
bash -n "$HELPER"
bash -n "$POST_DEPLOY_VALIDATOR"
grep -Fq 'CARBONET_QA_AUTH_LOCK_FILE:-/tmp/carbonet-qa-auth-session.lock' "$POST_DEPLOY_VALIDATOR" \
  || { echo '[runtime-qa-auth-concurrency] emission validators do not share the canonical lock' >&2; exit 1; }
grep -Fq 'flock -w "${CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS:-120}" 9' "$POST_DEPLOY_VALIDATOR" \
  || { echo '[runtime-qa-auth-concurrency] emission validator lock is not fail-closed' >&2; exit 1; }

LOCK_FILE="$TMP_DIR/shared.lock"
MARKER="$TMP_DIR/holder-ready"
(
  export CARBONET_QA_AUTH_LOCK_FILE="$LOCK_FILE" CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS=60
  source "$HELPER"
  carbonet_qa_auth_acquire_lock
  touch "$MARKER"
  sleep 2
  carbonet_qa_auth_release_lock
) &
holder=$!
for _ in $(seq 1 50); do [[ -f "$MARKER" ]] && break; sleep 0.05; done
[[ -f "$MARKER" ]] || { echo '[runtime-qa-auth-concurrency] holder did not acquire lock' >&2; exit 1; }
SECONDS=0
(
  export CARBONET_QA_AUTH_LOCK_FILE="$LOCK_FILE" CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS=60
  source "$HELPER"
  carbonet_qa_auth_acquire_lock
  carbonet_qa_auth_release_lock
)
wait "$holder"
(( SECONDS >= 1 )) || { echo '[runtime-qa-auth-concurrency] concurrent verifier was not serialized' >&2; exit 1; }

TIMEOUT_LOCK="$TMP_DIR/timeout.lock"
TIMEOUT_MARKER="$TMP_DIR/timeout-ready"
(
  export CARBONET_QA_AUTH_LOCK_FILE="$TIMEOUT_LOCK" CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS=60
  source "$HELPER"
  carbonet_qa_auth_acquire_lock
  touch "$TIMEOUT_MARKER"
  sleep 3
  carbonet_qa_auth_release_lock
) &
timeout_holder=$!
for _ in $(seq 1 50); do [[ -f "$TIMEOUT_MARKER" ]] && break; sleep 0.05; done
[[ -f "$TIMEOUT_MARKER" ]] || { echo '[runtime-qa-auth-concurrency] timeout holder did not acquire lock' >&2; exit 1; }
if (
  export CARBONET_QA_AUTH_LOCK_FILE="$TIMEOUT_LOCK" CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS=1
  source "$HELPER"
  carbonet_qa_auth_acquire_lock
); then
  echo '[runtime-qa-auth-concurrency] lock timeout did not fail closed' >&2
  exit 1
fi
wait "$timeout_holder"

source "$HELPER"
CARBONET_QA_AUTH_LOCK_FILE="$TMP_DIR/logout.lock"
CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS=60
carbonet_qa_auth_acquire_lock
CARBONET_QA_AUTH_SESSION_ACTIVE=1
printf 'cookie' > "$TMP_DIR/failure-cookie"
MOCK_LOGOUT_STATUS=503
curl() {
  local output_file=""
  while (($#)); do
    if [[ "$1" == "-o" ]]; then output_file="$2"; shift 2; else shift; fi
  done
  printf '{"status":"logoutFailure"}' > "$output_file"
  printf '%s' "$MOCK_LOGOUT_STATUS"
}
if carbonet_qa_logout "$TMP_DIR/failure-cookie" http://invalid.example; then
  echo '[runtime-qa-auth-concurrency] HTTP 503 logout was ignored' >&2
  exit 1
fi
[[ -z "${CARBONET_QA_AUTH_LOCK_FD:-}" ]] || { echo '[runtime-qa-auth-concurrency] failed logout leaked lock' >&2; exit 1; }

carbonet_qa_auth_acquire_lock
CARBONET_QA_AUTH_SESSION_ACTIVE=1
printf 'cookie' > "$TMP_DIR/success-cookie"
MOCK_LOGOUT_STATUS=200
curl() {
  local output_file=""
  while (($#)); do
    if [[ "$1" == "-o" ]]; then output_file="$2"; shift 2; else shift; fi
  done
  printf '{"status":"success"}' > "$output_file"
  printf '%s' "$MOCK_LOGOUT_STATUS"
}
carbonet_qa_logout "$TMP_DIR/success-cookie" http://invalid.example
[[ -z "${CARBONET_QA_AUTH_LOCK_FD:-}" ]] || { echo '[runtime-qa-auth-concurrency] successful logout leaked lock' >&2; exit 1; }

printf '[runtime-qa-auth-concurrency] PASS serialized=true timeout=fail-closed logout200=required logout503=rejected lockReleased=true\n'
