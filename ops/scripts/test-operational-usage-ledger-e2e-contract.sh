#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
HARNESS="$ROOT/ops/scripts/validate-operational-usage-ledger-e2e.sh"
CONTROLLER="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/web/ActorProcessGovernanceApiController.java"
SERVICE="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/ActorProcessGovernanceService.java"
SERVICE_TEST="$ROOT/modules/resonance-common/carbonet-common-core/src/test/java/egovframework/com/platform/governance/service/ActorProcessGovernanceServiceSecurityTest.java"
CONTROLLER_TEST="$ROOT/modules/resonance-common/carbonet-common-core/src/test/java/egovframework/com/platform/governance/web/ActorProcessGovernanceApiControllerAssignmentTest.java"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260811223000__create_system_usage_review_ledger.sql"
PANEL="$ROOT/projects/carbonet-frontend/source/src/features/actor-process-governance/SystemProcessTestReportPanel.tsx"
FRONTEND_AUDIT="$ROOT/projects/carbonet-frontend/source/scripts/verify-operational-usage-ledger.mjs"
FRONTEND_PIPELINE="$ROOT/projects/carbonet-frontend/source/scripts/run-frontend-pipeline.mjs"
FRONTEND_PACKAGE="$ROOT/projects/carbonet-frontend/source/package.json"
PLANNER="$ROOT/ops/scripts/plan-incremental-work.sh"
DEPLOY="$ROOT/ops/scripts/auto-deploy-main.sh"
AUTH_LOGOUT_LIVE="$ROOT/ops/tests/test-auth-logout-revocation-live.sh"
AUTH_LOGOUT_LEADER_CONTRACT="$ROOT/ops/tests/test-auth-logout-revocation-leader-contract.sh"
PROVISION_CONTRACT="$ROOT/ops/tests/test-usage-ledger-system-admin-provision-contract.sh"
PROVISION="$ROOT/ops/scripts/provision-usage-ledger-system-admin.sh"
DB_POSTCONDITION="$ROOT/ops/tests/test-usage-ledger-system-admin-db-postcondition.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

fail(){ printf '[operational-usage-ledger-e2e-contract] FAIL: %s\n' "$*" >&2; exit 1; }
contains(){ local file="$1" needle="$2"; grep -Fq -- "$needle" "$file" || fail "missing contract in ${file#$ROOT/}: $needle"; }
not_contains(){ local file="$1" needle="$2"; ! grep -Fq -- "$needle" "$file" || fail "forbidden contract in ${file#$ROOT/}: $needle"; }

for file in "$HARNESS" "$CONTROLLER" "$SERVICE" "$SERVICE_TEST" "$CONTROLLER_TEST" "$MIGRATION" "$PANEL" "$FRONTEND_AUDIT" "$FRONTEND_PIPELINE" "$FRONTEND_PACKAGE" "$PLANNER" "$DEPLOY" "$AUTH_LOGOUT_LIVE" "$AUTH_LOGOUT_LEADER_CONTRACT" "$PROVISION_CONTRACT" "$PROVISION" "$DB_POSTCONDITION"; do [[ -f "$file" ]] || fail "required file missing: ${file#$ROOT/}"; done
bash -n "$HARNESS" "$AUTH_LOGOUT_LIVE" "$AUTH_LOGOUT_LEADER_CONTRACT"
bash "$HARNESS" --self-test >/dev/null
bash "$AUTH_LOGOUT_LEADER_CONTRACT" >/dev/null
bash "$PROVISION_CONTRACT" "$ROOT" >/dev/null
node "$FRONTEND_AUDIT" >/dev/null

contains "$HARNESS" 'source "$ROOT/ops/scripts/runtime-qa-auth-common.sh"'
contains "$HARNESS" 'carbonet-usage-ledger-system-admin'
not_contains "$HARNESS" 'CARBONET_USAGE_LEDGER_ALLOWED_AUTH_SECRET:-carbonet-screen-smoke'
contains "$HARNESS" 'carbonet-test-account-switch'
contains "$HARNESS" 'carbonet_qa_login'
contains "$HARNESS" 'carbonet_qa_logout'
contains "$HARNESS" 'anonymous_api_status'
contains "$HARNESS" '/admin/api/system/actor-process/dashboard/core'
contains "$HARNESS" '/admin/api/system/actor-process/design-assets'
contains "$HARNESS" 'compact=true&page=${page}&size=${PAGE_SIZE}'
contains "$HARNESS" 'system-test-report/step-detail'
contains "$HARNESS" 'reviewStatus:"APPROVED"'
contains "$HARNESS" 'IDEMPOTENCY_KEY_REUSE_MISMATCH'
contains "$HARNESS" 'mismatch409=1'
contains "$HARNESS" 'redaction mutation survived'
contains "$HARNESS" 'extended secret mutation survived'
contains "$HARNESS" 'apiKey: "api-key-leak"'
contains "$HARNESS" 'credential: "credential-leak"'
contains "$HARNESS" 'privateKey: "private-key-leak"'
contains "$HARNESS" 'sessionId: "session-id-leak"'
contains "$HARNESS" 'developmentCode: "development-code-leak"'
contains "$HARNESS" 'verificationCode: "verification-code-leak"'
contains "$HARNESS" 'branch truth mutation survived'
contains "$HARNESS" 'stepCode tie-order regression mutation survived'
contains "$HARNESS" 'String(row.stepCode)'
contains "$HARNESS" '.orderContract.fields==["domainOrder","workflowOrder","processCode","stepOrder","stepCode"]'
contains "$HARNESS" '.items[] | [.domainOrder,.workflowOrder,.processCode,.stepOrder,.stepCode] | @tsv'
contains "$HARNESS" 'return $5 < pc'
contains "$HARNESS" 'global 5-key WORK_TYPE_PROCESS_STEP order regressed across pages'
contains "$HARNESS" 'pageOverflow'
contains "$HARNESS" 'width: 390, height: 844'
contains "$HARNESS" 'reviewScopeOptionCount'
contains "$HARNESS" 'persistentFixtures=0'
not_contains "$HARNESS" 'reviewStatus:"CHANGE_REQUESTED"'
not_contains "$HARNESS" 'capabilityCount==6'
not_contains "$HARNESS" 'set -x'

contains "$CONTROLLER" '@GetMapping("/system-test-report")'
contains "$CONTROLLER" '@GetMapping("/system-test-report/step-detail")'
contains "$CONTROLLER" '@PostMapping("/system-test-report/audit")'
contains "$CONTROLLER" '@PostMapping("/system-test-report/reviews")'
contains "$CONTROLLER" 'context.getUserId()'
contains "$CONTROLLER" 'Set.of("ROLE_SYSTEM_MASTER","ROLE_SYSTEM_ADMIN")'
contains "$CONTROLLER_TEST" 'stepDetailRequiresPlatformAdministrationAndReturnsOnlyTheFullSelectedStep'
contains "$CONTROLLER_TEST" 'reviewIdempotencyReuseMismatchIs409WhileOrdinaryValidationRemains400'
contains "$SERVICE" 'detail.put("detailMode","SELECTED_STEP_FULL")'
contains "$SERVICE" 'SYSTEM_REPORT_SECRET_KEY_FRAGMENTS'
contains "$SERVICE" 'prior.put("idempotent",true)'
contains "$SERVICE" 'review.put("reviewEvidenceScope","HUMAN_REVIEW_ONLY")'
contains "$SERVICE_TEST" 'plain-secret'
contains "$SERVICE_TEST" 'access-secret'
contains "$SERVICE_TEST" 'session-secret'
contains "$SERVICE_TEST" 'api-key-secret'
contains "$SERVICE_TEST" 'credential-secret'
contains "$SERVICE_TEST" 'private-key-secret'
contains "$SERVICE_TEST" 'session-id-secret'
contains "$SERVICE" '"apikey"'
contains "$SERVICE" '"privatekey"'
contains "$SERVICE" '"credential"'
contains "$SERVICE" '"sessionid"'
contains "$SERVICE" '"csrf"'
contains "$SERVICE" '"jwt"'
contains "$SERVICE" '"developmentcode"'
contains "$SERVICE" '"verificationcode"'
contains "$SERVICE_TEST" 'nextDestinationInventoryKeepsEdgeAndTargetActorsAndDualRoutesDistinct'
contains "$SERVICE" "'edgeActorCode',edge.actor_code"
contains "$SERVICE" "'targetActorCode',target.actor_code"
contains "$SERVICE" "'userRoutePath',coalesce(target.user_path,'')"
contains "$SERVICE" "'adminRoutePath',coalesce(target.admin_path,'')"
contains "$SERVICE" "'routeResolution',case"
contains "$SERVICE" "'screenRouteInventory'"
contains "$MIGRATION" 'framework_system_usage_review_idempotency_uk'
contains "$MIGRATION" "'APPROVED','CHANGE_REQUESTED'"

mapfile -t help_selectors < <(rg -o '\[data-help-id="[^"]+"\]' "$MIGRATION" | sort -u)
[[ "${#help_selectors[@]}" == "5" ]] || fail "migration must publish exactly five unique help selectors"
for help_selector in "${help_selectors[@]}"; do
  help_id="$(printf '%s\n' "$help_selector" | sed -E 's/^\[data-help-id="([^"]+)"\]$/\1/')"
  [[ -n "$help_id" && "$help_id" != "$help_selector" ]] || fail "invalid migration help selector: $help_selector"
  contains "$PANEL" "data-help-id=\"${help_id}\""
done
contains "$PANEL" 'developmentCode|verificationCode|apiKey|privateKey|credential|sessionId|csrf|jwt'
contains "$PANEL" 'const interactionBusy = busy || documentBusy || Boolean(rowBusyKey);'
contains "$PANEL" 'return number(row, "reviewId") > 0 && hasVersionFlag && reviewRecordCurrent(row);'
contains "$FRONTEND_AUDIT" '["developmentCode", "verificationCode", "apiKey", "privateKey", "credential", "sessionId", "csrf", "jwt"]'
contains "$FRONTEND_AUDIT" 'row command overlap A/B'
contains "$FRONTEND_AUDIT" 'partial-only review reload'
contains "$FRONTEND_PIPELINE" 'runAsync(process.execPath, ["scripts/verify-operational-usage-ledger.mjs"])'
contains "$FRONTEND_PACKAGE" '"audit:operational-usage-ledger": "node scripts/verify-operational-usage-ledger.mjs"'

contains "$PLANNER" 'runtime:operational-usage-ledger-e2e'
contains "$PLANNER" 'operational-usage-ledger-contract'
contains "$PLANNER" 'ops/scripts/provision-usage-ledger-system-admin.sh'
contains "$PLANNER" 'ops/tests/test-usage-ledger-system-admin-provision-contract.sh'
contains "$PLANNER" 'ops/tests/test-usage-ledger-system-admin-db-postcondition.sh'
contains "$PLANNER" 'ops/tests/test-auth-logout-revocation-live.sh'
contains "$PLANNER" 'ops/tests/test-auth-logout-revocation-leader-contract.sh'
contains "$PLANNER" 'ops/scripts/auto-deploy-main.sh'
contains "$PLANNER" 'ops/scripts/plan-incremental-work.sh'
contains "$PLANNER" 'projects/carbonet-frontend/source/scripts/run-frontend-pipeline.mjs'
contains "$PLANNER" 'projects/carbonet-frontend/source/package.json'
contains "$DEPLOY" 'run_operational_usage_ledger_static_contract_if_required'
contains "$DEPLOY" 'record_runtime_release_state "$target_commit"'
contains "$DEPLOY" 'run_operational_usage_ledger_live_e2e_if_required'
contains "$DEPLOY" 'local expected_commit="${1:-$target_commit}"'
contains "$DEPLOY" 'verify_operational_usage_ledger_current_runtime_identity'
contains "$DEPLOY" 'framework_runtime_release_state'
contains "$DEPLOY" 'resonance.ai/target-commit'
contains "$DEPLOY" 'STATIC_ONLY_BLOCKED_RUNTIME_IDENTITY_MISMATCH'
contains "$DEPLOY" 'run_operational_usage_ledger_current_runtime_e2e_if_required "$runtime_deployed_commit"'
contains "$DEPLOY" 'CARBONET_USAGE_LEDGER_E2E_TIMEOUT_SECONDS:-120'
contains "$DEPLOY" 'invalidate_runtime_release_state'

pipeline_contract() {
  local planner="$1" deploy="$2" frontend_pipeline="$3" frontend_package="$4"
  grep -Fq 'runtime:operational-usage-ledger-e2e' "$planner" &&
    grep -Fq 'ops/scripts/auto-deploy-main.sh' "$planner" &&
    grep -Fq 'ops/scripts/plan-incremental-work.sh' "$planner" &&
    grep -Fq 'projects/carbonet-frontend/source/scripts/run-frontend-pipeline.mjs' "$planner" &&
    grep -Fq 'projects/carbonet-frontend/source/package.json' "$planner" &&
    grep -Fq 'runAsync(process.execPath, ["scripts/verify-operational-usage-ledger.mjs"])' "$frontend_pipeline" &&
    grep -Fq '"audit:operational-usage-ledger": "node scripts/verify-operational-usage-ledger.mjs"' "$frontend_package" &&
    [[ "$(grep -Ec '^[[:space:]]*run_operational_usage_ledger_static_contract_if_required$' "$deploy")" == "2" ]] &&
    [[ "$(grep -Ec '^[[:space:]]*run_operational_usage_ledger_current_runtime_e2e_if_required "\$runtime_deployed_commit"$' "$deploy")" == "2" ]]
}
pipeline_contract "$PLANNER" "$DEPLOY" "$FRONTEND_PIPELINE" "$FRONTEND_PACKAGE" || fail "usage-ledger pipeline wiring contract is incomplete"
sed 's/runtime:operational-usage-ledger-e2e/runtime:REMOVED/g' "$PLANNER" >"$TMP_DIR/planner-token-removed.sh"
if pipeline_contract "$TMP_DIR/planner-token-removed.sh" "$DEPLOY" "$FRONTEND_PIPELINE" "$FRONTEND_PACKAGE"; then
  fail "planner-token removal mutation survived"
fi
sed '/^[[:space:]]*run_operational_usage_ledger_current_runtime_e2e_if_required "\$runtime_deployed_commit"$/d' \
  "$DEPLOY" >"$TMP_DIR/live-pipeline-call-removed.sh"
if pipeline_contract "$PLANNER" "$TMP_DIR/live-pipeline-call-removed.sh" "$FRONTEND_PIPELINE" "$FRONTEND_PACKAGE"; then
  fail "live-pipeline-call removal mutation survived"
fi
sed 's#runAsync(process.execPath, \["scripts/verify-operational-usage-ledger.mjs"\])#Promise.resolve()#g' \
  "$FRONTEND_PIPELINE" >"$TMP_DIR/frontend-pipeline-audit-call-removed.mjs"
if pipeline_contract "$PLANNER" "$DEPLOY" "$TMP_DIR/frontend-pipeline-audit-call-removed.mjs" "$FRONTEND_PACKAGE"; then
  fail "frontend-pipeline audit-call removal mutation survived"
fi
sed 's#"audit:operational-usage-ledger": "node scripts/verify-operational-usage-ledger.mjs"#"audit:operational-usage-ledger-REMOVED": "false"#g' \
  "$FRONTEND_PACKAGE" >"$TMP_DIR/frontend-package-audit-script-removed.json"
if pipeline_contract "$PLANNER" "$DEPLOY" "$FRONTEND_PIPELINE" "$TMP_DIR/frontend-package-audit-script-removed.json"; then
  fail "frontend-package audit-script removal mutation survived"
fi
finalizer_body="$(sed -n '/^finalize_postdeploy_candidate_release() {/,/^}/p' "$DEPLOY")"
printf '%s\n' "$finalizer_body" | awk '
  /record_runtime_release_state "\$target_commit"/ { ledger=NR }
  /run_operational_usage_ledger_live_e2e_if_required "\$target_commit"/ { usage=NR }
  /verify_postdeploy_candidate_staged/ { staged=NR }
  /promote-postdeploy-candidate-evidence\.sh/ { promoter=NR }
  END { exit !(ledger>0 && usage>ledger && staged>usage && promoter>staged) }
' || fail "candidate finalizer must publish ledger, run usage, precheck 12 units, then promote marker"
[[ "$(grep -Ec '^[[:space:]]*finalize_postdeploy_candidate_release$' "$DEPLOY")" == 3 ]] \
  || fail "each of the three runtime release paths must use the candidate finalizer"
merge_line="$(rg -n '^git merge --ff-only "\$target_commit"$' "$DEPLOY" | cut -d: -f1)"
static_line="$(rg -n '^run_operational_usage_ledger_static_contract_if_required$' "$DEPLOY" | cut -d: -f1)"
flyway_line="$(rg -n 'verify-flyway-migration-immutability\.sh' "$DEPLOY" | tail -1 | cut -d: -f1)"
[[ "$merge_line" =~ ^[0-9]+$ && "$static_line" =~ ^[0-9]+$ && "$flyway_line" =~ ^[0-9]+$ && "$merge_line" -lt "$static_line" && "$static_line" -lt "$flyway_line" ]] \
  || fail "static usage-ledger contract must run after candidate merge and before Flyway/build work"
static_only_merge_line="$(rg -n '^  git merge --ff-only "\$target_commit"$' "$DEPLOY" | head -1 | cut -d: -f1)"
static_only_static_line="$(rg -n '^  run_operational_usage_ledger_static_contract_if_required$' "$DEPLOY" | head -1 | cut -d: -f1)"
static_only_live_line="$(rg -n '^  run_operational_usage_ledger_current_runtime_e2e_if_required "\$runtime_deployed_commit"$' "$DEPLOY" | head -1 | cut -d: -f1)"
static_only_marker_line="$(awk -v start="$static_only_live_line" 'NR > start && /write_applied_deploy_state "\$target_commit"/ { print NR; exit }' "$DEPLOY")"
[[ "$static_only_merge_line" =~ ^[0-9]+$ && "$static_only_static_line" =~ ^[0-9]+$ && "$static_only_live_line" =~ ^[0-9]+$ && "$static_only_marker_line" =~ ^[0-9]+$ \
   && "$static_only_merge_line" -lt "$static_only_static_line" && "$static_only_static_line" -lt "$static_only_live_line" && "$static_only_live_line" -lt "$static_only_marker_line" ]] \
  || fail "static-only pipeline must merge, run static contract, verify current runtime live, then advance marker"

grep -Fq 'RUNTIME_DEPLOY_STATE_FILE="${CARBONET_RUNTIME_DEPLOY_STATE_FILE:-/opt/resonance-data/deploy/carbonet-runtime-identity-success.commit}"' "$DEPLOY" \
  || fail "dedicated runtime identity marker is missing"
grep -Fq 'marker_commit="$(tr -d '\''[:space:]'\'' <"$RUNTIME_DEPLOY_STATE_FILE" 2>/dev/null' "$DEPLOY" \
  || fail "runtime identity verifier still reads the overall applied marker"
grep -Fq 'FULL_SCREEN_GATE_BASE_COMMIT="$runtime_deployed_commit"' "$DEPLOY" \
  || fail "rollback snapshot is not bound to the serving runtime commit"
grep -Fq 'runtime identity marker bootstrapped from DB+K8s' "$DEPLOY" \
  || fail "fail-closed DB+K8s legacy runtime-marker bootstrap is missing"
! sed -n '/^verify_operational_usage_ledger_current_runtime_identity() {/,/^}/p' "$DEPLOY" | grep -Fq '$DEPLOY_STATE_FILE' \
  || fail "runtime identity verifier references the overall applied marker"

printf '[operational-usage-ledger-e2e-contract] PASS auth=allowed+anonymous2+denied7+logoutLeaderExact1 pagination=dynamic orderContract=5keys+stepCodeTieMutation detail=full redactionMutations=7 branchTruth=actors+dualRoutes review=create-reload-idempotent-mismatch409-cleanup pipeline=planner+frontend-pipeline+package+static+identity3+healthy-release-live pipelineRemovalMutations=4 browser=desktop+390 helpAnchors=5 forbiddenChangeRequest=1\n'
