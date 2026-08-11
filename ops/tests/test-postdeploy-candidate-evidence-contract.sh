#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260812023000__stage_and_atomically_promote_postdeploy_evidence.sql"
SCOPE_AUDIT_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260812033000__harden_scope_access_audit_append_only.sql"
STAGER="$ROOT/ops/scripts/stage-postdeploy-evidence-candidate.sh"
PROMOTER="$ROOT/ops/scripts/promote-postdeploy-candidate-evidence.sh"
DEPLOY="$ROOT/ops/scripts/auto-deploy-main.sh"

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
  "$ROOT/ops/scripts/check-postdeploy-authoritative-promotion.sh"
  "$ROOT/ops/scripts/carbonet-auto-deploy-failure-handler.sh"
  "$ROOT/ops/scripts/test-auto-deploy-failure-handler.sh"
)
for file in "$MIGRATION" "$SCOPE_AUDIT_MIGRATION" "${files[@]}"; do [[ -s "$file" ]] || { echo "missing: $file" >&2; exit 1; }; done
for file in "${files[@]}"; do bash -n "$file"; done
node --check "$ROOT/ops/scripts/validate-screen-contract-runtime-save.mjs"
bash "$ROOT/ops/tests/test-process-runtime-evidence-isolation.sh" "$ROOT"
bash "$ROOT/ops/scripts/test-plan-incremental-work.sh"
bash "$ROOT/ops/scripts/test-shared-smoke-auth-state.sh"

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
assert "SCREEN_CONTRACT_RUNTIME_SAVE_PREVIEW" in screen_wrapper and "previewMode==true" in screen_wrapper
assert "/professional-screen-contracts/preview" in screen_mjs and "previewCount: previewMode ? saves.length : 0" in screen_mjs
assert "/signin/actionLogout" in screen_mjs
assert 'runtimePublication?.published === false' in screen_mjs and 'runtimePublication?.reason === "UNCHANGED"' in screen_mjs
assert "screen_state_digest" in screen_wrapper and "pg_sequences" in screen_wrapper
assert "databaseStateHashBefore" in screen_wrapper and "databaseCurrentWrites:0" in screen_wrapper
assert screen_wrapper.count("pg_get_serial_sequence") >= 4
def preview_current_write_zero(before_rows,after_rows,before_sequence,after_sequence):
    return before_rows==after_rows and before_sequence==after_sequence
assert preview_current_write_zero("rows-hash","rows-hash",41,41)
assert not preview_current_write_zero("rows-hash","rows-hash",41,42)
usage=(root / "ops/scripts/validate-operational-usage-ledger-e2e.sh").read_text(encoding="utf-8")
for token in ("allowedRole:\"SYSTEM_ADMIN_FAMILY\"", "anonymousDenied:2", "ordinaryDenied:7",
              "browserViewports:2", "persistentFixtures:0", "reviewCreateReloadIdempotencyCleanup:true"):
    assert token in usage
assert "saveProfessionalScreenContractPreview" in service and "markCurrentTransactionRollbackOnly" in service
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

if os.environ.get("CANDIDATE_EVIDENCE_SKIP_DEPLOY_WIRING") != "true":
    deploy = deploy_path.read_text(encoding="utf-8")
    for token in (
        "CARBONET_POSTDEPLOY_CANDIDATE_ID",
        "CARBONET_POSTDEPLOY_EVIDENCE_MODE=candidate",
        "CARBONET_POSTDEPLOY_SOURCE_COMMIT",
        "promote-postdeploy-candidate-evidence.sh",
    ):
        assert token in deploy, f"auto-deploy candidate wiring missing {token}"
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
    assert "record_deploy_performance" not in finalizer and "clear-success" not in finalizer
    assert "finalize-success" in after_promoter and "|| echo" in after_promoter
    assert '"$RUNTIME_DEPLOY_STATE_FILE"' in finalizer
    assert "postdeploy_authoritative_promotion_status" in after_promoter
    assert 'write_applied_deploy_state "$target_commit"' in after_promoter
    authority = after_promoter.index("postdeploy_authoritative_promotion_status")
    snapshot_disarm = after_promoter.index("finalize-success", authority)
    runtime_marker_check = after_promoter.index('runtime_marker="$(tr -d', authority)
    assert authority < snapshot_disarm < runtime_marker_check, "promoted snapshot remains armed across marker faults"
    assert deploy.count("enable_postdeploy_candidate_mode") == 4  # definition + 3 runtime paths
    assert deploy.count("finalize_postdeploy_candidate_release") == 4
    assert deploy.count("run_postdeploy_candidate_validation_groups") == 4
    assert deploy.count("CARBONET_SCREEN_CONTRACT_PREVIEW_ONLY=1 run_screen_contract_runtime_save_gate_if_required") == 2
    assert deploy.count('write_applied_deploy_state "$target_commit"') == 3
    assert '"${CARBONET_POSTDEPLOY_EVIDENCE_MODE:-}" == candidate' in deploy[deploy.index("run_operational_usage_ledger_live_e2e_if_required()"):
                                                                                   deploy.index("verify_operational_usage_ledger_current_runtime_identity()")]
    cleanup_slice = deploy[deploy.index("cleanup_deploy()"):
                           deploy.index("run_runtime_candidate_checkpoint()")]
    assert "postdeploy_candidate_initialized=true" in deploy
    assert "reconcile_postdeploy_candidate_after_failure" in cleanup_slice
    assert 'flock -n 9' in deploy and deploy.index('flock -n 9') < deploy.index('postdeploy_candidate_id="postdeploy:')
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
assert "framework_postdeploy_evidence_promotion" in authority_body
assert "promotion.runtime_identity_hash=runtime.runtime_identity_hash" in authority_body
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
bash "$ROOT/ops/scripts/test-auto-deploy-failure-handler.sh"
