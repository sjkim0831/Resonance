#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
AUDIT="$ROOT/ops/scripts/audit-account-lock-recovery-assurance.sh"
PROMOTER="$ROOT/ops/scripts/complete-account-lock-recovery-assurance.sh"

bash -n "$AUDIT"
bash -n "$PROMOTER"

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
  'sourceCheckoutCurrent' \
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
  'post_report'; do
  grep -Fq "$token" "$PROMOTER" || { echo "[account-lock-recovery-assurance-contract] FAIL promoter missing=$token" >&2; exit 1; }
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

echo '[account-lock-recovery-assurance-contract] PASS failClosed=true steps=4 canonicalScreens=4 artifacts=4 cases=all types=all jobs=43 deployLock=shared evidenceLocks=serializable providerUrl=exact manufacturedEvidence=0'
