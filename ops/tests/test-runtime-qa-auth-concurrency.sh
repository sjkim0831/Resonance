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

python3 - "$HELPER" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text(encoding="utf-8")

def assert_owner_contract(value):
    assert "CARBONET_QA_AUTH_LOCK_OWNER_BASHPID" in value
    assert 'local current_pid="${BASHPID:-$$}"' in value
    assert '"$lock_owner" != "$current_pid"' in value
    assert "Keep both inherited variables intact" in value
    assert "unset CARBONET_QA_AUTH_LOCK_FD CARBONET_QA_AUTH_LOCK_OWNER_BASHPID" in value

assert_owner_contract(source)
mutated = source.replace(
    'if [[ -n "$lock_fd" && "$lock_owner" != "$current_pid" ]]; then',
    'if [[ -n "$lock_fd" && "$lock_owner" == "$current_pid" ]]; then',
    1,
)
try:
    assert_owner_contract(mutated)
except AssertionError:
    pass
else:
    raise AssertionError("borrowed-release owner-check mutation survived")
print("RUNTIME_QA_AUTH_OWNER_STATIC_PASS mutation=detected")
PY

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

BORROW_LOCK="$TMP_DIR/borrowed-release.lock"
BORROW_OWNER_READY="$TMP_DIR/borrow-owner-ready"
BORROW_CHILD_RELEASED="$TMP_DIR/borrow-child-released"
BORROW_OWNER_RELEASE="$TMP_DIR/borrow-owner-release"
BORROW_COMPETITOR_ACQUIRED="$TMP_DIR/borrow-competitor-acquired"
(
  export CARBONET_QA_AUTH_LOCK_FILE="$BORROW_LOCK" CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS=60
  source "$HELPER"
  carbonet_qa_auth_acquire_lock
  [[ "${CARBONET_QA_AUTH_LOCK_OWNER_BASHPID:-}" == "${BASHPID:-$$}" ]]
  touch "$BORROW_OWNER_READY"
  (
    source "$HELPER"
    inherited_fd="${CARBONET_QA_AUTH_LOCK_FD:-}"
    inherited_owner="${CARBONET_QA_AUTH_LOCK_OWNER_BASHPID:-}"
    [[ -n "$inherited_fd" && -n "$inherited_owner" ]]
    [[ "$inherited_owner" != "${BASHPID:-$$}" ]]
    carbonet_qa_auth_acquire_lock
    carbonet_qa_auth_release_lock
    [[ "${CARBONET_QA_AUTH_LOCK_FD:-}" == "$inherited_fd" ]]
    [[ "${CARBONET_QA_AUTH_LOCK_OWNER_BASHPID:-}" == "$inherited_owner" ]]
    touch "$BORROW_CHILD_RELEASED"
  )
  while [[ ! -e "$BORROW_OWNER_RELEASE" ]]; do sleep 0.01; done
  carbonet_qa_auth_release_lock
) &
borrow_owner_pid=$!
for _ in $(seq 1 50); do [[ -f "$BORROW_OWNER_READY" ]] && break; sleep 0.05; done
[[ -f "$BORROW_OWNER_READY" ]] || { echo '[runtime-qa-auth-concurrency] borrowed owner did not acquire lock' >&2; exit 1; }
for _ in $(seq 1 50); do [[ -f "$BORROW_CHILD_RELEASED" ]] && break; sleep 0.05; done
[[ -f "$BORROW_CHILD_RELEASED" ]] || { echo '[runtime-qa-auth-concurrency] borrowed child did not release' >&2; exit 1; }
if (
  export CARBONET_QA_AUTH_LOCK_FILE="$BORROW_LOCK" CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS=1
  unset CARBONET_QA_AUTH_LOCK_FD CARBONET_QA_AUTH_LOCK_OWNER_BASHPID
  source "$HELPER"
  if carbonet_qa_auth_acquire_lock; then
    touch "$BORROW_COMPETITOR_ACQUIRED"
    carbonet_qa_auth_release_lock
    exit 0
  fi
  exit 1
); then
  echo '[runtime-qa-auth-concurrency] borrowed child unlocked the owner critical section' >&2
  exit 1
fi
[[ ! -e "$BORROW_COMPETITOR_ACQUIRED" ]]
touch "$BORROW_OWNER_RELEASE"
wait "$borrow_owner_pid"
(
  export CARBONET_QA_AUTH_LOCK_FILE="$BORROW_LOCK" CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS=2
  unset CARBONET_QA_AUTH_LOCK_FD CARBONET_QA_AUTH_LOCK_OWNER_BASHPID
  source "$HELPER"
  carbonet_qa_auth_acquire_lock
  carbonet_qa_auth_release_lock
)

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
[[ -z "${CARBONET_QA_AUTH_LOCK_FD:-}" && -z "${CARBONET_QA_AUTH_LOCK_OWNER_BASHPID:-}" ]] || {
  echo '[runtime-qa-auth-concurrency] failed logout leaked lock ownership' >&2
  exit 1
}

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
[[ -z "${CARBONET_QA_AUTH_LOCK_FD:-}" && -z "${CARBONET_QA_AUTH_LOCK_OWNER_BASHPID:-}" ]] || {
  echo '[runtime-qa-auth-concurrency] successful logout leaked lock ownership' >&2
  exit 1
}

printf '[runtime-qa-auth-concurrency] PASS serialized=true borrowedRelease=no-op ownerRelease=exclusive competitorBlocked=true timeout=fail-closed logout200=required logout503=rejected lockReleased=true\n'
