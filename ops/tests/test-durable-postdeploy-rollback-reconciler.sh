#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
AUTO="$ROOT/ops/scripts/auto-deploy-main.sh"
JOURNAL_HELPER="$ROOT/ops/scripts/postdeploy-attempt-journal.py"
POSTDEPLOY_JOURNAL_HELPER="$JOURNAL_HELPER"
POSTDEPLOY_GATE_SCRIPT="$ROOT/ops/scripts/resonance-full-screen-deploy-gate.sh"
tmp="$(mktemp -d)"
trap 'rm -rf -- "$tmp"' EXIT

python3 - "$AUTO" "$tmp/recover-function.sh" <<'PY'
from pathlib import Path
import sys
text=Path(sys.argv[1]).read_text(encoding="utf-8")
start=text.index("recover_staged_postdeploy_attempt_after_failure() {")
i=text.index("{",start); depth=0; quote=None; escaped=False
for j in range(i,len(text)):
    ch=text[j]
    if escaped: escaped=False; continue
    if ch=="\\": escaped=True; continue
    if quote:
        if ch==quote: quote=None
        continue
    if ch in "'\"": quote=ch; continue
    if ch=="{": depth+=1
    elif ch=="}":
        depth-=1
        if depth==0:
            Path(sys.argv[2]).write_text(text[start:j+1]+"\n",encoding="utf-8")
            break
else: raise SystemExit("recover function end not found")
PY
# shellcheck disable=SC1090
source "$tmp/recover-function.sh"
python3 - "$AUTO" "$tmp/recover-persistent-function.sh" <<'PY'
from pathlib import Path
import sys
text=Path(sys.argv[1]).read_text(encoding="utf-8")
start=text.index("recover_persistent_postdeploy_attempt() {")
i=text.index("{",start); depth=0; quote=None; escaped=False
for j in range(i,len(text)):
    ch=text[j]
    if escaped: escaped=False; continue
    if ch=="\\": escaped=True; continue
    if quote:
        if ch==quote: quote=None
        continue
    if ch in "'\"": quote=ch; continue
    if ch=="{": depth+=1
    elif ch=="}":
        depth-=1
        if depth==0:
            Path(sys.argv[2]).write_text(text[start:j+1]+"\n",encoding="utf-8")
            break
else: raise SystemExit("persistent recovery function end not found")
PY
# shellcheck disable=SC1090
source "$tmp/recover-persistent-function.sh"
python3 - "$AUTO" "$tmp/orphan-function.sh" <<'PY'
from pathlib import Path
import sys
text=Path(sys.argv[1]).read_text(encoding="utf-8")
start=text.index("retire_orphan_versioned_snapshot() {")
i=text.index("{",start); depth=0; quote=None; escaped=False
for j in range(i,len(text)):
    ch=text[j]
    if escaped: escaped=False; continue
    if ch=="\\": escaped=True; continue
    if quote:
        if ch==quote: quote=None
        continue
    if ch in "'\"": quote=ch; continue
    if ch=="{": depth+=1
    elif ch=="}":
        depth-=1
        if depth==0:
            Path(sys.argv[2]).write_text(text[start:j+1]+"\n",encoding="utf-8")
            break
else: raise SystemExit("orphan function end not found")
PY
# shellcheck disable=SC1090
source "$tmp/orphan-function.sh"

candidate='postdeploy:test:reconciler:123456'
source_commit='1111111111111111111111111111111111111111'
baseline='0000000000000000000000000000000000000000'
FIXTURE_BASELINE="$baseline"
EXPECTED_RUNTIME_HASH='2222222222222222222222222222222222222222222222222222222222222222'
sha='3333333333333333333333333333333333333333333333333333333333333333'
image_id='docker-pullable://registry.invalid/carbonet@sha256:4444444444444444444444444444444444444444444444444444444444444444'
ROOT_DIR="$ROOT"
POSTDEPLOY_ATTEMPT_JOURNAL_FILE="$tmp/attempt.json"
POSTDEPLOY_LEGACY_RETIRE_DIR="$tmp/retired"
RUNTIME_CANDIDATE_CHECKPOINT_FILE="$tmp/checkpoint.json"
RUNTIME_LEDGER_QUARANTINE_FILE="$tmp/runtime-ledger.quarantine"
live_frontend_overlay="$tmp/overlay"
postdeploy_candidate_id="$candidate"
target_commit="$source_commit"
postdeploy_candidate_promoted=false
postdeploy_db_attempt_staged=true
postdeploy_rollback_restored=false
postdeploy_attempt_journal_initialized=true
runtime_deployed_commit="$baseline"
mkdir -p "$live_frontend_overlay" "$POSTDEPLOY_LEGACY_RETIRE_DIR"

new_journal() {
  local db_staged="${1:-true}" rollback_stage=SNAPSHOT_CAPTURED
  rm -f -- "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" "$tmp/.attempt.json.lock"
  [[ "$db_staged" != true ]] || rollback_stage=SNAPSHOT_CAPTURED
  jq -cn --arg attempt "$candidate" --arg source "$source_commit" --arg base "$baseline" \
    --arg sha "$sha" --arg imageId "$image_id" '
    {schemaVersion:2,lifecycleStatus:"STAGED",rollbackStage:"SNAPSHOT_CAPTURED",dbAttemptStaged:false,
     attemptId:$attempt,candidateId:$attempt,sourceCommit:$source,baseCommit:$base,
     runtimeIdentityHash:null,terminalReason:null,stagedAt:"2026-08-12T09:00:00Z",terminalAt:null,
     rollback:{snapshotId:"snapshot-reconciler",snapshotDir:"/opt/resonance-data/deploy/full-screen-deploy-gate/snapshots/snapshot-reconciler",
       snapshotManifestSha256:$sha,runtimeImageRef:"registry.invalid/carbonet:baseline",runtimeImageId:$imageId,
       deploymentUid:"deployment-uid",deploymentGeneration:7,deploymentAnnotationsSha256:$sha,podTemplateSha256:$sha,
       appliedMarkerCommit:$base,appliedMarkerSha256:$sha,runtimeMarkerCommit:$base,runtimeMarkerSha256:$sha}}' |
    python3 "$JOURNAL_HELPER" --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" stage >/dev/null
  if [[ "$db_staged" == true ]]; then
    python3 "$JOURNAL_HELPER" --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" \
      mark-db-staged "$candidate" "$source_commit" >/dev/null
  fi
  printf '{}\n' >"$RUNTIME_CANDIDATE_CHECKPOINT_FILE"
  postdeploy_candidate_promoted=false
  postdeploy_db_attempt_staged="$db_staged"
  postdeploy_rollback_restored=false
}

event() { printf '%s\n' "$1" >>"$EVENTS"; }
maybe_fail_once() {
  local point="$1" marker="$tmp/fault-${SCENARIO}-${point}"
  if [[ "${FAULT_POINT:-}" == "$point" && ! -e "$marker" ]]; then
    : >"$marker"; event "${point}_FAULT"; return 1
  fi
}
postdeploy_authoritative_promotion_status() {
  event AUTHORITY
  local value="${AUTH_SEQUENCE%%,*}"
  if [[ "$AUTH_SEQUENCE" == *,* ]]; then AUTH_SEQUENCE="${AUTH_SEQUENCE#*,}"; fi
  if [[ "$value" == 0 ]]; then
    POSTDEPLOY_AUTHORITY_OUTCOME="${AUTH_SUCCESS_OUTCOME:-PROMOTED}"
  elif [[ "$value" == 3 ]]; then
    POSTDEPLOY_AUTHORITY_OUTCOME=ABORTED
  else
    POSTDEPLOY_AUTHORITY_OUTCOME=UNKNOWN
  fi
  return "$value"
}
current_runtime_identity_hash() { printf '%s\n' "$EXPECTED_RUNTIME_HASH"; }
abort_postdeploy_release_attempt_db() {
  event DB_ABORTED
  [[ "${ABORT_RACE:-false}" != true ]] || return 55
}
transition_postdeploy_attempt_journal() {
  local status="$1" hash="$2" reason="$3"
  event "JOURNAL_${status}"
  python3 "$JOURNAL_HELPER" --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" transition \
    "$status" "$candidate" "$source_commit" "$hash" "$reason" >/dev/null
}
advance_postdeploy_rollback_stage() {
  python3 "$JOURNAL_HELPER" --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" advance-rollback \
    "$candidate" "$source_commit" "$1" "$2" >/dev/null
}
cancel_pre_runtime_postdeploy_attempt_journal() {
  event JOURNAL_PRE_RUNTIME_ABORTED
  python3 "$JOURNAL_HELPER" --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" cancel-pre-runtime \
    "$candidate" "$source_commit" >/dev/null
}
stage_postdeploy_release_attempt_db() {
  event DB_STAGE_RETRY
  [[ "${MIGRATION_ABSENT:-false}" != true ]] || return 3
  python3 "$JOURNAL_HELPER" --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" mark-db-staged \
    "$candidate" "$source_commit" >/dev/null
}
record_runtime_release_state() { event LEDGER; maybe_fail_once LEDGER; }
verify_operational_usage_ledger_current_runtime_identity() { event LEDGER_VERIFY; return 0; }
run_runtime_candidate_checkpoint() { event CHECKPOINT; maybe_fail_once CHECKPOINT || return; rm -f -- "$RUNTIME_CANDIDATE_CHECKPOINT_FILE"; }
archive_postdeploy_attempt_journal_terminal() {
  event ARCHIVE; maybe_fail_once ARCHIVE || return
  if [[ "$1" == ABORTED && "${AUTH_SUCCESS_OUTCOME:-}" == PROMOTED_RECONCILED ]]; then
    rm -f -- "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE"
  fi
}
write_postdeploy_promotion_quarantine() { event QUARANTINE; }
retire_matching_runtime_quarantine() { event QUARANTINE_RETIRE; rm -f -- "$RUNTIME_LEDGER_QUARANTINE_FILE"; }
write_runtime_deploy_state() { event RUNTIME_MARKER; printf '%s\n' "$1" >"$RUNTIME_DEPLOY_STATE_FILE"; }
write_applied_deploy_state() { event APPLIED_MARKER; printf '%s\n' "$1" >"$DEPLOY_STATE_FILE"; }
bash() {
  local action="${!#}"
  case "$action" in
    restore-physical) event PHYSICAL; maybe_fail_once PHYSICAL ;;
    verify-restored-physical) event PHYSICAL_VERIFY ;;
    restore-markers) event MARKERS; maybe_fail_once MARKERS ;;
    verify-markers) event MARKERS_VERIFY ;;
    finalize-failed) event RETIRE; maybe_fail_once RETIRE ;;
    finalize-success)
      [[ "${FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID:-}" == snapshot-reconciler \
         && "${FULL_SCREEN_GATE_EXPECTED_MANIFEST_SHA256:-}" == "$sha" \
         && "${FULL_SCREEN_GATE_EXPECTED_BASELINE_SOURCE_COMMIT:-}" == "$baseline" ]] || return 79
      event DISARM
      ;;
    describe) jq -cn --arg snapshotId snapshot-reconciler --arg snapshotDir "$tmp/snapshot" \
      --arg sourceCommit "$FIXTURE_BASELINE" --arg snapshotManifestSha256 "$sha" \
      '{schemaVersion:2,snapshotId:$snapshotId,snapshotDir:$snapshotDir,
        sourceCommit:$sourceCommit,snapshotManifestSha256:$snapshotManifestSha256}' ;;
    *) /usr/bin/bash "$@" ;;
  esac
}

assert_order() {
  python3 - "$EVENTS" "$@" <<'PY'
from pathlib import Path
import sys
events=Path(sys.argv[1]).read_text().splitlines()
position=-1
for expected in sys.argv[2:]:
    position=events.index(expected,position+1)
PY
}

run_fault_scenario() {
  SCENARIO="$1"; FAULT_POINT="$1"; AUTH_SEQUENCE=1; AUTH_SUCCESS_OUTCOME=PROMOTED; ABORT_RACE=false; MIGRATION_ABSENT=false
  EVENTS="$tmp/events-$SCENARIO"; : >"$EVENTS"; new_journal true
  local first=0 second=0
  recover_staged_postdeploy_attempt_after_failure || first=$?
  [[ "$first" == 79 && -s "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" ]]
  FAULT_POINT=""
  recover_staged_postdeploy_attempt_after_failure || second=$?
  [[ "$second" == 0 && ! -e "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" ]]
  assert_order AUTHORITY DB_ABORTED JOURNAL_ABORTED PHYSICAL LEDGER MARKERS CHECKPOINT ARCHIVE RETIRE
}

for point in PHYSICAL LEDGER MARKERS CHECKPOINT ARCHIVE RETIRE; do run_fault_scenario "$point"; done

# Promotion wins after the initial NOT_PROMOTED read but before abort obtains
# the shared advisory lock: the reconciler must publish PROMOTED and restore 0.
SCENARIO=promotion-race; EVENTS="$tmp/events-$SCENARIO"; : >"$EVENTS"; new_journal true
AUTH_SEQUENCE='1,0'; AUTH_SUCCESS_OUTCOME=PROMOTED; ABORT_RACE=true; MIGRATION_ABSENT=false; FAULT_POINT=""
recover_staged_postdeploy_attempt_after_failure
grep -Fxq JOURNAL_PROMOTED "$EVENTS"
! grep -Fxq PHYSICAL "$EVENTS"
python3 "$JOURNAL_HELPER" --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" read | jq -e \
  '.lifecycleStatus=="PROMOTED" and .rollbackStage=="DISARMED"' >/dev/null

# The same COMMIT cut may be discovered through the persistent STAGED entry.
# The local transition alone is insufficient: exact journal-bound snapshot
# success evidence must be verified before generic marker recovery is allowed.
SCENARIO=persistent-staged-promoted; EVENTS="$tmp/events-$SCENARIO"; : >"$EVENTS"; new_journal true
AUTH_SEQUENCE='0,0'; AUTH_SUCCESS_OUTCOME=PROMOTED; ABORT_RACE=false; MIGRATION_ABSENT=false
deployed_commit="$baseline"
persistent_status=0; recover_persistent_postdeploy_attempt || persistent_status=$?
[[ "$persistent_status" == 2 ]]
assert_order JOURNAL_PROMOTED LEDGER_VERIFY DISARM
! grep -Fxq PHYSICAL "$EVENTS"

# UNKNOWN never authorizes either DB abort or a physical mutation.
SCENARIO=unknown; EVENTS="$tmp/events-$SCENARIO"; : >"$EVENTS"; new_journal true
AUTH_SEQUENCE=2; ABORT_RACE=true
unknown_status=0; recover_staged_postdeploy_attempt_after_failure || unknown_status=$?
[[ "$unknown_status" == 79 ]]
! grep -Eq '^(DB_ABORTED|PHYSICAL)$' "$EVENTS"

# DB ABORT committed, then SIGKILL happened before the local journal rename.
# Exact idempotent abort replay proves DB authority and resumes one restore.
SCENARIO=abort-commit-crash; EVENTS="$tmp/events-$SCENARIO"; : >"$EVENTS"; new_journal true
AUTH_SEQUENCE=2; ABORT_RACE=false; MIGRATION_ABSENT=false
recover_staged_postdeploy_attempt_after_failure
[[ "$(grep -c '^PHYSICAL$' "$EVENTS")" == 1 ]]
[[ "$(grep -c '^DB_ABORTED$' "$EVENTS")" -ge 2 ]]
[[ ! -e "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" ]]

# SIGKILL after versioned active.env publish but before journal stage has
# mutation0. Exact baseline physical/marker/ledger proof retires the orphan
# pointer without DB abort or restore writers.
SCENARIO=orphan-capture; EVENTS="$tmp/events-$SCENARIO"; : >"$EVENTS"
rm -f -- "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" "$RUNTIME_CANDIDATE_CHECKPOINT_FILE"
FULL_SCREEN_GATE_STATE_DIR="$tmp/gate-state"
mkdir -p "$FULL_SCREEN_GATE_STATE_DIR"
printf 'fixture\n' >"$FULL_SCREEN_GATE_STATE_DIR/active.env"
retire_orphan_versioned_snapshot
assert_order PHYSICAL_VERIFY MARKERS_VERIFY LEDGER_VERIFY RETIRE
! grep -Eq '^(DB_ABORTED|PHYSICAL|MARKERS)$' "$EVENTS"

# Lifecycle migration absent is safe only for the unarmed, observe-only
# first-upgrade path. It cancels PRE_RUNTIME_FAILURE with physical mutation 0.
SCENARIO=pre-runtime; EVENTS="$tmp/events-$SCENARIO"; : >"$EVENTS"; new_journal false
AUTH_SEQUENCE=2; MIGRATION_ABSENT=true; ABORT_RACE=false
recover_staged_postdeploy_attempt_after_failure
grep -Fxq JOURNAL_PRE_RUNTIME_ABORTED "$EVENTS"
! grep -Eq '^(DB_ABORTED|PHYSICAL|LEDGER|MARKERS)$' "$EVENTS"
[[ ! -e "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" ]]

# DB STAGED may commit before the helper's local mark-db-staged rename. The
# next recovery replays exact DB stage, arms the same journal, and only then
# permits abort/physical convergence.
SCENARIO=db-stage-commit-journal-cut; EVENTS="$tmp/events-$SCENARIO"; : >"$EVENTS"; new_journal false
AUTH_SEQUENCE=1; AUTH_SUCCESS_OUTCOME=PROMOTED; MIGRATION_ABSENT=false; ABORT_RACE=false
recover_staged_postdeploy_attempt_after_failure
assert_order DB_STAGE_RETRY AUTHORITY DB_ABORTED JOURNAL_ABORTED PHYSICAL LEDGER MARKERS CHECKPOINT ARCHIVE RETIRE
[[ ! -e "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" ]]

# An exact local ABORTED journal is never sufficient by itself. If DB
# reconfirmation fails, physical state remains untouched and the journal stays.
SCENARIO=aborted-reconfirm-fails; EVENTS="$tmp/events-$SCENARIO"; : >"$EVENTS"; new_journal true
python3 "$JOURNAL_HELPER" --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" transition \
  ABORTED "$candidate" "$source_commit" - DEPLOYMENT_FAILED >/dev/null
AUTH_SEQUENCE=3; AUTH_SUCCESS_OUTCOME=PROMOTED; ABORT_RACE=true; MIGRATION_ABSENT=false
aborted_status=0; recover_staged_postdeploy_attempt_after_failure || aborted_status=$?
[[ "$aborted_status" == 79 && -s "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" ]]
! grep -Fxq PHYSICAL "$EVENTS"

# A different candidate retry may reconcile to the one canonical promotion for
# the same source. The requested DB/journal attempt remains truthfully ABORTED
# and DISARMED; canonical traffic and evidence are never rolled back.
DEPLOY_STATE_FILE="$tmp/applied.commit"
RUNTIME_DEPLOY_STATE_FILE="$tmp/runtime.commit"
printf '%s\n' "$source_commit" >"$DEPLOY_STATE_FILE"
printf '%s\n' "$source_commit" >"$RUNTIME_DEPLOY_STATE_FILE"
SCENARIO=reconciled-retry; EVENTS="$tmp/events-$SCENARIO"; : >"$EVENTS"; new_journal true
AUTH_SEQUENCE=0; AUTH_SUCCESS_OUTCOME=PROMOTED_RECONCILED; ABORT_RACE=false; MIGRATION_ABSENT=false
recover_staged_postdeploy_attempt_after_failure
grep -Fxq JOURNAL_ABORTED "$EVENTS"
grep -Fxq DISARM "$EVENTS"
! grep -Fxq PHYSICAL "$EVENTS"
[[ ! -e "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" ]]
assert_order DISARM QUARANTINE_RETIRE CHECKPOINT ARCHIVE

# Crash after the truthful reconciled journal transition/disarm resumes from
# ABORTED+DISARMED with exact DB authority and still performs restore 0.
SCENARIO=reconciled-resume; EVENTS="$tmp/events-$SCENARIO"; : >"$EVENTS"; new_journal true
python3 "$JOURNAL_HELPER" --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" transition \
  ABORTED "$candidate" "$source_commit" "$EXPECTED_RUNTIME_HASH" \
  RECONCILED_TO_EXISTING_SOURCE_PROMOTION >/dev/null
AUTH_SEQUENCE=0; AUTH_SUCCESS_OUTCOME=PROMOTED_RECONCILED
recover_staged_postdeploy_attempt_after_failure
grep -Fxq DISARM "$EVENTS"
! grep -Fxq PHYSICAL "$EVENTS"
[[ ! -e "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" ]]
assert_order DISARM QUARANTINE_RETIRE CHECKPOINT ARCHIVE

echo '[durable-rollback-reconciler-test] PASS order=authority-dbCAS-journal-physical-ledger-markers-checkpoint-archive-retire faults=6 restartConvergence=true dbStageCommitJournalCut=replayed abortCommitCrash=converged stagedPromotionSnapshotBinding=exact reconciledQuarantineBeforeArchive=true abortedDbReconfirm=required promotionRaceRestore=0 reconciledRetryRestore=0 unknownMutation=0 migrationAbsentPreRuntimeMutation=0'
