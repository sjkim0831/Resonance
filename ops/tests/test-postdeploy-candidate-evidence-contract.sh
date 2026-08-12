#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260812023000__stage_and_atomically_promote_postdeploy_evidence.sql"
SCOPE_AUDIT_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260812033000__harden_scope_access_audit_append_only.sql"
LIFECYCLE_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260812080000__bind_postdeploy_attempt_lifecycle.sql"
STAGER="$ROOT/ops/scripts/stage-postdeploy-evidence-candidate.sh"
PROMOTER="$ROOT/ops/scripts/promote-postdeploy-candidate-evidence.sh"
DEPLOY="$ROOT/ops/scripts/auto-deploy-main.sh"
JOURNAL_HELPER="$ROOT/ops/scripts/postdeploy-attempt-journal.py"

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
  "$ROOT/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"
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
for file in "$MIGRATION" "$SCOPE_AUDIT_MIGRATION" "$LIFECYCLE_MIGRATION" "$JOURNAL_HELPER" "${files[@]}"; do [[ -s "$file" ]] || { echo "missing: $file" >&2; exit 1; }; done
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
run_stager_payload() {
  local stager="$1" payload="$2"
  (
    kubectl() {
      local arg payload_b64=""
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

python3 - "$ROOT" "$MIGRATION" "$STAGER" "$PROMOTER" "$DEPLOY" <<'PY'
from pathlib import Path
import os, sys

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
assert "evidence_json=convert_from" in stager

prepare = promoter.index("printf '%s\\n' \"$SOURCE_COMMIT\" >\"$MARKER_TMP\"")
promotion = promoter.index("framework_promote_postdeploy_evidence_candidate")
rename = promoter.rindex('mv -fT -- "$MARKER_TMP" "$MARKER_FILE"')
assert prepare < promotion < rename, "marker/promotion ordering regressed"
assert 'MARKER_TMP="$(mktemp ' in promoter and '${MARKER_FILE}.tmp' not in promoter
assert ' -X -qAt -v ON_ERROR_STOP=1' in promoter
assert "stat -c %d" in promoter
assert "deployment marker target must be a regular non-symlink file" in promoter
assert 'marker_name" != . && "$marker_name" != ..' in promoter
assert "Do not add fallible gates after this point" in promoter
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
journal_helper = (root / "ops/scripts/postdeploy-attempt-journal.py").read_text(encoding="utf-8")
for token in ("SNAPSHOT_CAPTURED", "ARMED", "ABORT_AUTHORIZED", "PHYSICAL_RESTORED",
              "RESTORED_VERIFIED", "mark-db-staged", "cancel-pre-runtime", "advance-rollback"):
    assert token in journal_helper, f"durable rollback journal missing {token}"
assert "framework_stage_postdeploy_release_attempt" in stager
candidate_pg = (root / "ops/tests/test-postdeploy-candidate-evidence-postgres.sh").read_text(encoding="utf-8")
assert "framework_scope_access_audit_hash" in scope_migration and "row_hash" in scope_migration
assert 'cat "$MIGRATION"' in candidate_pg and 'cat "$SCOPE_AUDIT_MIGRATION"' in candidate_pg
assert candidate_pg.index('cat "$MIGRATION"') < candidate_pg.index('cat "$SCOPE_AUDIT_MIGRATION"')
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
assert "SCREEN_CONTRACT_RUNTIME_SAVE_PREVIEW" in screen_wrapper and "previewMode==true" in screen_wrapper
assert "/professional-screen-contracts/preview" in screen_mjs and "previewCount: previewMode ? saves.length : 0" in screen_mjs
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
    assert "Unsupported professional contract prediction fields" in runtime_source
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
              "predictsUnchangedWithoutClaimingPublication",
              "predictsHistoricalVersionReuseWithoutClaimingPublication"):
    assert token in runtime_service_test
for actor_mutation,runtime_mutation,label in (
    (service.replace("@Transactional(readOnly=true) public Map<String,Object> saveProfessionalScreenContractPreview",
                     "@Transactional public Map<String,Object> saveProfessionalScreenContractPreview",1),runtime_service,"read-only-transaction"),
    (service,runtime_service.replace("prepareProfessionalContract(contractId, validatedValues, false)",
                                     "prepareProfessionalContract(contractId, validatedValues, true)",1),"runtime-write-lock"),
    (service,runtime_service.replace("validateProfessionalPredictionValues(proposedValues)",
                                     "new LinkedHashMap<>(proposedValues)",1),"runtime-allowlist-bypass"),
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
assert "framework_process_execution_event" in role_e2e and "pg_sequences" in role_e2e

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
    enable = deploy[deploy.index("enable_postdeploy_candidate_mode() {"):
                    deploy.index("run_postdeploy_candidate_validation_groups() {")]
    assert "stage_postdeploy_release_attempt_db" not in enable
    assert "verify_postdeploy_release_attempt_db_staged" in enable
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
    for mutation in ("publish_pending_frontend_staging", 'kubectl -n "$NAMESPACE" set env',
                     'kubectl apply -f -', 'kubectl -n "$NAMESPACE" patch'):
        assert arm < rollout.index(mutation, arm), f"live mutation precedes durable DB arm: {mutation}"
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
    assert authority < snapshot_disarm < runtime_marker_check, "promoted snapshot remains armed across marker faults"
    assert after_promoter.index("clear-success", authority) > runtime_marker_check
    assert after_promoter.index('archive_postdeploy_attempt_journal_terminal "$attempt_terminal_status"', authority) > runtime_marker_check
    assert deploy.count("enable_postdeploy_candidate_mode") == 4  # definition + 3 runtime paths
    assert deploy.count("finalize_postdeploy_candidate_release") == 4
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
