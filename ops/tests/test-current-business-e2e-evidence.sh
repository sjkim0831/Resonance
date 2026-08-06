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
grep -q 'deployed commit changed during E2E' "$GENERIC"
grep -q 'deployed commit changed during E2E' "$PORTFOLIO"
grep -q 'deployment changed during E2E' "$EMISSION"
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
const lines = fs.readFileSync(process.argv[2], 'utf8').split(/\r?\n/);
const markers = [];
for (let i = 0; i < lines.length; i += 1) {
  if (lines[i].includes('> "${DEPLOY_STATE_FILE}.tmp"')) markers.push(i);
}
if (markers.length !== 5) throw new Error(`expected 5 Carbonet success markers, found ${markers.length}`);
let guarded = 0;
for (const index of markers) {
  let previous = index - 1;
  while (previous >= 0 && !lines[previous].trim()) previous -= 1;
  if (lines[previous]?.includes('record_runtime_release_state "$target_commit"')) guarded += 1;
}
if (guarded !== 3) throw new Error(`expected all 3 runtime-surface markers to be ledger guarded, found ${guarded}`);
const releaseRecords = lines.map((line, index) => line.includes('record_runtime_release_state "$target_commit"') ? index : -1).filter((index) => index >= 0);
if (releaseRecords.length !== 3) throw new Error(`expected 3 runtime surface publication paths, found ${releaseRecords.length}`);
const postDeployValidation = lines.findIndex((line) => line.includes('run-post-deploy-validation-groups.sh'));
const finalMarker = markers.at(-1);
const mainRuntimeRecord = releaseRecords.at(-1);
const runtimeInvalidation = lines.findIndex((line) => line.trim() === 'invalidate_runtime_release_state');
if (!(runtimeInvalidation < postDeployValidation && postDeployValidation < mainRuntimeRecord && mainRuntimeRecord < finalMarker)) {
  throw new Error('main runtime must invalidate after health, validate fail-closed, then publish identity immediately before its marker');
}
NODE

echo '[current-business-e2e-evidence-test] PASS legacy=excluded evidence=immutable binding=runtime-commit+process-version+fingerprint deploy-marker=ledger-guarded rollback=identity-restored'
