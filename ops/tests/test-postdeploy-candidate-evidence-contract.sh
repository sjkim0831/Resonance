#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260812023000__stage_and_atomically_promote_postdeploy_evidence.sql"
SCOPE_AUDIT_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260812033000__harden_scope_access_audit_append_only.sql"
LIFECYCLE_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260812080000__bind_postdeploy_attempt_lifecycle.sql"
RUNTIME_TEMPLATE_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260817235000__bind_runtime_identity_to_pod_template.sql"
HPA_STABLE_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260818151500__make_runtime_identity_hpa_stable.sql"
STAGER="$ROOT/ops/scripts/stage-postdeploy-evidence-candidate.sh"
PROMOTER="$ROOT/ops/scripts/promote-postdeploy-candidate-evidence.sh"
DEPLOY="$ROOT/ops/scripts/auto-deploy-main.sh"
JOURNAL_HELPER="$ROOT/ops/scripts/postdeploy-attempt-journal.py"
BUILD_DEPLOY="$ROOT/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"
V3_DEPLOY="$ROOT/ops/scripts/resonance-v3-deploy.sh"
COMMAND_INDEX="$ROOT/ops/scripts/resonance-command-index.sh"
FILE_WATCH="$ROOT/ops/scripts/resonance-file-watch.sh"
PROJECT_CORE_DEPLOY="$ROOT/ops/scripts/resonance-project-core-deploy.sh"
AI_FAST_DEV="$ROOT/ops/scripts/resonance-ai-fast-dev.sh"
LEGACY_RUNTIME_HARDENER="$ROOT/ops/scripts/retire-legacy-runtime-mutation-automation.sh"

files=(
  "$STAGER" "$PROMOTER" "$DEPLOY"
  "$ROOT/ops/scripts/run-post-deploy-validation-groups.sh"
  "$ROOT/ops/scripts/plan-incremental-work.sh"
  "$ROOT/ops/scripts/test-plan-incremental-work.sh"
  "$ROOT/ops/scripts/complete-activity-data-evidence-jobs.sh"
  "$ROOT/ops/scripts/complete-emission-calculation-evidence-jobs.sh"
  "$ROOT/ops/scripts/complete-report-certification-evidence-jobs.sh"
  "$ROOT/ops/scripts/validate-customer-work-journey.sh"
  "$ROOT/ops/scripts/validate-activity-data-runtime.sh"
  "$ROOT/ops/scripts/validate-emission-calculation-runtime.sh"
  "$ROOT/ops/scripts/validate-organizational-boundary-runtime.sh"
  "$ROOT/ops/scripts/validate-governance-change-runtime.sh"
  "$ROOT/ops/scripts/validate-report-certification-runtime.sh"
  "$ROOT/ops/scripts/run-process-runtime-smoke.sh"
  "$ROOT/ops/scripts/validate-operational-usage-ledger-e2e.sh"
  "$ROOT/ops/scripts/validate-actor-account-customer-journey.sh"
  "$ROOT/ops/scripts/validate-screen-contract-runtime-save.sh"
  "$ROOT/ops/scripts/resonance-full-screen-deploy-gate.sh"
  "$ROOT/ops/scripts/resonance-keycloak-carbonet-identity-sync.sh"
  "$ROOT/ops/scripts/resonance-actor-process-role-e2e.sh"
  "$ROOT/ops/scripts/run-nightly-frontend-contracts.sh"
  "$ROOT/projects/carbonet-frontend/source/scripts/run-full-screen-smoke.sh"
  "$ROOT/ops/tests/test-postdeploy-promotion-recovery.sh"
  "$ROOT/ops/scripts/abort-postdeploy-release-attempt.sh"
  "$ROOT/ops/scripts/stage-postdeploy-release-attempt.sh"
  "$BUILD_DEPLOY"
  "$V3_DEPLOY"
  "$COMMAND_INDEX"
  "$FILE_WATCH"
  "$PROJECT_CORE_DEPLOY"
  "$AI_FAST_DEV"
  "$LEGACY_RUNTIME_HARDENER"
  "$ROOT/ops/scripts/promote-runtime-startup-profile.sh"
  "$ROOT/ops/tests/test-postdeploy-attempt-journal.sh"
  "$ROOT/ops/tests/test-durable-postdeploy-rollback-reconciler.sh"
  "$ROOT/ops/scripts/check-postdeploy-authoritative-promotion.sh"
  "$ROOT/ops/scripts/carbonet-auto-deploy-failure-handler.sh"
  "$ROOT/ops/scripts/postdeploy-attempt-recovery-runner.sh"
  "$ROOT/ops/scripts/auto-deploy-main-launcher.sh"
  "$ROOT/ops/scripts/record-runtime-release-state.sh"
  "$ROOT/ops/scripts/test-auto-deploy-failure-handler.sh"
  "$ROOT/ops/tests/test-runtime-release-state.sh"
)
for file in "$MIGRATION" "$SCOPE_AUDIT_MIGRATION" "$LIFECYCLE_MIGRATION" "$RUNTIME_TEMPLATE_MIGRATION" "$HPA_STABLE_MIGRATION" "$JOURNAL_HELPER" "${files[@]}"; do [[ -s "$file" ]] || { echo "missing: $file" >&2; exit 1; }; done
for file in "${files[@]}"; do bash -n "$file"; done
python3 "$JOURNAL_HELPER" --help >/dev/null
node --check "$ROOT/ops/scripts/validate-screen-contract-runtime-save.mjs"
bash "$ROOT/ops/tests/test-process-runtime-evidence-isolation.sh" "$ROOT"
bash "$ROOT/ops/scripts/test-plan-incremental-work.sh"
bash "$ROOT/ops/scripts/test-shared-smoke-auth-state.sh"

# The first migration rollout can commit DB STAGED immediately before a crash
# while the mutable checkout is absent. Prove that replay arms the durable
# journal through the installed helper selected by environment, never ROOT.
stage_bundle_tmp="$(mktemp -d)"
stage_bundle_candidate='postdeploy:test:installed-helper:123456'
stage_bundle_source='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
stage_bundle_base='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
stage_bundle_sha='cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
stage_bundle_image_id='docker-pullable://registry.invalid/carbonet@sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
mkdir -p "$stage_bundle_tmp/state" "$stage_bundle_tmp/mutable-checkout/ops/scripts"
chmod 0700 "$stage_bundle_tmp/state"
install -m 0755 "$JOURNAL_HELPER" "$stage_bundle_tmp/installed-journal-helper.py"
install -m 0775 "$JOURNAL_HELPER" \
  "$stage_bundle_tmp/mutable-checkout/ops/scripts/postdeploy-attempt-journal.py"
: >"$stage_bundle_tmp/kubectl.calls"
jq -cn --arg attempt "$stage_bundle_candidate" --arg source "$stage_bundle_source" \
  --arg base "$stage_bundle_base" --arg sha "$stage_bundle_sha" --arg imageId "$stage_bundle_image_id" '
  {schemaVersion:2,lifecycleStatus:"STAGED",rollbackStage:"SNAPSHOT_CAPTURED",dbAttemptStaged:false,
   attemptId:$attempt,candidateId:$attempt,sourceCommit:$source,baseCommit:$base,
   runtimeIdentityHash:null,terminalReason:null,stagedAt:"2026-08-12T09:00:00Z",terminalAt:null,
   rollback:{snapshotId:"installed-helper",snapshotDir:"/opt/resonance-data/deploy/full-screen-deploy-gate/snapshots/installed-helper",
     snapshotManifestSha256:$sha,runtimeImageRef:"registry.invalid/carbonet:baseline",runtimeImageId:$imageId,
     deploymentUid:"uid",deploymentGeneration:7,deploymentAnnotationsSha256:$sha,podTemplateSha256:$sha,
     appliedMarkerCommit:$base,appliedMarkerSha256:$sha,runtimeMarkerCommit:$base,runtimeMarkerSha256:$sha}}' |
  python3 "$stage_bundle_tmp/installed-journal-helper.py" \
    --file "$stage_bundle_tmp/state/attempt.json" stage >/dev/null
stage_bundle_kubectl() {
  local sql candidate="${STAGE_BUNDLE_CANDIDATE:?}" source="${STAGE_BUNDLE_SOURCE:?}"
  printf '%s\n' "$*" >>"${STAGE_BUNDLE_CALLS:?}"
  sql="$(cat)"
  if [[ "$sql" == *to_regprocedure* ]]; then
    printf 'AVAILABLE\n'
  else
    jq -cn --arg candidate "$candidate" --arg source "$source" \
      '{status:"STAGED",candidateId:$candidate,sourceCommit:$source}'
  fi
}
export -f stage_bundle_kubectl
export STAGE_BUNDLE_CALLS="$stage_bundle_tmp/kubectl.calls"
stage_bundle_unsafe_status=0
CARBONET_RUNTIME_LEDGER_KUBECTL_BIN=stage_bundle_kubectl \
STAGE_BUNDLE_CANDIDATE="$stage_bundle_candidate" STAGE_BUNDLE_SOURCE="$stage_bundle_source" \
CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_FILE="$stage_bundle_tmp/state/attempt.json" \
RESONANCE_POSTGRES_LEADER_POD=fake-primary \
  bash "$ROOT/ops/scripts/stage-postdeploy-release-attempt.sh" \
    "$stage_bundle_tmp/mutable-checkout" "$stage_bundle_candidate" "$stage_bundle_source" \
    >"$stage_bundle_tmp/unsafe.log" 2>&1 || stage_bundle_unsafe_status=$?
[[ "$stage_bundle_unsafe_status" == 1 && ! -s "$stage_bundle_tmp/kubectl.calls" ]]
grep -Fq 'journal helper mode is unsafe' "$stage_bundle_tmp/unsafe.log"
CARBONET_RUNTIME_LEDGER_KUBECTL_BIN=stage_bundle_kubectl \
STAGE_BUNDLE_CANDIDATE="$stage_bundle_candidate" STAGE_BUNDLE_SOURCE="$stage_bundle_source" \
CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_HELPER="$stage_bundle_tmp/installed-journal-helper.py" \
CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_FILE="$stage_bundle_tmp/state/attempt.json" \
RESONANCE_POSTGRES_LEADER_POD=fake-primary \
  bash "$ROOT/ops/scripts/stage-postdeploy-release-attempt.sh" \
    "$stage_bundle_tmp/mutable-checkout" "$stage_bundle_candidate" "$stage_bundle_source" >/dev/null
python3 "$stage_bundle_tmp/installed-journal-helper.py" --file "$stage_bundle_tmp/state/attempt.json" read |
  jq -e '.dbAttemptStaged==true and .rollbackStage=="ARMED"' >/dev/null
[[ "$(wc -l <"$stage_bundle_tmp/kubectl.calls" | tr -d ' ')" == 2 ]]
rm -rf -- "$stage_bundle_tmp"
unset -f stage_bundle_kubectl
unset STAGE_BUNDLE_CALLS

# Exercise the real stager without touching Kubernetes or PostgreSQL. Bash
# parses `${input:-{}}` as a parameter expansion followed by a literal `}`,
# so every non-empty producer payload used to arrive at jq with one extra
# closing brace. Validate all four failed producer shapes, then prove that a
# helper mutated back to the ambiguous expansion is rejected.
stager_fixture_tmp="$(mktemp -d)"
stager_source='0000000000000000000000000000000000000000'
stager_image='registry.invalid/carbonet@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
stager_image_id='sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
cat >"$stager_fixture_tmp/deployment.json" <<JSON
{"metadata":{"namespace":"carbonet-prod","name":"carbonet-runtime","uid":"stager-runtime-uid","resourceVersion":"101","generation":7,"annotations":{"resonance.ai/target-commit":"$stager_source"}},"spec":{"replicas":1,"selector":{"matchLabels":{"app":"carbonet-runtime"}},"template":{"spec":{"containers":[{"name":"carbonet-runtime","image":"$stager_image"}]}}},"status":{"observedGeneration":7,"updatedReplicas":1,"readyReplicas":1,"availableReplicas":1,"unavailableReplicas":0}}
JSON
cat >"$stager_fixture_tmp/pods.json" <<JSON
{"items":[{"metadata":{"name":"runtime-0"},"spec":{"containers":[{"name":"carbonet-runtime","image":"$stager_image"}]},"status":{"phase":"Running","conditions":[{"type":"Ready","status":"True"}],"containerStatuses":[{"name":"carbonet-runtime","ready":true,"imageID":"$stager_image_id"}]}}]}
JSON
stager_template_hash="$(jq -cS '.spec.template' "$stager_fixture_tmp/deployment.json" | sha256sum | awk '{print $1}')"
jq -cn --arg source "$stager_source" --arg image "$stager_image" --arg imageId "$stager_image_id" \
  --arg template "$stager_template_hash" '
  {schemaVersion:1,stage:"RUNTIME_CANDIDATE_READY",targetCommit:$source,
   deploymentUid:"stager-runtime-uid",deploymentGeneration:7,desiredReplicas:1,
   imageRef:$image,imageIdDigest:$imageId,podTemplateSha256:$template}' \
  >"$stager_fixture_tmp/checkpoint.json"
chmod 0644 "$stager_fixture_tmp/checkpoint.json"
run_stager_payload() {
  local stager="$1" payload="$2" deployment_fixture="${3:-$stager_fixture_tmp/deployment.json}"
  local pods_fixture="${4:-$stager_fixture_tmp/pods.json}"
  (
    kubectl() {
      local arg payload_b64=""
      if [[ "$*" == *" get deployment/"* ]]; then cat "$STAGER_FIXTURE_DEPLOYMENT"; return; fi
      if [[ "$*" == *" get pods "* ]]; then cat "$STAGER_FIXTURE_PODS"; return; fi
      if [[ "$*" == *" exec runtime-"* && "$*" == *" curl "* ]]; then printf '{"status":"UP"}\n'; return; fi
      cat >/dev/null
      for arg in "$@"; do
        case "$arg" in
          payload_b64=*) payload_b64="${arg#payload_b64=}" ;;
        esac
      done
      [[ -n "$payload_b64" ]] || return 91
      printf '%s' "$payload_b64" | base64 -d | jq -e '
        .status == "PASS"
        and .unitCode == "STAGER_INPUT_REGRESSION"
        and .processCode == "TEST_PROCESS"
        and .evidenceKind == "RUNTIME"
        and .sourceCommit == "0000000000000000000000000000000000000000"
        and ((has("projectId") | not) or (.projectId | type) == "string")
      ' >/dev/null || return 92
      printf '%064d\n' 0
    }
    export -f kubectl
    printf '%s' "$payload" | env \
      CARBONET_POSTDEPLOY_EVIDENCE_MODE=candidate \
      CARBONET_POSTDEPLOY_CANDIDATE_ID=stager-input-regression \
      CARBONET_RUNTIME_CANDIDATE_CHECKPOINT_FILE="$stager_fixture_tmp/checkpoint.json" \
      STAGER_FIXTURE_DEPLOYMENT="$deployment_fixture" \
      STAGER_FIXTURE_PODS="$pods_fixture" \
      RESONANCE_POSTGRES_LEADER_POD=fake-primary \
      bash "$stager" STAGER_INPUT_REGRESSION TEST_PROCESS RUNTIME \
        0000000000000000000000000000000000000000
  )
}

producer_payloads=(
  '{"projectId":"PRJ-ACTIVITY","authenticatedApiCount":6,"protectedApiCount":3,"pageCount":8,"p95Millis":25,"readyReplicas":3,"actorAssignments":5,"simulationTypes":5}'
  '{"projectId":"PRJ-CALCULATION","authenticatedApiCount":5,"protectedApiCount":2,"pageCount":8,"p95Millis":25,"readyReplicas":3,"formula":"reconciled"}'
  '{"projectId":"PRJ-REPORT","reportId":"101","certificate":"CERT-101","integrityHash":"0000000000000000000000000000000000000000000000000000000000000000","authenticatedApiCount":3,"protectedApiCount":2,"pageCount":7,"p95Millis":25,"readyReplicas":3,"publicValid":true,"publicInvalid":true}'
  '{"projectId":"PRJ-ACTOR","actorAccounts":5,"actorRoles":5,"tasks":7,"fullWorkflow":"7/7","securityAuditEvidence":[{"schemaVersion":2,"auditId":1,"rowHash":"0000000000000000000000000000000000000000000000000000000000000000"},{"schemaVersion":2,"auditId":2,"rowHash":"1111111111111111111111111111111111111111111111111111111111111111"}],"authTokenCleanupVerified":true}'
)
for payload in "${producer_payloads[@]}"; do
  jq -e . <<<"$payload" >/dev/null
  run_stager_payload "$STAGER" "$payload" | grep -Fq '[postdeploy-candidate] STAGED'
done
run_stager_payload "$STAGER" "" | grep -Fq '[postdeploy-candidate] STAGED'
# HPA owns replicas and consequently Deployment generation. A scale event after
# RUNTIME_CANDIDATE_READY must not invalidate the immutable UID/image/template
# candidate identity when every current replica is Ready on the same image.
jq '.metadata.generation=8 | .spec.replicas=2
    | .status.observedGeneration=8 | .status.updatedReplicas=2
    | .status.readyReplicas=2 | .status.availableReplicas=2' \
  "$stager_fixture_tmp/deployment.json" >"$stager_fixture_tmp/deployment-scaled.json"
jq '.items += [(.items[0] | .metadata.name="runtime-1")]' \
  "$stager_fixture_tmp/pods.json" >"$stager_fixture_tmp/pods-scaled.json"
run_stager_payload "$STAGER" "${producer_payloads[0]}" \
  "$stager_fixture_tmp/deployment-scaled.json" "$stager_fixture_tmp/pods-scaled.json" \
  | grep -Fq '[postdeploy-candidate] STAGED'

# A PodTemplate mutation remains immutable even when the live Deployment is
# otherwise fully observed and Ready.
jq '.spec.template.spec.containers[0].env=[{"name":"FOREIGN_DRIFT","value":"1"}]' \
  "$stager_fixture_tmp/deployment.json" >"$stager_fixture_tmp/deployment-template-drift.json"
set +e
run_stager_payload "$STAGER" "${producer_payloads[0]}" \
  "$stager_fixture_tmp/deployment-template-drift.json" \
  >"$stager_fixture_tmp/template-drift.out" 2>"$stager_fixture_tmp/template-drift.err"
template_drift_status=$?
set -e
[[ "$template_drift_status" == 1 ]]
grep -Fq 'live runtime diverged from RUNTIME_CANDIDATE_READY checkpoint' \
  "$stager_fixture_tmp/template-drift.err"
jq '.metadata.annotations["resonance.ai/target-commit"]="ffffffffffffffffffffffffffffffffffffffff"' \
  "$stager_fixture_tmp/deployment.json" >"$stager_fixture_tmp/deployment-wrong-source.json"
if run_stager_payload "$STAGER" "${producer_payloads[0]}" \
    "$stager_fixture_tmp/deployment-wrong-source.json" >"$stager_fixture_tmp/wrong-source.log" 2>&1; then
  echo '[postdeploy-candidate-contract] FAIL wrong live target annotation was accepted' >&2
  exit 1
fi
grep -Fq 'candidate runtime deployment identity/readiness mismatch' "$stager_fixture_tmp/wrong-source.log"

stager_mutation_tmp="$(mktemp)"
trap 'rm -f "$stager_mutation_tmp"' EXIT
sed \
  -e '/^\[\[ -n "\$input" \]\] || input='"'"'{}'"'"'$/d' \
  -e 's|<<<"\$input"|<<<"${input:-{}}"|' \
  "$STAGER" >"$stager_mutation_tmp"
if run_stager_payload "$stager_mutation_tmp" "${producer_payloads[0]}" >/dev/null 2>&1; then
  echo '[postdeploy-candidate-contract] FAIL ambiguous empty-object fallback mutation escaped' >&2
  exit 1
fi
rm -f "$stager_mutation_tmp"
trap - EXIT
rm -rf -- "$stager_fixture_tmp"

# Direct build-v2 execution has no durable attempt/backup/recovery owner.  It
# must retire before even loading build helpers; deleting the runtime ledger and
# then mutating live state is not an admissible substitute for that owner.
direct_retired_tmp="$(mktemp -d)"
trap 'rm -rf -- "$direct_retired_tmp"' EXIT
mkdir -p "$direct_retired_tmp/root/ops/scripts" "$direct_retired_tmp/bin"
install -m 0755 "$BUILD_DEPLOY" \
  "$direct_retired_tmp/root/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"
install -m 0755 "$COMMAND_INDEX" \
  "$direct_retired_tmp/root/ops/scripts/resonance-command-index.sh"
install -m 0755 "$PROJECT_CORE_DEPLOY" \
  "$direct_retired_tmp/root/ops/scripts/resonance-project-core-deploy.sh"
install -m 0755 "$AI_FAST_DEV" \
  "$direct_retired_tmp/root/ops/scripts/resonance-ai-fast-dev.sh"
printf '%s\n' '#!/usr/bin/env bash' \
  'printf "UNSAFE:SOURCE:%s\n" "$(basename "$0")" >>"${DIRECT_UNSAFE_TRACE:?}"' \
  'exit 96' >"$direct_retired_tmp/root/ops/scripts/build.sh"
cp "$direct_retired_tmp/root/ops/scripts/build.sh" \
  "$direct_retired_tmp/root/ops/scripts/docker-registry-cache.sh"
printf '%s\n' '#!/usr/bin/env bash' \
  'printf "%s\n" '\''{"mode":"project-core-build-deploy","buildRequired":true,"deployRequired":true}'\''' \
  >"$direct_retired_tmp/root/ops/scripts/resonance-change-classifier.sh"
chmod 0755 "$direct_retired_tmp/root/ops/scripts/"*.sh
for direct_unsafe_tool in kubectl docker podman gradle mvn npm rsync sudo ssh psql curl; do
  printf '%s\n' '#!/usr/bin/env bash' \
    'printf "UNSAFE:TOOL:%s\n" "$(basename "$0")" >>"${DIRECT_UNSAFE_TRACE:?}"' \
    'exit 97' >"$direct_retired_tmp/bin/$direct_unsafe_tool"
  chmod 0755 "$direct_retired_tmp/bin/$direct_unsafe_tool"
done
printf '%s\n' 'runtime-authority-must-remain-byte-identical' >"$direct_retired_tmp/ledger"
printf '%s\n' 'source-must-remain-byte-identical' >"$direct_retired_tmp/source"
: >"$direct_retired_tmp/unsafe.trace"
direct_ledger_before="$(sha256sum "$direct_retired_tmp/ledger" | awk '{print $1}')"
direct_source_before="$(sha256sum "$direct_retired_tmp/source" | awk '{print $1}')"
run_direct_retired() {
  local name="$1" expected_message="$2" status=0
  shift 2
  : >"$direct_retired_tmp/unsafe.trace"
  set +e
  env DIRECT_UNSAFE_TRACE="$direct_retired_tmp/unsafe.trace" \
    PATH="$direct_retired_tmp/bin:$PATH" "$@" \
    >"$direct_retired_tmp/$name.stdout" 2>"$direct_retired_tmp/$name.stderr"
  status=$?
  set -e
  [[ "$status" == 78 ]] || {
    echo "[postdeploy-candidate-contract] FAIL $name expected rc78 got $status" >&2
    cat "$direct_retired_tmp/$name.stderr" >&2
    exit 1
  }
  grep -Fq "$expected_message" "$direct_retired_tmp/$name.stderr"
  [[ ! -s "$direct_retired_tmp/unsafe.trace" ]]
  [[ "$(sha256sum "$direct_retired_tmp/ledger" | awk '{print $1}')" == "$direct_ledger_before" ]]
  [[ "$(sha256sum "$direct_retired_tmp/source" | awk '{print $1}')" == "$direct_source_before" ]]
  [[ ! -e "$direct_retired_tmp/root/var" ]]
}
direct_message='[build-deploy-v2] RETIRED: direct execution requires the official durable auto-deploy pipeline'
run_direct_retired raw-default "$direct_message" env -u CARBONET_DURABLE_ATTEMPT_REQUIRED \
  /usr/bin/bash "$direct_retired_tmp/root/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"
run_direct_retired raw-false "$direct_message" env CARBONET_DURABLE_ATTEMPT_REQUIRED=false \
  /usr/bin/bash "$direct_retired_tmp/root/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"
for direct_command in deploy-fe 10; do
  run_direct_retired "command-$direct_command" "$direct_message" env \
    ROOT_DIR="$direct_retired_tmp/root" /usr/bin/bash \
    "$direct_retired_tmp/root/ops/scripts/resonance-command-index.sh" "$direct_command"
done
run_direct_retired project-core "$direct_message" /usr/bin/bash \
  "$direct_retired_tmp/root/ops/scripts/resonance-project-core-deploy.sh"
run_direct_retired ai-fast-dev "$direct_message" /usr/bin/bash \
  "$direct_retired_tmp/root/ops/scripts/resonance-ai-fast-dev.sh"
echo 'POSTDEPLOY_DIRECT_BUILD_RETIRED_PASS rc=78 callers=raw2+command-index2+project-core+ai-fast-dev ledger=unchanged source=unchanged mutation=0'
trap - EXIT
rm -rf -- "$direct_retired_tmp"

v3_delegate_tmp="$(mktemp -d)"
trap 'rm -rf -- "$v3_delegate_tmp"' EXIT
mkdir -p "$v3_delegate_tmp/root/ops/scripts" "$v3_delegate_tmp/bin"
install -m 0755 "$V3_DEPLOY" "$v3_delegate_tmp/root/ops/scripts/resonance-v3-deploy.sh"
printf '%s\n' '#!/usr/bin/env bash' \
  'printf "UNSAFE:BUILD\n" >>"${V3_UNSAFE_TRACE:?}"' \
  >"$v3_delegate_tmp/root/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"
chmod 0755 "$v3_delegate_tmp/root/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"
for v3_unsafe_tool in kubectl docker mvn npm sudo; do
  printf '%s\n' '#!/usr/bin/env bash' \
    'printf "UNSAFE:%s\n" "$(basename "$0")" >>"${V3_UNSAFE_TRACE:?}"' \
    >"$v3_delegate_tmp/bin/$v3_unsafe_tool"
  chmod 0755 "$v3_delegate_tmp/bin/$v3_unsafe_tool"
done
: >"$v3_delegate_tmp/unsafe.trace"
set +e
V3_UNSAFE_TRACE="$v3_delegate_tmp/unsafe.trace" PATH="$v3_delegate_tmp/bin:$PATH" \
  bash "$v3_delegate_tmp/root/ops/scripts/resonance-v3-deploy.sh" probe \
  >"$v3_delegate_tmp/v3.stdout" 2>"$v3_delegate_tmp/v3.stderr"
v3_retired_status=$?
set -e
[[ "$v3_retired_status" == 78 && ! -s "$v3_delegate_tmp/unsafe.trace" ]]
grep -q '^\[v3-deploy\] RETIRED: use the official durable auto-deploy pipeline$' "$v3_delegate_tmp/v3.stderr"
for v3_command in deploy deploy-safe v3-deploy; do
  : >"$v3_delegate_tmp/unsafe.trace"
  set +e
  ROOT_DIR="$v3_delegate_tmp/root" V3_UNSAFE_TRACE="$v3_delegate_tmp/unsafe.trace" \
    PATH="$v3_delegate_tmp/bin:$PATH" bash "$COMMAND_INDEX" "$v3_command" \
    >"$v3_delegate_tmp/command.stdout" 2>"$v3_delegate_tmp/command.stderr"
  v3_command_status=$?
  set -e
  [[ "$v3_command_status" == 78 && ! -s "$v3_delegate_tmp/unsafe.trace" ]]
done
watch_extract_function() { sed -n "/^$1() {$/,/^}$/p" "$FILE_WATCH"; }
eval "$(watch_extract_function trigger_deploy)"
ROOT_DIR="$v3_delegate_tmp/root"
LOG_FILE="$v3_delegate_tmp/file-watch.log"
log_warn() { printf 'WATCH:%s\n' "$*" >>"$v3_delegate_tmp/watch.trace"; }
set +e
trigger_deploy
v3_watch_status=$?
set -e
[[ "$v3_watch_status" == 78 && ! -s "$v3_delegate_tmp/unsafe.trace" ]]
grep -q '^WATCH:Legacy file-watch deployment is retired; use the official durable auto-deploy pipeline$' \
  "$v3_delegate_tmp/watch.trace"
! grep -q 'retry on next change' "$v3_delegate_tmp/watch.trace"
echo 'POSTDEPLOY_V3_RETIRED_PASS rc=78 callers=command-index3+file-watch network=0 build=0 mutation=0'
trap - EXIT
rm -rf -- "$v3_delegate_tmp"

python3 - "$ROOT" "$MIGRATION" "$STAGER" "$PROMOTER" "$DEPLOY" <<'PY'
from pathlib import Path
import os, re, shutil, subprocess, sys, tempfile

root, migration_path, stager_path, promoter_path, deploy_path = map(Path, sys.argv[1:])
migration = migration_path.read_text(encoding="utf-8")
stager = stager_path.read_text(encoding="utf-8")
promoter = promoter_path.read_text(encoding="utf-8")

units = {
    "ACTIVITY_DATA_STATIC": "complete-activity-data-evidence-jobs.sh",
    "ACTIVITY_DATA_RUNTIME": "validate-activity-data-runtime.sh",
    "EMISSION_CALCULATION_STATIC": "complete-emission-calculation-evidence-jobs.sh",
    "EMISSION_CALCULATION_RUNTIME": "validate-emission-calculation-runtime.sh",
    "REPORT_CERTIFICATION_STATIC": "complete-report-certification-evidence-jobs.sh",
    "REPORT_CERTIFICATION_RUNTIME": "validate-report-certification-runtime.sh",
    "CUSTOMER_WORK_COORDINATION_RUNTIME": "validate-customer-work-journey.sh",
    "ORGANIZATIONAL_BOUNDARY_RUNTIME": "validate-organizational-boundary-runtime.sh",
    "GOVERNANCE_CHANGE_RUNTIME": "validate-governance-change-runtime.sh",
    "OPERATIONAL_USAGE_LEDGER_GATE": "validate-operational-usage-ledger-e2e.sh",
    "ACTOR_ACCOUNT_CUSTOMER_JOURNEY": "validate-actor-account-customer-journey.sh",
    "SCREEN_CONTRACT_RUNTIME_SAVE_PREVIEW": "validate-screen-contract-runtime-save.sh",
}
for unit, filename in units.items():
    text = (root / "ops/scripts" / filename).read_text(encoding="utf-8")
    assert unit in text, f"missing candidate unit {unit} in {filename}"
    assert "stage-postdeploy-evidence-candidate.sh" in text, f"missing stager in {filename}"
    assert "CARBONET_POSTDEPLOY_EVIDENCE_MODE" in text, f"missing candidate mode in {filename}"

for token in (
    "framework_postdeploy_evidence_candidate",
    "framework_postdeploy_evidence_promotion",
    "framework_promote_postdeploy_evidence_candidate",
    "expected_units constant text[]",
    "expected_processes constant text[]",
    "DB_AUTHORITATIVE_FILESYSTEM_DERIVED",
    "uq_postdeploy_promotion_source_commit UNIQUE (source_commit)",
    "ck_postdeploy_promotion_runtime_hash",
    "postdeploy-evidence-promotion:'||p_source_commit",
    "FOR SHARE",
    "runtime ledger identity changed before atomic promotion",
    "WITH expected(unit_code,process_code,evidence_kind) AS (VALUES",
    "appended_simulation_count=0",
    "job promotion target coverage mismatch",
    "artifact promotion target coverage mismatch",
    "candidate runtime numeric evidence is missing or out of range",
    "job promotion requires at least one exact target for every process",
    "artifact promotion requires at least one exact target for every process",
    "document->>key_name ~ '^[0-9]+$'",
    "runtimeEvidenceHash",
    "actor-account candidate mutable/audit/auth evidence contract mismatch",
    "screen preview rollback/current-write evidence contract mismatch",
    "operational usage-ledger live gate evidence contract mismatch",
    "evidenceKind' IS DISTINCT FROM NEW.evidence_kind",
    "source_commit<>p_source_commit",
    "source_commit=''",
    "sha256(convert_to",
):
    assert token in migration, f"migration contract missing {token}"
for unit in units:
    assert f"'{unit}'" in migration, f"promoter exact set missing {unit}"
assert migration.count("INSERT INTO framework_postdeploy_evidence_promotion") == 1
assert "INSERT INTO framework_simulation_run" not in migration
assert "coalesce((customer->>'actorCount')" not in migration
assert "coalesce((customer->>'taskCount')" not in migration
assert "BEFORE UPDATE OR DELETE" in migration

assert "ON CONFLICT (candidate_id,unit_code) DO NOTHING" in stager
assert "immutable same-unit/different-payload retry fail" in stager
assert "evidence_json=(convert_from" in stager
for token in (
    'stage=="RUNTIME_CANDIDATE_READY"',
    '.metadata.annotations["resonance.ai/target-commit"]==$source',
    'candidate runtime identity/template changed during snapshot',
    'framework_candidate_runtime_identity_hash_v2(',
    'framework_bind_postdeploy_release_attempt_runtime(',
    "jsonb_build_object('runtimeIdentityHash',:'candidate_runtime_identity_hash')",
):
    assert token in stager, f"candidate runtime-bound stager missing {token}"

prepare = promoter.index("printf '%s\\n' \"$SOURCE_COMMIT\" >\"$MARKER_TMP\"")
promotion = promoter.index("framework_promote_postdeploy_evidence_candidate")
rename = promoter.rindex('mv -fT -- "$MARKER_TMP" "$MARKER_FILE"')
assert prepare < promotion < rename, "marker/promotion ordering regressed"
assert 'MARKER_TMP="$(mktemp ' in promoter and '${MARKER_FILE}.tmp' not in promoter
assert ' -X -qAt -v ON_ERROR_STOP=1' in promoter
assert "stat -c %d" in promoter
assert "deployment marker target must be a regular non-symlink file" in promoter
assert 'marker_name" != . && "$marker_name" != ..' in promoter
assert "CARBONET_POSTDEPLOY_DEFER_MARKER_UNTIL_FINAL_VERIFY" in promoter
assert "marker=DEFERRED_UNTIL_FINAL_LIVE_VERIFY" in promoter
live = promoter.index("deployment_json=")
ledger = promoter.index("runtime_ledger=")
assert prepare < live < ledger < promotion < rename, "live/ledger/promotion ordering regressed"
assert "existing_promotion=" not in promoter, "unsafe pre-runtime marker reconciliation returned"
assert "printf '[postdeploy-promoter] %s marker=%s\\n' \"$promotion\" \"$MARKER_FILE\" || true" in promoter
for token in (
    '.status.updatedReplicas', '.status.readyReplicas', '.status.availableReplicas',
    'deployment_uid', 'deployment_generation', 'observed_generation',
    'RUNTIME_CONTAINER', 'image_ref', 'runtime_image_id', 'runtimeIdentityHash',
    'runtime ledger and Kubernetes identity mismatch',
    'candidate_runtime_files=', 'runtime evidence ownership/mode contract mismatch',
    'runtime evidence hash mismatch', 'mapfile -t runtime_pods',
    'prepared marker changed before promotion', '.unitCount==12',
):
    assert token in promoter, f"promoter runtime identity contract missing {token}"

runtime_smoke = (root / "ops/scripts/run-process-runtime-smoke.sh").read_text(encoding="utf-8")
assert "candidate mode forbids current simulation/job promotion" in runtime_smoke
assert 'evidencePath=$evidence_path' in runtime_smoke
assert '${process_name}-${run_identity}-${stamp}.json' in runtime_smoke
assert 'chmod 0444 "$tmp/evidence.json"' in runtime_smoke
assert 'if [[ "$EVIDENCE_MODE" != candidate ]]' in runtime_smoke
governance = (root / "ops/scripts/validate-governance-change-runtime.sh").read_text(encoding="utf-8")
assert 'CARBONET_RUNTIME_SMOKE_PROMOTE="$PROMOTE_JOBS"' in governance
assert "CARBONET_RUNTIME_SMOKE_PROMOTE=true" not in governance
organization = (root / "ops/scripts/validate-organizational-boundary-runtime.sh").read_text(encoding="utf-8")
for validator in (organization, governance):
    assert "RUNTIME_SMOKE_OUTPUT" in validator and "evidencePath=" in validator
    assert "latest.json" not in validator
    assert "freshRuntimeAssertions:true" in validator

actor = (root / "ops/scripts/validate-actor-account-customer-journey.sh").read_text(encoding="utf-8")
assert "ACTOR_ACCOUNT_CUSTOMER_JOURNEY" in actor
assert "draft_snapshot_hex" in actor and "restore_owned_draft" in actor and "for update" in actor.lower()
assert '--data-binary "@$login_payload"' in actor and "/signin/actionLogout" in actor
assert 'if [[ "$EVIDENCE_MODE" != candidate ]]' in actor
assert 'draftMutation:"SKIPPED_CANDIDATE_READ_ONLY"' in actor and "mutableBusinessWrites:0" in actor
assert "securityAuditAppendDelta:2" in actor and "authTokenCleanupVerified:true" in actor
assert "CARBONET_ACTOR_TOKEN_STALE_AFTER_SECONDS" in actor
assert "created_at >= clock_timestamp() - make_interval" in actor
assert "recovering stale dedicated QA sessions" in actor
assert "recent_token_baseline" in actor and "exit 75" in actor
assert "scopeAuditIdDelta:1" in actor and "actorAuditIdDelta:1" in actor
for token in (
    "'schemaVersion',schema_version", "'rowHash',row_hash",
    "'actionCode',action_code", "'resourceType',resource_type", "'outcomeCode',outcome_code",
    "PROJECT_PARTICIPANT_READ", "REGULATORY_SUBMISSION_TRANSITION",
    "EMISSION_PROJECT", "REGULATORY_SUBMISSION", "ACCESS_DENIED",
):
    assert token in actor, f"actor journey authoritative audit evidence missing {token}"
assert "encode(sha256(convert_to(concat_ws('|',audit_id,lower(account_id)" not in actor
assert 'schemaVersion:"1.0"' not in actor and 'auditHash:' not in actor
assert 'actionCode:"PROJECT_DETAIL_READ"' not in actor and 'actionCode:"REGULATORY_ACCEPT"' not in actor
assert 'outcomeCode:"DENIED"' not in actor
assert "mutable_business_digest" in actor and "mutableBusinessHashBefore" in actor
scope_migration = (root / "apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260812033000__harden_scope_access_audit_append_only.sql").read_text(encoding="utf-8")
lifecycle_migration = (root / "apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260812080000__bind_postdeploy_attempt_lifecycle.sql").read_text(encoding="utf-8")
runtime_template_migration = (root / "apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260817235000__bind_runtime_identity_to_pod_template.sql").read_text(encoding="utf-8")
for token in (
    "framework_postdeploy_release_attempt", "STAGED", "PROMOTED", "ABORTED",
    "framework_stage_postdeploy_release_attempt", "framework_abort_postdeploy_release_attempt",
    "exact-CAS", "runtime_identity_hash", "PROMOTION_COMMITTED",
    "fk_postdeploy_candidate_attempt_identity",
):
    assert token in lifecycle_migration, f"attempt lifecycle migration missing {token}"
wrapper_start = lifecycle_migration.rindex("CREATE OR REPLACE FUNCTION framework_promote_postdeploy_evidence_candidate(")
wrapper = lifecycle_migration[wrapper_start:]
assert wrapper.index("pg_advisory_xact_lock") < wrapper.index("SELECT * INTO attempt"), \
    "promoter wrapper reintroduced row-to-advisory lock inversion"
abort_start = lifecycle_migration.index("CREATE OR REPLACE FUNCTION framework_abort_postdeploy_release_attempt(")
abort_end = lifecycle_migration.index("-- Preserve the fully validated", abort_start)
abort_body = lifecycle_migration[abort_start:abort_end]
assert abort_body.index("pg_advisory_xact_lock") < abort_body.index("UPDATE framework_postdeploy_release_attempt")
assert "REVOKE ALL ON FUNCTION framework_promote_postdeploy_evidence_candidate_v1" in lifecycle_migration
assert "aclexplode" in lifecycle_migration and "acl.grantee<>proc.proowner" in lifecycle_migration
for token in (
    "ADD COLUMN IF NOT EXISTS pod_template_sha256 varchar(64)",
    "ck_framework_runtime_release_state_pod_template_sha256",
    "framework_runtime_release_uses_legacy_identity_v1",
    "framework_runtime_release_identity_hash",
    "CARBONET_RUNTIME_IDENTITY_V2",
    "jsonb_build_array(",
    "framework_promote_postdeploy_evidence_candidate_v1(",
    "framework_screen_workflow_current_runtime_identity()",
    "framework_composite_verified_canary_dispatch_exact(",
    "podTemplateSha256",
    "ADD COLUMN IF NOT EXISTS candidate_runtime_identity_hash varchar(64)",
    "framework_candidate_runtime_identity_hash_v2(",
    "framework_bind_postdeploy_release_attempt_runtime(",
    "candidate_runtime_identity_hash IS DISTINCT FROM p_runtime_identity_hash",
    "evidence_json->>'runtimeIdentityHash' IS DISTINCT FROM p_runtime_identity_hash",
    "p_source_commit||'|'||p_runtime_identity_hash||'|'",
):
    assert token in runtime_template_migration, f"runtime PodTemplate identity migration missing {token}"
assert "runtime_identity_hash:=framework_runtime_release_identity_hash(runtime_state)" in runtime_template_migration
assert "runtime ledger pod template identity is unavailable" in runtime_template_migration
assert "REVOKE ALL ON FUNCTION framework_promote_postdeploy_evidence_candidate_v1" in runtime_template_migration
assert "aclexplode" in runtime_template_migration and "acl.grantee<>proc.proowner" in runtime_template_migration
for exact in (
    "76a08e672ab7054914ec3b5aecb57bc8e7a298fa",
    "5a9323d6-446c-49d2-ad3e-c300c18f5803",
    "sha256:48311ffbb0396684021efc84811c73432263850ce18c4d4412eb81151749e160",
    "3714b172fe60eed5d07658103aa5f51d6f9ef765f2cee2bd0ba304e71bfd9c1a",
):
    assert exact in runtime_template_migration, f"legacy backfill/bridge pin missing {exact}"
journal_helper = (root / "ops/scripts/postdeploy-attempt-journal.py").read_text(encoding="utf-8")
for token in ("SNAPSHOT_CAPTURED", "ARMED", "ABORT_AUTHORIZED", "PHYSICAL_RESTORED",
              "RESTORED_VERIFIED", "mark-db-staged", "cancel-pre-runtime", "advance-rollback"):
    assert token in journal_helper, f"durable rollback journal missing {token}"
assert "framework_stage_postdeploy_release_attempt" in stager
candidate_pg = (root / "ops/tests/test-postdeploy-candidate-evidence-postgres.sh").read_text(encoding="utf-8")
assert "framework_scope_access_audit_hash" in scope_migration and "row_hash" in scope_migration
assert 'cat "$MIGRATION"' in candidate_pg and 'cat "$SCOPE_AUDIT_MIGRATION"' in candidate_pg
assert candidate_pg.index('cat "$MIGRATION"') < candidate_pg.index('cat "$SCOPE_AUDIT_MIGRATION"')
assert 'cat "$RUNTIME_TEMPLATE_MIGRATION"' in candidate_pg
assert candidate_pg.index('cat "$LIFECYCLE_MIGRATION"') < candidate_pg.index('cat "$RUNTIME_TEMPLATE_MIGRATION"')
for token in ("postdeploy_runtime_identity_hash_v1", "legacy V1 runtime identity hash was accepted",
              "exact audited legacy row was not backfilled",
              "unknown unbound legacy-like row did not fail closed",
              "unaudited Deployment UID inherited legacy V1 identity",
              "canonical helper and shell V2 expression diverged",
              "post-migration NULL template identity did not fail closed",
              "template-only change did not alter V2 runtime identity",
              "malformed PodTemplate SHA-256 was accepted"):
    assert token in candidate_pg, f"runtime V2 PostgreSQL mutant missing {token}"
record_runtime = (root / "ops/scripts/record-runtime-release-state.sh").read_text(encoding="utf-8")
authority_check = (root / "ops/scripts/check-postdeploy-authoritative-promotion.sh").read_text(encoding="utf-8")
account_audit = (root / "ops/scripts/audit-account-lock-recovery-assurance.sh").read_text(encoding="utf-8")
deploy = deploy_path.read_text(encoding="utf-8")
for token in ("CARBONET_RUNTIME_EXPECTED_TEMPLATE_SHA256", "pod_template_sha256=excluded.pod_template_sha256",
              "'podTemplateSha256',pod_template_sha256", ".podTemplateSha256==$podTemplateSha256"):
    assert token in record_runtime, f"runtime recorder DB template binding missing {token}"
assert "framework_runtime_release_identity_hash(runtime)" in promoter
assert "'podTemplateSha256',pod_template_sha256" in promoter
assert "NOT (to_jsonb(runtime) ? 'pod_template_sha256')" in authority_check
assert authority_check.count("CARBONET_RUNTIME_IDENTITY_V2") == 2
assert "ELSE NULL" in authority_check
assert "NOT (to_jsonb(runtime) ? 'pod_template_sha256')" in deploy
assert "CARBONET_RUNTIME_IDENTITY_V2" in deploy and "ELSE NULL" in deploy
assert "to_jsonb(runtime)->>'pod_template_sha256' AS pod_template_sha256" in account_audit
assert '($runtime.deployment_generation // -1) <= ($deployment.metadata.generation // -2)' in account_audit
assert '($runtime.pod_template_sha256 // "") == $livePodTemplateSha256' in account_audit
java_runtime_consumers = [
    "CompositeAutocompletionReadinessService.java",
    "CompositeDesignOperationalWorker.java",
    "CompositeLiveSmokeEvidenceService.java",
    "CompositePhysicalEvidenceService.java",
]
java_dir = root / "modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service"
for name in java_runtime_consumers:
    source = (java_dir / name).read_text(encoding="utf-8")
    assert "framework_runtime_release_identity_hash(" in source, f"{name} does not use canonical runtime V2 hash"
    assert "runtime.image_id,runtime.health_status" not in source
actor_pg=(root / "modules/resonance-common/carbonet-common-core/src/test/java/egovframework/com/platform/governance/service/ActorProcessGovernanceMutationPropagationPostgresTest.java").read_text(encoding="utf-8")
composite_apply='applyMigration(COMPOSITE_DESIGN_MIGRATION,false);'
v2_fixture='installRuntimeIdentityV2CompositeDispatchFixture();'
assert actor_pg.index(composite_apply) < actor_pg.index(v2_fixture)
assert "dispatch.runtime_identity_hash=framework_runtime_release_identity_hash(runtime)" in actor_pg
assert "set pod_template_sha256=repeat('e',64),recorded_at=clock_timestamp()" in actor_pg
assert "set pod_template_sha256=repeat('f',64),recorded_at=clock_timestamp()" in actor_pg
assert "check(pod_template_sha256 is null or pod_template_sha256~'^[0-9a-f]{64}$')" in actor_pg

# The pre-schema bridge cannot call a function that does not exist yet, so its
# SQL is necessarily duplicated in shell. Compare the actual producer bytes
# semantically: exact V2 field order and the entire legacy eligibility tuple
# must match the migration helper and both authority-check branches.
import re

expected_v2_fields = (
    "source_commit", "deployment_namespace", "deployment_name", "deployment_uid",
    "deployment_generation", "observed_generation", "desired_replicas",
    "image_ref", "image_id", "health_status", "pod_template_sha256",
)

def v2_sequences(text):
    found=[]
    for body in re.findall(
        r"jsonb_build_array\(\s*'CARBONET_RUNTIME_IDENTITY_V2'\s*,(.*?)\)\s*::text",
        text,re.S,
    ):
        normalized=body.replace("(p_runtime).","")
        normalized=normalized.replace("to_jsonb(runtime)->>'pod_template_sha256'","pod_template_sha256")
        found.append(tuple(part.strip() for part in normalized.split(",")))
    return found

hash_helper = runtime_template_migration[
    runtime_template_migration.index("CREATE OR REPLACE FUNCTION framework_runtime_release_identity_hash("):
    runtime_template_migration.index("COMMENT ON FUNCTION framework_runtime_release_identity_hash",)
]
auto_hash = deploy[deploy.index("current_runtime_identity_hash() {"):
                   deploy.index("transition_postdeploy_attempt_journal() {")]
assert v2_sequences(hash_helper) == [expected_v2_fields]
assert v2_sequences(auto_hash) == [expected_v2_fields]
assert v2_sequences(authority_check) == [expected_v2_fields,expected_v2_fields]
v2_order_mutant=list(expected_v2_fields)
v2_order_mutant[7],v2_order_mutant[8]=v2_order_mutant[8],v2_order_mutant[7]
assert tuple(v2_order_mutant) != expected_v2_fields

def legacy_predicates(text, migration=False):
    if migration:
        start=text.index("CREATE OR REPLACE FUNCTION framework_runtime_release_uses_legacy_identity_v1(")
        end=text.index("COMMENT ON FUNCTION framework_runtime_release_uses_legacy_identity_v1",start)
        blocks=[text[start:end]]
    else:
        blocks=re.findall(
            r"WHEN\s+release_key='CARBONET_RUNTIME'.*?\bTHEN",
            text,re.S,
        )
    result=[]
    for block in blocks:
        normalized=block.replace("(p_runtime).","")
        normalized=normalized.replace("to_jsonb(runtime)->>'pod_template_sha256'","pod_template_sha256")
        result.append(tuple(re.findall(r"\b([a-z0-9_]+)\s*=\s*'([^']+)'",normalized)))
    return result

legacy_expected=legacy_predicates(runtime_template_migration,migration=True)[0]
assert tuple(field for field,_ in legacy_expected) == (
    "release_key","source_commit","deployment_namespace","deployment_name","deployment_uid",
    "image_ref","image_id","health_status","pod_template_sha256",
)
assert legacy_predicates(auto_hash) == [legacy_expected]
assert legacy_predicates(authority_check) == [legacy_expected,legacy_expected]
legacy_drop_uid=tuple(pair for pair in legacy_expected if pair[0] != "deployment_uid")
assert legacy_drop_uid != legacy_expected
assert "p_reduced_hash" in candidate_pg and "candidate-test-reduced-hash" in candidate_pg
assert "reduced/stale row hash mutation was not rejected" in candidate_pg
assert "9000000000000000101" in candidate_pg and "9000000000000000102" in candidate_pg
candidate_branch = actor[actor.index('if [[ "$EVIDENCE_MODE" == candidate ]]'):]
assert "update framework_customer_journey_validation_run" not in candidate_branch.split("else",1)[0]

customer = (root / "ops/scripts/validate-customer-work-journey.sh").read_text(encoding="utf-8")
assert "candidate mode is read-only" in customer and "EXISTING_ACCEPTED_READ_ONLY" in customer
assert customer.index('if [[ "$EVIDENCE_MODE" == candidate ]]') < customer.index("deadline=\"$(date -d '+30 days' +%F)\"")
assert "carbonet_qa_logout" in customer and "CARBONET_QA_AUTH_SESSION_ACTIVE=1" in customer
for validator_name in ("validate-activity-data-runtime.sh", "validate-emission-calculation-runtime.sh"):
    validator=(root / "ops/scripts" / validator_name).read_text(encoding="utf-8")
    assert "carbonet_qa_logout" in validator and "CARBONET_QA_AUTH_SESSION_ACTIVE=1" in validator
    assert "%{http_code} %{time_total}" in validator

screen_wrapper = (root / "ops/scripts/validate-screen-contract-runtime-save.sh").read_text(encoding="utf-8")
screen_mjs = (root / "ops/scripts/validate-screen-contract-runtime-save.mjs").read_text(encoding="utf-8")
service = (root / "modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/ActorProcessGovernanceService.java").read_text(encoding="utf-8")
controller = (root / "modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/web/ActorProcessGovernanceApiController.java").read_text(encoding="utf-8")
runtime_service = (root / "modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/ScreenContractRuntimeService.java").read_text(encoding="utf-8")
runtime_service_test = (root / "modules/resonance-common/carbonet-common-core/src/test/java/egovframework/com/platform/governance/service/ScreenContractRuntimeServiceTest.java").read_text(encoding="utf-8")
preview_bundle_migration = (root / "apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260814173000__project_professional_screen_preview_bundle.sql").read_text(encoding="utf-8")
assert "SCREEN_CONTRACT_RUNTIME_SAVE_PREVIEW" in screen_wrapper and "previewMode==true" in screen_wrapper
assert "/professional-screen-contracts/preview" in screen_mjs and "previewCount: previewMode ? saves.length : 0" in screen_mjs
assert 'CARBONET_SCREEN_CONTRACT_SAVE_MAX_MS || "2500"' in screen_mjs
assert 'saved.elapsedMs <= maxSaveMillis' in screen_mjs
assert 2000 < int(re.search(r'SAVE_MAX_MS \|\| "([0-9]+)"', screen_mjs).group(1)) < 3000
assert "/signin/actionLogout" in screen_mjs
assert 'publication?.predicted === true' in screen_mjs and 'publication?.applied === false' in screen_mjs
assert 'publication?.published === false' in screen_mjs and "wouldPublishMatchesReason" in screen_mjs
assert 'new Set(fingerprints).size === 1' in screen_mjs and 'fingerprint: fingerprints[0]' in screen_mjs
assert '"DESIGN_CHANGED", "HISTORICAL_VERSION_REUSED"' in screen_mjs
assert "screen_target_state_digest" in screen_wrapper and "pg_sequences" in screen_wrapper
assert "databaseStateHashBefore" in screen_wrapper and "databaseCurrentWrites:0" in screen_wrapper
assert "TARGET_CONTRACT_ID" in screen_wrapper and "databaseTarget" in screen_wrapper

def assert_scoped_screen_digest(value):
    assert "where c.contract_id=$TARGET_CONTRACT_ID" in value
    assert "where b.contract_id=$TARGET_CONTRACT_ID" in value
    assert "where v.contract_id=$TARGET_CONTRACT_ID" in value
    assert "where i.item_id=$SCREEN_ITEM_ID" in value
    assert "'tableCounts',jsonb_build_object(" in value
    for table in ("framework_professional_screen_contract", "framework_screen_contract_binding",
                  "framework_screen_contract_version", "framework_screen_contract_event",
                  "framework_page_development_item"):
        assert f"(select count(*) from {table})" in value
    assert value.count("pg_get_serial_sequence") == 2
    assert "pg_get_serial_sequence('framework_screen_contract_version','version_id')" in value
    assert "pg_get_serial_sequence('framework_screen_contract_event','event_id')" in value
    assert "pg_get_serial_sequence('framework_professional_screen_contract','contract_id')" not in value
    assert "pg_get_serial_sequence('framework_page_development_item','item_id')" not in value
    assert "jsonb_agg(to_jsonb(c) order by c.contract_id)" not in value

assert_scoped_screen_digest(screen_wrapper)
for old,new,label in (
    ("where c.contract_id=$TARGET_CONTRACT_ID", "where true", "target-contract-scope"),
    ("'tableCounts',jsonb_build_object(", "'removedCounts',jsonb_build_object(", "global-cardinality"),
    ("pg_get_serial_sequence('framework_screen_contract_event','event_id')",
     "pg_get_serial_sequence('framework_professional_screen_contract','contract_id')", "scheduler-sequence-isolation"),
):
    mutated=screen_wrapper.replace(old,new,1)
    try: assert_scoped_screen_digest(mutated)
    except AssertionError: pass
    else: raise AssertionError(f"screen preview {label} mutation survived")

def scoped_preview_state(target_hash,table_counts,publication_sequences,unrelated_scheduler_hash):
    return target_hash,tuple(sorted(table_counts.items())),tuple(publication_sequences)
base=scoped_preview_state("target-v1",{"contracts":100,"bindings":100,"versions":100,"events":100,"pageItems":100},(41,51),"scheduler-v1")
assert base==scoped_preview_state("target-v1",{"contracts":100,"bindings":100,"versions":100,"events":100,"pageItems":100},(41,51),"scheduler-v2")
assert base!=scoped_preview_state("target-v2",{"contracts":100,"bindings":100,"versions":100,"events":100,"pageItems":100},(41,51),"scheduler-v2")
for key in ("contracts","bindings","versions","events","pageItems"):
    counts={"contracts":100,"bindings":100,"versions":100,"events":100,"pageItems":100};counts[key]+=1
    assert base!=scoped_preview_state("target-v1",counts,(41,51),"scheduler-v2")
for sequences in ((42,51),(41,52)):
    assert base!=scoped_preview_state("target-v1",{"contracts":100,"bindings":100,"versions":100,"events":100,"pageItems":100},sequences,"scheduler-v2")
usage=(root / "ops/scripts/validate-operational-usage-ledger-e2e.sh").read_text(encoding="utf-8")
for token in ("allowedRole:\"SYSTEM_ADMIN_FAMILY\"", "anonymousDenied:2", "ordinaryDenied:7",
              "browserViewports:2", "persistentFixtures:0", "reviewCreateReloadIdempotencyCleanup:true"):
    assert token in usage
def assert_read_only_preview(actor_source,runtime_source):
    save=actor_source[actor_source.index("@Transactional public Map<String,Object> saveProfessionalScreenContract"):
                      actor_source.index("@Transactional(readOnly=true) public Map<String,Object> saveProfessionalScreenContractPreview")]
    preview=actor_source[actor_source.index("@Transactional(readOnly=true) public Map<String,Object> saveProfessionalScreenContractPreview"):
                         actor_source.index("Map<String,Object> professionalScreenContractInput",actor_source.index("saveProfessionalScreenContractPreview"))]
    for shared in ("professionalScreenContractInput", "professionalContractReadiness", "previewProfessionalScreenDesignGate"):
        assert shared in save and shared in preview
    assert "saveProfessionalScreenContract(b,actor)" not in preview
    assert "markCurrentTransactionRollbackOnly" not in preview and "jdbc.update" not in preview
    assert "predictProfessionalContract" in preview and '"READ_ONLY_PREDICTION"' in preview
    assert 'runtimeValues.remove("contractId")' in preview
    assert 'runtimeValues.remove("kpiContract")' in preview
    predictor=runtime_source[runtime_source.index("public Map<String,Object> predictProfessionalContract"):
                             runtime_source.index("private PreparedProfessionalContract prepareProfessionalContract")]
    assert "validateProfessionalPredictionValues(proposedValues)" in predictor
    assert "prepareProfessionalContract(contractId, validatedValues, false)" in predictor
    assert "activeProfessionalContractBindings(contractId, false)" in predictor
    assert "jdbc.update" not in predictor and "nextval" not in predictor.lower()
    assert 'publicationResult(true, "DESIGN_CHANGED"' in predictor
    assert "PROFESSIONAL_PREDICTION_FIELDS" in runtime_source
    assert "PROFESSIONAL_CONTRACT_STATUSES" in runtime_source
    assert 'proposedValues.containsKey("contractStatus")' in runtime_source
    assert "PROFESSIONAL_CONTRACT_STATUSES.contains(status)" in runtime_source
    assert "Unsupported professional contract prediction fields" in runtime_source
    preparer=runtime_source[runtime_source.index("private PreparedProfessionalContract prepareProfessionalContract"):
                            runtime_source.index("private Map<String,Object> supportContract")]
    assert "framework_canonical_screen_bundle(" in preparer
    canonical_call=preparer[preparer.index("framework_canonical_screen_bundle("):
                            preparer.index(')::text as "canonicalBundle"')]
    assert "?::jsonb" in canonical_call and "write(projection), contractId" in preparer
    assert 'result.put("published", predicted ? false : published)' in runtime_source
    assert 'result.put("wouldPublish", published)' in runtime_source
    publisher=runtime_source[runtime_source.index("public Map<String,Object> publishProfessionalContract"):
                             runtime_source.index("public Map<String,Object> predictProfessionalContract")]
    assert "prepareProfessionalContract(contractId, Map.of(), true)" in publisher

assert_read_only_preview(service,runtime_service)
assert "@Autowired\n    public ScreenContractRuntimeService(DataSource dataSource, ObjectMapper mapper)" in runtime_service
assert "AnnotationConfigApplicationContext" in runtime_service_test
assert "context.registerBean(ScreenContractRuntimeService.class)" in runtime_service_test
for token in ("rejectsImmutableAndUnknownProfessionalPredictionOverridesBeforeDatabaseAccess",
              'List.of("processCode", "routePath", "contractId", "kpiContract", "unknownField")',
              "projectsLegacyEightStatesIntoOneFinalTenStateRuntimeAndSupportHash",
              "rejectsNonCanonicalProfessionalPredictionStatusesBeforeDatabaseAccess",
              "predictsUnchangedWithoutClaimingPublication",
              "predictsHistoricalVersionReuseWithoutClaimingPublication"):
    assert token in runtime_service_test
for token in (
    "framework_project_professional_screen_contract",
    "jsonb_populate_record(persisted,overlay)",
    "framework_strict_jsonb_array(entry.value#>>'{}')",
    "framework_canonical_screen_design($1,$2,$3,$4,'{}'::jsonb)",
    "framework_canonical_screen_bundle($1,$2,$3,$4,'{}'::jsonb)",
):
    assert token in preview_bundle_migration
for field in (
    "businessPurpose", "entryCondition", "exitCondition", "sectionContract",
    "fieldContract", "commandContract", "stateContract", "apiContract",
    "dataContract", "evidenceContract", "responsiveContract",
    "accessibilityContract", "securityContract", "apiVerified",
    "databaseVerified", "authorityVerified", "responsiveVerified",
    "accessibilityVerified", "exceptionStatesVerified", "auditEvidenceRef",
    "contractStatus",
):
    assert preview_bundle_migration.count("'"+field+"'") >= 2
for status in ("DRAFT", "REVIEW_REQUIRED", "DESIGN_COMPLETE", "APPROVED", "VERIFIED"):
    assert "'"+status+"'" in preview_bundle_migration
    assert '"'+status+'"' in runtime_service
assert "proposed ? 'contractStatus'" in preview_bundle_migration
assert "proposed->>'contractStatus'=ANY(contract_statuses)" in preview_bundle_migration
assert not re.search(r"\b(insert|update|delete|nextval)\b", preview_bundle_migration, re.I)
for actor_mutation,runtime_mutation,label in (
    (service.replace("@Transactional(readOnly=true) public Map<String,Object> saveProfessionalScreenContractPreview",
                     "@Transactional public Map<String,Object> saveProfessionalScreenContractPreview",1),runtime_service,"read-only-transaction"),
    (service,runtime_service.replace("prepareProfessionalContract(contractId, validatedValues, false)",
                                     "prepareProfessionalContract(contractId, validatedValues, true)",1),"runtime-write-lock"),
    (service,runtime_service.replace("validateProfessionalPredictionValues(proposedValues)",
                                     "new LinkedHashMap<>(proposedValues)",1),"runtime-allowlist-bypass"),
    (service,runtime_service.replace("PROFESSIONAL_CONTRACT_STATUSES.contains(status)",
                                     "true",1),"runtime-status-enum-bypass"),
    (service,runtime_service.replace(
        '?::jsonb\n                   )::text as "canonicalBundle"',
        '\'{}\'::jsonb\n                   )::text as "canonicalBundle"',1),
     "runtime-stale-bundle-projection"),
    (service.replace('runtimeValues.remove("contractId");',"",1),runtime_service,"actor-contract-id-leak"),
    (service,runtime_service.replace('result.put("published", predicted ? false : published)',
                                     'result.put("published", published)',1),"preview-published-semantics"),
):
    try: assert_read_only_preview(actor_mutation,runtime_mutation)
    except (AssertionError,ValueError): pass
    else: raise AssertionError(f"screen preview {label} mutation survived")
assert 'PostMapping("/professional-screen-contracts/preview")' in controller
assert not any(token in runtime_service for token in ("java.io.", "java.nio.file", "HttpClient", "RestTemplate", "ProcessBuilder"))

identity_group=(root / "ops/scripts/run-post-deploy-validation-groups.sh").read_text(encoding="utf-8")
identity_candidate=identity_group[identity_group.index('if [[ "${CARBONET_POSTDEPLOY_EVIDENCE_MODE:-}" == candidate ]]'):
                                  identity_group.index("  else", identity_group.index('if [[ "${CARBONET_POSTDEPLOY_EVIDENCE_MODE:-}" == candidate ]]'))]
assert "identity_current_digest" in identity_candidate and "currentWrites=0" in identity_candidate
assert "validate-keycloak-carbonet-identity-sync.sh" in identity_candidate
assert "resonance-keycloak-carbonet-identity-sync.sh" not in identity_candidate
assert "resonance-keycloak-carbonet-identity-sync-install.sh" not in identity_candidate

role_e2e=(root / "ops/scripts/resonance-actor-process-role-e2e.sh").read_text(encoding="utf-8")
assert role_e2e.count("value.committed !== false") == 2
assert "workflow_state_digest" in role_e2e and "workflow_digest_after" in role_e2e
assert "framework_process_execution_event" in role_e2e and "pg_sequences" not in role_e2e
assert 'value.databaseCurrentWrites !== 0' in role_e2e and 'value.mutationScope !== "READ_ONLY_VALIDATION"' in role_e2e

if os.environ.get("CANDIDATE_EVIDENCE_SKIP_DEPLOY_WIRING") == "true":
    raise SystemExit(0)
if os.environ.get("CANDIDATE_EVIDENCE_SKIP_DEPLOY_WIRING") != "true":
    deploy = deploy_path.read_text(encoding="utf-8")
    for token in (
        "CARBONET_POSTDEPLOY_CANDIDATE_ID",
        "CARBONET_POSTDEPLOY_EVIDENCE_MODE=candidate",
        "CARBONET_POSTDEPLOY_SOURCE_COMMIT",
        "promote-postdeploy-candidate-evidence.sh",
    ):
        assert token in deploy, f"auto-deploy candidate wiring missing {token}"
    gate = (root / "ops/scripts/resonance-full-screen-deploy-gate.sh").read_text(encoding="utf-8")
    build_deploy = (root / "ops/scripts/resonance-k8s-build-deploy-80-v2.sh").read_text(encoding="utf-8")
    startup_profile = (root / "ops/scripts/promote-runtime-startup-profile.sh").read_text(encoding="utf-8")
    failure_handler = (root / "ops/scripts/carbonet-auto-deploy-failure-handler.sh").read_text(encoding="utf-8")
    init = deploy[deploy.index("initialize_postdeploy_attempt_journal() {"):
                  deploy.index("current_runtime_identity_hash() {")]
    assert init.index("POSTDEPLOY_JOURNAL_HELPER") < init.index("stage_postdeploy_release_attempt_db")
    assert 'rollbackStage:"SNAPSHOT_CAPTURED"' in init and "postdeploy_db_attempt_staged=true" in init
    installed_journal_helper = "/opt/resonance-data/control-plane/bin/postdeploy-attempt-journal.py"
    assert f'POSTDEPLOY_JOURNAL_HELPER="${{CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_HELPER:-{installed_journal_helper}}}"' in deploy
    rebind = deploy[deploy.index("rebind_default_postdeploy_helpers() {"):
                    deploy.index("# The applied-source marker")]
    assert f'POSTDEPLOY_JOURNAL_HELPER="{installed_journal_helper}"' in rebind
    stage_db = deploy[deploy.index("stage_postdeploy_release_attempt_db() {"):
                      deploy.index("verify_postdeploy_release_attempt_db_staged() {")]
    assert 'CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_HELPER="$POSTDEPLOY_JOURNAL_HELPER"' in stage_db
    build_child = deploy[deploy.index("IMMUTABLE_FRONTEND_IMAGE=true"):
                         deploy.index("verify_postdeploy_release_attempt_db_staged ||")]
    assert 'CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_HELPER="$POSTDEPLOY_JOURNAL_HELPER"' in build_child
    assert 'CARBONET_POSTDEPLOY_LEADER_RESOLVER="$POSTDEPLOY_LEADER_RESOLVER"' in stage_db
    assert 'CARBONET_POSTDEPLOY_LEADER_RESOLVER="$POSTDEPLOY_LEADER_RESOLVER"' in build_child
    assert 'RESONANCE_POSTGRES_LEADER_POD="${POSTGRES_POD:-}"' in build_child
    assert "CARBONET_DURABLE_ATTEMPT_REQUIRED=true" in build_child
    enable = deploy[deploy.index("enable_postdeploy_candidate_mode() {"):
                    deploy.index("run_postdeploy_candidate_validation_groups() {")]
    assert "stage_postdeploy_release_attempt_db" not in enable
    assert "verify_postdeploy_release_attempt_db_staged" in enable
    startup_branch = deploy[deploy.index("# A measured JVM profile changes only the Deployment environment."):
                            deploy.index("# Test/deployment automation changes do not alter the running application.")]
    assert startup_branch.count("enable_postdeploy_candidate_mode") == 1
    assert startup_branch.index("enable_postdeploy_candidate_mode") < \
        startup_branch.index("promote-runtime-startup-profile.sh")
    assert startup_profile.index('kubectl -n "$namespace" set env') < \
        startup_profile.index('kubectl -n "$namespace" rollout status')
    for startup_mutant in (
        startup_branch.replace("  enable_postdeploy_candidate_mode\n", "", 1),
        startup_branch.replace(
            "  enable_postdeploy_candidate_mode\n  CARBONET_DEPLOY_ROOT=",
            "  CARBONET_DEPLOY_ROOT=", 1).replace(
                "    bash ops/scripts/promote-runtime-startup-profile.sh\n",
                "    bash ops/scripts/promote-runtime-startup-profile.sh\n  enable_postdeploy_candidate_mode\n", 1),
    ):
        assert startup_mutant.count("enable_postdeploy_candidate_mode") != 1 or \
            startup_mutant.index("enable_postdeploy_candidate_mode") > \
            startup_mutant.index("promote-runtime-startup-profile.sh")
    reconciler = deploy[deploy.index("recover_staged_postdeploy_attempt_after_failure() {"):
                        deploy.index("cleanup_deploy() {")]
    assert reconciler.index("postdeploy_authoritative_promotion_status") < reconciler.index("abort_postdeploy_release_attempt_db")
    # A same-source/canonical winner is already ABORTED by the DB wrapper and
    # is disarmed locally without physical rollback.  The abort-before-journal
    # ordering invariant applies to the NOT_PROMOTED restoration branch.
    not_promoted = reconciler[reconciler.index('      1)\n        abort_postdeploy_release_attempt_db'):]
    assert not_promoted.index("abort_postdeploy_release_attempt_db") < not_promoted.index("transition_postdeploy_attempt_journal ABORTED")
    assert reconciler.index("transition_postdeploy_attempt_journal ABORTED") < reconciler.index("restore-physical")
    assert reconciler.index("restore-physical") < reconciler.index('record_runtime_release_state "$baseline"')
    assert reconciler.index('record_runtime_release_state "$baseline"') < reconciler.index("restore-markers")
    assert reconciler.index("RESTORED_VERIFIED") < reconciler.index("clear-failed")
    assert reconciler.index("clear-failed") < reconciler.index("archive_postdeploy_attempt_journal_terminal ABORTED false")
    assert "MIGRATION_UNAVAILABLE_ROLLBACK" not in reconciler
    lane = deploy[deploy.index("run_runtime_release_validation_lanes() {"):
                  deploy.index("archive_postdeploy_attempt_journal_terminal() {")]
    assert "resonance-full-screen-deploy-gate.sh restore" not in lane
    assert "durable reconciler owns rollback" in lane
    assert "FULL_SCREEN_GATE_AUTO_ROLLBACK=false" in deploy[deploy.index('frontend_smoke_pattern="$(node'):
                                                              deploy.index('echo "[auto-deploy] frontend overlay deployed')]
    assert 'FULL_SCREEN_GATE_STATE_DIR="${CARBONET_FULL_SCREEN_GATE_STATE_DIR:-${FULL_SCREEN_GATE_STATE_DIR:-/opt/resonance-data/deploy/full-screen-deploy-gate}}"' in deploy
    assert "source \"$ACTIVE_FILE\"" not in gate
    assert 'startswith("resonance.ai/")' in gate and "deployment.kubernetes.io/revision" in gate
    assert "restore-physical" in gate and "restore-markers" in gate and "verify-restored-physical" in gate
    for snapshot_file in ("deployment-rollout-policy.json", "web-deployment-state.json", "web-service.json"):
        assert snapshot_file in gate
    assert gate.index('rsync -a --exclude=') < gate.index('mv -fT -- "$index_tmp" "$OVERLAY_DIR/index.html"') < gate.index('rsync -a --delete-after')
    assert 'patch "service/$WEB_SERVICE" --type=json' in gate
    assert 'FULL_SCREEN_GATE_EXPECTED_MANIFEST_SHA256' in gate
    rollout = build_deploy[build_deploy.index("rollout_image() {"):
                           build_deploy.index("verify_runtime() {")]
    post_flyway = rollout[rollout.index('if [[ "$CARBONET_DURABLE_ATTEMPT_REQUIRED"'):
                           rollout.index("publish_pending_frontend_staging")]
    assert "CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_HELPER" in post_flyway
    arm = rollout.index("stage-postdeploy-release-attempt.sh")
    ledger_invalidate = rollout.index("require_runtime_release_state_invalidation_before_live_mutation",arm)
    assert arm < ledger_invalidate
    invalidation_guard = build_deploy[
        build_deploy.index("invalidate_runtime_release_state_before_live_mutation() {"):
        build_deploy.index("sync_overlay() {")
    ]
    assert 'bash "$RUNTIME_RELEASE_STATE_RECORDER" --invalidate' in invalidation_guard
    assert "return 79" not in invalidation_guard and "count=0" in invalidation_guard
    assert 'rollback_and_fail "RUNTIME_LEDGER_INVALIDATION_FAILED"' in invalidation_guard
    assert '[[ "$CARBONET_DURABLE_ATTEMPT_REQUIRED" == true ]] || return 0' not in invalidation_guard
    assert 'if [[ "$CARBONET_DURABLE_ATTEMPT_REQUIRED" == true \\\n     && "$POSTDEPLOY_DB_ATTEMPT_STAGED" != true ]]' in invalidation_guard
    for mutation in ("publish_pending_frontend_staging", 'kubectl -n "$NAMESPACE" set env',
                     'kubectl apply -f -', 'kubectl -n "$NAMESPACE" patch'):
        assert arm < ledger_invalidate < rollout.index(mutation, ledger_invalidate), \
            f"live mutation precedes DB arm/ledger invalidation: {mutation}"
    def retired_direct_build_contract(text):
        guard_value = 'CARBONET_DURABLE_ATTEMPT_REQUIRED="${CARBONET_DURABLE_ATTEMPT_REQUIRED:-false}"'
        guard_if = 'if [[ "$CARBONET_DURABLE_ATTEMPT_REQUIRED" != true ]]; then'
        message = "[build-deploy-v2] RETIRED: direct execution requires the official durable auto-deploy pipeline"
        try:
            strict = text.index("set -euo pipefail")
            value = text.index(guard_value, strict)
            condition = text.index(guard_if, value)
            refusal = text.index(message, condition)
            exit_78 = text.index("  exit 78", refusal)
            end = text.index("\nfi", exit_78)
            password = text.index("export RESONANCE_SUDO_PASSWORD")
            helper = text.index('source "$ROOT_DIR/ops/scripts/build.sh"')
        except ValueError:
            return False
        return (text.count(guard_value) == 1
                and strict < value < condition < refusal < exit_78 < end
                < password < helper)
    assert retired_direct_build_contract(build_deploy)
    for direct_retirement_mutant in (
        build_deploy.replace("  exit 78", "  exit 0", 1),
        build_deploy.replace('!= true', '== false', 1),
        build_deploy.replace(
            'if [[ "$CARBONET_DURABLE_ATTEMPT_REQUIRED" != true ]]; then',
            'if [[ "$CARBONET_DURABLE_ATTEMPT_REQUIRED" == false ]]; then', 1),
    ):
        assert not retired_direct_build_contract(direct_retirement_mutant)
    project_core = (root / "ops/scripts/resonance-project-core-deploy.sh").read_text(encoding="utf-8")
    ai_fast_dev = (root / "ops/scripts/resonance-ai-fast-dev.sh").read_text(encoding="utf-8")
    command_index = (root / "ops/scripts/resonance-command-index.sh").read_text(encoding="utf-8")
    v3_deploy = (root / "ops/scripts/resonance-v3-deploy.sh").read_text(encoding="utf-8")
    file_watch = (root / "ops/scripts/resonance-file-watch.sh").read_text(encoding="utf-8")
    assert 'exec /usr/bin/bash "$ROOT_DIR/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"' in project_core
    assert "8  | deploy-v2  - retired (official auto-deploy only; no direct route)" in command_index
    assert "resonance-k8s-build-deploy-80-v2.sh (병렬 빌드)" not in command_index
    assert 'SKIP_IMAGE_BUILD=true exec /usr/bin/bash \\\n      "$ROOT_DIR/ops/scripts/resonance-k8s-build-deploy-80-v2.sh" "${@:2}"' in command_index
    assert 'exec /usr/bin/bash "$ROOT_DIR/ops/scripts/resonance-project-core-deploy.sh"' in ai_fast_dev
    assert 'write_status "applied" "project-core-rolling-deploy"' not in ai_fast_dev
    def retired_v3_contract(text):
        required = (
            "[v3-deploy] RETIRED: use the official durable auto-deploy pipeline",
            "exit 78",
        )
        forbidden = (
            "RESONANCE_SUDO_PASSWORD", "CANONICAL_BUILD_DEPLOY", "kubectl ",
            "sudo ", "sync_frontend() {", "rollout() {", "restart_pod() {",
            "docker build", "ctr -n k8s.io", "resonance-k8s-build-deploy-80-v2.sh",
        )
        return all(token in text for token in required) and not any(
            token in text for token in forbidden)
    assert retired_v3_contract(v3_deploy)
    assert not retired_v3_contract(v3_deploy.replace("exit 78", "exit 0", 1))
    assert command_index.count('resonance-v3-deploy.sh') >= 3
    assert command_index.count('exec /usr/bin/bash "$ROOT_DIR/ops/scripts/resonance-v3-deploy.sh"') == 3
    assert "git-pre-deploy-backup.sh" not in command_index
    assert file_watch.count('bash "$ROOT_DIR/ops/scripts/resonance-v3-deploy.sh"') == 1
    assert file_watch.count("trigger_deploy || exit $?") == 2
    watch_trigger = file_watch[file_watch.index("trigger_deploy() {"):
                               file_watch.index("WATCH_PATHS=(")]
    assert "status == 78" in watch_trigger and "return 78" in watch_trigger
    assert watch_trigger.index("status == 78") < watch_trigger.index("retry on next change")
    def v3_inventory_contract(text):
        anchor = text.index(
            "apps/carbonet-api/src/main/resources/db/migration/postgresql/"+
            "V20260817235000__bind_runtime_identity_to_pod_template.sql")
        start = text.rfind("if deploy_path_changed", 0, anchor)
        end = text.index("; then", anchor)
        inventory = text[start:end]
        return all(path in inventory for path in (
            "ops/scripts/resonance-v3-deploy.sh",
            "ops/scripts/resonance-command-index.sh",
            "ops/scripts/resonance-file-watch.sh",
        ))
    assert v3_inventory_contract(deploy)
    for inventory_path in (
        "ops/scripts/resonance-v3-deploy.sh",
        "ops/scripts/resonance-command-index.sh",
        "ops/scripts/resonance-file-watch.sh",
    ):
        assert not v3_inventory_contract(deploy.replace(inventory_path, "", 1))
    sync_overlay = build_deploy[build_deploy.index("sync_overlay() {"):
                                 build_deploy.index("build_maven() {")]
    defer_guard = 'if [[ "$CARBONET_DEFER_LIVE_MUTATIONS_UNTIL_POST_FLYWAY" == true'
    assert defer_guard in sync_overlay
    assert sync_overlay.index(defer_guard) < sync_overlay.index("guard_frontend_overlay backup")
    assert 'verify-react-asset-closure.mjs" "$PENDING_FRONTEND_STAGING_DIR"' in sync_overlay
    assert "Live overlay verification and publish deferred until durable DB attempt stage" in sync_overlay
    deferred_mutant = sync_overlay.replace(defer_guard, 'if [[ false == true', 1)
    assert deferred_mutant.index("if [[ false == true") < deferred_mutant.index("guard_frontend_overlay backup")
    parallel_build = build_deploy[build_deploy.index('log_step "Parallel Build (Frontend + Backend)"'):
                                  build_deploy.index("sync_overlay", build_deploy.index('log_step "Parallel Build (Frontend + Backend)"'))]
    parent_guard = 'if [[ "$CARBONET_DEFER_LIVE_MUTATIONS_UNTIL_POST_FLYWAY" == true ]]'
    assert parent_guard in parallel_build
    parent_branch = parallel_build[parallel_build.index(parent_guard):
                                   parallel_build.index("else", parallel_build.index(parent_guard))]
    assert "build_frontend &" not in parent_branch
    assert parent_branch.index("build_maven &") < parent_branch.index("build_frontend")
    assert parent_branch.index("build_frontend") < parent_branch.index('wait "$maven_pid"')
    parent_mutant = parent_branch.replace("build_frontend || frontend_exit=$?",
                                          "build_frontend &\n    frontend_pid=$!", 1)
    assert "build_frontend &" in parent_mutant
    assert "DEFER_ROLLBACK_TO_ATTEMPT_RECONCILER" in build_deploy
    child_rollback = build_deploy[build_deploy.index("rollback_and_fail() {"):
                                  build_deploy.index("root_cmd() {")]
    assert child_rollback.index("DEFER_ROLLBACK_TO_ATTEMPT_RECONCILER") < child_rollback.index("Restoring previous deployment image")
    assert "DEFER_ROLLBACK_TO_ATTEMPT_RECONCILER" in startup_profile
    assert "/opt/resonance-data/control-plane/bin/postdeploy-attempt-journal.py" in failure_handler
    assert "/opt/resonance-data/control-plane/bin/postdeploy-attempt-recovery-runner.sh" in failure_handler
    assert '--uid="$deploy_owner"' in failure_handler and 'CARBONET_RECOVERY_TARGET_COMMIT="$target"' in failure_handler
    assert '$state_dir/full-screen-deploy-gate/active.env' in failure_handler
    assert 'CARBONET_RUNTIME_LEDGER_OBSERVE_ONLY="$observe_only"' in deploy
    assert 'record_runtime_release_state "$baseline" observe-only' in reconciler
    assert '${CARBONET_DEPLOY_STATE_DIR:-/opt/resonance-data/deploy}/runtime-ledger-invalidation.quarantine' in deploy
    assert 'chmod 0700 "$BACKUP_DIR"' in deploy
    assert 'find "$BACKUP_DIR" -maxdepth 1 -type f -exec chmod 0600 {} +' in deploy
    assert '\\( -type l -o \\! -user "$(id -u)" \\)' in deploy
    assert 'mv "${platform_preflight_cache}.tmp" "$platform_preflight_cache"\nfi\nmkdir -p -m 0700 -- "$BACKUP_DIR"' in deploy
    assert 'backup_previous_umask="$(umask)"' in deploy
    assert 'schema_backup_dir="$(mktemp -d "$BACKUP_DIR/.schema-backup.XXXXXX")"' in deploy
    assert 'arm_private_backup_partial() {' in deploy
    assert 'publish_private_backup_partial() {' in deploy
    assert 'partial="${final}.partial.$$"' in deploy
    assert 'mv -T -- "$partial" "$final" || return 1' in deploy
    assert 'sync -f "$BACKUP_DIR" || return 1\n}' in deploy
    assert 'sync -f "$BACKUP_DIR" 2>/dev/null || true' not in deploy
    publish_start = deploy.index('publish_private_backup_partial() {')
    publish_body = deploy[publish_start:deploy.index('\n}', publish_start) + 2]
    arm_start = deploy.index('arm_private_backup_partial() {')
    arm_body = deploy[arm_start:deploy.index('\n}', arm_start) + 2]
    assert publish_body.index('mv -T -- "$partial" "$final" || return 1') < publish_body.index('sync -f "$BACKUP_DIR" || return 1')
    assert '"$(stat -c \'%a:%u\' "$partial")" == "600:$(id -u)"' in publish_body
    assert '&& -f "$partial" && ! -L "$partial"' in publish_body
    assert '&& ! -e "$final" && ! -L "$final"' in publish_body
    assert '[[ ! -e "$partial" && ! -L "$partial" ]]' in arm_body
    assert 'mv -T -- "$partial" "$final"\n' not in publish_body
    assert 'sync -f "$BACKUP_DIR"\n' not in publish_body
    # Execute the exact helper body with one failed primitive at a time. The
    # caller invokes it in an OR-list, so explicit returns—not ambient
    # `set -e`—must preserve both mv and directory-sync failures.
    with tempfile.TemporaryDirectory(prefix="backup-publish-contract-") as backup_tmp:
        helper_probe = r'''set -euo pipefail
umask 077
BACKUP_DIR="$1"
failure="$2"
wrong_owner_uid="${3:-}"
''' + arm_body + "\n" + publish_body + r'''
final="$BACKUP_DIR/carbonet-probe.sql.gz"
partial="${final}.partial.$$"
printf 'verified-backup\n' >"$partial"
chmod 0600 "$partial"
case "$failure" in
  mv)
    mv() { return 71; }
    ! publish_private_backup_partial "$partial" "$final"
    [[ -f "$partial" && ! -e "$final" ]]
    ;;
  sync)
    sync() { return 72; }
    ! publish_private_backup_partial "$partial" "$final"
    [[ ! -e "$partial" && -f "$final" ]]
    ;;
  wrong-mode)
    chmod 0644 "$partial"
    ! publish_private_backup_partial "$partial" "$final"
    [[ -f "$partial" && ! -e "$final" ]]
    ;;
  wrong-owner)
    if (( EUID == 0 )); then
      chown "$wrong_owner_uid" "$partial"
    else
      sudo -n chown "$wrong_owner_uid" "$partial"
    fi
    ! publish_private_backup_partial "$partial" "$final"
    [[ -f "$partial" && ! -e "$final" ]]
    ;;
  partial-symlink)
    rm -- "$partial"
    printf 'sentinel\n' >"$BACKUP_DIR/sentinel"
    ln -s "$BACKUP_DIR/sentinel" "$partial"
    ! publish_private_backup_partial "$partial" "$final"
    [[ "$(cat "$BACKUP_DIR/sentinel")" == sentinel && -L "$partial" && ! -e "$final" ]]
    ;;
  final-collision)
    printf 'existing-final\n' >"$final"
    ! publish_private_backup_partial "$partial" "$final"
    [[ "$(cat "$final")" == existing-final && -f "$partial" ]]
    ;;
  wrong-binding)
    wrong="$BACKUP_DIR/wrong.partial.$$"
    mv -- "$partial" "$wrong"
    ! publish_private_backup_partial "$wrong" "$final"
    [[ -f "$wrong" && ! -e "$final" ]]
    ;;
  outside-prefix)
    outside="$BACKUP_DIR/../outside-carbonet-probe.sql.gz"
    outside_partial="${outside}.partial.$$"
    mv -- "$partial" "$outside_partial"
    ! publish_private_backup_partial "$outside_partial" "$outside"
    [[ -f "$outside_partial" && ! -e "$outside" ]]
    ;;
  arm-outside-prefix)
    rm -- "$partial"
    outside="$BACKUP_DIR/../outside-carbonet-probe.sql.gz"
    ! arm_private_backup_partial "$outside" >/dev/null
    [[ ! -e "$outside" && ! -e "${outside}.partial.$$" ]]
    ;;
  arm-final-collision)
    rm -- "$partial"
    printf 'existing-final\n' >"$final"
    ! arm_private_backup_partial "$final" >/dev/null
    [[ "$(cat "$final")" == existing-final ]]
    ;;
  arm-partial-symlink)
    rm -- "$partial"
    ln -s "$BACKUP_DIR/missing-sentinel" "$partial"
    ! arm_private_backup_partial "$final" >/dev/null
    [[ -L "$partial" && ! -e "$partial" && ! -e "$final" ]]
    ;;
  arm-final-symlink)
    rm -- "$partial"
    ln -s "$BACKUP_DIR/missing-final-target" "$final"
    ! arm_private_backup_partial "$final" >/dev/null
    [[ -L "$final" && ! -e "$final" && ! -e "$partial" ]]
    ;;
  *) exit 99 ;;
esac
'''
        primitives = [
            "mv", "sync", "wrong-mode", "partial-symlink", "final-collision",
            "wrong-binding", "outside-prefix", "arm-outside-prefix",
            "arm-final-collision", "arm-partial-symlink", "arm-final-symlink",
        ]
        sudo_available = shutil.which("sudo") is not None and subprocess.run(
            ["sudo", "-n", "true"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        ).returncode == 0
        if os.geteuid() == 0 or sudo_available:
            primitives.append("wrong-owner")
        wrong_owner_uid = "65534" if os.geteuid() == 0 else "0"
        for primitive in primitives:
            probe_dir = Path(backup_tmp) / primitive
            probe_dir.mkdir(mode=0o700)
            subprocess.run(
                ["bash", "-c", helper_probe, "_", str(probe_dir), primitive, wrong_owner_uid],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                text=True,
            )
    backup_block = deploy[deploy.index('if [[ "$backup_required" == "true" ]]'):
                          deploy.index('# Apply the same policy after a successful dump')]
    assert backup_block.index('umask 077') < backup_block.index('> "$roles_backup_partial_file"')
    assert backup_block.index('umask 077') < backup_block.index('> "$backup_partial_file"')
    assert backup_block.rindex('umask "$backup_previous_umask"') > backup_block.rindex('> "$backup_partial_file"')
    assert '> "$roles_backup_file"' not in backup_block
    assert '> "$backup_file"' not in backup_block
    assert backup_block.count('publish_private_backup_partial "$backup_partial_file" "$backup_file"') == 6
    assert backup_block.count('publish_private_backup_partial "$roles_backup_partial_file" "$roles_backup_file"') == 1
    assert "retire_orphan_versioned_snapshot" in deploy and "orphan pre-runtime snapshot RETIRED mutation=0" in deploy
    cleanup_contract = deploy[deploy.index("cleanup_deploy() {"):deploy.index("# Prepare an attempt-unique identity")]
    assert '(( recovery_status == 0 )) || original_status="$recovery_status"' in cleanup_contract
    assert "trap cleanup_deploy EXIT" in cleanup_contract
    assert "handle_deploy_signal 130" in cleanup_contract and "handle_deploy_signal 143" in cleanup_contract
    finalizer_start = deploy.index("finalize_postdeploy_candidate_release()")
    finalizer = deploy[finalizer_start:
                       deploy.index("# Recovery executes immediately", finalizer_start)]
    release = finalizer.index("record_runtime_release_state")
    usage = finalizer.index("run_operational_usage_ledger_live_e2e_if_required")
    precheck = finalizer.index("verify_postdeploy_candidate_staged")
    promote = finalizer.index("promote-postdeploy-candidate-evidence.sh")
    assert release < usage < precheck < promote, "release/usage/precheck/promoter order regressed"
    after_promoter=finalizer[promote:]
    assert "promoter returned without exact deployment marker" not in after_promoter
    assert "record_deploy_performance" not in finalizer
    assert "finalize-success" in after_promoter and "|| echo" in after_promoter
    assert '"$RUNTIME_DEPLOY_STATE_FILE"' in finalizer
    assert "postdeploy_authoritative_promotion_status" in after_promoter
    assert 'write_applied_deploy_state "$target_commit"' in after_promoter
    authority = after_promoter.index("postdeploy_authoritative_promotion_status")
    snapshot_disarm = after_promoter.index("finalize-success", authority)
    runtime_marker_check = after_promoter.index('runtime_marker="$(tr -d', authority)
    final_live_verify = after_promoter.index('verify_operational_usage_ledger_current_runtime_identity "$target_commit" proof-only', authority)
    drift_compensation = after_promoter.index("invalidate_runtime_release_state", final_live_verify)
    recovery_pending = after_promoter.index("return 75", drift_compensation)
    assert authority < final_live_verify < drift_compensation < recovery_pending < snapshot_disarm < runtime_marker_check, \
        "post-promotion verifier/compensation/disarm/marker order regressed"
    assert "PROMOTED_FINAL_LIVE_IDENTITY_DRIFT" in after_promoter
    defer_marker = finalizer.index("CARBONET_POSTDEPLOY_DEFER_MARKER_UNTIL_FINAL_VERIFY=true")
    assert defer_marker < promote, "promoter was not placed in deferred-marker mode"
    assert after_promoter.index("clear-success", authority) > runtime_marker_check
    assert after_promoter.index('archive_postdeploy_attempt_journal_terminal "$attempt_terminal_status"', authority) > runtime_marker_check
    assert deploy.count("enable_postdeploy_candidate_mode") == 4  # definition + 3 runtime paths
    bind_source = deploy[deploy.index("bind_postdeploy_candidate_live_source() {"):
                         deploy.index("enable_postdeploy_candidate_mode() {")]
    assert '--resource-version="$resource_version"' in bind_source
    assert 'resonance.ai/target-commit=$target_commit' in bind_source
    assert "selector:.spec.selector,template:.spec.template" in bind_source
    assert "replicas:.spec.replicas" not in bind_source, \
        "HPA-owned replicas must not invalidate the source annotation CAS"
    assert "generation:.metadata.generation" not in bind_source, \
        "HPA replica scaling advances generation and must not invalidate the CAS"
    enable_body = deploy[deploy.index("enable_postdeploy_candidate_mode() {"):
                         deploy.index("run_postdeploy_candidate_validation_groups() {")]
    assert enable_body.index("invalidate_runtime_release_state") < enable_body.index("bind_postdeploy_candidate_live_source")
    assert enable_body.index("bind_postdeploy_candidate_live_source") < enable_body.index("postdeploy_candidate_initialized=true")
    frontend_path = deploy[deploy.index("# A frontend-only commit is compiled directly"):
                           deploy.index("# A measured JVM profile changes only")]
    assert 'frontend_overlay_template_sha256="$(python3 "$POSTDEPLOY_JOURNAL_HELPER"' in frontend_path
    assert 'select(.sourceCommit==$target) | .rollback.podTemplateSha256 // empty' in frontend_path
    assert 'finalize_postdeploy_candidate_release "$frontend_overlay_template_sha256"' in frontend_path
    assert '( "$mode" == recovery-promoted || "$mode" == frontend-overlay )' in deploy
    # One frontend-only path calls the base finalizer directly. The two runtime
    # paths must pass through the composite-gate cleanup wrapper, which itself
    # invokes the base finalizer exactly once. Count exact definitions/calls so
    # the wrapper name cannot inflate the old substring-based assertion.
    assert deploy.count("finalize_postdeploy_candidate_release() {") == 1
    assert deploy.count("finalize_postdeploy_candidate_release_with_composite_gate_cleanup() {") == 1
    assert deploy.count("if finalize_postdeploy_candidate_release; then") == 1
    assert len(re.findall(r"(?m)^\s*finalize_postdeploy_candidate_release\s*$", deploy)) == 0
    assert len(re.findall(
        r'(?m)^\s*finalize_postdeploy_candidate_release "\$frontend_overlay_template_sha256"\s*$',
        deploy,
    )) == 1
    assert len(re.findall(r"(?m)^\s*finalize_postdeploy_candidate_release_with_composite_gate_cleanup\s*$", deploy)) == 2
    assert deploy.count("run_postdeploy_candidate_validation_groups") == 4
    assert deploy.count("CARBONET_SCREEN_CONTRACT_PREVIEW_ONLY=1 run_screen_contract_runtime_save_gate_if_required") == 2
    # Three normal completion paths plus durable aborted-recovery and
    # same-source reconciliation each converge the monotonic applied marker.
    assert deploy.count('write_applied_deploy_state "$target_commit"') == 5
    assert '"${CARBONET_POSTDEPLOY_EVIDENCE_MODE:-}" == candidate' in deploy[deploy.index("run_operational_usage_ledger_live_e2e_if_required()"):
                                                                                   deploy.index("verify_operational_usage_ledger_current_runtime_identity()")]
    cleanup_slice = deploy[deploy.index("cleanup_deploy()"):
                           deploy.index("run_runtime_candidate_checkpoint()")]
    assert "postdeploy_candidate_initialized=true" in deploy
    assert "reconcile_postdeploy_candidate_after_failure" in cleanup_slice
    assert 'flock -n 9' in deploy and deploy.index('flock -n 9') < deploy.index('postdeploy_candidate_id="postdeploy:')
    assert 'flock -w "${CARBONET_RECOVERY_LOCK_WAIT_SECONDS:-60}"' in deploy
    assert 'CARBONET_DEFER_LIVE_MUTATIONS_UNTIL_POST_FLYWAY="$([[ "$PLAN_DATABASE_REQUIRED" == true || "$postdeploy_db_attempt_staged" != true ]]' in deploy
    assert "FULL_SCREEN_GATE_BASE_COMMIT=\"$runtime_deployed_commit\"" in deploy
    assert deploy.count("FULL_SCREEN_GATE_DEFER_ACCEPT=true") >= 4
    assert deploy.count("FULL_SCREEN_SMOKE_REQUIRE_PREAUTH=true") >= 2
    assert "runtime:identity-staged-reconcile-required" in deploy
assert "identity design changed without a staged reconcile" in deploy
no_change_gate = deploy[deploy.index('if [[ "$deployed_commit" == "$target_commit" ]]'):
                        deploy.index("# Publish the in-flight state")]
assert "timeout 4s kubectl --request-timeout=3s" in no_change_gate
assert "no_change_recovery_hint=true" in no_change_gate
assert "durable state unchanged" in no_change_gate and "exit 75" in no_change_gate
assert "write_postdeploy_promotion_quarantine" not in no_change_gate

planner=(root / "ops/scripts/plan-incremental-work.sh").read_text(encoding="utf-8")
assert "runtime:postdeploy-candidate-evidence" in planner
assert "runtime:identity-staged-reconcile-required" in planner
early_identity_block = deploy.index("BLOCKED before mutation: identity design changed")
pending_recovery_call = deploy.index("if recover_authoritative_postdeploy_marker_pending")
assert pending_recovery_call < early_identity_block < deploy.index("# Documentation, design metadata")
identity_sync_body = deploy[deploy.index("sync_keycloak_actor_assignments_if_required() {"):
                            deploy.index("run_backstage_screen_space_e2e_if_required() {")]
assert "identity reconciliation verify-only PASS currentWrites=0" in identity_sync_body
assert "bash ops/scripts/resonance-keycloak-e2e-scope-sync.sh" not in identity_sync_body
assert 'bash ops/scripts/resonance-keycloak-carbonet-identity-sync-install.sh' not in identity_sync_body
assert "bash ops/scripts/resonance-keycloak-carbonet-identity-sync.sh" not in identity_sync_body
assert "SCREEN_SPACE_VERIFY_ONLY=1" in deploy
screen_space = (root / "ops/scripts/resonance-screen-space-runtime-e2e.sh").read_text(encoding="utf-8")
assert "candidate-read-only-index" in screen_space and "verifyOnly=true currentWrites=0" in screen_space
assert screen_space.index("SCREEN_SPACE_VERIFY_ONLY") < screen_space.index("materialize-registered-screen")

invalidate_body = deploy[deploy.index("invalidate_runtime_release_state() {"):
                         deploy.index("record_deploy_performance() {")]
assert "CARBONET_RUNTIME_LEDGER_INVALIDATE_ATTEMPTS:-3" in invalidate_body
assert "invalidate_status=0" in invalidate_body and "ledger_count\" == 0" in invalidate_body
assert "select count(*) from framework_runtime_release_state" in invalidate_body
cleanup_body = deploy[deploy.index("cleanup_deploy() {"):deploy.index("trap cleanup_deploy")]
recovery_body = deploy[deploy.index("reconcile_postdeploy_candidate_after_failure() {"):
                       deploy.index("record_deploy_performance() {")]
authority_body = deploy[deploy.index("postdeploy_authoritative_promotion_status() {"):
                        deploy.index("write_postdeploy_recovery_state() {")]
pending_recovery_body = deploy[deploy.index("recover_authoritative_postdeploy_marker_pending() {"):
                               deploy.index("run_operational_usage_ledger_current_runtime_e2e_if_required() {")]
discovery_body = deploy[deploy.index("discover_postdeploy_current_runtime_source() {"):
                        deploy.index("recover_authoritative_postdeploy_marker_pending() {")]
ledgerless_recovery = deploy[deploy.index("promoted_candidate_identity_with_ledger_absent() {"):
                             deploy.index("# A DB COMMIT can outlive")]
for token in (
    "candidate_runtime_identity_hash=promotion.runtime_identity_hash",
    "framework_candidate_runtime_identity_hash_v2",
    "DB_PROMOTED_FINAL_LIVE_VERIFY_PENDING",
    "PROMOTED_FINAL_LIVE_IDENTITY_DRIFT",
    "pending_present=false",
    "quarantine_present=false",
    "missing files are recreated only after",
    "Normal COMMIT->SIGKILL and marker-rename faults retain",
    "Ordinary runtime/applied-marker recovery is owned",
    'return 1',
    'record_runtime_release_state "$source" recovery-promoted',
    "RECOVERY_PENDING promoted live identity remains divergent",
):
    assert token in ledgerless_recovery, f"ledgerless promoted recovery missing {token}"
db_recovery_anchor = ledgerless_recovery.index(
    'db_hash="$(promoted_candidate_identity_with_ledger_absent')
pending_reconstruction = ledgerless_recovery.index(
    "write_postdeploy_marker_pending 'DB_PROMOTED_FINAL_LIVE_VERIFY_PENDING'", db_recovery_anchor)
quarantine_reconstruction = ledgerless_recovery.index(
    "write_postdeploy_promotion_quarantine 'PROMOTED_FINAL_LIVE_IDENTITY_DRIFT'",
    pending_reconstruction)
ledgerless_live_proof = ledgerless_recovery.index(
    'verify_promoted_live_identity_without_runtime_ledger "$source" "$expected_hash"',
    quarantine_reconstruction)
assert db_recovery_anchor < pending_reconstruction < quarantine_reconstruction < ledgerless_live_proof
recover_persistent_body = deploy[deploy.index("recover_persistent_postdeploy_attempt() {"):
                                 deploy.index("archive_recovered_promoted_attempt_journal() {")]
special_recovery = recover_persistent_body.index("recover_promoted_final_live_verify_pending")
ordinary_authority = recover_persistent_body.index(
    'postdeploy_authoritative_promotion_status "$source" "$candidate"', special_recovery)
snapshot_after_recovery = recover_persistent_body.index("finalize-success", ordinary_authority)
assert special_recovery < ordinary_authority < snapshot_after_recovery
assert "reconcile_postdeploy_candidate_after_failure" in cleanup_body
assert "LEDGER_INVALIDATION_UNVERIFIED" in recovery_body
assert "PROMOTION_DB_CHECK_UNAVAILABLE" in recovery_body
assert "DB-authoritative promotion confirmed" in recovery_body
assert "invalidate_runtime_release_state" in recovery_body
assert "$DEPLOY_STATE_FILE" not in authority_body and "$RUNTIME_DEPLOY_STATE_FILE" not in authority_body
assert "POSTDEPLOY_AUTHORITY_SCRIPT" in authority_body
authority_checker = (root / "ops/scripts/check-postdeploy-authoritative-promotion.sh").read_text(encoding="utf-8")
assert "framework_postdeploy_release_attempt" in authority_checker
assert "UNKNOWN" in authority_checker and "lifecycle_available" in authority_checker
assert "PROMOTED_RECONCILED" in authority_checker and "ABORTED" in authority_checker
assert "exact_reconciled" in authority_checker and "canonical_authority" in authority_checker
assert "mv -fT --" in deploy and "stat -c '%a'" in deploy
assert "verify_operational_usage_ledger_current_runtime_identity \"$pending_target\" proof-only" in pending_recovery_body
assert "verify_operational_usage_ledger_current_runtime_identity \"$pending_target\" reconcile" in pending_recovery_body
assert "write_applied_deploy_state \"$pending_target\"" in pending_recovery_body
assert "finalize-success" in pending_recovery_body and "MARKER_PENDING_RUNTIME_RECONCILE_FAILED" in pending_recovery_body
assert "DB_PROMOTED_ORPHAN_COMMIT" in pending_recovery_body and "COMMIT -> SIGKILL" in pending_recovery_body
assert "POSTDEPLOY_RECOVERY_SOURCE" in discovery_body and "resonance.ai/target-commit" in discovery_body
assert "merge-base --is-ancestor \"$pending_target\" \"$target_commit\"" in pending_recovery_body
assert '"$pending_target" != "$target_commit"' not in pending_recovery_body
proof = pending_recovery_body.index('"$pending_target" proof-only')
snapshot_disarm = pending_recovery_body.index("finalize-success", proof)
runtime_reconcile = pending_recovery_body.index('"$pending_target" reconcile', snapshot_disarm)
assert proof < snapshot_disarm < runtime_reconcile
assert "merge-base --is-ancestor \"$pending_target\" \"$applied_marker\"" in pending_recovery_body
runtime_capture = deploy.index('FULL_SCREEN_GATE_BASE_COMMIT="$runtime_deployed_commit"', pending_recovery_call)
assert pending_recovery_call < runtime_capture
recovery_dispatch = deploy[pending_recovery_call:deploy.index("# Documentation, design metadata", pending_recovery_call)]
assert 'bash "$PLAN_SCRIPT" "$postdeploy_recovered_commit" "$target_commit" --format env' in recovery_dispatch
assert "incremental_replan_after_marker_reconcile" in recovery_dispatch
for expensive_token in ('backup_file="', 'git merge --ff-only "$target_commit"', 'FULL_SCREEN_GATE_BASE_COMMIT="$runtime_deployed_commit"'):
    assert pending_recovery_call < deploy.index(expensive_token, pending_recovery_call), f"recovery moved after {expensive_token}"
for forbidden in ("pg_dump", "git merge --ff-only", "frontend:build"):
    assert forbidden not in pending_recovery_body, f"recovery function invokes expensive work: {forbidden}"
mutated_invalidate = invalidate_body.replace('if [[ "$ledger_count" == 0 ]]', 'if [[ "$ledger_count" == 1 ]]', 1)
assert 'if [[ "$ledger_count" == 0 ]]' not in mutated_invalidate
assert "identity-design-requires-staged-reconcile" in planner

# Mutation proof: deleting or swapping a tuple must be observable rather than
# surviving independent unit/process set checks.
expected_tuples = [
    "('ACTIVITY_DATA_RUNTIME','ACTIVITY_DATA','RUNTIME')",
    "('ACTIVITY_DATA_STATIC','ACTIVITY_DATA','STATIC')",
    "('ACTOR_ACCOUNT_CUSTOMER_JOURNEY','CUSTOMER_WORK_COORDINATION','RUNTIME')",
    "('CUSTOMER_WORK_COORDINATION_RUNTIME','CUSTOMER_WORK_COORDINATION','RUNTIME')",
    "('EMISSION_CALCULATION_RUNTIME','EMISSION_CALCULATION','RUNTIME')",
    "('EMISSION_CALCULATION_STATIC','EMISSION_CALCULATION','STATIC')",
    "('GOVERNANCE_CHANGE_RUNTIME','GOVERNANCE_CHANGE','RUNTIME')",
    "('OPERATIONAL_USAGE_LEDGER_GATE','__RELEASE__','RELEASE_GATE')",
    "('ORGANIZATIONAL_BOUNDARY_RUNTIME','ORGANIZATIONAL_BOUNDARY','RUNTIME')",
    "('REPORT_CERTIFICATION_RUNTIME','REPORT_CERTIFICATION','RUNTIME')",
    "('REPORT_CERTIFICATION_STATIC','REPORT_CERTIFICATION','STATIC')",
    "('SCREEN_CONTRACT_RUNTIME_SAVE_PREVIEW','__RELEASE__','RELEASE_GATE')",
]
def tuple_contract(text):
    body = text[text.index("WITH expected(unit_code,process_code,evidence_kind) AS (VALUES"):]
    return all(body.count(item) >= 1 for item in expected_tuples)
assert tuple_contract(migration)
mutated = migration.replace(expected_tuples[0], "", 1)
assert not tuple_contract(mutated)
mutated_mapping = migration.replace(expected_tuples[0], "('ACTIVITY_DATA_RUNTIME','REPORT_CERTIFICATION','RUNTIME')", 1)
assert not tuple_contract(mutated_mapping)
mutated_unique = migration.replace("uq_postdeploy_promotion_source_commit UNIQUE (source_commit)", "", 1)
assert "uq_postdeploy_promotion_source_commit UNIQUE (source_commit)" not in mutated_unique
mutated_lock = migration.replace(
    "postdeploy-evidence-promotion:'||p_source_commit",
    "postdeploy-evidence-promotion:'||p_candidate_id", 1)
assert "postdeploy-evidence-promotion:'||p_source_commit" not in mutated_lock
function_body = migration[migration.index("CREATE OR REPLACE FUNCTION framework_promote_postdeploy_evidence_candidate"):]
runtime_lock = function_body.index("FOR SHARE")
existing_lookup = function_body.index("SELECT * INTO existing")
assert runtime_lock < existing_lookup, "DB reconcile bypasses locked runtime identity"
mutated_function_order = function_body.replace("FOR SHARE", "__RUNTIME_LOCK__", 1)
mutated_function_order = mutated_function_order.replace("SELECT * INTO existing", "FOR SHARE", 1)
mutated_function_order = mutated_function_order.replace("__RUNTIME_LOCK__", "SELECT * INTO existing", 1)
assert mutated_function_order.index("FOR SHARE") > mutated_function_order.index("SELECT * INTO existing")
mutated_promoter_order = promoter.replace("deployment_json=", "__LIVE_CHECK__=", 1)
mutated_promoter_order = mutated_promoter_order.replace("promotion=", "deployment_json=", 1)
mutated_promoter_order = mutated_promoter_order.replace("__LIVE_CHECK__=", "promotion=", 1)
def promoter_order_is_safe(text):
    return (
        text.index("deployment_json=") < text.index("runtime_ledger=")
        < text.index("framework_promote_postdeploy_evidence_candidate")
    )
assert promoter_order_is_safe(promoter)
assert not promoter_order_is_safe(mutated_promoter_order)
mutated_readiness = promoter.replace(
    '((.status.updatedReplicas // 0)==(.spec.replicas // 0))',
    '((.status.updatedReplicas // 0)>=(.spec.replicas // 0))', 1)
assert mutated_readiness != promoter and ">=(.spec.replicas" in mutated_readiness

# A non-quiet psql transaction emits BEGIN/COMMIT command tags around the JSON
# row. jq must receive the exact JSON row, so -q is a release-critical flag.
def fake_psql(flags):
    row='{"status":"PROMOTED","unitCount":12}'
    return row if "q" in flags else "BEGIN\n"+row+"\nCOMMIT"
import json
assert json.loads(fake_psql("qAt"))["unitCount"] == 12
try:
    json.loads(fake_psql("At"))
    raise AssertionError("non-quiet psql command tags unexpectedly parsed")
except json.JSONDecodeError:
    pass
mutated_psql=promoter.replace("-X -qAt -v ON_ERROR_STOP=1", "-X -At -v ON_ERROR_STOP=1", 1)
assert mutated_psql != promoter
assert mutated_psql.count("-X -qAt -v ON_ERROR_STOP=1") == promoter.count("-X -qAt -v ON_ERROR_STOP=1") - 1

critical_payload_tokens=(
    "actor_journey->>'mutableBusinessWrites' IS DISTINCT FROM '0'",
    "actor_journey->>'securityAuditAppendDelta' IS DISTINCT FROM '2'",
    "actor_journey->>'scopeAuditIdDelta' IS DISTINCT FROM '1'",
    "actor_journey->>'actorAuditIdDelta' IS DISTINCT FROM '1'",
    "actor_journey->>'authTokenCleanupVerified' IS DISTINCT FROM 'true'",
    "screen_preview->>'databaseCurrentWrites' IS DISTINCT FROM '0'",
    "screen_preview->>'databaseStateHashAfter' IS DISTINCT FROM screen_preview->>'databaseStateHashBefore'",
    "screen_preview->>'runtimeHashAfter' IS DISTINCT FROM screen_preview->>'runtimeHashBefore'",
    "usage_gate->>'anonymousDenied' IS DISTINCT FROM '2'",
    "usage_gate->>'ordinaryDenied' IS DISTINCT FROM '7'",
    "usage_gate->>'reviewCreateReloadIdempotencyCleanup' IS DISTINCT FROM 'true'",
)
def critical_payload_contract(text):
    return all(token in text for token in critical_payload_tokens)
assert critical_payload_contract(migration)
for token in critical_payload_tokens:
    assert not critical_payload_contract(migration.replace(token,"TRUE",1)), token

authoritative_audit_tokens=(
    "item->>'schemaVersion' IS DISTINCT FROM '2'",
    "item->>'rowHash'",
    "item->>'actionCode' IS DISTINCT FROM 'PROJECT_PARTICIPANT_READ'",
    "item->>'actionCode' IS DISTINCT FROM 'REGULATORY_SUBMISSION_TRANSITION'",
    "item->>'resourceType' IS DISTINCT FROM 'EMISSION_PROJECT'",
    "item->>'resourceType' IS DISTINCT FROM 'REGULATORY_SUBMISSION'",
    "item->>'outcomeCode' IS DISTINCT FROM 'ACCESS_DENIED'",
    "audit.action_code<>evidence.item->>'actionCode'",
    "audit.resource_type<>evidence.item->>'resourceType'",
    "audit.outcome_code<>evidence.item->>'outcomeCode'",
    "audit.schema_version::text<>evidence.item->>'schemaVersion'",
    "audit.row_hash<>evidence.item->>'rowHash'",
)
def authoritative_audit_contract(text):
    return all(token in text for token in authoritative_audit_tokens)
assert authoritative_audit_contract(migration)
reduced_hash_mutation=migration.replace(
    "audit.row_hash<>evidence.item->>'rowHash'",
    "encode(sha256(convert_to(concat_ws('|',audit.audit_id,lower(audit.account_id),audit.tenant_id,audit.project_id,audit.decision_code,audit.reason_code),'UTF8')),'hex')<>evidence.item->>'rowHash'",
    1,
)
assert not authoritative_audit_contract(reduced_hash_mutation), "reduced audit hash mutation escaped"
for stale in ("1.0", "PROJECT_DETAIL_READ", "REGULATORY_ACCEPT"):
    assert stale not in migration, f"stale actor audit claim remained in promoter: {stale}"

activity = (root / "ops/scripts/validate-activity-data-runtime.sh").read_text(encoding="utf-8")
mutated_activity = activity.replace('if [[ "$EVIDENCE_MODE" == "candidate" ]]; then', 'if false; then', 1)
assert mutated_activity != activity and 'if false; then' in mutated_activity
assert "appended_simulation_count=5" not in migration
print("POSTDEPLOY_CANDIDATE_STATIC_PASS units=12 tuples=exact processes=6 marker=mktemp-recheck-db-atomicmv runtime=all-pods-health evidence=unique-owned-0444-sha256 simulationFabrication=0 jobsArtifacts=6-process-exact autoPaths=candidate3-current2 rollbackSnapshot=promoter-bound")
PY
bash "$ROOT/ops/tests/test-postdeploy-promotion-recovery.sh" "$ROOT"
bash "$ROOT/ops/tests/test-runtime-release-state.sh"
bash "$ROOT/ops/scripts/test-auto-deploy-failure-handler.sh"
