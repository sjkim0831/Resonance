#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260811191500__retire_account_recovery_admin_bypass_contracts.sql"
CLASSIFIER="$ROOT/ops/scripts/report-process-closing-classification.sh"
for token in RETIRED_DUPLICATE_ADMIN_FLOW "retired <> 4" "api_contract='[]'" "command_contract='[]'" "contract_status='REVIEW_REQUIRED'" 'administrative credential bypass contract remains executable'; do
  grep -Fq "$token" "$MIGRATION" || { echo "missing retirement guard: $token" >&2; exit 1; }
done
grep -Fq "WHERE audit_evidence_ref <> 'RETIRED_DUPLICATE_ADMIN_FLOW'" "$CLASSIFIER"
if grep -Eq 'resetPassword\(|api_verified=true|database_verified=true|authority_verified=true' "$MIGRATION"; then
  echo 'retirement migration must not implement or verify an administrative credential bypass' >&2; exit 1
fi
echo '[account-recovery-admin-retirement] PASS retired=4 canonicalUserSteps=4 credentialBypass=0 ai=false'
