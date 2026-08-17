#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260807052000__bind_business_e2e_evidence_to_current_contract.sql"
RUNTIME_IDENTITY_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260817235000__bind_runtime_identity_to_pod_template.sql"
SERVICE="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/ActorProcessGovernanceService.java"
AUDIT="$ROOT/ops/scripts/resonance-all-process-contract-audit.mjs"
GENERIC="$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh"
PORTFOLIO="$ROOT/ops/scripts/promote-project-portfolio-after-e2e.sh"
EMISSION="$ROOT/ops/scripts/complete-emission-project-assurance.sh"
CAPTURE="$ROOT/ops/scripts/capture-business-e2e-contract.sh"
RUNTIME_LEDGER="$ROOT/ops/scripts/record-runtime-release-state.sh"
AUTO_DEPLOY="$ROOT/ops/scripts/auto-deploy-main.sh"
BUILD_DEPLOY="$ROOT/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"

for file in "$MIGRATION" "$RUNTIME_IDENTITY_MIGRATION" "$SERVICE" "$AUDIT" "$GENERIC" "$PORTFOLIO" "$EMISSION" "$CAPTURE" "$RUNTIME_LEDGER" "$AUTO_DEPLOY" "$BUILD_DEPLOY"; do
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

grep -q 'ADD COLUMN IF NOT EXISTS runtime_identity_hash varchar(64)' "$RUNTIME_IDENTITY_MIGRATION"
grep -q 'ck_framework_process_qa_run_runtime_identity_hash' "$RUNTIME_IDENTITY_MIGRATION"
grep -q 'framework_runtime_release_identity_hash(runtime_state)' "$RUNTIME_IDENTITY_MIGRATION"
grep -q "release_key='CARBONET_RUNTIME'" "$RUNTIME_IDENTITY_MIGRATION"
grep -q 'FOR SHARE' "$RUNTIME_IDENTITY_MIGRATION"
grep -q "captured->>'runtimeIdentityHash' IS DISTINCT FROM canonical_runtime_hash" "$RUNTIME_IDENTITY_MIGRATION"
grep -q "captured->>'podTemplateSha256' IS DISTINCT FROM runtime_state.pod_template_sha256" "$RUNTIME_IDENTITY_MIGRATION"
grep -q 'evidence.runtime_identity_hash=runtime_hash.runtime_identity_hash' "$RUNTIME_IDENTITY_MIGRATION"
! grep -Eq 'UPDATE[[:space:]]+framework_process_qa_run[[:space:]]+SET[[:space:]]+runtime_identity_hash' "$RUNTIME_IDENTITY_MIGRATION"

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

grep -q 'resonance.ai/target-commit' "$CAPTURE"
grep -q 'resonance.ai/runtime-template-sha256' "$CAPTURE"
grep -q 'framework_runtime_release_state' "$CAPTURE"
grep -q 'framework_runtime_release_identity_hash(runtime)' "$CAPTURE"
grep -q "jq -cS '.spec.template'" "$CAPTURE"
grep -q 'runtime release ledger and deployment source/PodTemplate attestations differ' "$CAPTURE"
grep -q -- '--arg runtimeIdentityHash "$RUNTIME_IDENTITY_HASH"' "$CAPTURE"
grep -q -- '--arg podTemplateSha256 "$POD_TEMPLATE_SHA256"' "$CAPTURE"
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
const allAppliedMarkers = (deploy.match(/write_applied_deploy_state "\$target_commit"/g) || []).length;
const finalizerAppliedMarkers = (finalizer.match(/write_applied_deploy_state "\$target_commit"/g) || []).length;
if (finalizerAppliedMarkers !== 1 || allAppliedMarkers < 3) {
  throw new Error('expected exactly one runtime-finalizer marker and retained non-runtime/recovery marker paths');
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

python3 - "$RUNTIME_IDENTITY_MIGRATION" "$CAPTURE" <<'PY'
import pathlib
import sys

migration = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
capture = pathlib.Path(sys.argv[2]).read_text(encoding="utf-8")
trigger = migration.split("CREATE OR REPLACE FUNCTION framework_validate_process_qa_evidence_insert()", 1)[1].split("CREATE OR REPLACE VIEW", 1)[0]
view = migration.split("CREATE OR REPLACE VIEW framework_current_business_e2e_evidence AS", 1)[1].split("COMMENT ON COLUMN", 1)[0]
for token in (
    "FOR SHARE",
    "runtimeIdentityHash",
    "podTemplateSha256",
    "canonical_runtime_hash IS NULL",
):
    if token not in trigger:
        raise SystemExit(f"BUSINESS_E2E runtime trigger contract missing: {token}")
for token in (
    "evidence.runtime_identity_hash=runtime_hash.runtime_identity_hash",
    "runtime_hash.runtime_identity_hash IS NOT NULL",
):
    if token not in view:
        raise SystemExit(f"BUSINESS_E2E current view contract missing: {token}")

snapshot = capture.index('DEPLOYMENT_JSON="$(kubectl')
live_hash = capture.index("LIVE_TEMPLATE_SHA256=", snapshot)
proof = capture.index('ANNOTATED_TEMPLATE_SHA256', live_hash)
emit = capture.index('--arg runtimeIdentityHash', proof)
if not snapshot < live_hash < proof < emit:
    raise SystemExit("BUSINESS_E2E capture must prove one live Deployment snapshot before emitting identity")
for removed in ("ANNOTATED_TEMPLATE_SHA256", "LIVE_TEMPLATE_SHA256", "DEPLOYMENT_UID"):
    mutant = capture.replace(removed, "REMOVED", 1)
    if mutant == capture:
        raise SystemExit(f"capture mutant was ineffective: {removed}")
PY

echo '[current-business-e2e-evidence-test] PASS legacy=excluded evidence=immutable binding=runtime-identity-v2+pod-template+process-version+fingerprint live-snapshot=exact old-evidence=stale'
