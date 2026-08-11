#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
TARGET="$ROOT/ops/scripts/promote-company-reapplication-process-after-e2e.sh"
ATOMIC="$ROOT/ops/scripts/promote-company-reapplication-screens-atomically.sh"
[[ -x "$TARGET" ]] || { echo COMPANY_REAPPLICATION_PROCESS_PROMOTER_MISSING >&2; exit 1; }
bash -n "$TARGET"
bash -n "$ATOMIC"

for token in \
  COMPANY_REAPPLICATION_PUBLIC_HAPPY COMPANY_REAPPLICATION_PUBLIC_AUTHORITY \
  COMPANY_REAPPLICATION_PUBLIC_CONFLICT COMPANY_REAPPLICATION_PUBLIC_ISOLATION \
  COMPANY_REAPPLICATION_PUBLIC_RECOVERY TC_COMPANY_REAPPLICATION_EVIDENCE_CRASH_WINDOW \
  COMPANY_REAPPLICATION_PUBLIC_VALIDATION \
  COMPANY_REAPPLICATION_APPROVER_REVIEW \
  promote-company-reapplication-screens-atomically.sh \
  MemberCompanyReapplyFlowTest InstitutionEvidenceReconcilerTest \
  'approved_count<>7 OR passed_count<>7' \
  'framework_current_business_e2e_evidence'; do
  grep -Fq "$token" "$TARGET" || { echo "COMPANY_REAPPLICATION_PROCESS_PROMOTER_CONTRACT_MISSING token=$token" >&2; exit 1; }
done
for token in --prepare-only 'exactly two unique prepared steps are required' 'passed<>2' 'COMMIT;' 'steps":2' 'atomic":true'; do
  grep -Fq -- "$token" "$ATOMIC" || { echo "COMPANY_REAPPLICATION_ATOMIC_PROMOTER_CONTRACT_MISSING token=$token" >&2; exit 1; }
done

case_count="$(sed -n '/const required={/,/^};/p' "$TARGET" | grep -c ':\[')"
[[ "$case_count" == 7 ]] || { echo "COMPANY_REAPPLICATION_PROCESS_PROMOTER_CASE_COUNT_INVALID count=$case_count" >&2; exit 1; }

echo COMPANY_REAPPLICATION_PROCESS_PROMOTER_CONTRACT_PASS
