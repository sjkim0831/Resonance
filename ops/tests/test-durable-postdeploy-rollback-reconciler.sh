#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
AUTO="$ROOT/ops/scripts/auto-deploy-main.sh"
JOURNAL_HELPER="$ROOT/ops/scripts/postdeploy-attempt-journal.py"
POSTDEPLOY_JOURNAL_HELPER="$JOURNAL_HELPER"
POSTDEPLOY_GATE_SCRIPT="$ROOT/ops/scripts/resonance-full-screen-deploy-gate.sh"
RECORD_RUNTIME="$ROOT/ops/scripts/record-runtime-release-state.sh"
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

python3 - "$AUTO" "$tmp/resolve-leader-function.sh" <<'PY'
from pathlib import Path
import sys
text=Path(sys.argv[1]).read_text(encoding="utf-8")
start=text.index("resolve_postdeploy_postgres_pod() {")
end=text.index("\n}\n",start)+3
Path(sys.argv[2]).write_text(text[start:end],encoding="utf-8")
PY
# shellcheck disable=SC1090
source "$tmp/resolve-leader-function.sh"
cat >"$tmp/leader-resolver.sh" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "${K8S_NAMESPACE:-}" >"${LEADER_NAMESPACE_RECORD:?}"
[[ "${LEADER_RESOLVER_FAIL:-false}" != true ]] || exit 1
printf '%s\n' postgres-patroni-2
SH
chmod 0755 "$tmp/leader-resolver.sh"
NAMESPACE=recovery-ns
POSTDEPLOY_LEADER_RESOLVER="$tmp/leader-resolver.sh"
POSTGRES_POD=""
LEADER_NAMESPACE_RECORD="$tmp/leader-namespace" resolve_postdeploy_postgres_pod
[[ "$POSTGRES_POD" == postgres-patroni-2 ]]
[[ "$(cat "$tmp/leader-namespace")" == recovery-ns ]]
POSTGRES_POD=""
leader_failure=0
LEADER_RESOLVER_FAIL=true \
  LEADER_NAMESPACE_RECORD="$tmp/leader-namespace" \
  resolve_postdeploy_postgres_pod || leader_failure=$?
[[ "$leader_failure" == 1 && -z "$POSTGRES_POD" ]]

python3 - "$AUTO" "$tmp/attempt-quarantine-functions.sh" <<'PY'
from pathlib import Path
import sys
text=Path(sys.argv[1]).read_text(encoding="utf-8")
names=["defer_exact_durable_attempt_recovery_quarantine","retire_matching_runtime_quarantine"]
out=[]
for name in names:
    start=text.index(name+"() {")
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
                out.append(text[start:j+1]+"\n")
                break
Path(sys.argv[2]).write_text("\n".join(out),encoding="utf-8")
PY
(
  source "$tmp/attempt-quarantine-functions.sh"
  qdir="$tmp/attempt-quarantine"
  mkdir -p "$qdir/retired"
  chmod 0700 "$qdir"
  POSTDEPLOY_ATTEMPT_JOURNAL_FILE="$qdir/attempt.json"
  POSTDEPLOY_JOURNAL_HELPER="$JOURNAL_HELPER"
  RUNTIME_LEDGER_QUARANTINE_FILE="$qdir/quarantine.state"
  POSTDEPLOY_LEGACY_RETIRE_DIR="$qdir/retired"
  qcandidate='postdeploy:test:quarantine:123456'
  qsource='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  qbase='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  qsha='cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
  qimage='docker-pullable://registry.invalid/carbonet@sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
  jq -cn --arg attempt "$qcandidate" --arg source "$qsource" --arg base "$qbase" \
    --arg sha "$qsha" --arg imageId "$qimage" '
    {schemaVersion:2,lifecycleStatus:"STAGED",rollbackStage:"SNAPSHOT_CAPTURED",dbAttemptStaged:false,
     attemptId:$attempt,candidateId:$attempt,sourceCommit:$source,baseCommit:$base,
     runtimeIdentityHash:null,terminalReason:null,stagedAt:"2026-08-12T09:00:00Z",terminalAt:null,
     rollback:{snapshotId:"quarantine-fixture",snapshotDir:"/opt/resonance-data/deploy/full-screen-deploy-gate/snapshots/quarantine-fixture",
       snapshotManifestSha256:$sha,runtimeImageRef:"registry.invalid/baseline",runtimeImageId:$imageId,
       deploymentUid:"uid",deploymentGeneration:1,deploymentAnnotationsSha256:$sha,podTemplateSha256:$sha,
       appliedMarkerCommit:$base,appliedMarkerSha256:$sha,runtimeMarkerCommit:$base,runtimeMarkerSha256:$sha}}' |
    python3 "$JOURNAL_HELPER" --file "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE" stage >/dev/null
  write_attempt_quarantine() {
    local reason="$1" candidate_id="${2:-$qcandidate}"
    printf 'schemaVersion=1\ntargetCommit=%s\ncandidateId=%s\nreason=%s\nobservedAppliedMarker=%s\nobservedRuntimeMarker=%s\n' \
      "$qsource" "$candidate_id" "$reason" "$qbase" "$qbase" >"$RUNTIME_LEDGER_QUARANTINE_FILE"
    chmod 0600 "$RUNTIME_LEDGER_QUARANTINE_FILE"
  }
  write_attempt_quarantine WRONG_REASON
  ! defer_exact_durable_attempt_recovery_quarantine
  write_attempt_quarantine ATTEMPT_DB_STAGE_UNAVAILABLE wrong-candidate
  ! defer_exact_durable_attempt_recovery_quarantine
  write_attempt_quarantine ATTEMPT_DB_STAGE_UNAVAILABLE
  printf 'extra=bad\n' >>"$RUNTIME_LEDGER_QUARANTINE_FILE"
  ! defer_exact_durable_attempt_recovery_quarantine
  write_attempt_quarantine ATTEMPT_DB_STAGE_UNAVAILABLE
  defer_exact_durable_attempt_recovery_quarantine
  pinned_hash="$attempt_recovery_quarantine_hash"
  write_attempt_quarantine PROMOTION_DB_CHECK_UNAVAILABLE
  drift_hash="$(sha256sum "$RUNTIME_LEDGER_QUARANTINE_FILE" | awk '{print $1}')"
  [[ "$drift_hash" != "$pinned_hash" ]]
  ! retire_matching_runtime_quarantine "$qcandidate" "$qsource"
  [[ -f "$RUNTIME_LEDGER_QUARANTINE_FILE" ]]
  write_attempt_quarantine ATTEMPT_DB_STAGE_UNAVAILABLE
  [[ "$(sha256sum "$RUNTIME_LEDGER_QUARANTINE_FILE" | awk '{print $1}')" == "$pinned_hash" ]]
  retire_matching_runtime_quarantine "$qcandidate" "$qsource"
  [[ ! -e "$RUNTIME_LEDGER_QUARANTINE_FILE" ]]
  [[ -f "$POSTDEPLOY_LEGACY_RETIRE_DIR/${qcandidate}.recovery-quarantine.state" ]]
)
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

# Legacy first-upgrade checkpoint evidence may live under the persistent build
# worktree even when bootstrap ROOT still points at /opt/Resonance. Exercise
# exact path ownership, stale-ledger blocking, false-quarantine reachability,
# and a crash immediately before the quarantine-last retirement cut.
python3 - "$AUTO" "$tmp/legacy-functions.sh" <<'PY'
from pathlib import Path
import sys
text=Path(sys.argv[1]).read_text(encoding="utf-8")
names=["rebind_default_postdeploy_helpers","defer_exact_legacy_false_discovery_quarantine",
       "legacy_owned_runtime_projection_hash","legacy_overlay_tree_hash","legacy_live_nginx_hash",
       "postdeploy_source_has_no_attempt_or_promotion_rows","resolve_legacy_full_screen_gate_state_dir",
       "retire_legacy_partial_runtime_attempt"]
out=[]
for name in names:
    start=text.index(name+"() {")
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
                out.append(text[start:j+1]+"\n")
                break
    else: raise SystemExit(f"function end not found: {name}")
Path(sys.argv[2]).write_text("\n".join(out),encoding="utf-8")
PY

# A checkpoint written by `prepare` has no live runtime or rollback evidence.
# Treat only its exact helper-owned shape as non-legacy so normal checkpoint
# preparation can atomically replace it for the new target. Malformed, READY,
# or evidence-bearing states remain fail-closed.
(
  # shellcheck disable=SC1090
  source "$tmp/legacy-functions.sh"
  prepared="$tmp/prepared-checkpoint-resolver"
  RUNTIME_CANDIDATE_CHECKPOINT_FILE="$prepared/checkpoint.json"
  POSTDEPLOY_ATTEMPT_JOURNAL_FILE="$prepared/no-journal.json"
  POSTDEPLOY_LEGACY_RETIRE_DIR="$prepared/retired"
  RUNTIME_LEDGER_QUARANTINE_FILE="$prepared/no-quarantine.state"
  LEGACY_FULL_SCREEN_GATE_STATE_DIR="$prepared/configured-gate"
  CARBONET_CLEAN_WORKTREE_BASE="$prepared/worktrees"
  CARBONET_DEPLOY_ORIGINAL_ROOT="$prepared/bootstrap"
  ROOT_DIR="$prepared/worktrees/runtime-build"
  FULL_SCREEN_GATE_STATE_DIR="$prepared/current-gate"
  persistent_gate="$CARBONET_CLEAN_WORKTREE_BASE/runtime-build/var/run/full-screen-deploy-gate"
  mkdir -p "$POSTDEPLOY_LEGACY_RETIRE_DIR" "$LEGACY_FULL_SCREEN_GATE_STATE_DIR" \
    "$persistent_gate" "$FULL_SCREEN_GATE_STATE_DIR"
  write_prepared_checkpoint() {
    jq -n '
      {schemaVersion:1,stage:"PREPARED",
       baseCommit:("0"*40),targetCommit:("1"*40),
       planFingerprint:("a"*64),migrationRequired:true,
       migrationFingerprint:("b"*64),preparedAt:"2026-08-12T12:47:12+09:00"}
    ' >"$RUNTIME_CANDIDATE_CHECKPOINT_FILE"
    chmod 0644 "$RUNTIME_CANDIDATE_CHECKPOINT_FILE"
  }
  resolver_status=0
  write_prepared_checkpoint
  resolve_legacy_full_screen_gate_state_dir || resolver_status=$?
  [[ "$resolver_status" == 1 ]]

  jq '.unexpected=true' "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" >"${RUNTIME_CANDIDATE_CHECKPOINT_FILE}.tmp"
  mv -fT -- "${RUNTIME_CANDIDATE_CHECKPOINT_FILE}.tmp" "$RUNTIME_CANDIDATE_CHECKPOINT_FILE"
  resolver_status=0; resolve_legacy_full_screen_gate_state_dir || resolver_status=$?
  [[ "$resolver_status" == 79 ]]

  write_prepared_checkpoint
  jq '.stage="RUNTIME_CANDIDATE_READY"' "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" >"${RUNTIME_CANDIDATE_CHECKPOINT_FILE}.tmp"
  mv -fT -- "${RUNTIME_CANDIDATE_CHECKPOINT_FILE}.tmp" "$RUNTIME_CANDIDATE_CHECKPOINT_FILE"
  resolver_status=0; resolve_legacy_full_screen_gate_state_dir || resolver_status=$?
  [[ "$resolver_status" == 79 ]]

  write_prepared_checkpoint
  printf 'unexpected-active\n' >"$persistent_gate/active.env"
  resolver_status=0; resolve_legacy_full_screen_gate_state_dir || resolver_status=$?
  [[ "$resolver_status" == 79 ]]
  rm -f -- "$persistent_gate/active.env"

  printf '{}\n' >"$POSTDEPLOY_ATTEMPT_JOURNAL_FILE"
  resolver_status=0; resolve_legacy_full_screen_gate_state_dir || resolver_status=$?
  [[ "$resolver_status" == 79 ]]
  rm -f -- "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE"
  printf 'reason=unexpected\n' >"$RUNTIME_LEDGER_QUARANTINE_FILE"
  resolver_status=0; resolve_legacy_full_screen_gate_state_dir || resolver_status=$?
  [[ "$resolver_status" == 79 ]]
  rm -f -- "$RUNTIME_LEDGER_QUARANTINE_FILE"

  chmod 0600 "$RUNTIME_CANDIDATE_CHECKPOINT_FILE"
  resolver_status=0; resolve_legacy_full_screen_gate_state_dir || resolver_status=$?
  [[ "$resolver_status" == 79 ]]
)

(
  # shellcheck disable=SC1090
  source "$tmp/legacy-functions.sh"
  legacy="$tmp/legacy"
  baseline='0000000000000000000000000000000000000000'
  old_candidate='1111111111111111111111111111111111111111'
  retry_target='5555555555555555555555555555555555555555'
  snapshot_id='snapshot-legacy-path'
  gate="$legacy/worktrees/runtime-build/var/run/full-screen-deploy-gate"
  snapshot="$gate/snapshots/$snapshot_id"
  live_frontend_overlay="$legacy/live-overlay"
  mkdir -p "$snapshot/frontend-overlay" "$live_frontend_overlay" "$legacy/retired"
  printf 'baseline-index\n' >"$snapshot/frontend-overlay/index.html"
  printf 'baseline-index\n' >"$live_frontend_overlay/index.html"
  printf 'nginx-baseline\n' >"$snapshot/nginx.conf"
  cat >"$gate/active.env" <<EOF
SNAPSHOT_ID='$snapshot_id'
SNAPSHOT_DIR='$snapshot'
SNAPSHOT_FORMAT='hardlink-tree'
RUNTIME_IMAGE='registry.invalid/carbonet:baseline'
WEB_IMAGE='nginx:baseline'
GIT_SHA='$baseline'
BASELINE_SOURCE_COMMIT='$baseline'
EOF
  chmod 0600 "$gate/active.env"
  active_hash="$(sha256sum "$gate/active.env" | awk '{print $1}')"
  RUNTIME_CANDIDATE_CHECKPOINT_FILE="$legacy/checkpoint.json"
  jq -n --arg base "$baseline" --arg target "$old_candidate" --arg snapshot "$snapshot_id" \
    --arg dir "$snapshot" --arg active "$active_hash" '
    {schemaVersion:1,stage:"RUNTIME_CANDIDATE_READY",baseCommit:$base,targetCommit:$target,
     planFingerprint:("a"*64),migrationRequired:true,migrationFingerprint:("b"*64),
     preparedAt:"2026-08-12T00:00:00Z",imageRef:"registry.invalid/carbonet:candidate",
     releaseId:"release-legacy",deploymentUid:"deployment-uid",deploymentGeneration:7,
     desiredReplicas:2,imageIdDigest:("sha256:"+("c"*64)),snapshotId:$snapshot,snapshotDir:$dir,
     activeFileSha256:$active,assetManifestSha256:("d"*64),migrationEvidenceSha256:("e"*64),
     verifiedAt:"2026-08-12T00:01:00Z"}' >"$RUNTIME_CANDIDATE_CHECKPOINT_FILE"
  chmod 0644 "$RUNTIME_CANDIDATE_CHECKPOINT_FILE"

  DEPLOY_STATE_FILE="$legacy/applied.commit"
  RUNTIME_DEPLOY_STATE_FILE="$legacy/runtime.commit"
  POSTDEPLOY_ATTEMPT_JOURNAL_FILE="$legacy/no-journal.json"
  POSTDEPLOY_LEGACY_RETIRE_DIR="$legacy/retired"
  RUNTIME_LEDGER_QUARANTINE_FILE="$legacy/runtime-ledger.quarantine"
  LEGACY_FULL_SCREEN_GATE_STATE_DIR="$legacy/wrong-root"
  CARBONET_CLEAN_WORKTREE_BASE="$legacy/worktrees"
  CARBONET_DEPLOY_ORIGINAL_ROOT="$legacy/bootstrap"
  ROOT_DIR="$legacy/worktrees/runtime-build"
  NAMESPACE=carbonet-prod DEPLOYMENT=carbonet-runtime POSTGRES_POD=postgres-patroni-0 POSTGRES_CONTAINER=patroni POSTGRES_USER=postgres POSTGRES_DB=carbonet
  target_commit="$retry_target" runtime_deployed_commit="$baseline"
  printf '%s\n' "$baseline" >"$DEPLOY_STATE_FILE"
  printf '%s\n' "$baseline" >"$RUNTIME_DEPLOY_STATE_FILE"
  cat >"$legacy/deployment.json" <<EOF
{"metadata":{"uid":"deployment-uid","generation":9,"annotations":{"resonance.ai/target-commit":"$baseline"}},"spec":{"replicas":2,"minReadySeconds":10,"progressDeadlineSeconds":300,"strategy":{"type":"RollingUpdate"},"selector":{"matchLabels":{"app":"carbonet-runtime"}},"template":{"metadata":{"labels":{"app":"carbonet-runtime"}},"spec":{"containers":[{"name":"carbonet-runtime","image":"registry.invalid/carbonet:baseline"}]}}}}
EOF
  write_quarantine() {
    local qcandidate="${1:-postdeploy:${retry_target:0:12}:20260812T000000000000000:123:456}"
    local reason="${2:-LEGACY_PARTIAL_STATE_CONTRACT_INVALID}"
    cat >"$RUNTIME_LEDGER_QUARANTINE_FILE" <<EOF
schemaVersion=1
targetCommit=$retry_target
candidateId=$qcandidate
reason=$reason
observedAppliedMarker=$baseline
observedRuntimeMarker=$baseline
EOF
    chmod 0600 "$RUNTIME_LEDGER_QUARANTINE_FILE"
  }
  kubectl() {
    case "$*" in
      *"get deployment/carbonet-runtime"*) cat "$legacy/deployment.json" ;;
      *"get configmap carbonet-web-nginx"*) printf 'nginx-baseline\n' ;;
      *) return 1 ;;
    esac
  }
  postdeploy_authoritative_promotion_status() { return "${AUTHORITY_STATUS:-1}"; }
  postdeploy_source_has_no_attempt_or_promotion_rows() { [[ "${DB_ABSENCE_EXACT:-true}" == true ]]; }
  verify_operational_usage_ledger_current_runtime_identity() { [[ "${LEDGER_EXACT:-true}" == true ]]; }
  write_postdeploy_promotion_quarantine() { :; }

  write_quarantine "postdeploy:ffffffffffff:bad-source"; ! defer_exact_legacy_false_discovery_quarantine
  write_quarantine "postdeploy:${retry_target:0:12}:20260812T000000000000000:123:456" WRONG_REASON
  ! defer_exact_legacy_false_discovery_quarantine
  write_quarantine
  defer_exact_legacy_false_discovery_quarantine
  resolve_legacy_full_screen_gate_state_dir
  [[ "$LEGACY_FULL_SCREEN_GATE_STATE_DIR" == "$gate" ]]

  chmod 0600 "$RUNTIME_CANDIDATE_CHECKPOINT_FILE"
  bad_mode_status=0; retire_legacy_partial_runtime_attempt || bad_mode_status=$?
  [[ "$bad_mode_status" == 79 && -f "$gate/active.env" && -f "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" ]]
  chmod 0644 "$RUNTIME_CANDIDATE_CHECKPOINT_FILE"
  LEDGER_EXACT=false
  stale_status=0; retire_legacy_partial_runtime_attempt || stale_status=$?
  [[ "$stale_status" == 79 && -f "$gate/active.env" && -f "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" ]]
  LEDGER_EXACT=true DB_ABSENCE_EXACT=false
  db_unknown_status=0; retire_legacy_partial_runtime_attempt || db_unknown_status=$?
  [[ "$db_unknown_status" == 79 && -f "$gate/active.env" ]]
  DB_ABSENCE_EXACT=true

  quarantine_destination="$POSTDEPLOY_LEGACY_RETIRE_DIR/$(sed -n 's/^candidateId=//p' "$RUNTIME_LEDGER_QUARANTINE_FILE").legacy-false-discovery-quarantine.state"
  mv() {
    local destination="${!#}"
    if [[ "$destination" == "$quarantine_destination" && ! -e "$legacy/quarantine-move-faulted" ]]; then
      : >"$legacy/quarantine-move-faulted"
      return 1
    fi
    command mv "$@"
  }
  crash_status=0; retire_legacy_partial_runtime_attempt || crash_status=$?
  [[ "$crash_status" == 79 && ! -e "$gate/active.env" && ! -e "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" \
     && -f "$RUNTIME_LEDGER_QUARANTINE_FILE" && -f "$POSTDEPLOY_LEGACY_RETIRE_DIR/${old_candidate}.legacy-retired.json" \
     && -f "$POSTDEPLOY_LEGACY_RETIRE_DIR/legacy-retire.intent.json" ]]
  resolve_legacy_full_screen_gate_state_dir
  retire_legacy_partial_runtime_attempt
  [[ ! -e "$RUNTIME_LEDGER_QUARANTINE_FILE" && -f "$quarantine_destination" \
     && -f "$POSTDEPLOY_LEGACY_RETIRE_DIR/${old_candidate}.legacy-retire.completed.json" ]]
)

# Observe-only ledger reconciliation is an uninterrupted UPSERT transaction:
# no pre-health DELETE, and post-transaction K8s drift invalidates the new row.
record_fixture="$tmp/record-runtime"
mkdir -p "$record_fixture"
cat >"$record_fixture/kubectl" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
args="$*"
if [[ "$args" == *" get deployment/carbonet-runtime -o json"* ]]; then
  count="$(cat "$FAKE_GET_COUNT" 2>/dev/null || printf 0)"; count=$((count + 1)); printf '%s\n' "$count" >"$FAKE_GET_COUNT"
  generation=9
  [[ "${FAKE_DRIFT_AFTER:-0}" != "$count" ]] || generation=10
  sed "s/__GENERATION__/$generation/g" "$FAKE_DEPLOYMENT_JSON"
elif [[ "$args" == *" get pods "* ]]; then
  cat "$FAKE_PODS_JSON"
elif [[ "$args" == *" curl -fsS "* ]]; then
  printf '{"status":"UP"}\n'
elif [[ "$args" == *" psql "* ]]; then
  sql="$(cat)"
  printf '%s\n--CALL--\n' "$sql" >>"$FAKE_SQL_LOG"
  if [[ "$sql" == *"to_regclass('public.framework_runtime_release_state')"* ]]; then
    printf 'framework_runtime_release_state\n'
  elif [[ "$sql" == *"insert into framework_runtime_release_state"* ]]; then
    printf '1\n' >"$FAKE_LEDGER_STATE"
  elif [[ "$sql" == *"jsonb_build_object"* ]]; then
    [[ "$(cat "$FAKE_LEDGER_STATE" 2>/dev/null || printf 0)" != 1 ]] || cat "$FAKE_RECORDED_JSON"
  elif [[ "$sql" == *"delete from framework_runtime_release_state"* ]]; then
    printf '0\n' >"$FAKE_LEDGER_STATE"
  elif [[ "$sql" == *"select count(*) from framework_runtime_release_state"* ]]; then
    cat "$FAKE_LEDGER_STATE" 2>/dev/null || printf '0\n'
  fi
else
  printf 'unexpected fake kubectl args: %s\n' "$args" >&2
  exit 9
fi
SH
chmod +x "$record_fixture/kubectl"
cat >"$record_fixture/deployment.json" <<'JSON'
{"metadata":{"resourceVersion":"rv-9","uid":"deployment-uid","generation":__GENERATION__,"annotations":{"resonance.ai/target-commit":"0000000000000000000000000000000000000000"}},"spec":{"replicas":2,"selector":{"matchLabels":{"app":"carbonet-runtime"}},"template":{"spec":{"containers":[{"name":"carbonet-runtime","image":"registry.invalid/carbonet:baseline"}]}}},"status":{"observedGeneration":__GENERATION__,"updatedReplicas":2,"readyReplicas":2,"availableReplicas":2,"unavailableReplicas":0}}
JSON
cat >"$record_fixture/pods.json" <<'JSON'
{"items":[{"metadata":{"name":"runtime-0"},"status":{"phase":"Running","conditions":[{"type":"Ready","status":"True"}],"containerStatuses":[{"name":"carbonet-runtime","ready":true,"imageID":"docker-pullable://registry.invalid/carbonet@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]},"spec":{"containers":[{"name":"carbonet-runtime","image":"registry.invalid/carbonet:baseline"}]}},{"metadata":{"name":"runtime-1"},"status":{"phase":"Running","conditions":[{"type":"Ready","status":"True"}],"containerStatuses":[{"name":"carbonet-runtime","ready":true,"imageID":"docker-pullable://registry.invalid/carbonet@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]},"spec":{"containers":[{"name":"carbonet-runtime","image":"registry.invalid/carbonet:baseline"}]}}]}
JSON
cat >"$record_fixture/recorded.json" <<'JSON'
{"releaseKey":"CARBONET_RUNTIME","sourceCommit":"0000000000000000000000000000000000000000","deploymentNamespace":"carbonet-prod","deploymentName":"carbonet-runtime","deploymentUid":"deployment-uid","deploymentGeneration":9,"observedGeneration":9,"desiredReplicas":2,"imageRef":"registry.invalid/carbonet:baseline","imageId":"docker-pullable://registry.invalid/carbonet@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","healthStatus":"UP"}
JSON
export FAKE_GET_COUNT="$record_fixture/get-count" FAKE_SQL_LOG="$record_fixture/sql.log"
export FAKE_DEPLOYMENT_JSON="$record_fixture/deployment.json" FAKE_PODS_JSON="$record_fixture/pods.json" FAKE_RECORDED_JSON="$record_fixture/recorded.json"
export FAKE_LEDGER_STATE="$record_fixture/ledger-state"
rm -f "$FAKE_GET_COUNT" "$FAKE_SQL_LOG" "$FAKE_LEDGER_STATE"
CARBONET_RUNTIME_LEDGER_KUBECTL_BIN="$record_fixture/kubectl" \
CARBONET_RUNTIME_LEDGER_OBSERVE_ONLY=true POSTGRES_POD=postgres-patroni-0 \
  bash "$RECORD_RUNTIME" 0000000000000000000000000000000000000000 >/dev/null
grep -Fqi 'begin;' "$FAKE_SQL_LOG"
grep -Fqi 'insert into framework_runtime_release_state' "$FAKE_SQL_LOG"
grep -Fqi 'commit;' "$FAKE_SQL_LOG"
! grep -Fqi 'delete from framework_runtime_release_state' "$FAKE_SQL_LOG"

rm -f "$FAKE_GET_COUNT" "$FAKE_SQL_LOG"
drift_status=0
FAKE_DRIFT_AFTER=3 CARBONET_RUNTIME_LEDGER_KUBECTL_BIN="$record_fixture/kubectl" \
CARBONET_RUNTIME_LEDGER_OBSERVE_ONLY=true POSTGRES_POD=postgres-patroni-0 \
  bash "$RECORD_RUNTIME" 0000000000000000000000000000000000000000 >/dev/null 2>&1 || drift_status=$?
[[ "$drift_status" != 0 ]]
python3 - "$FAKE_SQL_LOG" <<'PY'
from pathlib import Path
import sys
text=Path(sys.argv[1]).read_text()
assert text.lower().index("insert into framework_runtime_release_state") < text.lower().index("delete from framework_runtime_release_state")
PY

# The helper contract must preserve explicit recovery overrides and rebind all
# default-derived paths after the clean-worktree switch.
grep -Fq 'rebind_default_postdeploy_helpers' "$AUTO"
grep -Fq 'ROOT_DIR="$clean_worktree"' "$AUTO"
grep -Fq '&& "$ledger_generation" == "$generation"' "$AUTO"
grep -Fq '&& "$ledger_desired" == "$desired"' "$AUTO"
grep -Fq 'BLOCKED deferred legacy false-discovery quarantine was not retired with its exact evidence pair' "$AUTO"

# Dispatch reachability contract: an exact-shaped deferred quarantine is never
# allowed past recovery unless the pair retirement returned success and the
# pinned quarantine moved to its exact terminal destination.
python3 - "$AUTO" <<'PY'
from pathlib import Path
import sys
text=Path(sys.argv[1]).read_text()
recovery=text[text.index('else\n  recovery_target_commit='):
              text.index('live_frontend_overlay=')]
assert recovery.index("resolve_postdeploy_postgres_pod") < recovery.index('record_deploy_phase "recovery_identity"')
dispatch=text.index("if recover_persistent_postdeploy_attempt; then")
assert text.index("resolve_postdeploy_postgres_pod", text.index('else\n  recovery_target_commit=')) < dispatch
assert "runtime identity proof has no writable PostgreSQL leader" in text
guard=text.index("BLOCKED deferred legacy false-discovery quarantine")
mutation=text.index('postdeploy_pending_recovery_status=1')
assert guard < mutation
window=text[guard-1000:guard+300]
for required in ('legacy_retire_status" == 0','! -e "$RUNTIME_LEDGER_QUARANTINE_FILE"',
                 'legacy_quarantine_retired','legacy_false_discovery_quarantine_hash','exit 79'):
    assert required in window, required
PY

echo '[durable-rollback-reconciler-test] PASS order=authority-dbCAS-journal-physical-ledger-markers-checkpoint-archive-retire faults=6 restartConvergence=true dbStageCommitJournalCut=replayed abortCommitCrash=converged stagedPromotionSnapshotBinding=exact reconciledQuarantineBeforeArchive=true abortedDbReconfirm=required promotionRaceRestore=0 reconciledRetryRestore=0 unknownMutation=0 migrationAbsentPreRuntimeMutation=0 legacyPathResolution=checkpoint-owned legacyFalseQuarantine=reachable-hash-bound-last legacyCrashResume=true staleLedgerMutation=blocked malformedQuarantine=blocked'
