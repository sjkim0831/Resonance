#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT/ops/scripts/retire-exact-legacy-member-lifecycle-fixture.mjs"
TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT

[[ -f "$SCRIPT" ]] || { echo "missing retirement script: $SCRIPT" >&2; exit 1; }
node --check "$SCRIPT"

python3 - "$SCRIPT" <<'PY'
import pathlib,sys
source=pathlib.Path(sys.argv[1]).read_text()
requirements={
  "exact-id": 'executionId: "22877354-a7a7-48ce-b60b-b296e2a75321"',
  "exact-scope": 'tenantId: "TEST_COMPANY_001"',
  "exact-project": 'projectId: "PRJ-ACTOR-TEST"',
  "exact-process": 'processCode: "MEMBER_LIFECYCLE"',
  "exact-initiator": 'initiatedBy: "qaowner26"',
  "exact-status": 'executionStatus: "COMPLETED"',
  "exact-started": 'startedAt: "2026-08-06T02:08:58.330654"',
  "exact-completed": 'completedAt: "2026-08-06T02:09:00.953069"',
  "exact-snapshot": 'snapshotRef: "qa:22877354-a7a7-48ce-b60b-b296e2a75321:MEMBER_LIFECYCLE_04_APPROVE"',
  "exact-counts": 'eventCount: 4,\n  draftCount: 4,',
  "dedicated-secret": '"carbonet-usage-ledger-system-admin"',
  "canonical-lock": '"/tmp/carbonet-qa-auth-session.lock"',
  "source-live-binding": '(requireSourceMatch && liveTargetCommit !== sourceCommit)',
  "zero-token": "active_token_count=0",
  "no-provenance": "site_scope#>'{qaProvenance}' is null",
  "archive-hardlink": "linkSync(temporary, pathname)",
  "archive-readonly": "chmodSync(temporary, 0o400)",
  "archive-single-link": "stat.nlink !== 1",
  "archive-readback": "return immutableFile(pathname)",
  "archive-before-mutate": "const archive = existingArchive || writeImmutable(archivePath, archiveEnvelope);",
  "full-row-cas": "if actual_rows is distinct from ${expectedRows}::jsonb",
  "table-lock": "lock table framework_process_execution,framework_process_execution_event,framework_process_work_draft,COMTNAUTHTOKENSTORE in share row exclusive mode",
  "reset": "LEGACY_MEMBER_RETIRE_RESET_POSTCONDITION",
  "delete": "LEGACY_MEMBER_RETIRE_DELETE_POSTCONDITION",
  "other-row-proof": "LEGACY_MEMBER_RETIRE_FOREIGN_ROW_DRIFT",
  "receipt": "carbonet.legacy-member-lifecycle-retirement-receipt/v1",
  "idempotent": '"ALREADY_RETIRED"',
  "foreign-guard": 'initial.state === "MISMATCH"',
}
def failed(candidate): return [name for name,token in requirements.items() if token not in candidate]
assert not failed(source),failed(source)
mutants=0
for name,token in requirements.items():
    mutant=source.replace(token,"__REMOVED_BY_MUTANT__")
    mutants+=1
    assert name in failed(mutant),(name,failed(mutant))
print(f"STATIC_CONTRACT_PASS checks={len(requirements)} mutants={mutants}")
PY

mkdir -p "$TMP/bin"
cat >"$TMP/bin/kubectl" <<'MOCK'
#!/usr/bin/env bash
set -Eeuo pipefail
args="$*"
if [[ "$args" == *" get secret "* ]]; then
  printf '{"metadata":{"name":"carbonet-usage-ledger-system-admin","labels":{"resonance.ai/purpose":"usage-ledger-system-admin"}},"type":"Opaque","data":{"username":"cWFyZXRpcmUyNg==","password":"dGVzdC1vbmx5LXBhc3M="}}\n'
elif [[ "$args" == *" get deployment/carbonet-runtime "* ]]; then
  jq -cn --arg commit "$MOCK_COMMIT" '{metadata:{generation:7,annotations:{"resonance.ai/target-commit":$commit}},spec:{replicas:2},status:{observedGeneration:7,updatedReplicas:2,readyReplicas:2,availableReplicas:2,unavailableReplicas:0}}'
elif [[ "$args" == *" get pods "* ]]; then
  printf 'patroni-0\n'
elif [[ "$args" == *"pg_is_in_recovery()"* ]]; then
  printf 'f\n'
elif [[ "$args" == *" exec -i "* ]]; then
  sql="$(cat)"
  state="$(cat "$MOCK_CASE/state")"
  if [[ "$sql" == *"LEGACY_MEMBER_RETIRE_SNAPSHOT_V1"* ]]; then
    cat "$MOCK_CASE/$state.json"
  elif [[ "$sql" == *"LEGACY_MEMBER_RETIRE_RESET_DELETE_V1"* ]]; then
    calls="$(cat "$MOCK_CASE/mutation-calls")"
    printf '%s\n' "$((calls+1))" >"$MOCK_CASE/mutation-calls"
    [[ "$state" == exact ]] || { echo "mutation invoked outside exact state" >&2; exit 91; }
    archive="$MOCK_EVIDENCE_DIR/legacy-member-lifecycle-20260806-22877354.snapshot.json"
    [[ -f "$archive" && "$(stat -c %a "$archive")" == 400 ]] || { echo "archive missing before mutation" >&2; exit 92; }
    hash="$(sha256sum "$archive" | awk '{print $1}')"
    case "${MOCK_MUTATION_MODE:-good}" in
      good)
        printf 'absent\n' >"$MOCK_CASE/state"
        jq -cn --arg hash "$hash" '{status:"RETIRED",retirementId:"legacy-member-lifecycle-20260806-22877354",executionId:"22877354-a7a7-48ce-b60b-b296e2a75321",archiveSha256:$hash,reset:{executions:1,events:4,drafts:4},delete:{executions:1},activeTokenBefore:0,activeTokenAfter:0,otherRowsWriteCount:0,otherRowsFingerprintBefore:{execution:{count:9,fingerprint:"a"},event:{count:8,fingerprint:"b"},draft:{count:7,fingerprint:"c"}},otherRowsFingerprintAfter:{execution:{count:9,fingerprint:"a"},event:{count:8,fingerprint:"b"},draft:{count:7,fingerprint:"c"}}}'
        ;;
      foreign)
        jq -cn --arg hash "$hash" '{status:"RETIRED",retirementId:"legacy-member-lifecycle-20260806-22877354",executionId:"22877354-a7a7-48ce-b60b-b296e2a75321",archiveSha256:$hash,reset:{executions:1,events:4,drafts:4},delete:{executions:1},activeTokenBefore:0,activeTokenAfter:0,otherRowsWriteCount:1,otherRowsFingerprintBefore:{x:1},otherRowsFingerprintAfter:{x:2}}'
        ;;
      crash)
        printf 'absent\n' >"$MOCK_CASE/state"
        exit 93
        ;;
      *) exit 94 ;;
    esac
  else
    echo "unexpected psql input" >&2
    exit 95
  fi
else
  echo "unexpected kubectl invocation: $args" >&2
  exit 96
fi
MOCK
chmod +x "$TMP/bin/kubectl"

make_case() {
  local name="$1" initial="$2"
  local case_dir="$TMP/$name"
  local repo="$case_dir/repo" parent="$case_dir/retired"
  mkdir -p "$repo" "$parent"
  chmod 700 "$parent"
  git -C "$repo" init -q
  git -C "$repo" config user.email qa@example.invalid
  git -C "$repo" config user.name QA
  printf 'fixture\n' >"$repo/README"
  git -C "$repo" add README
  git -C "$repo" commit -qm fixture
  git -C "$repo" rev-parse HEAD >"$case_dir/commit"
  printf '%s\n' "$initial" >"$case_dir/state"
  printf '0\n' >"$case_dir/mutation-calls"

  jq -cn '{schemaVersion:1,retirementId:"legacy-member-lifecycle-20260806-22877354",state:"EXACT",counts:{execution:1,event:4,draft:4,activeToken:0},contract:{tenantId:"TEST_COMPANY_001",projectId:"PRJ-ACTOR-TEST",processCode:"MEMBER_LIFECYCLE",executionId:"22877354-a7a7-48ce-b60b-b296e2a75321",initiatedBy:"qaowner26",executionStatus:"COMPLETED",currentState:"COMPLETED",startedAt:"2026-08-06T02:08:58.330654",completedAt:"2026-08-06T02:09:00.953069",snapshotRef:"qa:22877354-a7a7-48ce-b60b-b296e2a75321:MEMBER_LIFECYCLE_04_APPROVE",eventCount:4,draftCount:4,qaProvenance:"ABSENT"},targetRows:{execution:{execution_id:"22877354-a7a7-48ce-b60b-b296e2a75321",status:"COMPLETED"},events:[{event_id:1},{event_id:2},{event_id:3},{event_id:4}],drafts:[{draft_id:1},{draft_id:2},{draft_id:3},{draft_id:4}]},otherRowsFingerprint:{execution:{count:9,fingerprint:"a"},event:{count:8,fingerprint:"b"},draft:{count:7,fingerprint:"c"}}}' >"$case_dir/exact.json"
  jq -cn '{schemaVersion:1,retirementId:"legacy-member-lifecycle-20260806-22877354",state:"ABSENT",counts:{execution:0,event:0,draft:0,activeToken:0},contract:{tenantId:"TEST_COMPANY_001",projectId:"PRJ-ACTOR-TEST",processCode:"MEMBER_LIFECYCLE",executionId:"22877354-a7a7-48ce-b60b-b296e2a75321",initiatedBy:"qaowner26",executionStatus:"COMPLETED",currentState:"COMPLETED",startedAt:"2026-08-06T02:08:58.330654",completedAt:"2026-08-06T02:09:00.953069",snapshotRef:"qa:22877354-a7a7-48ce-b60b-b296e2a75321:MEMBER_LIFECYCLE_04_APPROVE",eventCount:4,draftCount:4,qaProvenance:"ABSENT"},targetRows:{execution:null,events:[],drafts:[]},otherRowsFingerprint:{execution:{count:9,fingerprint:"a"},event:{count:8,fingerprint:"b"},draft:{count:7,fingerprint:"c"}}}' >"$case_dir/absent.json"
  jq -cn '{schemaVersion:1,retirementId:"legacy-member-lifecycle-20260806-22877354",state:"MISMATCH",counts:{execution:2,event:4,draft:4,activeToken:0},contract:{},targetRows:{},otherRowsFingerprint:{}}' >"$case_dir/mismatch.json"
  printf '%s\n' "$case_dir"
}

run_retirement() {
  local case_dir="$1" mode="${2:-good}"
  MOCK_CASE="$case_dir" \
  MOCK_COMMIT="$(cat "$case_dir/commit")" \
  MOCK_EVIDENCE_DIR="$case_dir/retired/member-lifecycle" \
  MOCK_MUTATION_MODE="$mode" \
  PATH="$TMP/bin:$PATH" \
  RESONANCE_ROOT="$case_dir/repo" \
  CARBONET_MEMBER_RETIRE_EVIDENCE_DIR="$case_dir/retired/member-lifecycle" \
  CARBONET_QA_AUTH_LOCK_FILE="$case_dir/auth.lock" \
  CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS=5 \
  CARBONET_MEMBER_RETIRE_COMMAND_TIMEOUT_MS=5000 \
  node "$SCRIPT"
}

case_main="$(make_case main exact)"
first="$(run_retirement "$case_main")"
jq -e '.status=="PASS" and .outcome=="RESET_DELETE_COMMITTED" and .reset=={executions:1,events:4,drafts:4} and .deletedExecutions==1 and .otherRowsWriteCount==0 and .activeTokens==0' <<<"$first" >/dev/null
[[ "$(cat "$case_main/mutation-calls")" == 1 && "$(cat "$case_main/state")" == absent ]]
archive="$case_main/retired/member-lifecycle/legacy-member-lifecycle-20260806-22877354.snapshot.json"
receipt="$case_main/retired/member-lifecycle/legacy-member-lifecycle-20260806-22877354.retired.json"
[[ "$(stat -c %a "$archive")" == 400 && "$(stat -c %a "$receipt")" == 400 ]]
[[ "$(find "$case_main/retired/member-lifecycle" -name '*.tmp' -o -name '.*.tmp' | wc -l)" == 0 ]]
second="$(run_retirement "$case_main")"
jq -e '.status=="PASS" and .outcome=="ALREADY_RETIRED" and .reset=={executions:0,events:0,drafts:0} and .deletedExecutions==0' <<<"$second" >/dev/null
[[ "$(cat "$case_main/mutation-calls")" == 1 ]]

case_mismatch="$(make_case mismatch mismatch)"
set +e
run_retirement "$case_mismatch" >"$case_mismatch/out" 2>"$case_mismatch/err"
status=$?
set -e
[[ "$status" == 79 && "$(cat "$case_mismatch/mutation-calls")" == 0 ]]
[[ ! -e "$case_mismatch/retired/member-lifecycle/legacy-member-lifecycle-20260806-22877354.snapshot.json" ]]
grep -Fq 'not the exact retireable contract' "$case_mismatch/err"

case_foreign="$(make_case foreign exact)"
set +e
run_retirement "$case_foreign" foreign >"$case_foreign/out" 2>"$case_foreign/err"
status=$?
set -e
[[ "$status" == 79 && "$(cat "$case_foreign/mutation-calls")" == 1 && "$(cat "$case_foreign/state")" == exact ]]
[[ -f "$case_foreign/retired/member-lifecycle/legacy-member-lifecycle-20260806-22877354.snapshot.json" ]]
[[ ! -e "$case_foreign/retired/member-lifecycle/legacy-member-lifecycle-20260806-22877354.retired.json" ]]
recovered="$(run_retirement "$case_foreign" good)"
jq -e '.outcome=="RESET_DELETE_COMMITTED"' <<<"$recovered" >/dev/null
[[ "$(cat "$case_foreign/mutation-calls")" == 2 ]]

case_crash="$(make_case crash exact)"
set +e
run_retirement "$case_crash" crash >"$case_crash/out" 2>"$case_crash/err"
status=$?
set -e
[[ "$status" == 79 && "$(cat "$case_crash/mutation-calls")" == 1 && "$(cat "$case_crash/state")" == absent ]]
[[ -f "$case_crash/retired/member-lifecycle/legacy-member-lifecycle-20260806-22877354.snapshot.json" ]]
[[ ! -e "$case_crash/retired/member-lifecycle/legacy-member-lifecycle-20260806-22877354.retired.json" ]]
crash_recovery="$(run_retirement "$case_crash" good)"
jq -e '.outcome=="RECOVERED_AFTER_COMMIT" and .deletedExecutions==0' <<<"$crash_recovery" >/dev/null
[[ "$(cat "$case_crash/mutation-calls")" == 1 ]]

chmod 600 "$archive"
printf 'tamper\n' >>"$archive"
chmod 400 "$archive"
set +e
run_retirement "$case_main" >"$case_main/tamper-out" 2>"$case_main/tamper-err"
status=$?
set -e
[[ "$status" == 79 && "$(cat "$case_main/mutation-calls")" == 1 ]]
grep -Eq 'archive contract is invalid|JSON' "$case_main/tamper-err"

echo 'LEGACY_MEMBER_LIFECYCLE_RETIREMENT_CONTRACT_PASS dynamicCases=5 exactRows=1/4/4 activeTokens=0 otherRowsWrite=0 idempotentRetries=3'
