#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
ENGINE="$ROOT/ops/scripts/resonance-all-process-contract-audit.mjs"
WRAPPER="$ROOT/ops/scripts/resonance-all-process-contract-audit.sh"
INSTALLER="$ROOT/ops/scripts/install-all-process-contract-audit.sh"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260812031500__stage_hourly_screen_contract_audit_batches.sql"
SERVICE="$ROOT/ops/systemd/resonance-all-process-contract-audit.service"
NIGHTLY="$ROOT/ops/scripts/run-nightly-frontend-contracts.sh"
NIGHTLY_SERVICE="$ROOT/ops/systemd/resonance-full-screen-nightly.service"
FULL_SCREEN="$ROOT/projects/carbonet-frontend/source/scripts/run-full-screen-smoke.sh"
LOGOUT="$ROOT/projects/carbonet-frontend/source/scripts/logout-full-screen-auth-state.mjs"
BACKEND="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/ActorProcessGovernanceService.java"
CONTROLLER="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/web/ActorProcessGovernanceApiController.java"
PERFORMANCE_TEST="$ROOT/ops/tests/test-audit-batch-performance-postgres.sh"
PERFORMANCE_GENERATOR="$ROOT/ops/tests/generate-audit-batch-performance-sql.py"
MUTATION_TEST="$ROOT/ops/tests/test-audit-batch-mutation-postgres.sh"
MUTATION_SQL="$ROOT/ops/tests/audit-batch-mutation.sql"

for file in "$ENGINE" "$WRAPPER" "$INSTALLER" "$MIGRATION" "$SERVICE" "$NIGHTLY" "$NIGHTLY_SERVICE" "$FULL_SCREEN" "$LOGOUT" "$BACKEND" "$CONTROLLER" "$PERFORMANCE_TEST" "$PERFORMANCE_GENERATOR" "$MUTATION_TEST" "$MUTATION_SQL"; do
  [[ -f "$file" ]] || { echo "missing ${file#$ROOT/}" >&2; exit 1; }
done
bash -n "$WRAPPER" "$INSTALLER" "$NIGHTLY" "$FULL_SCREEN"
node --check "$ENGINE"
node --check "$LOGOUT"

grep -Fq 'CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS:-300' "$WRAPPER"
grep -Fq 'carbonet_qa_auth_run_serialized all-process-contract-audit' "$WRAPPER"
grep -Fq 'chmod 0600 "$CREDENTIAL_FILE"' "$WRAPPER"
grep -Fq 'CARBONET_ADMIN_AUDIT_CREDENTIAL_FILE' "$WRAPPER"
! grep -Eq 'CARBONET_ADMIN_AUDIT_(USER|PASSWORD)' "$WRAPPER" "$ENGINE"
grep -Fq 'runtime-qa-auth-common.sh' "$INSTALLER"
grep -Fq 'Environment=CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS=300' "$SERVICE" "$NIGHTLY_SERVICE"
grep -Fq 'UMask=0077' "$SERVICE" "$NIGHTLY_SERVICE"
grep -Fq 'carbonet_qa_auth_run_serialized nightly-full-screen' "$NIGHTLY"
grep -Fq 'logout-full-screen-auth-state.mjs' "$FULL_SCREEN"
grep -Fq '/signin/actionLogout' "$LOGOUT" "$ENGINE"
grep -Fq 'AUDIT_REPORT_PAGE50_REFERENCE_MS:-500' "$PERFORMANCE_TEST"
grep -Fq 'AUDIT_REPORT_PAGE50_BUDGET_MS:-3000' "$PERFORMANCE_TEST"
grep -Fq 'AUDIT_TARGET_PAGE250_BUDGET_MS:-20' "$PERFORMANCE_TEST"
grep -Fq 'transaction=ROLLBACK' "$PERFORMANCE_TEST"
grep -Fq 'transaction=ROLLBACK' "$MUTATION_TEST"
grep -Fq 'framework_screen_workflow_test_run_run_id_seq' "$MUTATION_SQL"
grep -Fq 'fixture_run_base-target.target_ordinal' "$MUTATION_SQL"

python3 - "$ENGINE" "$MIGRATION" "$BACKEND" "$CONTROLLER" <<'PY'
from pathlib import Path
import sys

engine, migration, backend, controller = [Path(p).read_text(encoding="utf-8") for p in sys.argv[1:]]
main = engine[engine.index("async function main()") :]
order = [
    main.index("runContractAuditPages") if "runContractAuditPages" in main else -1,
    main.index("const audited = validate(payload)"),
    main.index("const routes = await smokeRoutes"),
    main.index("contractAudit = await completeAuditBatch"),
    main.index("await logoutLive(cookie)"),
    main.index("process.stdout.write"),
]
if order[0] != -1:
    raise SystemExit("page staging must occur in loadLiveReport, not be repeated in main")
if order[1:] != sorted(order[1:]):
    raise SystemExit(f"audit lifecycle order drift: {order}")
for token in (
    "RUNNING","COMPLETE","FAILED","FAILED_UNBOUND",
    "framework_screen_workflow_audit_batch_target",
    "framework_screen_workflow_target_inventory",
    "framework_complete_screen_workflow_audit_batch",
    "framework_current_screen_workflow_test_run",
    "UNBOUND-HOURLY-20260811-700681-702430",
    "c2e3cb12c3ea814ce44ad9fb7d8954320890c5f31525f86f9f61872708cbd243",
    "incident_run.run_id=OLD.run_id",
    "SCREEN_WORKFLOW_AUDIT_INCIDENT_INSERT_NOT_ALLOWLISTED",
    "SCREEN_WORKFLOW_AUDIT_INCIDENT_RUN_INSERT_NOT_ALLOWLISTED",
):
    if token not in migration:
        raise SystemExit(f"migration contract missing: {token}")
for token in (
    "HOURLY_ALL_PROCESS_BATCH_REQUIRES_UNFILTERED_CANONICAL_SCOPE",
    "framework_screen_workflow_test_run evidence",
    "framework_screen_workflow_audit_incident_run incident_run",
    "audit_batch.batch_status='COMPLETE'",
    "framework_screen_workflow_audit_batch_target target",
    "SCREEN_WORKFLOW_AUDIT_TARGET_SNAPSHOT_MISMATCH",
    "audit_target_key",
    "framework_record_screen_workflow_audit_page",
    "saveProfessionalScreenContractPreview",
):
    if token not in backend:
        raise SystemExit(f"backend batch/preview contract missing: {token}")
for token in ("audit-batches/start","audit-batches/{auditBatchId}/complete","audit-batches/{auditBatchId}/fail","professional-screen-contracts/preview"):
    if token not in controller:
        raise SystemExit(f"controller endpoint missing: {token}")
PY

[[ "$(find "$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql" -maxdepth 1 -type f -name 'V20260812031500__*.sql' | wc -l)" -eq 1 ]] || {
  echo 'Flyway V20260812031500 is not unique' >&2; exit 1;
}
echo '[test-audit-auth-batch-contract] PASS: canonical lock=300s secret=file logout=hourly+nightly batch=exact-complete-only incident=1750-unbound'
