#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
AUDIT="$ROOT/ops/scripts/audit-account-lock-recovery-assurance.sh"
PROMOTER="$ROOT/ops/scripts/complete-account-lock-recovery-assurance.sh"
STATUS_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260811194000__fail_close_account_recovery_until_assured.sql"
STATUS_POSTGRES_TEST="$ROOT/ops/tests/test-account-lock-recovery-process-status-gate-postgres.sh"
CASE_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260811201000__canonicalize_account_recovery_self_service_cases.sql"
CASE_POSTGRES_TEST="$ROOT/ops/tests/test-account-lock-recovery-self-service-cases-postgres.sh"
RELAY_POSTGRES_TEST="$ROOT/ops/tests/test-account-lock-recovery-self-service-relay-postgres.sh"

bash -n "$AUDIT"
bash -n "$PROMOTER"
bash -n "$STATUS_POSTGRES_TEST"
bash -n "$CASE_POSTGRES_TEST"
bash -n "$RELAY_POSTGRES_TEST"
[[ -f "$STATUS_MIGRATION" ]]
[[ -f "$CASE_MIGRATION" ]]

ACCOUNT_RECOVERY_ASSURANCE_VALIDATE_URL_ONLY=true \
ACCOUNT_RECOVERY_DELIVERY_URL='https://delivery.internal.example/v1/recovery' \
  bash "$AUDIT"
for invalid_url in '' 'delivery.url=' 'ftp://delivery.internal.example' 'https://'; do
  if ACCOUNT_RECOVERY_ASSURANCE_VALIDATE_URL_ONLY=true \
     ACCOUNT_RECOVERY_DELIVERY_URL="$invalid_url" bash "$AUDIT"; then
    echo '[account-lock-recovery-assurance-contract] FAIL provider URL validator accepted invalid input' >&2
    exit 1
  fi
done

for token in \
  OTP_DELIVERY_PROVIDER_UNCONFIGURED \
  DEVELOPMENT_CODE_ENABLED \
  DIRTY_OR_UNTRACKED_ASSURANCE_SOURCE \
  RUNTIME_RELEASE_IDENTITY_MISMATCH \
  FOUR_STEP_BUSINESS_E2E_INCOMPLETE \
  APPROVED_TEST_CASES_INCOMPLETE \
  APPROVED_TEST_TYPES_INCOMPLETE \
  JOB_GATE_EVIDENCE_INCOMPLETE \
  ARTIFACT_EVIDENCE_INCOMPLETE \
  'valid_delivery_url' \
  'ACCOUNT_RECOVERY_DELIVERY_URL' \
  '.["account.recovery.delivery.url"]' \
  "c.contract_status='VERIFIED'" \
  "c.audit_evidence_ref='qa-run:sha256:'||e.evidence_hash" \
  "evidence_ref LIKE 'qa-run:'||j.process_code||':'" \
  'framework_current_business_e2e_evidence e' \
  "g.evidence_ref=j.evidence_ref" \
  "e.source_commit=(SELECT source_commit FROM runtime_summary)" \
  "contract_ref='process://ACCOUNT_LOCK_RECOVERY/'" \
  "'aligned',a.aligned" \
  'passedCases==.partialEvidence.tests.approvedCases' \
  'runtimeIdentityCurrent' \
  'framework_runtime_release_identity_hash(runtime) AS runtime_identity_hash' \
  "r.evidence_json::jsonb->>'runtimeIdentityHash'=" \
  "r.evidence_json::jsonb->>'podTemplateSha256'=" \
  'runtimeIdentityHash:$runtimeIdentityHash' \
  'sourceCheckoutCurrent' \
  'PROCESS_ASSURANCE_STATUS_INVALID' \
  'processStatus:["IN_DEVELOPMENT","ACTIVE"]' \
  "'promotable',a.promotable,'verified',a.verified" \
  'then .partialEvidence.jobs.verified==43' \
  'else .partialEvidence.jobs.promotable==43 end' \
  'then .partialEvidence.artifacts.verified==4' \
  'else .partialEvidence.artifacts.promotable==4 end' \
  'assuranceReady'; do
  grep -Fq "$token" "$AUDIT" || { echo "[account-lock-recovery-assurance-contract] FAIL audit missing=$token" >&2; exit 1; }
done

for token in \
  'CARBONET_DEPLOY_LOCK_FILE' \
  'flock -s -w 30 8' \
  'BEGIN ISOLATION LEVEL SERIALIZABLE' \
  'framework_process_qa_run q' \
  'FOR SHARE OF q' \
  'FOR SHARE OF r' \
  'FOR SHARE OF g' \
  'runtime_source_commit' \
  '.runtimeIdentityHash|select(test("^[0-9a-f]{64}$"))' \
  'framework_runtime_release_identity_hash(runtime)' \
  'runtime_pod_template_sha256' \
  "r.evidence_json::jsonb->>'runtimeIdentityHash'=runtime_identity_hash_value" \
  "r.evidence_json::jsonb->>'podTemplateSha256'=runtime_pod_template_sha256" \
  "runtime_identity_hash_value IS DISTINCT FROM '\$runtime_identity_hash'" \
  'and .runtimeIdentityHash==$runtimeIdentityHash' \
  '.partialEvidence.process.processStatus=="IN_DEVELOPMENT"' \
  "process_status_value<>'IN_DEVELOPMENT'" \
  "process_status='ACTIVE' AND definition_locked" \
  '.partialEvidence.process.processStatus=="ACTIVE"' \
  'contract_count<>4 OR implementation_contracts<>4' \
  'approved_cases<8 OR passed_cases<>approved_cases' \
  'approved_types<5 OR passed_types<>approved_types' \
  'job_count<>43 OR promotable_jobs<>43' \
  "job_status IN ('COMPLETED','VERIFIED')" \
  'framework_development_job_gate_result' \
  "job_status='COMPLETED'" \
  'artifact_count<>4 OR aligned_artifacts<>4 OR promotable_artifacts<>4' \
  "evidence_ref LIKE 'qa-run:'||j.process_code||':'||process_version_value" \
  'e.source_commit=runtime_source_commit' \
  "g.evidence_ref=j.evidence_ref" \
  'ASSURANCE_VERIFIED' \
  'account recovery atomic promotion did not verify 4 artifacts' \
  '.partialEvidence.artifacts.verified==4' \
  'post_report'; do
  grep -Fq "$token" "$PROMOTER" || { echo "[account-lock-recovery-assurance-contract] FAIL promoter missing=$token" >&2; exit 1; }
done

for token in \
  'runtime_identity_hash_value' 'pod_template_sha256_value' \
  "'runtimeIdentityHash',runtime_identity_hash_value" \
  "'podTemplateSha256',pod_template_sha256_value" \
  "r.evidence_json::jsonb->>'runtimeIdentityHash'=runtime_identity_hash_value" \
  "r.evidence_json::jsonb->>'podTemplateSha256'=pod_template_sha256_value"; do
  grep -Fq "$token" "$RELAY_POSTGRES_TEST" || { echo "[account-lock-recovery-assurance-contract] FAIL relay test missing=$token" >&2; exit 1; }
done

for token in \
  'definition_total<>1 OR version_total<>1' \
  'known_pre_state_total<>1' \
  "process_status IN ('ACTIVE','IN_DEVELOPMENT')" \
  'AND definition_locked' \
  "process_status='IN_DEVELOPMENT'" \
  'definition_locked=true' \
  'updated_total<>1' \
  'gated_total<>1' \
  'DISABLE TRIGGER trg_guard_locked_process_definition' \
  'ENABLE TRIGGER trg_guard_locked_process_definition'; do
  grep -Fq "$token" "$STATUS_MIGRATION" || { echo "[account-lock-recovery-assurance-contract] FAIL status migration missing=$token" >&2; exit 1; }
done

for token in unexpected-version draft-status unlocked-definition \
  'definition/version/pre-state mismatch'; do
  grep -Fq "$token" "$STATUS_POSTGRES_TEST" || { echo "[account-lock-recovery-assurance-contract] FAIL status rollback test missing=$token" >&2; exit 1; }
done

for token in \
  GENERIC_HTTP_202 APPLICATION_LEVEL_FAIL FIVE_ATTEMPT_LOCK \
  SINGLE_USE_PROOF SESSION_REVOCATION ONE_SHOT_RESULT \
  OLD_ACCESS_JWT_REJECTED SAFE_RETRY_RESEND \
  AMBIGUOUS_SUBJECT_SUPPRESSION EXACTLY_ONCE_IDEMPOTENCY \
  ASYNC_TIMING_SAFE_DELIVERY PRESERVE_VALID_PROOF_ON_DUPLICATE_VERIFY \
  ATOMIC_RATE_LIMITS TRUSTED_PROXY_IDENTITY RESEND_INVALIDATES_PREVIOUS \
  ACCOUNT_LOCK_RECOVERY_HAPPY ACCOUNT_LOCK_RECOVERY_EXCEPTION \
  ACCOUNT_LOCK_RECOVERY_AUTHORITY ACCOUNT_LOCK_RECOVERY_ISOLATION \
  ACCOUNT_LOCK_RECOVERY_RECOVERY ACCOUNT_LOCK_RECOVERY_ENUMERATION \
  ACCOUNT_LOCK_RECOVERY_REPLAY ACCOUNT_LOCK_RECOVERY_BRUTE_FORCE \
  "process_status='IN_DEVELOPMENT'" "definition_locked" \
  "DELETE FROM framework_simulation_run" "automated=false" \
  "jsonb_typeof(steps_json::jsonb)<>'array'" \
  'jsonb_array_length(steps_json::jsonb)=0' \
  "jsonb_typeof(assertions_json::jsonb)<>'array'" \
  'jsonb_array_length(assertions_json::jsonb)=0'; do
  grep -Fq "$token" "$CASE_MIGRATION" || { echo "[account-lock-recovery-assurance-contract] FAIL case migration missing=$token" >&2; exit 1; }
done

for token in unexpected-version draft-status unlocked-definition missing-case \
  'exact approved case set mismatch' 'cases=8 types=6' \
  'malformed JSON was accepted' 'malformedJson=blocked'; do
  grep -Fq "$token" "$CASE_POSTGRES_TEST" || { echo "[account-lock-recovery-assurance-contract] FAIL case rollback test missing=$token" >&2; exit 1; }
done

if grep -Fq 'INSERT INTO framework_simulation_run' "$PROMOTER"; then
  echo '[account-lock-recovery-assurance-contract] FAIL promoter must not manufacture simulation evidence' >&2
  exit 1
fi
if grep -Eq "contract_status[[:space:]]+IN[[:space:]]*\([^)]*DESIGN_COMPLETE" "$AUDIT" "$PROMOTER"; then
  echo '[account-lock-recovery-assurance-contract] FAIL design-only contract can be promoted' >&2
  exit 1
fi
if grep -Eq "job_status='VERIFIED'[^;]+WHERE[^;]+job_status='PLANNED'" "$PROMOTER"; then
  echo '[account-lock-recovery-assurance-contract] FAIL promoter upgrades PLANNED work' >&2
  exit 1
fi
if grep -Eq "SET[^;]+evidence_ref='inline://account-lock-recovery" "$PROMOTER"; then
  echo '[account-lock-recovery-assurance-contract] FAIL promoter overwrites original evidence' >&2
  exit 1
fi
if grep -Fq '*delivery*url*' "$AUDIT"; then
  echo '[account-lock-recovery-assurance-contract] FAIL provider detection accepts a property-name substring' >&2
  exit 1
fi

python3 - "$AUDIT" "$PROMOTER" <<'PY'
from pathlib import Path
import sys

audit=Path(sys.argv[1]).read_text(encoding="utf-8")
source=Path(sys.argv[2]).read_text(encoding="utf-8")
transaction=source[source.index("BEGIN ISOLATION LEVEL SERIALIZABLE;"):source.index('COMMIT;" >/dev/null')]
identity_lock=transaction.index("framework_runtime_release_identity_hash(runtime)")
identity_compare=transaction.index("runtime_identity_hash_value IS DISTINCT FROM")
first_promotion=transaction.index("INSERT INTO framework_development_job_event")
assert identity_lock < identity_compare < first_promotion
assert "FOR SHARE" in transaction[identity_lock:first_promotion]
for consumer in (audit, transaction):
    assert "r.evidence_json::jsonb->>'runtimeIdentityHash'" in consumer
    assert "r.evidence_json::jsonb->>'podTemplateSha256'" in consumer
mutant=transaction.replace(
    " OR runtime_identity_hash_value IS DISTINCT FROM '$runtime_identity_hash'","",1
)
assert "runtime_identity_hash_value IS DISTINCT FROM" not in mutant
assert "runtime_identity_hash_value IS DISTINCT FROM" in transaction
template_mutant=transaction.replace(
    "AND r.evidence_json::jsonb->>'podTemplateSha256'=runtime_pod_template_sha256", "", 1
)
assert "r.evidence_json::jsonb->>'podTemplateSha256'=runtime_pod_template_sha256" in transaction
assert template_mutant != transaction
PY

echo '[account-lock-recovery-assurance-contract] PASS failClosed=true steps=4 canonicalScreens=4 artifacts=4 cases=all types=all jobs=43 deployLock=shared evidenceLocks=serializable runtimeIdentity=source+V2hash+podTemplate simulations=identity-bound providerUrl=exact manufacturedEvidence=0'
