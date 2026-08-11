#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260807052000__bind_business_e2e_evidence_to_current_contract.sql"
SERVICE="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/ActorProcessGovernanceService.java"
AUDIT="$ROOT/ops/scripts/resonance-all-process-contract-audit.mjs"
GENERIC="$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh"
PORTFOLIO="$ROOT/ops/scripts/promote-project-portfolio-after-e2e.sh"
EMISSION="$ROOT/ops/scripts/complete-emission-project-assurance.sh"
CAPTURE="$ROOT/ops/scripts/capture-business-e2e-contract.sh"
RUNTIME_LEDGER="$ROOT/ops/scripts/record-runtime-release-state.sh"
AUTO_DEPLOY="$ROOT/ops/scripts/auto-deploy-main.sh"
BUILD_DEPLOY="$ROOT/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"

for file in "$MIGRATION" "$SERVICE" "$AUDIT" "$GENERIC" "$PORTFOLIO" "$EMISSION" "$CAPTURE" "$RUNTIME_LEDGER" "$AUTO_DEPLOY" "$BUILD_DEPLOY"; do
  [[ -f "$file" ]] || { echo "missing contract file: $file" >&2; exit 1; }
done

bash -n "$GENERIC" "$PORTFOLIO" "$EMISSION" "$CAPTURE" "$RUNTIME_LEDGER" "$AUTO_DEPLOY" "$BUILD_DEPLOY"
node --check "$AUDIT"

grep -q "DEFAULT 'LEGACY_QA'" "$MIGRATION"
grep -q "evidence.evidence_type='BUSINESS_E2E'" "$MIGRATION"
grep -q 'evidence.process_version=p.process_version' "$MIGRATION"
grep -q 'evidence.contract_fingerprint=fingerprint.contract_fingerprint' "$MIGRATION"
grep -q 'BEFORE UPDATE OR DELETE ON framework_process_qa_run' "$MIGRATION"
grep -q 'BEFORE INSERT ON framework_process_qa_run' "$MIGRATION"
grep -q "to_jsonb(s)-'step_id'-'created_at'-'updated_at'" "$MIGRATION"
grep -q 'framework_process_flow_edge edge' "$MIGRATION"
grep -q 'framework_process_data_handoff handoff' "$MIGRATION"
grep -q 'framework_process_dependency dependency' "$MIGRATION"
grep -q 'NO_CURRENT_VERSION_EVIDENCE' "$MIGRATION"
grep -q 'CREATE TABLE IF NOT EXISTS framework_runtime_release_state' "$MIGRATION"
grep -q "CHECK (release_key='CARBONET_RUNTIME')" "$MIGRATION"
grep -q "source_commit ~ '\^\[0-9a-f\]{40}\$'" "$MIGRATION"
grep -q 'RUNTIME_COMMIT_UNAVAILABLE' "$MIGRATION"
grep -q 'evidence.source_commit=runtime.source_commit' "$MIGRATION"
! grep -q 'DROP CONSTRAINT' "$MIGRATION"

grep -q 'framework_current_business_e2e_evidence' "$SERVICE"
grep -q 'framework_current_process_step_contract_fingerprint' "$SERVICE"
grep -q "'QA_RUNTIME'" "$SERVICE"
grep -q 'READ_ONLY_AUDIT_BUSINESS_PASS_REQUIRES_CURRENT_VERSION_LEDGER_NO_PROMOTION' "$AUDIT"
grep -q 'BUSINESS_EVIDENCE_STALE_CONTRACT_VERSION' "$AUDIT"
grep -q 'BUSINESS_EVIDENCE_FINGERPRINT_MISMATCH' "$AUDIT"
grep -q 'BUSINESS_EVIDENCE_RUNTIME_COMMIT_MISMATCH' "$AUDIT"
grep -q 'BUSINESS_RUNTIME_COMMIT_UNAVAILABLE' "$AUDIT"

for writer in "$GENERIC" "$PORTFOLIO" "$EMISSION"; do
  grep -q "'BUSINESS_E2E'" "$writer"
  grep -q 'framework_current_process_step_contract_fingerprint' "$writer"
  grep -q 'framework_current_business_e2e_evidence' "$writer"
  ! grep -Eq 'UPDATE[[:space:]]+framework_process_qa_run' "$writer"
done

grep -q 'resonance\\.ai/target-commit' "$CAPTURE"
grep -q 'framework_runtime_release_state' "$CAPTURE"
grep -q 'runtime release ledger and deployment target-commit annotation differ' "$CAPTURE"
! grep -q 'carbonet-main-success.commit' "$CAPTURE"
! grep -q 'E2E_ALLOW_LEGACY_DEPLOYMENT_WITHOUT_ANNOTATION' "$CAPTURE"
grep -q 'framework_current_process_step_contract_fingerprint' "$CAPTURE"
grep -q 'runtime contract changed during E2E' "$GENERIC"
grep -q 'runtime commit is not an ancestor of the validation commit' "$PORTFOLIO"
grep -q 'unreleased runtime change detected' "$PORTFOLIO"
grep -q 'runtime commit is not validation ancestor' "$EMISSION"
grep -q 'unreleased runtime change key=' "$EMISSION"
grep -q 'stepAssertions' "$EMISSION"
grep -q 'validators:' "$EMISSION"
grep -q 'inline://business-e2e/sha256/' "$EMISSION"
grep -q "evidence.body || jsonb_build_object('stepCode'" "$EMISSION"
grep -q 'resolve-patroni-primary-pod.sh' "$EMISSION"
! grep -q "'carbonet-prod','\$ASSURANCE_EVIDENCE_URI'" "$EMISSION"

! grep -Eq "required\.case_code,'1\.0'" "$PORTFOLIO"

grep -q 'delete from framework_runtime_release_state' "$RUNTIME_LEDGER"
grep -q 'resonance.ai/target-commit=\$TARGET_COMMIT' "$RUNTIME_LEDGER"
grep -q 'actuator/health' "$RUNTIME_LEDGER"
grep -q 'observedGeneration' "$RUNTIME_LEDGER"
grep -q 'desired_replicas' "$RUNTIME_LEDGER"
grep -q 'runtime_image_id_count' "$RUNTIME_LEDGER"
grep -q 'image_id=excluded.image_id' "$RUNTIME_LEDGER"
grep -q 'on conflict (release_key) do update' "$RUNTIME_LEDGER"
! grep -q 'carbonet-main-success.commit' "$RUNTIME_LEDGER"
grep -q 'PRE_ROLLOUT_TARGET_COMMIT' "$BUILD_DEPLOY"
grep -q "resonance.ai/target-commit-'" "$BUILD_DEPLOY"

node - "$AUTO_DEPLOY" <<'NODE'
const fs = require('fs');
const deploy = fs.readFileSync(process.argv[2], 'utf8');
if (!deploy.includes('RUNTIME_DEPLOY_STATE_FILE="${CARBONET_RUNTIME_DEPLOY_STATE_FILE:-')) {
  throw new Error('dedicated runtime identity marker is missing');
}
const finalizerStart = deploy.indexOf('finalize_postdeploy_candidate_release() {');
const finalizer = deploy.slice(finalizerStart,
                               deploy.indexOf('# Recovery executes immediately', finalizerStart));
const release = finalizer.indexOf('record_runtime_release_state "$target_commit"');
const promoter = finalizer.indexOf('promote-postdeploy-candidate-evidence.sh');
const runtimeMarker = finalizer.indexOf('"$RUNTIME_DEPLOY_STATE_FILE"', promoter);
const authority = finalizer.indexOf('postdeploy_authoritative_promotion_status', promoter);
const appliedMarker = finalizer.indexOf('write_applied_deploy_state "$target_commit"', authority);
if (!(release >= 0 && promoter > release && runtimeMarker > promoter && authority > runtimeMarker && appliedMarker > authority)) {
  throw new Error('runtime publication must promote DB/runtime marker before the overall applied marker');
}
if ((deploy.match(/write_applied_deploy_state "\$target_commit"/g) || []).length !== 3) {
  throw new Error('expected one runtime finalizer and two non-runtime applied-marker call sites');
}
const verifierStart = deploy.indexOf('verify_operational_usage_ledger_current_runtime_identity() {');
const verifier = deploy.slice(verifierStart,
                              deploy.indexOf('# A DB COMMIT can outlive', verifierStart));
if (!verifier.includes('$RUNTIME_DEPLOY_STATE_FILE') || verifier.includes('$DEPLOY_STATE_FILE')) {
  throw new Error('current runtime identity must use only the dedicated runtime marker');
}
if (!deploy.includes('FULL_SCREEN_GATE_BASE_COMMIT="$runtime_deployed_commit"')) {
  throw new Error('rollback snapshot is not bound to the serving runtime identity');
}
NODE

echo '[current-business-e2e-evidence-test] PASS legacy=excluded evidence=immutable binding=runtime-commit+process-version+fingerprint deploy-marker=ledger-guarded rollback=identity-restored'
