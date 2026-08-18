#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
GROUP_SCRIPT="$ROOT/ops/scripts/run-post-deploy-validation-groups.sh"
WRITER="$ROOT/ops/scripts/resonance-keycloak-carbonet-identity-sync.sh"

[[ -s "$GROUP_SCRIPT" && -s "$WRITER" ]]
bash -n "$GROUP_SCRIPT"
bash -n "$WRITER"

python3 - "$GROUP_SCRIPT" "$WRITER" <<'PY'
from pathlib import Path
import sys

groups=Path(sys.argv[1]).read_text(encoding="utf-8")
writer=Path(sys.argv[2]).read_text(encoding="utf-8")
candidate=groups[groups.index('if [[ "${CARBONET_POSTDEPLOY_EVIDENCE_MODE:-}" == candidate ]]'):
                 groups.index("  else",groups.index('if [[ "${CARBONET_POSTDEPLOY_EVIDENCE_MODE:-}" == candidate ]]'))]
shared_default="/tmp/resonance-keycloak-carbonet-identity-sync.lock"

def assert_lock_contract(source):
    assert f'IDENTITY_SYNC_LOCK_FILE:-{shared_default}' in source
    assert 'IDENTITY_SYNC_LOCK_WAIT_SECONDS:-60' in source
    child_close='exec {identity_sync_lock_fd}>&- || exit 1'
    assert source.count(child_close) == 3
    before=source.index('if ! identity_before="$(')
    before_close=source.index(child_close,before)
    before_digest=source.index('identity_current_digest',before_close)
    validator_close=source.index(child_close,before_digest)
    validator=source.index('bash ops/scripts/validate-keycloak-carbonet-identity-sync.sh',validator_close)
    after=source.index('if ! identity_after="$(')
    after_close=source.index(child_close,after)
    after_digest=source.index('identity_current_digest',after_close)
    assert before < before_close < before_digest < validator_close < validator < after < after_close < after_digest
    order=(
        source.index('if ! exec {identity_sync_lock_fd}>'),
        source.index('if ! flock -w "$identity_sync_lock_wait_seconds" "$identity_sync_lock_fd"'),
        before,
        validator,
        after,
        source.index('if ! identity_candidate_lock_close'),
    )
    assert tuple(sorted(order)) == order
    assert "unable to open shared identity synchronization lock" in source
    assert "shared identity synchronization lock timed out" in source

assert_lock_contract(candidate)
assert f'IDENTITY_SYNC_LOCK_FILE:-{shared_default}' in writer
assert 'exec 9>"$LOCK_FILE"' in writer and 'flock -w 60 9' in writer
assert "jsonb_agg(to_jsonb(a) order by a.sync_id)" in groups
for token in (
    f'IDENTITY_SYNC_LOCK_FILE:-{shared_default}',
    'if ! exec {identity_sync_lock_fd}>',
    'if ! flock -w "$identity_sync_lock_wait_seconds" "$identity_sync_lock_fd"',
    'exec {identity_sync_lock_fd}>&- || exit 1',
    'if ! identity_before="$(',
    'bash ops/scripts/validate-keycloak-carbonet-identity-sync.sh',
    'if ! identity_after="$(',
    'if ! identity_candidate_lock_close',
):
    mutant=candidate.replace(token,"",1)
    try:
        assert_lock_contract(mutant)
    except (AssertionError,ValueError):
        pass
    else:
        raise AssertionError(f"identity synchronization lock mutation survived: {token}")
PY

group_function="$(sed -n '/^validate_identity_design_group() {$/,/^}$/p' "$GROUP_SCRIPT")"
[[ "$group_function" == *'identity_candidate_lock_close() {'* ]]
eval "$group_function"

tmp="$(mktemp -d)"
declare -a orphan_pids=()
cleanup() {
  local status=$?
  trap - EXIT INT TERM
  [[ -z "${writer_pid:-}" ]] || kill "$writer_pid" 2>/dev/null || true
  [[ -z "${candidate_pid:-}" ]] || kill "$candidate_pid" 2>/dev/null || true
  if (( ${#orphan_pids[@]} > 0 )); then
    kill "${orphan_pids[@]}" 2>/dev/null || true
  fi
  rm -rf -- "$tmp"
  exit "$status"
}
trap cleanup EXIT INT TERM

start_writer() {
  local lock_file="$1" case_dir="$2" attempt
  mkdir -p "$case_dir"
  (
    exec 9>"$lock_file"
    flock -w 2 9
    : >"$case_dir/writer-held"
    for attempt in $(seq 1 500); do
      if [[ -e "$case_dir/mutate-on-snapshot" && -e "$case_dir/first-snapshot" &&
            ! -e "$case_dir/writer-mutated" ]]; then
        printf '%064d\n' 1 >"$case_dir/digest-state"
        : >"$case_dir/writer-mutated"
      fi
      [[ -e "$case_dir/release-writer" ]] && exit 0
      sleep 0.01
    done
    exit 1
  ) &
  writer_pid=$!
  for attempt in $(seq 1 200); do
    [[ -e "$case_dir/writer-held" ]] && return 0
    kill -0 "$writer_pid" 2>/dev/null || return 1
    sleep 0.01
  done
  return 1
}

run_candidate_fixture() (
  local trace="$1" lock_file="$2" wait_seconds="$3" fixture_dir
  fixture_dir="$(dirname "$trace")"
  printf '%s\n' "$BASHPID" >"$fixture_dir/candidate-parent-pid"
  export CARBONET_POSTDEPLOY_EVIDENCE_MODE=candidate
  export IDENTITY_SYNC_LOCK_FILE="$lock_file"
  export IDENTITY_SYNC_LOCK_WAIT_SECONDS="$wait_seconds"
  export RESONANCE_POSTGRES_LEADER_POD=fixture-leader
  root="$ROOT"
  kubectl() {
    local digest attempt
    printf 'snapshot\n' >>"$trace"
    : >"$fixture_dir/first-snapshot"
    if [[ -e "$fixture_dir/digest-child-long-lived" ]]; then
      printf '%s\n' "$BASHPID" >"$fixture_dir/child-pid"
      : >"$fixture_dir/child-ready"
      for attempt in $(seq 1 1000); do
        [[ -e "$fixture_dir/release-child" ]] && break
        sleep 0.01
      done
    fi
    if [[ -s "$fixture_dir/digest-state" ]]; then
      IFS= read -r digest <"$fixture_dir/digest-state"
      printf '%s\n' "$digest"
    else
      printf '%064d\n' 0
    fi
  }
  bash() {
    local attempt
    if [[ "${1:-}" == ops/scripts/validate-keycloak-carbonet-identity-sync.sh ]]; then
      printf 'validate\n' >>"$trace"
      if [[ -e "$fixture_dir/validator-child-long-lived" ]]; then
        printf '%s\n' "$BASHPID" >"$fixture_dir/child-pid"
        : >"$fixture_dir/child-ready"
        for attempt in $(seq 1 1000); do
          [[ -e "$fixture_dir/release-child" ]] && break
          sleep 0.01
        done
      fi
      if [[ -e "$fixture_dir/wait-for-writer-mutation" ]]; then
        for attempt in $(seq 1 200); do
          [[ -e "$fixture_dir/writer-mutated" ]] && return 0
          sleep 0.01
        done
        return 1
      fi
    fi
    return 0
  }
  validate_identity_design_group
)

probe_canonical_writer_lock() {
  local lock_file="$1" probe_fd started_ms elapsed_ms
  exec {probe_fd}>"$lock_file"
  started_ms="$(date +%s%3N)"
  flock -w 1 "$probe_fd"
  elapsed_ms=$(( $(date +%s%3N) - started_ms ))
  flock -u "$probe_fd"
  exec {probe_fd}>&-
  if (( elapsed_ms >= 800 )); then
    echo "writer lock reacquire exceeded 800ms: ${elapsed_ms}ms" >&2
    return 1
  fi
  printf '%s' "$elapsed_ms"
}

run_parent_death_fd_case() {
  local mode="$1" signal="$2" case_dir lock_file trace
  local attempt child_pid parent_pid parent_status elapsed_ms
  case_dir="$tmp/fd-${mode,,}-${signal,,}"
  lock_file="$case_dir/identity.lock"
  trace="$case_dir/trace"
  mkdir -p "$case_dir"
  : >"$case_dir/${mode}-child-long-lived"
  run_candidate_fixture "$trace" "$lock_file" 3 >"$case_dir/candidate.log" 2>&1 &
  candidate_pid=$!
  for attempt in $(seq 1 300); do
    [[ -s "$case_dir/candidate-parent-pid" && -s "$case_dir/child-pid" &&
       -e "$case_dir/child-ready" ]] && break
    kill -0 "$candidate_pid" 2>/dev/null || return 1
    sleep 0.01
  done
  [[ -s "$case_dir/candidate-parent-pid" && -s "$case_dir/child-pid" &&
     -e "$case_dir/child-ready" ]]
  IFS= read -r parent_pid <"$case_dir/candidate-parent-pid"
  IFS= read -r child_pid <"$case_dir/child-pid"
  [[ "$parent_pid" =~ ^[0-9]+$ && "$child_pid" =~ ^[0-9]+$ ]]
  orphan_pids+=("$child_pid")
  kill -0 "$child_pid"
  kill -s "$signal" "$parent_pid"
  set +e
  wait "$candidate_pid"
  parent_status=$?
  set -e
  candidate_pid=""
  if [[ "$signal" == KILL ]]; then
    [[ "$parent_status" -eq 137 ]]
  else
    [[ "$parent_status" -eq 143 ]]
  fi
  kill -0 "$child_pid"
  elapsed_ms="$(probe_canonical_writer_lock "$lock_file")"
  kill -0 "$child_pid"
  kill -KILL "$child_pid" 2>/dev/null || true
  parent_death_reacquire_ms="$elapsed_ms"
}

# The candidate must not take its first snapshot while the minute writer owns
# the shared lock. Once released, the exact sequence is before/validate/after.
wait_case="$tmp/wait"
wait_lock="$wait_case/identity.lock"
wait_trace="$wait_case/trace"
start_writer "$wait_lock" "$wait_case"
(
  : >"$wait_case/candidate-started"
  run_candidate_fixture "$wait_trace" "$wait_lock" 3
) >"$wait_case/candidate.log" 2>&1 &
candidate_pid=$!
for attempt in $(seq 1 200); do
  [[ -e "$wait_case/candidate-started" ]] && break
  sleep 0.01
done
sleep 0.15
kill -0 "$candidate_pid"
[[ ! -s "$wait_trace" ]]
# Model the timer's append while it still owns the lock. The candidate can
# only observe the completed state, so both of its full digests remain equal.
printf '%064d\n' 1 >"$wait_case/digest-state"
: >"$wait_case/release-writer"
wait "$writer_pid"
writer_pid=""
wait "$candidate_pid"
candidate_pid=""
mapfile -t wait_events <"$wait_trace"
[[ "${wait_events[*]}" == "snapshot validate snapshot" ]]
exec {release_probe_fd}>"$wait_lock"
flock -n "$release_probe_fd"
flock -u "$release_probe_fd"
exec {release_probe_fd}>&-

# A killed candidate parent must not strand the writer lock in either kind of
# deliberately long-lived child. Exercise SIGKILL during the digest and TERM
# during the validator while proving the orphan is still alive at reacquire.
parent_death_reacquire_ms=""
run_parent_death_fd_case digest KILL
digest_kill_reacquire_ms="$parent_death_reacquire_ms"
run_parent_death_fd_case validator TERM
validator_term_reacquire_ms="$parent_death_reacquire_ms"

# A candidate using a different lock is the concurrency mutant. Reproduce the
# production race by changing the full digest between its two snapshots while
# the writer still owns the canonical lock.
mutant_case="$tmp/mutant"
mutant_lock="$mutant_case/identity.lock"
mutant_trace="$mutant_case/trace"
mkdir -p "$mutant_case"
: >"$mutant_case/mutate-on-snapshot"
: >"$mutant_case/wait-for-writer-mutation"
printf '%064d\n' 0 >"$mutant_case/digest-state"
start_writer "$mutant_lock" "$mutant_case"
set +e
run_candidate_fixture "$mutant_trace" "$mutant_case/unshared.lock" 1 \
  >"$mutant_case/candidate.log" 2>&1
mutant_status=$?
set -e
kill -0 "$writer_pid"
[[ "$mutant_status" -ne 0 && -e "$mutant_case/writer-mutated" ]]
mapfile -t mutant_events <"$mutant_trace"
[[ "${mutant_events[*]}" == "snapshot validate snapshot" ]]
grep -Fq 'verify-only gate changed current identity state' "$mutant_case/candidate.log"
: >"$mutant_case/release-writer"
wait "$writer_pid"
writer_pid=""

# Timeout is fail-closed: no snapshot and no validator mutation occur.
timeout_case="$tmp/timeout"
timeout_lock="$timeout_case/identity.lock"
timeout_trace="$timeout_case/trace"
start_writer "$timeout_lock" "$timeout_case"
timeout_started_ms="$(date +%s%3N)"
set +e
run_candidate_fixture "$timeout_trace" "$timeout_lock" 1 \
  >"$timeout_case/candidate.log" 2>&1
timeout_status=$?
set -e
timeout_elapsed_ms=$(( $(date +%s%3N) - timeout_started_ms ))
[[ "$timeout_status" -ne 0 && ! -s "$timeout_trace" ]]
[[ "$timeout_elapsed_ms" -ge 900 && "$timeout_elapsed_ms" -lt 3000 ]]
grep -Fq 'shared identity synchronization lock timed out after 1s' "$timeout_case/candidate.log"
: >"$timeout_case/release-writer"
wait "$writer_pid"
writer_pid=""

# An unopenable path is also fail-closed before either snapshot.
open_case="$tmp/open"
mkdir -p "$open_case"
set +e
run_candidate_fixture "$open_case/trace" "$open_case/missing/identity.lock" 1 \
  >"$open_case/candidate.log" 2>&1
open_status=$?
set -e
[[ "$open_status" -ne 0 && ! -s "$open_case/trace" ]]
grep -Fq 'unable to open shared identity synchronization lock' "$open_case/candidate.log"

echo "[postdeploy-identity-sync-lock-contract] PASS sharedLock=writer+candidate sequence=before+validate+after writerHoldSnapshots=0 timerAppend=serialized released=verified digestParentKillReacquire=${digest_kill_reacquire_ms}ms validatorParentTermReacquire=${validator_term_reacquire_ms}ms childAlive=2 timeout=${timeout_elapsed_ms}ms timeoutMutation=0 openFailureMutation=0 mutant=unshared-lock-state-drift-rejected"
