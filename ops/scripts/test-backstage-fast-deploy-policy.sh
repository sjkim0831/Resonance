#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
DEPLOY="$ROOT/ops/scripts/resonance-backstage-deploy.sh"
AUTO_DEPLOY="$ROOT/ops/scripts/auto-deploy-main.sh"
E2E_SPEC="$ROOT/platform/control-plane/backstage/packages/app/e2e-tests/resonance-control-plane.test.ts"
E2E_RUNNER="$ROOT/ops/scripts/resonance-backstage-visual-e2e.sh"
PLAYWRIGHT_CONFIG="$ROOT/platform/control-plane/backstage/playwright.config.ts"
MANIFEST="$ROOT/deploy/k8s/control-plane/backstage.yaml"
FULL_E2E_RUNNER="$ROOT/ops/scripts/resonance-backstage-full-e2e.sh"
FULL_E2E_SERVICE="$ROOT/ops/systemd/resonance-backstage-full-e2e.service"
FULL_E2E_TIMER="$ROOT/ops/systemd/resonance-backstage-full-e2e.timer"
ROLE_E2E="$ROOT/ops/scripts/resonance-actor-process-role-e2e.sh"
PURGE_BRIDGE="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/web/ActorProcessControlPlaneBridgeController.java"
PURGE_BRIDGE_TEST="$ROOT/modules/resonance-common/carbonet-common-core/src/test/java/egovframework/com/platform/governance/web/ActorProcessControlPlaneBridgeProjectPurgeTest.java"
ROOT_PACKAGE="$ROOT/platform/control-plane/backstage/package.json"
ROOT_CONFIG_SCHEMA="$ROOT/platform/control-plane/backstage/config.d.ts"
APP_PACKAGE="$ROOT/platform/control-plane/backstage/packages/app/package.json"

# These three suites use only private mktemp fixtures and read the target
# worktree. Start them together, continue the parent policy checks, then join
# every exact target SHA before this contract can report PASS. This preserves
# every gate while moving their wall time off the serial critical path.
parallel_child_contract_root="$(mktemp -d)"
chmod 0700 "$parallel_child_contract_root"
declare -a parallel_child_contract_pids=()
declare -a parallel_child_contract_logs=()
declare -a parallel_child_contract_labels=()
runtime_config_fixture=""
lock_fixture=""
cleanup_fast_policy_test() {
  local status="$?" pid
  trap - EXIT
  set +e
  for pid in "${parallel_child_contract_pids[@]}"; do
    kill "$pid" >/dev/null 2>&1 || true
  done
  for pid in "${parallel_child_contract_pids[@]}"; do
    wait "$pid" >/dev/null 2>&1 || true
  done
  rm -rf -- "${runtime_config_fixture:-}" "${lock_fixture:-}" \
    "${parallel_child_contract_root:-}"
  exit "$status"
}
trap cleanup_fast_policy_test EXIT
start_parallel_child_contract() {
  local label="$1" log
  shift
  log="$parallel_child_contract_root/${#parallel_child_contract_pids[@]}.$label.log"
  ("$@") >"$log" 2>&1 &
  parallel_child_contract_pids+=("$!")
  parallel_child_contract_logs+=("$log")
  parallel_child_contract_labels+=("$label")
}
join_parallel_child_contracts() {
  local index child_status=0 failed=0
  for index in "${!parallel_child_contract_pids[@]}"; do
    child_status=0
    wait "${parallel_child_contract_pids[$index]}" || child_status=$?
    cat "${parallel_child_contract_logs[$index]}"
    if (( child_status != 0 )); then
      echo "parallel child contract failed label=${parallel_child_contract_labels[$index]} status=$child_status" >&2
      failed=$((failed + 1))
    fi
  done
  parallel_child_contract_pids=()
  (( failed == 0 ))
}

grep -Fq 'DEPENDENCY_CACHE_ROOT=' "$DEPLOY"
grep -Fq 'resonance-backstage-runtime-fingerprint.sh' "$DEPLOY"
grep -Fq 'reusing registry-proved immutable application image' "$DEPLOY"
grep -Fq "sha256sum \"\$APP/yarn.lock\" \"\$APP/package.json\" | awk '{print \$1}'" "$DEPLOY"
grep -Fq 'cp -al -- "$cache_modules" "$APP/node_modules"' "$DEPLOY"
grep -Fq '.resonance-immutable-cache-key' "$DEPLOY"
grep -Fq '"$(cat "$state_marker")" == "$cache_key"' "$DEPLOY"
grep -Fq 'dependency state matches immutable cache' "$DEPLOY"
grep -Fq 'flock -w 300 8' "$DEPLOY"
grep -Fq 'resonance.io/catalog-digest' "$DEPLOY"
if grep -Fq 'rollout restart deployment/resonance-backstage' "$DEPLOY"; then
  echo "Backstage deploy must not force a duplicate rollout" >&2
  exit 1
fi
grep -A8 'path: /api/resonance-projects/health/project-runtime-purge-recovery' "$MANIFEST" |
  grep -Fq 'periodSeconds: 1'
grep -A8 'path: /components.yaml' "$MANIFEST" |
  grep -Fq 'periodSeconds: 1'
grep -Fq 'Backstage visual E2E scope:' "$AUTO_DEPLOY"
grep -Fq '[[ -n "$e2e_routes" ]] && display_scope=impact' "$AUTO_DEPLOY"
grep -Fq 'RESONANCE_BACKSTAGE_E2E_SCOPE="$e2e_scope"' "$AUTO_DEPLOY"
grep -Fq 'derive_backstage_e2e_routes' "$AUTO_DEPLOY"
grep -Fq 'RESONANCE_BACKSTAGE_E2E_ROUTES="$e2e_routes"' "$AUTO_DEPLOY"
grep -Fq 'BACKSTAGE_PUBLIC_URL="${BACKSTAGE_PUBLIC_URL:-https://backstage.172.16.1.232.nip.io:32947}"' "$AUTO_DEPLOY"
grep -Fq '"$BACKSTAGE_PUBLIC_URL/.backstage/health/v1/readiness"' "$AUTO_DEPLOY"
grep -Fq 'RESONANCE_BACKSTAGE_URL="$BACKSTAGE_PUBLIC_URL"' "$AUTO_DEPLOY"
grep -Fq 'BACKSTAGE_BASE_URL="$BACKSTAGE_PUBLIC_URL"' "$AUTO_DEPLOY"
grep -Fq 'BACKSTAGE_URL="$BACKSTAGE_PUBLIC_URL" BACKSTAGE_PUBLIC_URL="$BACKSTAGE_PUBLIC_URL"' "$AUTO_DEPLOY"
grep -Fq 'BACKSTAGE_REQUIRE_BASELINE_TAG_DIGEST_PROOF=true' "$AUTO_DEPLOY"
grep -Fq 'run_target_backstage_deploy_helper verify-pending-candidate "$target_commit"' "$AUTO_DEPLOY"
grep -Fq 'baselineTagDigestProof=$baseline_tag_digest_proof mutation=0' "$DEPLOY"
grep -Fq '(keys | sort) == ["deploymentUid","digestImage","holdTag","tag"]' "$DEPLOY"
grep -Fq '"$IMAGE_REPOSITORY:rollback-hold-${BACKSTAGE_PENDING_ATTEMPT_ID}"' "$DEPLOY"
grep -Fq 'https://backstage.172.16.1.232.nip.io:32947' "$E2E_RUNNER"
grep -Fq 'export RESONANCE_BACKSTAGE_URL="https://backstage.172.16.1.232.nip.io:32947"' "$FULL_E2E_RUNNER"
grep -Fq 'Environment=RESONANCE_BACKSTAGE_URL=https://backstage.172.16.1.232.nip.io:32947' "$FULL_E2E_SERVICE"
grep -Fq "e2eScope === 'recovery'" "$E2E_SPEC"
grep -Fq 'requestedRoutes.length > 0' "$E2E_SPEC"
grep -Fq "route === '/system-recovery'" "$E2E_SPEC"
grep -Fq 'BACKSTAGE_E2E_STORAGE_STATE="$auth_state"' "$E2E_RUNNER"
grep -Fq 'RESONANCE_E2E_SKIP_IDENTITY_PREFLIGHT=true' "$AUTO_DEPLOY"
grep -Fq 'identity preflight covered by deployment authentication gates' "$E2E_RUNNER"
grep -Fq './node_modules/.bin/playwright test' "$E2E_RUNNER"
grep -Fq 'chmod 0600 "$auth_state"' "$E2E_RUNNER"
grep -Fq 'storageState: process.env.BACKSTAGE_E2E_STORAGE_STATE' "$PLAYWRIGHT_CONFIG"
grep -Fq 'Backstage visual E2E running concurrently' "$AUTO_DEPLOY"
grep -Fq 'wait_backstage_visual_e2e' "$AUTO_DEPLOY"
grep -Fq 'concurrent Backstage visual E2E failed' "$AUTO_DEPLOY"
grep -Fq 'actor-process role E2E skipped for unrelated routes' "$AUTO_DEPLOY"
grep -Fq '"configSchema": "config.d.ts"' "$ROOT_PACKAGE"
grep -Fq '@visibility frontend' "$ROOT_CONFIG_SCHEMA"
[[ "$(grep -Fc 'resonanceOidcEnabled' "$ROOT_CONFIG_SCHEMA")" == 1 ]]
[[ "$(grep -Fc 'resonanceOidcDisplayName' "$ROOT_CONFIG_SCHEMA")" == 1 ]]
! grep -Fq '"configSchema"' "$APP_PACKAGE"
[[ ! -e "$ROOT/platform/control-plane/backstage/packages/app/config.d.ts" ]]
grep -Fq 'verify_backstage_frontend_schema_artifacts' "$DEPLOY"
grep -Fq 'verify_frontend_auth_runtime_config' "$DEPLOY"
grep -Fq 'Backstage OIDC sign-in runtime config is missing; guest entry was rendered' "$E2E_SPEC"
start_parallel_child_contract fingerprint bash "$ROOT/ops/scripts/test-backstage-runtime-fingerprint.sh"
start_parallel_child_contract purge-recovery bash "$ROOT/ops/scripts/test-backstage-runtime-purge-recovery-secret.sh" "$ROOT"
start_parallel_child_contract deployment-rollback bash "$ROOT/ops/scripts/test-backstage-deployment-rollback.sh" "$ROOT"
grep -Fq 'Integer authorityProof=jdbc.queryForObject(' "$PURGE_BRIDGE"
grep -Fq '"select 1 from (select "' "$PURGE_BRIDGE"
grep -Fq '+"framework_project_runtime_purge_require_admin(?)) "' "$PURGE_BRIDGE"
if grep -Fq 'framework_project_runtime_purge_require_admin(?) is null' "$PURGE_BRIDGE"; then
  echo "Runtime purge authority proof must not test PostgreSQL void for NULL" >&2
  exit 1
fi
grep -Fq '&&sql.contains("select 1 from")' "$PURGE_BRIDGE_TEST"
grep -Fq '&&!sql.contains("is null")' "$PURGE_BRIDGE_TEST"
grep -Fq 'build_backstage_application' "$DEPLOY"
grep -Fq 'corepack yarn tsc >"$typecheck_log" 2>&1 &' "$DEPLOY"
grep -Fq 'corepack yarn build:backend >"$bundle_log" 2>&1 &' "$DEPLOY"
grep -Fq 'concurrent application build failed' "$DEPLOY"
grep -Fq 'policy_contract_files=(' "$AUTO_DEPLOY"
grep -Fq 'ops/scripts/test-backstage-deployment-rollback.sh' "$AUTO_DEPLOY"
grep -Fq 'deterministic policy gates reused: unchanged fingerprint' "$AUTO_DEPLOY"
grep -Fq 'sha256sum "${policy_existing_files[@]}"' "$AUTO_DEPLOY"
grep -Fq 'cached_policy_digest" == "$policy_digest"' "$AUTO_DEPLOY"
grep -Fq "printf 'MISSING  %s\\n'" "$AUTO_DEPLOY"
grep -Fq 'BACKUP_TIMEOUT_SECONDS="${CARBONET_BACKUP_TIMEOUT_SECONDS:-3600}"' "$AUTO_DEPLOY"
python3 - "$AUTO_DEPLOY" "$DEPLOY" <<'PY'
import pathlib
import re
import sys

auto = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
deploy = pathlib.Path(sys.argv[2]).read_text(encoding="utf-8")
bootstrap = auto.split('if [[ "${CARBONET_DEPLOY_SNAPSHOT_ACTIVE:-false}" != "true" ]]', 1)[1].split(
    'POLICY_ROOT=', 1
)[0]
for token in ('mktemp -d /tmp/carbonet-auto-deploy-main.', "chmod 0700", "700:$(id -u)"):
    if token not in bootstrap:
        raise SystemExit(f"direct deploy bootstrap is not in a private helper snapshot: {token}")
default_path = "/opt/resonance-data/control-plane/deploy-state/backstage"
if default_path not in auto or default_path not in deploy:
    raise SystemExit("Backstage writers do not share the durable state-directory lock")

def body(source: str, name: str, next_name: str) -> str:
    return source.split(f"{name}() {{", 1)[1].split(f"\n{next_name}() {{", 1)[0]

self_heal = body(auto, "ensure_backstage_actor_process_e2e_ready", "run_serialized_carbonet_actor_process_e2e_job")
catalog = auto.split("sync_backstage_catalog_if_required() {", 1)[1].split(
    "\n}\n\n# The standard build", 1
)[0]
acquire = self_heal.index("acquire_clean_backstage_deployment_mutation_lock")
mutation = self_heal.index("rollout restart")
if acquire >= mutation or "release_backstage_deployment_mutation_lock" not in self_heal[mutation:]:
    raise SystemExit("Backstage self-heal mutation is outside the shared lock")
for token in ("kubectl", "rollout restart", "rollout status", "acquire_clean_backstage_deployment_mutation_lock"):
    if token in catalog:
        raise SystemExit(f"legacy raw Backstage catalog writer remains reachable: {token}")
for token in ("backstage:catalog-sync", "return 79", "target-bound Backstage deployment"):
    if token not in catalog:
        raise SystemExit(f"legacy raw Backstage catalog path is not sealed: {token}")
policy_validate = body(
    auto,
    "validate_target_backstage_fast_deploy_policy_if_required",
    "filter_prevalidated_backstage_fast_policy_contract_test",
)
for token in (
    '[[ "${PLAN_BACKSTAGE_REQUIRED:-false}" == true ]]',
    'policy_sha_before="$(sha256sum "$policy_test"',
    'bash "$policy_test"',
    'policy_sha_after="$(sha256sum "$policy_test"',
    'backstage_fast_policy_validated_sha256="$policy_sha_after"',
):
    if token not in policy_validate:
        raise SystemExit(f"target Backstage fast-policy validation is not SHA-bound: {token}")
policy_filter = body(
    auto,
    "filter_prevalidated_backstage_fast_policy_contract_test",
    "frontend_only_fast_path_eligible",
)
for token in (
    'current_sha="$(sha256sum "$policy_test"',
    '"$current_sha" == "$backstage_fast_policy_validated_sha256"',
    '"$selected_test" == "$policy_test"',
    'catalog_contract_tests=("${filtered_tests[@]}")',
):
    if token not in policy_filter:
        raise SystemExit(f"prevalidated Backstage fast-policy filter is incomplete: {token}")
if auto.count("prevalidate_target_contract_lanes_before_mutation || exit $?") != 1:
    raise SystemExit("target contract lanes must join once before mutation")
prevalidate = body(
    auto,
    "prevalidate_target_contract_lanes_before_mutation",
    "frontend_only_fast_path_eligible",
)
for token in (
    'command git clone --shared --no-checkout --quiet "$POLICY_ROOT"',
    'checkout --detach --quiet "$target_commit"',
    'validate_target_backstage_fast_deploy_policy_if_required',
    'bash ops/scripts/select-catalog-contract-tests.sh --paths-stdin',
    'policy_pid="$!"',
    'contracts_pid="$!"',
    'wait "$policy_pid"',
    'wait "$contracts_pid"',
    'prevalidated_catalog_contract_sha256["$path"]="$expected_sha"',
    'target prevalidation failed policy=$policy_status contracts=$contracts_status mutation=0',
):
    if token not in prevalidate:
        raise SystemExit(f"clean target parallel prevalidation is incomplete: {token}")
selector_map = auto.index("mapfile -t catalog_contract_tests")
selector_filter = auto.index("filter_prevalidated_backstage_fast_policy_contract_test", selector_map)
selector_sha_filter = auto.index("filter_sha_pinned_prevalidated_catalog_contract_tests", selector_map)
selector_launch = auto.index('run_parallel_contract_tests "${catalog_contract_tests[@]}"', selector_map)
if not selector_map < selector_filter < selector_sha_filter < selector_launch:
    raise SystemExit("prevalidated Backstage fast-policy is not filtered before selector launch")
if 'state_dir="$(dirname -- "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE")"' not in auto:
    raise SystemExit("Backstage auto lock does not bind the pending-state directory")
clean_lock = body(
    auto,
    "acquire_clean_backstage_deployment_mutation_lock",
    "recover_pending_backstage_deployment_after_target_merge",
)
if "-e \"$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE\"" not in clean_lock or \
        "-L \"$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE\"" not in clean_lock:
    raise SystemExit("Backstage raw writers do not refuse a pending durable rollback")
if auto.count("recover_pending_backstage_deployment_after_target_merge || exit $?") != 2:
    raise SystemExit("both runtime and catalog-only target merges must run pending recovery")
for merge_section in auto.split('git merge --ff-only "$target_commit"')[1:]:
    static_gate = merge_section.find("run_postdeploy_candidate_static_contract_if_required")
    recover = merge_section.find("recover_pending_backstage_deployment_after_target_merge || exit $?")
    if static_gate < 0 or recover < static_gate:
        raise SystemExit("target Backstage recovery must follow its static contract")

parent_deploy = body(auto, "deploy_backstage_if_required", "derive_backstage_e2e_routes")
for token in (
    "BACKSTAGE_DEPLOYMENT_FINALIZE_MODE=deferred",
    'BACKSTAGE_DEPLOYMENT_TARGET_COMMIT="$target_commit"',
    'BACKSTAGE_DEPLOYMENT_AUTHORITY_KIND="$authority_kind"',
    'capture_parent_backstage_handoff_binding_locked "$pending_sha256"',
    'backstage_deployment_attempt_id="$deployment_attempt_id"',
    'write_parent_backstage_authority_binding ARMED "$authority_kind"',
    'BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE="$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE"',
    "durable handoff retained until global promotion",
):
    if token not in parent_deploy:
        raise SystemExit(f"Backstage parent deploy is missing deferred handoff token: {token}")
handoff_arm = parent_deploy.index("backstage_deployment_handoff_active=true")
child_start = parent_deploy.index('bash "$BACKSTAGE_DEPLOY_HELPER"')
if handoff_arm >= child_start:
    raise SystemExit("Backstage parent handoff must arm before the child can be SIGKILLed")
capture = parent_deploy.index('capture_parent_backstage_handoff_binding_locked "$pending_sha256"')
durable_arm = parent_deploy.index('write_parent_backstage_authority_binding ARMED "$authority_kind"')
if not child_start < capture < durable_arm:
    raise SystemExit("durable parent authority is not armed immediately after exact child handoff")
if 'printf \'%s\\n\' "$target_commit" > "${BACKSTAGE_DEPLOY_STATE_FILE}.tmp"' in parent_deploy:
    raise SystemExit("Backstage marker is still published before the outer gates")
if "Backstage runtime checkpoint verified; resuming at E2E gates" in parent_deploy or \
        'checkpoint="$(cat "$BACKSTAGE_DEPLOY_STATE_FILE"' in parent_deploy:
    raise SystemExit("Backstage deploy must not trust marker plus HTTP readiness as live identity proof")

authority_lock = body(
    auto,
    "begin_parent_backstage_authority_finalize_lock",
    "load_parent_backstage_repair_pending_binding",
)
for token in (
    "acquire_backstage_deployment_mutation_lock",
    "validate_parent_backstage_handoff_binding_locked",
    "backstage_authority_finalize_lock_active=true",
):
    if token not in authority_lock:
        raise SystemExit(f"Backstage authority/finalize lock is incomplete: {token}")
backstage_finalize = body(
    auto,
    "finalize_backstage_deployment_after_release_success",
    "write_applied_deploy_state_with_backstage_binding",
)
for token in (
    "begin_parent_backstage_authority_finalize_lock",
    'BACKSTAGE_EXPECTED_PENDING_SHA256="$pending_sha256"',
    'BACKSTAGE_EXPECTED_ATTEMPT_ID="$repair_attempt_id"',
    'BACKSTAGE_DEPLOYMENT_INHERITED_LOCK_FD="$inherited_lock_fd"',
):
    if token not in backstage_finalize:
        raise SystemExit(f"Backstage child finalize is outside attempt lock: {token}")

cleanup = body(auto, "cleanup_deploy", "handle_deploy_signal")
authority_reconcile = cleanup.index("reconcile_backstage_deployment_during_cleanup")
runtime_recovery = cleanup.index("recover_runtime_after_failure_if_safe")
if authority_reconcile >= runtime_recovery or "runtime rollback is withheld" not in cleanup:
    raise SystemExit("Backstage durable-authority reconciliation must precede and gate runtime rollback")

authority_cleanup = auto.split("reconcile_backstage_deployment_during_cleanup() {", 1)[1].split(
    "\n}\nPOSTDEPLOY_LEGACY_RETIRE_DIR=", 1
)[0]
for token in (
    'case "${backstage_deployment_authority_kind:-}"',
    'postdeploy_authoritative_promotion_status "$target_commit" "$release_attempt_id"',
    'postdeploy_candidate_promoted=true',
    'postdeploy_candidate_authority_unknown=true',
    'run_target_backstage_deploy_helper reconcile-pending "$authoritative_commit"',
    'Backstage parent/external authority is unavailable or contradictory; mutation refused',
):
    if token not in authority_cleanup:
        raise SystemExit(f"Backstage cleanup is missing durable authority token: {token}")
if 'backstage_startup_recovery_hold:-false' not in authority_cleanup or \
        'runtime recovery withheld' not in authority_cleanup:
    raise SystemExit("startup Backstage authority hold does not suppress runtime recovery")

recovery_case = auto.index('case "$postdeploy_pending_recovery_status" in')
backup = auto.index('timestamp="$(date', recovery_case)
early_reconcile = auto.index(
    "reconcile_pending_backstage_deployment_after_authority_recovery", recovery_case
)
if not recovery_case < early_reconcile < backup:
    raise SystemExit("Backstage crash recovery must finish before backup")
pre_runtime_reconcile = auto.index(
    "reconcile_pending_backstage_deployment_before_runtime_recovery || exit $?"
)
runtime_recovery = auto.index("if recover_persistent_postdeploy_attempt", pre_runtime_reconcile)
if pre_runtime_reconcile >= runtime_recovery:
    raise SystemExit("Backstage pending recovery must precede runtime physical recovery")
startup_reconcile = body(
    auto,
    "reconcile_pending_backstage_deployment_before_runtime_recovery",
    "recover_pending_backstage_deployment_after_target_merge",
)
for token in (
    '[[ "$schema_version" == 3 || "$schema_version" == 4 ]]',
    '"$coordinator" == standalone',
    '"$finalize_mode" == immediate',
    'BACKSTAGE_EXPECTED_PENDING_SHA256= BACKSTAGE_EXPECTED_ATTEMPT_ID=',
    'run_target_backstage_deploy_helper recover-pending',
    'standalone Backstage pending recovered before runtime recovery',
):
    if token not in startup_reconcile:
        raise SystemExit(f"schema-v4/current and schema-v3/legacy standalone startup recovery is incomplete: {token}")
standalone_route = startup_reconcile.index('"$coordinator" == standalone')
deferred_matrix = startup_reconcile.index('case "$authority_kind" in')
if standalone_route >= deferred_matrix:
    raise SystemExit("standalone immediate recovery must precede the parent authority matrix")
for token in (
    'artifact_active_status=ABSENT',
    'missing_binding_candidate',
    'postdeploy_authoritative_promotion_status "$pending_target"',
    'ABSENT:1',
    'BACKSTAGE_DEPLOYMENT_INHERITED_LOCK_FD="$inherited_lock_fd"',
    'schema-v3/v4 parent/external authority is contradictory or unavailable; mutation=0',
):
    if token not in startup_reconcile:
        raise SystemExit(f"artifact-free v4/current or v3/legacy startup gap is not fail-closed: {token}")
no_change = auto.split('if [[ "$deployed_commit" == "$target_commit" ]]', 1)[1].split(
    '# Publish the in-flight state', 1
)[0]
if 'BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE' not in no_change:
    raise SystemExit("no-change fast path can bypass a durable Backstage pending handoff")
for token in (
    '-e "$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE"',
    '-L "$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE"',
):
    if no_change.count(token) < 2:
        raise SystemExit(
            f"no-change startup/lock-failure routing omits parent authority residue: {token}"
        )
for token in (
    'acquire_clean_backstage_deployment_mutation_lock',
    '! -e "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE"',
    '! -L "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE"',
    'verify_no_change_backstage_runtime_identity',
    'verify_semantic_success_operational_usage_ledger_identity "$deployed_commit"',
    'no_change_backstage_repair_required=true',
    'no-change success proof could not acquire the Backstage mutation lock',
):
    if token not in no_change:
        raise SystemExit(f"no-change success is outside the shared Backstage lock: {token}")
repair_plan = body(
    auto, "apply_no_change_backstage_repair_plan", "backstage_runtime_fingerprint_at_ref"
)
for token in (
    '[[ "${no_change_backstage_repair_required:-false}" == true ]]',
    'PLAN_BACKSTAGE_REQUIRED=true',
    'PLAN_INFRASTRUCTURE_REQUIRED=true',
    'backstage-runtime-drift-repair',
    'backstage:build-deploy',
):
    if token not in repair_plan:
        raise SystemExit(f"no-change Backstage drift does not enter target-bound repair: {token}")
for token in (
    "backstage_recovery_may_require_repair",
    "policy_required=true",
    "PLAN_BACKSTAGE_REQUIRED=true",
):
    if token not in body(
        auto,
        "prevalidate_target_contract_lanes_before_mutation",
        "frontend_only_fast_path_eligible",
    ):
        raise SystemExit(f"startup Backstage recovery does not prevalidate target policy: {token}")
recovery_repair_hint = auto.split(
    "# Any startup Backstage recovery residue may authenticate as a label-less", 1
)[1].split('eval "$(bash "$PLAN_SCRIPT"', 1)[0]
for token in (
    '-e "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE"',
    '-L "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE"',
    '-e "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE"',
    '-L "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE"',
    '-e "$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE"',
    '-L "$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE"',
    '! -e "$BACKSTAGE_RUNTIME_IDENTITY_FILE"',
    '! -L "$BACKSTAGE_RUNTIME_IDENTITY_FILE"',
    "backstage_recovery_may_require_repair=true",
):
    if token not in recovery_repair_hint:
        raise SystemExit(f"startup repair prevalidation hint omits recovery state: {token}")
late_identity_repair = body(
    auto,
    "apply_backstage_runtime_identity_repair_plan_if_required",
    "backstage_runtime_fingerprint_at_ref",
)
for token in (
    "backstage_runtime_identity_repair_required",
    "no_change_candidate=false",
    "no_change_backstage_repair_required=true",
    "apply_no_change_backstage_repair_plan",
    "require_prevalidated_backstage_fast_policy_for_late_repair",
):
    if token not in late_identity_repair:
        raise SystemExit(f"label-less rollback does not force exact target repair: {token}")
reconcile_call = auto.index(
    "reconcile_pending_backstage_deployment_before_runtime_recovery || exit $?"
)
late_repair_call = auto.index(
    "apply_backstage_runtime_identity_repair_plan_if_required || exit $?",
    reconcile_call,
)
runtime_recovery_call = auto.index("if recover_persistent_postdeploy_attempt", late_repair_call)
if not reconcile_call < late_repair_call < runtime_recovery_call:
    raise SystemExit("late Backstage identity repair plan is not bound before runtime recovery")
no_change_recovery = auto.split('case "$postdeploy_pending_recovery_status" in', 1)[1].split(
    'if [[ "${CARBONET_RECOVERY_ONLY:-false}"', 1
)[0]
promoted_same_target = no_change_recovery.split(
    'if [[ "$postdeploy_recovered_commit" == "$target_commit"', 1
)[1].split('# Remote B may arrive', 1)[0]
for token in (
    'acquire_clean_backstage_deployment_mutation_lock',
    'terminal_deploy_recovery_residue_absent',
    'verify_operational_usage_ledger_current_runtime_identity "$target_commit" proof-only',
):
    if token not in promoted_same_target:
        raise SystemExit(f"promoted-runtime recovery success is outside the Backstage lock: {token}")
for token in (
    'backstage_pending_reconciled_before_runtime',
    'backstage_pending_reconciled_to_target',
    'verify_operational_usage_ledger_current_runtime_identity "$runtime_deployed_commit" proof-only',
    'no-change Backstage authority finalized before runtime recovery',
    'no_change_prepared_composite_activation_eligible',
):
    if token not in no_change_recovery:
        raise SystemExit(f"no-change Backstage recovery is missing exact proof: {token}")
prepared_fallback = no_change_recovery.split(
    '# PREPARED activation is a legacy runtime-only recovery path', 1
)[1].split("write_postdeploy_promotion_quarantine", 1)[0]
for token in (
    'no_change_prepared_composite_activation_eligible',
    'acquire_clean_backstage_deployment_mutation_lock',
    'terminal_deploy_recovery_residue_absent',
    'verify_operational_usage_ledger_current_runtime_identity "$target_commit" proof-only',
):
    if token not in prepared_fallback:
        raise SystemExit(f"PREPARED no-change activation is outside the Backstage lock: {token}")
recovery_only = auto.rsplit('if [[ "${CARBONET_RECOVERY_ONLY:-false}" == true ]]', 1)[1].split(
    '# Identity-design changes are evaluated', 1
)[0]
for token in (
    'acquire_clean_backstage_deployment_mutation_lock',
    'retire_recovery_only_prepared_checkpoint_if_safe',
    'terminal_deploy_recovery_residue_absent',
    'verify_operational_usage_ledger_current_runtime_identity "$deployed_commit" proof-only',
):
    if token not in recovery_only:
        raise SystemExit(f"recovery-only success is outside the final residue lock: {token}")

terminal_residue = body(
    auto,
    "terminal_deploy_recovery_residue_absent",
    "retire_recovery_only_prepared_checkpoint_if_safe",
)
for state_path in (
    "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE",
    "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE",
    "$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE",
    "$RUNTIME_CANDIDATE_CHECKPOINT_FILE",
    "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE",
    "$POSTDEPLOY_MARKER_PENDING_FILE",
    "$RUNTIME_LEDGER_QUARANTINE_FILE",
    "$FULL_SCREEN_GATE_STATE_DIR/active.env",
    "$POSTDEPLOY_LEGACY_RETIRE_DIR/legacy-retire.intent.json",
):
    if f'! -e "{state_path}"' not in terminal_residue or f'! -L "{state_path}"' not in terminal_residue:
        raise SystemExit(f"terminal success omits regular/symlink residue proof: {state_path}")

catalog_start = auto.index('backstage_only_change=false')
catalog_end = auto.index("# A failed post-deploy gate", catalog_start)
catalog_path = auto[catalog_start:catalog_end]
catalog_e2e = catalog_path.index("wait_backstage_visual_e2e")
catalog_authority = catalog_path.index(
    'write_applied_deploy_state_with_backstage_binding "$target_commit"'
)
catalog_finalize = catalog_path.index(
    "finalize_backstage_deployment_after_release_success", catalog_authority
)
if not catalog_e2e < catalog_authority < catalog_finalize:
    raise SystemExit("catalog Backstage finalize is not after visual E2E and applied authority")
catalog_ledger = catalog_path.index(
    'verify_operational_usage_ledger_current_runtime_identity "$runtime_deployed_commit" proof-only',
    catalog_finalize,
)
catalog_success = catalog_path.index('exit 0', catalog_ledger)
if not catalog_finalize < catalog_ledger < catalog_success:
    raise SystemExit("catalog/Backstage success can bypass exact runtime ledger proof")

runtime_start = auto.rindex("run_runtime_release_validation_lanes")
runtime_path = auto[runtime_start:]
runtime_e2e = runtime_path.index("wait_backstage_visual_e2e")
runtime_authority = runtime_path.index(
    "finalize_postdeploy_candidate_release_with_composite_gate_cleanup"
)
runtime_finalize = runtime_path.index(
    "finalize_backstage_deployment_after_release_success", runtime_authority
)
if not runtime_e2e < runtime_authority < runtime_finalize:
    raise SystemExit("runtime Backstage finalize is not after visual E2E and DB promotion")
runtime_release = body(
    auto, "finalize_postdeploy_candidate_release", "launch_composite_autocompletion_postdeploy_campaign"
)
lock_before_promoter = runtime_release.index("begin_parent_backstage_authority_finalize_lock")
promoter = runtime_release.index("promote-postdeploy-candidate-evidence.sh")
if lock_before_promoter >= promoter:
    raise SystemExit("runtime Backstage attempt lock does not precede DB authority publication")

artifact_load = body(
    auto, "load_parent_backstage_authority_binding", "write_parent_backstage_authority_binding"
)
artifact_keyset = '["appliedMarkerBeforeSha256","appliedMarkerBeforeStat","attemptId","authorityKind","integritySha256","kind","pendingSha256","releaseAttemptId","schemaVersion","status","targetCommit"]'
if artifact_keyset not in artifact_load or artifact_keyset not in deploy:
    raise SystemExit("parent/child authority artifact keyset is not byte-for-byte identical")
for shared_schema_token in (
    '.schemaVersion == 1',
    '.kind == "BackstageParentAuthorityBinding"',
    '.status == "ARMED" or .status == "AUTHORIZED"',
    'length >= 15 and length <= 512 and test("^[ -~]+$")',
):
    if shared_schema_token not in artifact_load or shared_schema_token not in deploy:
        raise SystemExit(f"parent/child authority artifact schema differs: {shared_schema_token}")
artifact_write = body(
    auto, "write_parent_backstage_authority_binding", "finalize_parent_backstage_authority_binding"
)
artifact_finalize = body(
    auto, "finalize_parent_backstage_authority_binding", "parent_backstage_authority_binding_active"
)
for token in (
    'BackstageParentAuthorityBinding',
    '.status == "ARMED" or .status == "AUTHORIZED"',
    'pendingSha256',
    'releaseAttemptId',
    'integritySha256',
    '600:$(id -u):1',
    'realpath -m -s',
    'readlink -f',
):
    if token not in artifact_load:
        raise SystemExit(f"durable parent authority parser omits exact binding: {token}")
if "FINALIZED" in artifact_load + artifact_write + artifact_finalize:
    raise SystemExit("parent authority receipt must use only ARMED|AUTHORIZED")
artifact_pending_cas = artifact_write.index(
    'load_parent_backstage_handoff_binding "$exact_pending_sha256"'
)
artifact_rename = artifact_write.index('mv -fT -- "$binding_tmp"')
artifact_dir_sync = artifact_write.index('sync -f "$binding_dir"', artifact_rename)
if not artifact_pending_cas < artifact_rename < artifact_dir_sync:
    raise SystemExit("parent authority publication is not pending-CAS -> rename -> dir-sync")
artifact_pending_absent = artifact_finalize.index(
    '! -e "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE"'
)
artifact_identity = artifact_finalize.index(
    'verify_backstage_runtime_identity_for_ref_under_lock "$exact_target"'
)
artifact_unlink = artifact_finalize.index('rm -f -- "$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE"')
if not artifact_pending_absent < artifact_identity < artifact_unlink:
    raise SystemExit("AUTHORIZED receipt clears before pending0 and exact identity proof")

frontend_fast_condition = body(
    auto, "frontend_only_fast_path_eligible", "startup_profile_fast_path_eligible"
)
startup_fast_condition = body(
    auto, "startup_profile_fast_path_eligible", "automation_only_fast_path_eligible"
)
automation_fast_condition = body(
    auto, "automation_only_fast_path_eligible", "runtime_candidate_checkpoint_plan_eligible"
)
for label, condition in (
    ("frontend", frontend_fast_condition),
    ("startup-profile", startup_fast_condition),
):
    if '"${PLAN_BACKSTAGE_REQUIRED:-false}" != true' not in condition:
        raise SystemExit(f"mixed {label}+Backstage plan can bypass the deferred control-plane deploy")
for token in (
    '"${PLAN_RUNTIME_REQUIRED:-false}" != true',
    '"${PLAN_BACKSTAGE_REQUIRED:-false}" != true',
    'automation:shell-syntax',
    'automation:full-screen-smoke',
):
    if token not in automation_fast_condition:
        raise SystemExit(f"automation fast path can consume a mixed runtime/Backstage plan: {token}")
automation_terminal = auto.split("if automation_only_fast_path_eligible; then", 1)[1].split(
    "\nfi\n\n# Source catalog closure", 1
)[0]
automation_conditional_ledger = automation_terminal.index(
    'run_operational_usage_ledger_current_runtime_e2e_if_required "$runtime_deployed_commit"'
)
automation_terminal_ledger = automation_terminal.index(
    'verify_operational_usage_ledger_current_runtime_identity "$runtime_deployed_commit" proof-only'
)
automation_marker = automation_terminal.index(
    'write_applied_deploy_state "$target_commit" || exit 79'
)
if not automation_conditional_ledger < automation_terminal_ledger < automation_marker:
    raise SystemExit("automation success marker is not guarded by terminal exact runtime ledger proof")
checkpoint_policy = body(
    auto, "runtime_candidate_checkpoint_plan_eligible", "no_change_prepared_composite_activation_eligible"
)
for predicate in (
    "frontend_only_fast_path_eligible",
    "startup_profile_fast_path_eligible",
    "automation_only_fast_path_eligible",
):
    if f"! {predicate}" not in checkpoint_policy:
        raise SystemExit(f"runtime checkpoint policy does not reject fast path: {predicate}")
for predicate in (
    "frontend_only_fast_path_eligible",
    "startup_profile_fast_path_eligible",
    "automation_only_fast_path_eligible",
):
    if auto.count(f"if {predicate}; then") != 1:
        raise SystemExit(f"fast-path branch is not bound to its tested predicate: {predicate}")
if "if ! runtime_candidate_checkpoint_plan_eligible; then" not in auto:
    raise SystemExit("runtime candidate checkpoint is not bound to its tested predicate")
if 'if [[ "$PLAN_RUNTIME_REQUIRED" != "true" ]] && ! automation_only_fast_path_eligible; then' not in auto:
    raise SystemExit("catalog branch can consume the automation-only validation path")

for token in (
    'target_commit:ops/scripts/resonance-backstage-deploy.sh',
    'BACKSTAGE_DEPLOY_HELPER_SHA256',
    'reconcile-pending "$authoritative_commit"',
):
    if token not in auto:
        raise SystemExit(f"target-bound Backstage recovery helper missing: {token}")

deploy_case = deploy.split("  deploy)", 1)[1]
application_build = deploy_case.index("build_backstage_application")
schema_artifact_gate = deploy_case.index(
    "verify_backstage_frontend_schema_artifacts", application_build
)
image_build = deploy_case.index("start_phase image-build", schema_artifact_gate)
if not application_build < schema_artifact_gate < image_build:
    raise SystemExit("OIDC frontend schema artifact is not proved before image build")
rollout = deploy_case.index("rollout status deployment/resonance-backstage")
runtime_ready = deploy_case.index("wait_for_runtime", rollout)
frontend_config_gate = deploy_case.index("verify_frontend_auth_runtime_config", runtime_ready)
finalize = deploy_case.index("finalize_successful_backstage_deployment", frontend_config_gate)
if not rollout < runtime_ready < frontend_config_gate < finalize:
    raise SystemExit(
        "frontend auth config is not proved after readiness and before rollback state finalization"
    )
for policy_path in (
    "platform/control-plane/backstage/package.json",
    "platform/control-plane/backstage/config.d.ts",
    "platform/control-plane/backstage/packages/app/package.json",
):
    if policy_path not in auto:
        raise SystemExit(f"Backstage packaging input is absent from policy digest: {policy_path}")
PY

runtime_config_fixture="$(mktemp -d)"
plan_predicate_functions="$runtime_config_fixture/plan-predicate-functions.sh"
sed -n \
  '/^frontend_only_fast_path_eligible() {/,/^no_change_prepared_composite_activation_eligible() {/p' \
  "$AUTO_DEPLOY" | sed '$d' >"$plan_predicate_functions"
# shellcheck disable=SC1090
source "$plan_predicate_functions"
predicate_value() {
  if "$1"; then printf true; else printf false; fi
}
while IFS='|' read -r plan_label plan_runtime plan_frontend plan_backend plan_database \
    plan_backstage plan_infrastructure plan_tests expected_frontend expected_startup \
    expected_automation expected_checkpoint; do
  PLAN_RUNTIME_REQUIRED="$plan_runtime"
  PLAN_FRONTEND_REQUIRED="$plan_frontend"
  PLAN_BACKEND_REQUIRED="$plan_backend"
  PLAN_DATABASE_REQUIRED="$plan_database"
  PLAN_BACKSTAGE_REQUIRED="$plan_backstage"
  PLAN_INFRASTRUCTURE_REQUIRED="$plan_infrastructure"
  PLAN_TESTS="$plan_tests"
  [[ "$(predicate_value frontend_only_fast_path_eligible)" == "$expected_frontend" \
     && "$(predicate_value startup_profile_fast_path_eligible)" == "$expected_startup" \
     && "$(predicate_value automation_only_fast_path_eligible)" == "$expected_automation" \
     && "$(predicate_value runtime_candidate_checkpoint_plan_eligible)" == "$expected_checkpoint" ]] || {
    echo "mixed-plan predicate mismatch: $plan_label" >&2
    exit 1
  }
done <<'PLAN_CASES'
frontend-only|true|true|false|false|false|false|frontend:build|true|false|false|false
frontend-backstage|true|true|false|false|true|true|frontend:build,backstage:build-deploy|false|false|false|true
frontend-startup-profile|true|true|false|false|false|true|frontend:build,runtime:startup-profile|false|false|false|true
startup-only|true|false|false|false|false|true|runtime:startup-profile|false|true|false|false
startup-backstage|true|false|false|false|true|true|runtime:startup-profile|false|false|false|true
automation-only|false|false|false|false|false|true|automation:shell-syntax|false|false|true|false
smoke-automation-only|false|false|false|false|false|true|automation:full-screen-smoke|false|false|true|false
visual-e2e-catalog|false|false|false|false|false|true|backstage:visual-e2e|false|false|false|true
runtime-automation-backstage|true|false|false|false|true|true|runtime:other|false|false|false|true
PLAN_CASES
unset -f frontend_only_fast_path_eligible startup_profile_fast_path_eligible \
  automation_only_fast_path_eligible runtime_candidate_checkpoint_plan_eligible \
  predicate_value

# A Backstage plan executes the exact target fast-policy once. If the selector
# maps that unchanged file again, the recorded post-PASS SHA removes only that
# test; changing even one byte keeps the selector launch eligible.
policy_once_functions="$runtime_config_fixture/policy-once-functions.sh"
sed -n \
  '/^validate_target_backstage_fast_deploy_policy_if_required() {/,/^frontend_only_fast_path_eligible() {/p' \
  "$AUTO_DEPLOY" | sed '$d' >"$policy_once_functions"
# shellcheck disable=SC1090
source "$policy_once_functions"
policy_once_root="$runtime_config_fixture/policy-once-root"
mkdir -p "$policy_once_root/ops/scripts"
printf '%s\n' '#!/usr/bin/env bash' 'exit 0' \
  >"$policy_once_root/ops/scripts/test-backstage-fast-deploy-policy.sh"
chmod 0700 "$policy_once_root/ops/scripts/test-backstage-fast-deploy-policy.sh"
ROOT_DIR="$policy_once_root"
PLAN_BACKSTAGE_REQUIRED=true
backstage_fast_policy_validated_sha256=""
policy_target_calls=0
bash() {
  [[ "$1" == "$policy_once_root/ops/scripts/test-backstage-fast-deploy-policy.sh" ]]
  policy_target_calls=$((policy_target_calls + 1))
}
validate_target_backstage_fast_deploy_policy_if_required
(
  cd "$policy_once_root"
  catalog_contract_tests=(
    ops/scripts/test-backstage-fast-deploy-policy.sh
    ops/scripts/test-other-contract.sh
  )
  filter_prevalidated_backstage_fast_policy_contract_test >/dev/null
  [[ "${#catalog_contract_tests[@]}" == 1 \
     && "${catalog_contract_tests[0]}" == ops/scripts/test-other-contract.sh ]]
  printf '%s\n' '# target changed after validation' \
    >>ops/scripts/test-backstage-fast-deploy-policy.sh
  catalog_contract_tests=(ops/scripts/test-backstage-fast-deploy-policy.sh)
  filter_prevalidated_backstage_fast_policy_contract_test
  [[ "${#catalog_contract_tests[@]}" == 1 \
     && "${catalog_contract_tests[0]}" == ops/scripts/test-backstage-fast-deploy-policy.sh ]]
)
[[ "$policy_target_calls" == 1 ]]
ROOT_DIR="$ROOT"
unset -f validate_target_backstage_fast_deploy_policy_if_required \
  filter_prevalidated_backstage_fast_policy_contract_test bash

# The three static contracts that run before catalog selection are reused only
# while their exact bytes remain unchanged. A post-PASS edit fails closed
# instead of silently dropping or rerunning the contract after mutation.
sha_dedupe_functions="$runtime_config_fixture/sha-dedupe-functions.sh"
sed -n \
  '/^run_sha_pinned_catalog_contract_prevalidation() {/,/^frontend_only_fast_path_eligible() {/p' \
  "$AUTO_DEPLOY" | sed '$d' >"$sha_dedupe_functions"
# shellcheck disable=SC1090
source "$sha_dedupe_functions"
sha_dedupe_root="$runtime_config_fixture/sha-dedupe-root"
sha_dedupe_calls="$runtime_config_fixture/sha-dedupe.calls"
: >"$sha_dedupe_calls"
export SHA_DEDUPE_CALLS="$sha_dedupe_calls"
sha_dedupe_contracts=(
  ops/tests/test-postdeploy-candidate-evidence-contract.sh
  ops/scripts/test-durable-postdeploy-rollback-reconciler.sh
  ops/scripts/test-operational-usage-ledger-e2e-contract.sh
)
for contract_path in "${sha_dedupe_contracts[@]}"; do
  mkdir -p "$sha_dedupe_root/$(dirname "$contract_path")"
  printf '%s\n' '#!/usr/bin/env bash' \
    'printf "%s\\n" "$(basename "$0")" >>"${SHA_DEDUPE_CALLS:?}"' \
    >"$sha_dedupe_root/$contract_path"
  chmod 0700 "$sha_dedupe_root/$contract_path"
done
ROOT_DIR="$sha_dedupe_root"
declare -A prevalidated_catalog_contract_sha256=()
for contract_path in "${sha_dedupe_contracts[@]}"; do
  run_sha_pinned_catalog_contract_prevalidation "$contract_path"
done
[[ "$(wc -l <"$sha_dedupe_calls" | tr -d '[:space:]')" == 3 ]]
catalog_contract_tests=("${sha_dedupe_contracts[@]}" ops/scripts/test-other-contract.sh)
filter_sha_pinned_prevalidated_catalog_contract_tests >/dev/null
[[ "${#catalog_contract_tests[@]}" == 1 \
   && "${catalog_contract_tests[0]}" == ops/scripts/test-other-contract.sh ]]
printf '%s\n' '# SHA drift after prevalidation' \
  >>"$sha_dedupe_root/${sha_dedupe_contracts[0]}"
catalog_contract_tests=("${sha_dedupe_contracts[0]}")
set +e
filter_sha_pinned_prevalidated_catalog_contract_tests >/dev/null 2>&1
sha_dedupe_drift_status="$?"
set -e
[[ "$sha_dedupe_drift_status" == 79 \
   && "${#catalog_contract_tests[@]}" == 1 \
   && "$(wc -l <"$sha_dedupe_calls" | tr -d '[:space:]')" == 3 ]]
ROOT_DIR="$ROOT"
unset -f run_sha_pinned_catalog_contract_prevalidation \
  filter_sha_pinned_prevalidated_catalog_contract_tests

# The joined prevalidation must execute committed target bytes from clean
# clones even when the source worktree contains a foreign uncommitted policy,
# and any parallel contract failure must stop before the caller's mutation.
prevalidation_fixture="$(mktemp -d)"
prevalidation_repo="$prevalidation_fixture/repo"
prevalidation_calls="$prevalidation_fixture/calls"
mkdir -p "$prevalidation_repo/ops/scripts"
: >"$prevalidation_calls"
export PREVALIDATION_CALLS="$prevalidation_calls"
printf '%s\n' '#!/usr/bin/env bash' \
  'printf "%s\\n" TARGET_POLICY >>"${PREVALIDATION_CALLS:?}"' \
  >"$prevalidation_repo/ops/scripts/test-backstage-fast-deploy-policy.sh"
printf '%s\n' '#!/usr/bin/env bash' 'cat >/dev/null' \
  "printf '%s\\n' ops/scripts/test-backstage-fast-deploy-policy.sh ops/scripts/test-other-contract.sh" \
  >"$prevalidation_repo/ops/scripts/select-catalog-contract-tests.sh"
printf '%s\n' '#!/usr/bin/env bash' \
  'printf "%s\\n" TARGET_CONTRACT >>"${PREVALIDATION_CALLS:?}"' \
  '[[ "${PREVALIDATION_FORCE_FAIL:-false}" != true ]]' \
  >"$prevalidation_repo/ops/scripts/test-other-contract.sh"
printf '%s\n' '#!/usr/bin/env bash' >"$prevalidation_repo/ops/scripts/auto-deploy-main.sh"
chmod 0700 "$prevalidation_repo"/ops/scripts/*.sh
git -C "$prevalidation_repo" init -q
git -C "$prevalidation_repo" config user.name prevalidation-test
git -C "$prevalidation_repo" config user.email prevalidation-test@example.invalid
git -C "$prevalidation_repo" add .
git -C "$prevalidation_repo" commit -qm base
prevalidation_base="$(git -C "$prevalidation_repo" rev-parse HEAD)"
printf '%s\n' '# target selector impact' >>"$prevalidation_repo/ops/scripts/auto-deploy-main.sh"
git -C "$prevalidation_repo" add ops/scripts/auto-deploy-main.sh
git -C "$prevalidation_repo" commit -qm target
prevalidation_target="$(git -C "$prevalidation_repo" rev-parse HEAD)"
printf '%s\n' '#!/usr/bin/env bash' \
  'printf "%s\\n" WORKTREE_POLICY >>"${PREVALIDATION_CALLS:?}"' 'exit 99' \
  >"$prevalidation_repo/ops/scripts/test-backstage-fast-deploy-policy.sh"
POLICY_ROOT="$prevalidation_repo"
ROOT_DIR="$prevalidation_repo"
target_commit="$prevalidation_target"
deployed_commit="$prevalidation_base"
PLAN_BACKSTAGE_REQUIRED=false
PLAN_RUNTIME_REQUIRED=false
PLAN_TESTS=""
backstage_recovery_may_require_repair=true
backstage_fast_policy_validated_sha256=""
declare -A prevalidated_catalog_contract_sha256=()
automation_only_fast_path_eligible() { return 1; }
validate_target_backstage_fast_deploy_policy_if_required() {
  local policy_test="$ROOT_DIR/ops/scripts/test-backstage-fast-deploy-policy.sh" before after
  before="$(sha256sum "$policy_test" | awk '{print $1}')"
  bash "$policy_test"
  after="$(sha256sum "$policy_test" | awk '{print $1}')"
  [[ "$before" == "$after" ]]
  backstage_fast_policy_validated_sha256="$after"
}
prevalidate_target_contract_lanes_before_mutation >/dev/null
[[ "$(grep -Fc TARGET_POLICY "$prevalidation_calls")" == 1 \
   && "$(grep -Fc TARGET_CONTRACT "$prevalidation_calls")" == 1 \
   && "$(grep -Fc WORKTREE_POLICY "$prevalidation_calls" || true)" == 0 \
   && "$backstage_fast_policy_validated_sha256" =~ ^[0-9a-f]{64}$ \
   && "${prevalidated_catalog_contract_sha256[ops/scripts/test-other-contract.sh]:-}" =~ ^[0-9a-f]{64}$ ]]
# Late exact rollback repair may reuse only the target-commit policy receipt,
# never the foreign source-worktree bytes or a stale digest.
require_prevalidated_backstage_fast_policy_for_late_repair
prevalidation_saved_policy_sha="$backstage_fast_policy_validated_sha256"
backstage_fast_policy_validated_sha256=ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
set +e
require_prevalidated_backstage_fast_policy_for_late_repair >/dev/null 2>&1
late_policy_sha_mismatch_status="$?"
set -e
[[ "$late_policy_sha_mismatch_status" == 79 ]]
backstage_fast_policy_validated_sha256="$prevalidation_saved_policy_sha"
PREVALIDATION_FORCE_FAIL=true
export PREVALIDATION_FORCE_FAIL
prevalidation_mutation_calls=0
set +e
if prevalidate_target_contract_lanes_before_mutation >/dev/null 2>&1; then
  prevalidation_mutation_calls=$((prevalidation_mutation_calls + 1))
  prevalidation_failure_status=0
else
  prevalidation_failure_status=$?
fi
set -e
[[ "$prevalidation_failure_status" == 79 && "$prevalidation_mutation_calls" == 0 ]]
unset PREVALIDATION_FORCE_FAIL
ROOT_DIR="$ROOT"
POLICY_ROOT="$ROOT"
rm -rf -- "$prevalidation_fixture"
unset -f prevalidate_target_contract_lanes_before_mutation \
  automation_only_fast_path_eligible validate_target_backstage_fast_deploy_policy_if_required

# Exercise the real parent wrapper and child lock adopter with one actual OFD.
# A second-open regression would block, so the five-second bound turns it into
# an immediate contract failure instead of hanging the policy suite.
real_ofd_functions="$runtime_config_fixture/real-ofd-functions.sh"
sed -n \
  '/^run_target_backstage_deploy_helper() {/,/^PARENT_BACKSTAGE_REPAIR_AUTHORITY_EXISTS=/p' \
  "$AUTO_DEPLOY" | sed '$d' >"$real_ofd_functions"
# shellcheck disable=SC1090
source "$real_ofd_functions"
real_ofd_root="$runtime_config_fixture/real-ofd"
mkdir -m 0700 "$real_ofd_root"
BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$real_ofd_root"
BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$real_ofd_root/deployment-rollback.pending.json"
BACKSTAGE_RUNTIME_IDENTITY_FILE="$real_ofd_root/runtime-success.identity.json"
BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE="$real_ofd_root/repair-authority.json"
BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE="$real_ofd_root/parent-authority-binding.json"
BACKSTAGE_DEPLOY_STATE_FILE="$real_ofd_root/backstage.marker"
BACKSTAGE_DEPLOY_HELPER="$DEPLOY"
BACKSTAGE_DEPLOY_HELPER_SHA256="$(sha256sum "$DEPLOY" | awk '{print $1}')"
resolve_target_backstage_deploy_helper() { :; }
export -f run_target_backstage_deploy_helper resolve_target_backstage_deploy_helper
export ROOT_DIR BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR \
  BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE BACKSTAGE_RUNTIME_IDENTITY_FILE \
  BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE BACKSTAGE_DEPLOY_STATE_FILE \
  BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE \
  BACKSTAGE_DEPLOY_HELPER BACKSTAGE_DEPLOY_HELPER_SHA256
exec {real_parent_lock_fd}<"$real_ofd_root"
flock -w 1 "$real_parent_lock_fd"
set +e
BACKSTAGE_DEPLOYMENT_INHERITED_LOCK_FD="$real_parent_lock_fd" \
BACKSTAGE_EXPECTED_ATTEMPT_ID=cccccccccccccccccccccccccccccccc \
BACKSTAGE_EXPECTED_PENDING_SHA256=dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd \
  timeout 5 bash -c 'run_target_backstage_deploy_helper recover-pending' \
    >"$runtime_config_fixture/real-ofd.out" 2>&1
real_ofd_status="$?"
set -e
[[ "$real_ofd_status" == 79 ]]
grep -Fq 'inherited exclusive state-directory deploy lock verified' \
  "$runtime_config_fixture/real-ofd.out"
grep -Fq 'expected pending state is absent; mutation=0' "$runtime_config_fixture/real-ofd.out"
exec {real_parent_lock_fd}<&-
unset -f run_target_backstage_deploy_helper resolve_target_backstage_deploy_helper

terminal_recovery_functions="$runtime_config_fixture/terminal-recovery-functions.sh"
sed -n \
  '/^terminal_deploy_recovery_residue_absent() {/,/^MIN_BACKUP_BYTES=/p' \
  "$AUTO_DEPLOY" | sed '$d' >"$terminal_recovery_functions"
# shellcheck disable=SC1090
source "$terminal_recovery_functions"
residue_root="$runtime_config_fixture/terminal-residue"
mkdir -p "$residue_root/full-screen" "$residue_root/legacy-retire"
BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$residue_root/backstage.pending"
BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE="$residue_root/backstage-repair-authority.json"
BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE="$residue_root/parent-authority-binding.json"
RUNTIME_CANDIDATE_CHECKPOINT_FILE="$residue_root/runtime-checkpoint.json"
POSTDEPLOY_ATTEMPT_JOURNAL_FILE="$residue_root/attempt.json"
POSTDEPLOY_MARKER_PENDING_FILE="$residue_root/marker.pending"
RUNTIME_LEDGER_QUARANTINE_FILE="$residue_root/runtime.quarantine"
FULL_SCREEN_GATE_STATE_DIR="$residue_root/full-screen"
POSTDEPLOY_LEGACY_RETIRE_DIR="$residue_root/legacy-retire"
terminal_deploy_recovery_residue_absent
while IFS= read -r residue_path; do
  printf 'residue\n' >"$residue_path"
  if terminal_deploy_recovery_residue_absent; then
    echo "terminal success accepted regular residue: $residue_path" >&2
    exit 1
  fi
  rm -f -- "$residue_path"
  ln -s "$residue_root/missing-target" "$residue_path"
  if terminal_deploy_recovery_residue_absent; then
    echo "terminal success accepted symlink residue: $residue_path" >&2
    exit 1
  fi
  rm -f -- "$residue_path"
done <<RESIDUES
$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE
$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE
$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE
$RUNTIME_CANDIDATE_CHECKPOINT_FILE
$POSTDEPLOY_ATTEMPT_JOURNAL_FILE
$POSTDEPLOY_MARKER_PENDING_FILE
$RUNTIME_LEDGER_QUARANTINE_FILE
$FULL_SCREEN_GATE_STATE_DIR/active.env
$POSTDEPLOY_LEGACY_RETIRE_DIR/legacy-retire.intent.json
RESIDUES

checkpoint_target="$(git -C "$ROOT" rev-parse HEAD)"
runtime_deployed_commit="$checkpoint_target"
target_commit="$checkpoint_target"
POSTDEPLOY_CHECKPOINT_SCRIPT="$ROOT/ops/scripts/runtime-candidate-checkpoint.sh"
checkpoint_clear_calls=0
verify_operational_usage_ledger_current_runtime_identity() { :; }
run_runtime_candidate_checkpoint() {
  [[ "$1" == clear-failed ]]
  checkpoint_clear_calls=$((checkpoint_clear_calls + 1))
  rm -f -- "$RUNTIME_CANDIDATE_CHECKPOINT_FILE"
}
create_real_prepared_checkpoint() {
  rm -f -- "$RUNTIME_CANDIDATE_CHECKPOINT_FILE"
  CARBONET_DEPLOY_ROOT="$ROOT" \
  CARBONET_RUNTIME_CANDIDATE_CHECKPOINT_FILE="$RUNTIME_CANDIDATE_CHECKPOINT_FILE" \
  CARBONET_CHECKPOINT_BASE_COMMIT="$checkpoint_target" \
  CARBONET_CHECKPOINT_TARGET_COMMIT="$checkpoint_target" \
  CARBONET_CHECKPOINT_PLAN_DATABASE=false \
    bash "$POSTDEPLOY_CHECKPOINT_SCRIPT" prepare >/dev/null
  [[ "$(stat -c '%a' "$RUNTIME_CANDIDATE_CHECKPOINT_FILE")" == 644 ]]
}
create_real_prepared_checkpoint
retire_recovery_only_prepared_checkpoint_if_safe >/dev/null
[[ "$checkpoint_clear_calls" == 1 && ! -e "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" ]]
create_real_prepared_checkpoint
chmod 0600 "$RUNTIME_CANDIDATE_CHECKPOINT_FILE"
set +e
retire_recovery_only_prepared_checkpoint_if_safe >/dev/null 2>&1
prepared_mode_status="$?"
set -e
[[ "$prepared_mode_status" == 79 && -f "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" ]]
rm -f -- "$RUNTIME_CANDIDATE_CHECKPOINT_FILE"
create_real_prepared_checkpoint
printf 'active\n' >"$FULL_SCREEN_GATE_STATE_DIR/active.env"
set +e
retire_recovery_only_prepared_checkpoint_if_safe >/dev/null 2>&1
prepared_active_status="$?"
set -e
[[ "$prepared_active_status" == 79 && -f "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" \
   && "$checkpoint_clear_calls" == 1 ]]
rm -f -- "$FULL_SCREEN_GATE_STATE_DIR/active.env" "$RUNTIME_CANDIDATE_CHECKPOINT_FILE"
create_real_prepared_checkpoint
ln -s "$residue_root/missing-target" "$POSTDEPLOY_LEGACY_RETIRE_DIR/legacy-retire.intent.json"
set +e
retire_recovery_only_prepared_checkpoint_if_safe >/dev/null 2>&1
prepared_intent_status="$?"
set -e
[[ "$prepared_intent_status" == 79 && -f "$RUNTIME_CANDIDATE_CHECKPOINT_FILE" \
   && "$checkpoint_clear_calls" == 1 ]]
rm -f -- "$POSTDEPLOY_LEGACY_RETIRE_DIR/legacy-retire.intent.json" \
  "$RUNTIME_CANDIDATE_CHECKPOINT_FILE"
unset -f terminal_deploy_recovery_residue_absent \
  retire_recovery_only_prepared_checkpoint_if_safe \
  clear_no_change_runtime_checkpoint_if_present \
  verify_operational_usage_ledger_current_runtime_identity \
  run_runtime_candidate_checkpoint create_real_prepared_checkpoint

no_change_identity_function="$runtime_config_fixture/no-change-identity-function.sh"
sed -n \
  '/^verify_backstage_runtime_identity_for_ref_under_lock() {/,/^no_change_prepared_composite_activation_eligible() {/p' \
  "$AUTO_DEPLOY" | sed '$d' >"$no_change_identity_function"
# shellcheck disable=SC1090
source "$no_change_identity_function"
identity_target='cccccccccccccccccccccccccccccccccccccccc'
target_commit="$identity_target"
identity_calls="$runtime_config_fixture/no-change-identity.calls"
IDENTITY_CHILD_STATUS=0
BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=true
BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD=19
run_target_backstage_deploy_helper() {
  printf '%s|fd=%s\n' "$*" "${BACKSTAGE_DEPLOYMENT_INHERITED_LOCK_FD:-}" >>"$identity_calls"
  return "$IDENTITY_CHILD_STATUS"
}
: >"$identity_calls"
verify_no_change_backstage_runtime_identity
[[ "$(cat "$identity_calls")" == "verify-runtime-identity $identity_target|fd=19" ]]
IDENTITY_CHILD_STATUS=1
set +e
verify_no_change_backstage_runtime_identity >/dev/null 2>&1
identity_drift_status="$?"
set -e
[[ "$identity_drift_status" == 1 ]]
IDENTITY_CHILD_STATUS=79
set +e
verify_no_change_backstage_runtime_identity >/dev/null 2>&1
identity_unsafe_status="$?"
set -e
[[ "$identity_unsafe_status" == 79 ]]
IDENTITY_CHILD_STATUS=0
BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=false
: >"$identity_calls"
set +e
verify_no_change_backstage_runtime_identity >/dev/null 2>&1
identity_unlocked_status="$?"
set -e
[[ "$identity_unlocked_status" == 79 && ! -s "$identity_calls" ]]
unset -f verify_backstage_runtime_identity_for_ref_under_lock \
  verify_no_change_backstage_runtime_identity prove_backstage_terminal_success \
  run_target_backstage_deploy_helper
prepared_activation_function="$runtime_config_fixture/prepared-activation-function.sh"
sed -n \
  '/^no_change_prepared_composite_activation_eligible() {/,/^}/p' \
  "$AUTO_DEPLOY" >"$prepared_activation_function"
# shellcheck disable=SC1090
source "$prepared_activation_function"
early_composite_gate_status=PREPARED
early_composite_gate_candidate='postdeploy:prepared-fixture'
backstage_pending_reconciled_before_runtime=false
no_change_prepared_composite_activation_eligible
for recovered_kind in legacy-v1 db-nonpromotion; do
  backstage_pending_reconciled_before_runtime=true
  prepared_activation_calls=0
  if no_change_prepared_composite_activation_eligible; then
    prepared_activation_calls=$((prepared_activation_calls + 1))
  fi
  [[ "$prepared_activation_calls" == 0 ]] || {
    echo "recovered $recovered_kind Backstage baseline reached PREPARED target activation" >&2
    exit 1
  }
done
unset -f no_change_prepared_composite_activation_eligible
authority_function="$runtime_config_fixture/authority-function.sh"
{
  sed -n \
    '/^verify_backstage_runtime_identity_for_ref_under_lock() {/,/^verify_no_change_backstage_runtime_identity() {/p' \
    "$AUTO_DEPLOY" | sed '$d'
  sed -n \
    '/^apply_no_change_backstage_repair_plan() {/,/^backstage_runtime_fingerprint_at_ref() {/p' \
    "$AUTO_DEPLOY" | sed '$d'
  sed -n \
    '/^PARENT_BACKSTAGE_REPAIR_AUTHORITY_EXISTS=/,/^reconcile_pending_backstage_deployment_after_authority_recovery() {/p' \
    "$AUTO_DEPLOY" | sed '$d'
  sed -n \
    '/^classify_backstage_runtime_identity_after_rollback_under_lock() {/,/^reconcile_pending_backstage_deployment_before_runtime_recovery() {/p' \
    "$AUTO_DEPLOY" | sed '$d'
  sed -n \
    '/^reconcile_pending_backstage_deployment_before_runtime_recovery() {/,/^recover_pending_backstage_deployment_after_target_merge() {/p' \
    "$AUTO_DEPLOY" | sed '$d'
  sed -n \
    '/^finalize_backstage_deployment_after_release_success() {/,/^write_applied_deploy_state_with_backstage_binding() {/p' \
    "$AUTO_DEPLOY" | sed '$d'
  sed -n \
    '/^write_applied_deploy_state_with_backstage_binding() {/,/^reconcile_backstage_deployment_during_cleanup() {/p' \
    "$AUTO_DEPLOY" | sed '$d'
  sed -n \
    '/^reconcile_backstage_deployment_during_cleanup() {/,/^POSTDEPLOY_LEGACY_RETIRE_DIR=/p' \
    "$AUTO_DEPLOY" | sed '$d'
} >"$authority_function"
# shellcheck disable=SC1090
source "$authority_function"
  authority_pending="$runtime_config_fixture/authority-state/deployment-rollback.pending.json"
  authority_marker="$runtime_config_fixture/applied.marker"
  backstage_marker="$runtime_config_fixture/backstage.marker"
  repair_authority="$runtime_config_fixture/authority-state/repair-authority.json"
  parent_authority="$runtime_config_fixture/authority-state/parent-authority-binding.json"
  authority_runtime_identity="$runtime_config_fixture/authority-state/runtime-success.identity.json"
authority_calls="$runtime_config_fixture/authority.calls"
authority_target="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
authority_baseline="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
repair_attempt="cccccccccccccccccccccccccccccccc"
target_commit="$authority_target"
postdeploy_candidate_id="postdeploy:authority-fixture"
  BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$authority_pending"
  BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$(dirname "$authority_pending")"
  BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE="$repair_authority"
  BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE="$parent_authority"
BACKSTAGE_RUNTIME_IDENTITY_FILE="$authority_runtime_identity"
BACKSTAGE_DEPLOY_STATE_FILE="$backstage_marker"
DEPLOY_STATE_FILE="$authority_marker"
POSTDEPLOY_ATTEMPT_JOURNAL_FILE="$runtime_config_fixture/postdeploy-attempt.json"
POSTDEPLOY_JOURNAL_HELPER="$runtime_config_fixture/read-postdeploy-journal.py"
printf '%s\n' \
  'import pathlib, sys' \
  'path = sys.argv[sys.argv.index("--file") + 1]' \
  'sys.stdout.write(pathlib.Path(path).read_text(encoding="utf-8"))' \
  >"$POSTDEPLOY_JOURNAL_HELPER"
  mkdir -p "$(dirname "$repair_authority")"
chmod 0700 "$(dirname "$repair_authority")"
AUTHORITY_STATUS=2
CHILD_STATUS=0
REPLACE_PENDING_DURING_AUTH=false
STANDALONE_IDENTITY_PUBLISHED=false
postdeploy_authoritative_promotion_status() {
  if [[ "$REPLACE_PENDING_DURING_AUTH" == true ]]; then
    printf '%s\n' '{"replacement":true}' >"$authority_pending"
    chmod 0600 "$authority_pending"
  fi
  return "$AUTHORITY_STATUS"
}
run_target_backstage_deploy_helper() {
  if [[ -n "${BACKSTAGE_EXPECTED_PENDING_SHA256:-}" ]]; then
    [[ -f "$authority_pending" && "$(sha256sum "$authority_pending" | awk '{print $1}')" == \
       "$BACKSTAGE_EXPECTED_PENDING_SHA256" ]] || return 79
  fi
  if [[ -n "${BACKSTAGE_EXPECTED_ATTEMPT_ID:-}" && -f "$authority_pending" ]]; then
    [[ "$(jq -r '.attemptId // empty' "$authority_pending")" == \
       "$BACKSTAGE_EXPECTED_ATTEMPT_ID" ]] || return 79
  fi
  if [[ -n "${AUTHORITY_ENV_CALLS:-}" ]]; then
    printf '%s|sha=%s|attempt=%s|fd=%s\n' "$*" \
      "${BACKSTAGE_EXPECTED_PENDING_SHA256:-}" \
      "${BACKSTAGE_EXPECTED_ATTEMPT_ID:-}" \
      "${BACKSTAGE_DEPLOYMENT_INHERITED_LOCK_FD:-}" >>"$AUTHORITY_ENV_CALLS"
  fi
  printf '%s\n' "$*" >>"$authority_calls"
  (( CHILD_STATUS == 0 )) || return "$CHILD_STATUS"
  case "$1" in
    recover-pending)
      if [[ -f "$authority_pending" \
         && "$(jq -r '.coordinator // empty' "$authority_pending")" == standalone \
         && "$STANDALONE_IDENTITY_PUBLISHED" == true ]]; then
        printf '%s\n' "$authority_target" >"$backstage_marker"
        printf '%s\n' "$authority_target" >"$authority_runtime_identity"
      fi
      rm -f -- "$authority_pending" "$repair_authority"
      ;;
    finalize-pending)
      rm -f -- "$authority_pending" "$repair_authority"
      printf '%s\n' "$2" >"$backstage_marker"
      printf '%s\n' "$2" >"$authority_runtime_identity"
      ;;
    reconcile-pending)
      rm -f -- "$authority_pending" "$repair_authority"
      if [[ "$2" == "$authority_target" ]]; then
        printf '%s\n' "$authority_target" >"$backstage_marker"
        printf '%s\n' "$authority_target" >"$authority_runtime_identity"
      fi
      ;;
    reconcile-repair-authority)
      [[ ! -e "$authority_pending" && -f "$repair_authority" \
         && "$(jq -r '.status // empty' "$repair_authority")" == AUTHORIZED ]] || return 79
      rm -f -- "$repair_authority"
      printf '%s\n' "$authority_target" >"$authority_runtime_identity"
      ;;
    verify-runtime-identity)
      [[ "$2" =~ ^[0-9a-f]{40}$ && -f "$authority_runtime_identity" \
         && ! -L "$authority_runtime_identity" \
         && "$(tr -d '[:space:]' <"$authority_runtime_identity")" == "$2" \
         && -f "$backstage_marker" && ! -L "$backstage_marker" \
         && "$(tr -d '[:space:]' <"$backstage_marker")" == "$2" ]]
      ;;
    *) return 79 ;;
  esac
}
acquire_backstage_deployment_mutation_lock() {
  if [[ "${BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD:-false}" == true ]]; then
    return 0
  fi
  AUTHORITY_LOCK_NEW_OPEN_CALLS=$((AUTHORITY_LOCK_NEW_OPEN_CALLS + 1))
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=true
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD=19
  if [[ "${REPLACE_BOUND_PENDING_ON_LOCK:-false}" == true ]]; then
    REPLACE_BOUND_PENDING_ON_LOCK=false
    rm -f -- "$authority_pending"
    create_bound_pending "$backstage_deployment_authority_kind" \
      eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
  fi
}
release_backstage_deployment_mutation_lock() {
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=false
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD=""
  REPLACE_BOUND_PENDING_ON_LOCK=false
}
rollback_backstage_deployment_after_failure() {
  printf '%s\n' 'recover-pending' >>"$authority_calls"
  rm -f -- "$authority_pending"
  backstage_deployment_handoff_active=false
}
  reset_authority_case() {
    : >"$authority_calls"
    rm -f -- "$repair_authority" "$parent_authority"
  printf '%s\n' '{"pending":true}' >"$authority_pending"
  printf '%s\n' "$authority_baseline" >"$authority_marker"
  printf '%s\n' "$authority_baseline" >"$backstage_marker"
  backstage_deployment_handoff_active=true
  postdeploy_candidate_promoted=false
  postdeploy_candidate_authority_unknown=false
  backstage_deployment_target_commit=""
  backstage_deployment_attempt_id=""
  backstage_deployment_pending_sha256=""
  backstage_deployment_handoff_binding_captured=false
  backstage_authority_finalize_lock_active=false
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=false
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD=""
  AUTHORITY_LOCK_NEW_OPEN_CALLS=0
  CHILD_STATUS=0
  REPLACE_PENDING_DURING_AUTH=false
}
create_repair_pending() {
  printf '%s\n' \
    "{\"schemaVersion\":4,\"phase\":\"CANDIDATE_READY\",\"finalizeMode\":\"deferred\",\"coordinator\":\"auto\",\"targetCommit\":\"$authority_target\",\"authorityKind\":\"REPAIR_TOKEN\",\"attemptId\":\"$repair_attempt\"}" \
    >"$authority_pending"
  chmod 0600 "$authority_pending"
}
create_bound_pending() {
  local kind="$1" attempt="$2"
  printf '%s\n' \
    "{\"schemaVersion\":4,\"phase\":\"CANDIDATE_READY\",\"finalizeMode\":\"deferred\",\"coordinator\":\"auto\",\"targetCommit\":\"$authority_target\",\"authorityKind\":\"$kind\",\"attemptId\":\"$attempt\"}" \
    >"$authority_pending"
  chmod 0600 "$authority_pending"
}
create_legacy_bound_pending() {
  local kind="$1" attempt="$2"
  printf '%s\n' \
    "{\"schemaVersion\":3,\"phase\":\"CANDIDATE_READY\",\"finalizeMode\":\"deferred\",\"coordinator\":\"auto\",\"targetCommit\":\"$authority_target\",\"authorityKind\":\"$kind\",\"attemptId\":\"$attempt\"}" \
    >"$authority_pending"
  chmod 0600 "$authority_pending"
}
create_standalone_pending() {
  printf '%s\n' \
    "{\"schemaVersion\":4,\"phase\":\"CANDIDATE_READY\",\"finalizeMode\":\"immediate\",\"coordinator\":\"standalone\",\"targetCommit\":\"$authority_target\",\"authorityKind\":\"APPLIED_MARKER\",\"attemptId\":\"$repair_attempt\"}" \
    >"$authority_pending"
  chmod 0600 "$authority_pending"
}
  create_repair_authority() {
  local state="$1" pending_sha payload integrity
  pending_sha="$(sha256sum "$authority_pending" | awk '{print $1}')"
  payload="$(jq -cnS --arg target "$authority_target" --arg attempt "$repair_attempt" \
    --arg pending "$pending_sha" --arg state "$state" \
    '{schemaVersion:1,targetCommit:$target,attemptId:$attempt,pendingSha256:$pending,status:$state}')"
  integrity="$(printf '%s' "$payload" | sha256sum | awk '{print $1}')"
  jq -cS --arg integrity "$integrity" '. + {integritySha256:$integrity}' \
    <<<"$payload" >"$repair_authority"
    chmod 0600 "$repair_authority"
  }
  # Cleanup authority tests below isolate parent state transitions from the
  # child call trace. Startup rollback classification restores the exact
  # product parent->child verifier before exercising the new three-state path.
  verify_backstage_runtime_identity_for_ref_under_lock() {
    [[ "$BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD" == true \
       && -f "$backstage_marker" && ! -L "$backstage_marker" \
       && "$(tr -d '[:space:]' <"$backstage_marker")" == "$1" ]]
  }
  prepare_cleanup_parent_binding() {
    local kind="$1" pending_sha
    create_bound_pending "$kind" "$repair_attempt"
    pending_sha="$(sha256sum "$authority_pending" | awk '{print $1}')"
    backstage_deployment_authority_kind="$kind"
    backstage_deployment_target_commit="$authority_target"
    backstage_deployment_attempt_id="$repair_attempt"
    backstage_deployment_pending_sha256="$pending_sha"
    backstage_deployment_handoff_binding_captured=true
    backstage_deployment_handoff_active=true
    BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=true
    BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD=19
    write_parent_backstage_authority_binding ARMED "$kind" "$authority_target" \
      "$repair_attempt" "$pending_sha" \
      "$([[ "$kind" == DB_PROMOTION ]] && printf '%s' "$postdeploy_candidate_id")"
    release_backstage_deployment_mutation_lock
  }
create_parent_authority_binding() {
  local state="$1" kind="$2" attempt="${3:-$repair_attempt}"
  local pending_schema="${4:-4}" pending_sha release_attempt=""
  pending_sha="$(sha256sum "$authority_pending" | awk '{print $1}')"
  [[ "$kind" != DB_PROMOTION ]] || release_attempt="$postdeploy_candidate_id"
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=true
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD=19
  write_parent_backstage_authority_binding ARMED "$kind" "$authority_target" \
    "$attempt" "$pending_sha" "$release_attempt" "$pending_schema"
  if [[ "$state" == AUTHORIZED ]]; then
    write_parent_backstage_authority_binding AUTHORIZED "$kind" "$authority_target" \
      "$attempt" "$pending_sha" "$release_attempt" "$pending_schema"
  fi
  release_backstage_deployment_mutation_lock
}

# DB COMMIT happened before the in-memory flag: durable promotion must finalize,
# never restore the baseline.
reset_authority_case
prepare_cleanup_parent_binding DB_PROMOTION
AUTHORITY_STATUS=0
reconcile_backstage_deployment_during_cleanup
[[ "$postdeploy_candidate_promoted" == true ]]
[[ "$backstage_deployment_handoff_active" == false ]]
[[ "$(cat "$authority_calls")" == "reconcile-pending $authority_target" ]]
[[ "$(cat "$backstage_marker")" == "$authority_target" ]]

# A proved non-promotion restores the baseline, while an unavailable DB proof
# retains the pending state and performs zero Deployment mutation.
reset_authority_case
prepare_cleanup_parent_binding DB_PROMOTION
AUTHORITY_STATUS=1
reconcile_backstage_deployment_during_cleanup
[[ "$(cat "$authority_calls")" == recover-pending ]]
reset_authority_case
prepare_cleanup_parent_binding DB_PROMOTION
AUTHORITY_STATUS=2
set +e
reconcile_backstage_deployment_during_cleanup \
  >"$runtime_config_fixture/db-unknown.out" 2>"$runtime_config_fixture/db-unknown.err"
db_unknown_status="$?"
set -e
[[ "$db_unknown_status" == 79 && -f "$authority_pending" && ! -s "$authority_calls" ]]
[[ "$postdeploy_candidate_authority_unknown" == true ]]
reset_authority_case
prepare_cleanup_parent_binding DB_PROMOTION
AUTHORITY_STATUS=1
REPLACE_PENDING_DURING_AUTH=true
set +e
reconcile_backstage_deployment_during_cleanup >/dev/null 2>&1
cleanup_replacement_status="$?"
set -e
[[ "$cleanup_replacement_status" == 79 && -f "$authority_pending" && ! -s "$authority_calls" ]]
reset_authority_case
prepare_cleanup_parent_binding DB_PROMOTION
AUTHORITY_STATUS=0
CHILD_STATUS=79
set +e
reconcile_backstage_deployment_during_cleanup >/dev/null 2>&1
cleanup_promoted_child_status="$?"
set -e
[[ "$cleanup_promoted_child_status" == 79 && "$postdeploy_candidate_promoted" == true ]]
[[ -f "$authority_pending" && "$backstage_deployment_handoff_active" == true ]]

# The applied marker is itself the catalog authority. A signal after its atomic
# rename finalizes the target; an older marker restores the pending candidate.
reset_authority_case
prepare_cleanup_parent_binding APPLIED_MARKER
printf '%s\n' "$authority_target" >"$authority_marker"
reconcile_backstage_deployment_during_cleanup
[[ "$(cat "$authority_calls")" == "reconcile-pending $authority_target" ]]
[[ ! -e "$authority_pending" && "$(cat "$backstage_marker")" == "$authority_target" ]]
reset_authority_case
prepare_cleanup_parent_binding APPLIED_MARKER
reconcile_backstage_deployment_during_cleanup
[[ "$(cat "$authority_calls")" == recover-pending ]]
[[ ! -e "$authority_pending" && "$(cat "$backstage_marker")" == "$authority_baseline" ]]

# Marker publication/clear failure and missing authority are fail-closed: the
# durable pending file survives and cleanup reports status 79.
reset_authority_case
prepare_cleanup_parent_binding APPLIED_MARKER
printf '%s\n' "$authority_target" >"$authority_marker"
CHILD_STATUS=79
set +e
reconcile_backstage_deployment_during_cleanup >/dev/null 2>&1
child_failure_status="$?"
set -e
[[ "$child_failure_status" == 79 && -f "$authority_pending" ]]
[[ "$(cat "$backstage_marker")" == "$authority_baseline" ]]
reset_authority_case
prepare_cleanup_parent_binding APPLIED_MARKER
rm -f -- "$authority_marker"
set +e
reconcile_backstage_deployment_during_cleanup >/dev/null 2>&1
marker_missing_status="$?"
set -e
[[ "$marker_missing_status" == 79 && -f "$authority_pending" && ! -s "$authority_calls" ]]

# A same-target repair is authorized only by its fresh attempt token. An absent
# or ARMED token restores the baseline; AUTHORIZED finalizes that exact attempt.
reset_authority_case
create_repair_pending
backstage_deployment_authority_kind=REPAIR_TOKEN
reconcile_backstage_deployment_during_cleanup
[[ "$(cat "$authority_calls")" == recover-pending \
   && ! -e "$authority_pending" && ! -e "$repair_authority" ]]
reset_authority_case
create_repair_pending
create_repair_authority ARMED
backstage_deployment_authority_kind=REPAIR_TOKEN
reconcile_backstage_deployment_during_cleanup
[[ "$(cat "$authority_calls")" == recover-pending \
   && ! -e "$authority_pending" && ! -e "$repair_authority" ]]
reset_authority_case
create_repair_pending
create_repair_authority AUTHORIZED
backstage_deployment_authority_kind=REPAIR_TOKEN
reconcile_backstage_deployment_during_cleanup
[[ "$(cat "$authority_calls")" == "reconcile-pending $authority_target" \
   && ! -e "$authority_pending" && ! -e "$repair_authority" \
   && "$(cat "$backstage_marker")" == "$authority_target" ]]
# A post-finalize parent failure sees pending=0. The child's no-pending mode may
# clear only an exact identity/marker-bound orphan token before disarming.
reset_authority_case
create_repair_pending
create_repair_authority AUTHORIZED
rm -f -- "$authority_pending"
backstage_deployment_authority_kind=REPAIR_TOKEN
reconcile_backstage_deployment_during_cleanup
[[ "$(cat "$authority_calls")" == reconcile-repair-authority \
   && ! -e "$repair_authority" && "$backstage_deployment_handoff_active" == false ]]
# Integrity mismatch retains both candidate and token with zero child mutation.
reset_authority_case
create_repair_pending
create_repair_authority ARMED
jq -cS '.attemptId = "dddddddddddddddddddddddddddddddd"' \
  "$repair_authority" >"$repair_authority.tmp"
mv -f -- "$repair_authority.tmp" "$repair_authority"
chmod 0600 "$repair_authority"
backstage_deployment_authority_kind=REPAIR_TOKEN
set +e
reconcile_backstage_deployment_during_cleanup >/dev/null 2>&1
repair_tamper_status="$?"
set -e
[[ "$repair_tamper_status" == 79 && -f "$authority_pending" \
   && -f "$repair_authority" && ! -s "$authority_calls" ]]

recover_persistent_postdeploy_attempt() {
  printf '%s\n' runtime-restore >>"$authority_calls"
}
# Restore the exact product wrapper for startup and common rollback
# classification, including inherited-FD propagation and the child call trace.
eval "$(sed -n \
  '/^verify_backstage_runtime_identity_for_ref_under_lock() {/,/^verify_no_change_backstage_runtime_identity() {/p' \
  "$AUTO_DEPLOY" | sed '$d')"
reset_startup_case() {
  : >"$authority_calls"
  rm -f -- "$repair_authority" "$parent_authority" "$authority_runtime_identity" \
    "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE"
  printf '%s\n' "$authority_baseline" >"$authority_marker"
  printf '%s\n' "$authority_baseline" >"$backstage_marker"
  target_commit="$authority_target"
  CHILD_STATUS=0
  REPLACE_PENDING_DURING_AUTH=false
  STANDALONE_IDENTITY_PUBLISHED=false
  backstage_runtime_identity_repair_required=false
  backstage_recovery_may_require_repair=false
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=false
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD=""
}
# Every exact rollback completion uses one held-FD three-state classifier:
# target-equivalent identity is success, drift/absence requires repair, and an
# unsafe verifier result is a status79 hold without inventing convergence.
reset_startup_case
printf '%s\n' "$authority_target" >"$authority_runtime_identity"
printf '%s\n' "$authority_target" >"$backstage_marker"
acquire_backstage_deployment_mutation_lock
classify_backstage_runtime_identity_after_rollback_under_lock "$authority_target"
[[ "$backstage_pending_reconciled_to_target" == true \
   && "$backstage_runtime_identity_repair_required" == false \
   && "$(cat "$authority_calls")" == \
      "verify-runtime-identity $authority_target" ]]
release_backstage_deployment_mutation_lock
reset_startup_case
acquire_backstage_deployment_mutation_lock
classify_backstage_runtime_identity_after_rollback_under_lock "$authority_target"
[[ "$backstage_pending_reconciled_to_target" == false \
   && "$backstage_runtime_identity_repair_required" == true \
   && "$(cat "$authority_calls")" == \
      "verify-runtime-identity $authority_target" ]]
release_backstage_deployment_mutation_lock
reset_startup_case
CHILD_STATUS=79
acquire_backstage_deployment_mutation_lock
set +e
classify_backstage_runtime_identity_after_rollback_under_lock \
  "$authority_target" >/dev/null 2>&1
rollback_identity_unsafe_status="$?"
set -e
[[ "$rollback_identity_unsafe_status" == 79 \
   && "$backstage_pending_reconciled_to_target" == false \
   && "$backstage_runtime_identity_repair_required" == false ]]
release_backstage_deployment_mutation_lock
# Current schema-v4 standalone/immediate crash recovery belongs entirely to the
# child. Before its exact attempt identity is durable the child rolls back; once
# that identity is durable it finalizes. The parent invokes the same plain
# recover-pending CLI in both cases and never applies commit-level authority.
reset_startup_case
create_standalone_pending
reconcile_pending_backstage_deployment_before_runtime_recovery
[[ "$(cat "$authority_calls")" == $'recover-pending\nverify-runtime-identity '"$authority_target" \
   && ! -e "$authority_pending" \
   && "$(cat "$backstage_marker")" == "$authority_baseline" \
   && "$backstage_pending_reconciled_before_runtime" == true \
   && "$backstage_pending_reconciled_to_target" == false \
   && "$backstage_runtime_identity_repair_required" == true ]]
# A stale success marker equal to the current target does not turn a
# label-less standalone rollback into success when identity is absent.
reset_startup_case
create_standalone_pending
printf '%s\n' "$authority_target" >"$backstage_marker"
reconcile_pending_backstage_deployment_before_runtime_recovery
[[ "$(cat "$authority_calls")" == $'recover-pending\nverify-runtime-identity '"$authority_target" \
   && ! -e "$authority_pending" && ! -e "$authority_runtime_identity" \
   && "$backstage_pending_reconciled_to_target" == false \
   && "$backstage_runtime_identity_repair_required" == true ]]
reset_startup_case
create_standalone_pending
STANDALONE_IDENTITY_PUBLISHED=true
reconcile_pending_backstage_deployment_before_runtime_recovery
[[ "$(cat "$authority_calls")" == $'recover-pending\nverify-runtime-identity '"$authority_target" \
   && ! -e "$authority_pending" \
   && "$(cat "$backstage_marker")" == "$authority_target" \
   && "$backstage_pending_reconciled_before_runtime" == true \
   && "$backstage_pending_reconciled_to_target" == true \
   && "$backstage_runtime_identity_repair_required" == false ]]
# Legacy schema-v3 is never accepted as a new live handoff, but startup retains
# exact SHA+attempt recovery. A definitely pre-authority pending rolls back;
# an exact AUTHORIZED receipt finalizes the same legacy attempt.
reset_startup_case
create_legacy_bound_pending APPLIED_MARKER "$repair_attempt"
reconcile_pending_backstage_deployment_before_runtime_recovery
[[ "$(cat "$authority_calls")" == $'recover-pending\nverify-runtime-identity '"$authority_target" \
   && ! -e "$authority_pending" && ! -e "$parent_authority" \
   && "$backstage_pending_reconciled_to_target" == false \
   && "$backstage_runtime_identity_repair_required" == true ]]
reset_startup_case
create_legacy_bound_pending APPLIED_MARKER "$repair_attempt"
create_parent_authority_binding AUTHORIZED APPLIED_MARKER "$repair_attempt" 3
printf '%s\n' "$authority_target" >"$authority_marker"
reconcile_pending_backstage_deployment_before_runtime_recovery
[[ "$(cat "$authority_calls")" == $'reconcile-pending '"$authority_target"$'\nverify-runtime-identity '"$authority_target" \
   && ! -e "$authority_pending" && ! -e "$parent_authority" \
   && "$backstage_pending_reconciled_to_target" == true ]]
# Pre-promotion recovery restores Backstage before the first runtime writer.
reset_startup_case
printf '%s\n' "{\"schemaVersion\":2,\"targetCommit\":\"$authority_target\",\"authorityKind\":\"DB_PROMOTION\"}" \
  >"$authority_pending"
chmod 0600 "$authority_pending"
AUTHORITY_STATUS=1
reconcile_pending_backstage_deployment_before_runtime_recovery
recover_persistent_postdeploy_attempt
[[ "$(cat "$authority_calls")" == $'recover-pending\nverify-runtime-identity '"$authority_target"$'\nruntime-restore' ]]
[[ "$backstage_pending_reconciled_before_runtime" == true ]]
[[ "$backstage_pending_reconciled_to_target" == false \
   && "$backstage_runtime_identity_repair_required" == true ]]
# A committed promotion finalizes Backstage first; an unavailable DB performs
# neither Backstage nor runtime mutation.
reset_startup_case
printf '%s\n' "{\"schemaVersion\":2,\"targetCommit\":\"$authority_target\",\"authorityKind\":\"DB_PROMOTION\"}" \
  >"$authority_pending"
chmod 0600 "$authority_pending"
AUTHORITY_STATUS=0
reconcile_pending_backstage_deployment_before_runtime_recovery
recover_persistent_postdeploy_attempt
[[ "$(cat "$authority_calls")" == $'reconcile-pending '"$authority_target"$'\nruntime-restore' ]]
[[ "$backstage_pending_reconciled_before_runtime" == true ]]
[[ "$backstage_pending_reconciled_to_target" == true ]]
reset_startup_case
printf '%s\n' "{\"schemaVersion\":2,\"targetCommit\":\"$authority_target\",\"authorityKind\":\"DB_PROMOTION\"}" \
  >"$authority_pending"
chmod 0600 "$authority_pending"
AUTHORITY_STATUS=2
set +e
reconcile_pending_backstage_deployment_before_runtime_recovery >/dev/null 2>&1
startup_unknown_status="$?"
set -e
[[ "$startup_unknown_status" == 79 && -f "$authority_pending" && ! -s "$authority_calls" ]]
reset_startup_case
printf '%s\n' "{\"schemaVersion\":2,\"targetCommit\":\"$authority_target\",\"authorityKind\":\"DB_PROMOTION\"}" \
  >"$authority_pending"
chmod 0600 "$authority_pending"
AUTHORITY_STATUS=1
REPLACE_PENDING_DURING_AUTH=true
set +e
reconcile_pending_backstage_deployment_before_runtime_recovery >/dev/null 2>&1
startup_replacement_status="$?"
set -e
[[ "$startup_replacement_status" == 79 && -f "$authority_pending" && ! -s "$authority_calls" ]]
REPLACE_PENDING_DURING_AUTH=false
reset_startup_case
printf '%s\n' "{\"schemaVersion\":2,\"targetCommit\":\"$authority_target\",\"authorityKind\":\"DB_PROMOTION\"}" \
  >"$authority_pending"
chmod 0600 "$authority_pending"
AUTHORITY_STATUS=0
CHILD_STATUS=79
set +e
reconcile_pending_backstage_deployment_before_runtime_recovery >/dev/null 2>&1
startup_db_child_status="$?"
set -e
[[ "$startup_db_child_status" == 79 && -f "$authority_pending" ]]
# Legacy state is rollback-only and APPLIED_MARKER uses the exact durable file.
reset_startup_case
printf '%s\n' '{"schemaVersion":1}' >"$authority_pending"
chmod 0600 "$authority_pending"
reconcile_pending_backstage_deployment_before_runtime_recovery
recover_persistent_postdeploy_attempt
[[ "$(cat "$authority_calls")" == $'recover-pending\nverify-runtime-identity '"$authority_target"$'\nruntime-restore' ]]
[[ "$backstage_pending_reconciled_to_target" == false \
   && "$backstage_runtime_identity_repair_required" == true ]]
reset_startup_case
printf '%s\n' "{\"schemaVersion\":2,\"targetCommit\":\"$authority_target\",\"authorityKind\":\"APPLIED_MARKER\"}" \
  >"$authority_pending"
chmod 0600 "$authority_pending"
printf '%s\n' "$authority_target" >"$authority_marker"
reconcile_pending_backstage_deployment_before_runtime_recovery
recover_persistent_postdeploy_attempt
[[ "$(cat "$authority_calls")" == $'reconcile-pending '"$authority_target"$'\nruntime-restore' ]]
[[ "$backstage_pending_reconciled_to_target" == true ]]
reset_startup_case
printf '%s\n' "{\"schemaVersion\":2,\"targetCommit\":\"$authority_target\",\"authorityKind\":\"APPLIED_MARKER\"}" \
  >"$authority_pending"
chmod 0600 "$authority_pending"
reconcile_pending_backstage_deployment_before_runtime_recovery
[[ "$backstage_pending_reconciled_to_target" == false ]]
[[ "$(cat "$authority_calls")" == $'reconcile-pending '"$authority_baseline"$'\nverify-runtime-identity '"$authority_target" \
   && "$backstage_runtime_identity_repair_required" == true ]]
reset_startup_case
printf '%s\n' "{\"schemaVersion\":2,\"targetCommit\":\"$authority_target\",\"authorityKind\":\"APPLIED_MARKER\"}" \
  >"$authority_pending"
chmod 0600 "$authority_pending"
rm -f -- "$authority_marker"
set +e
reconcile_pending_backstage_deployment_before_runtime_recovery >/dev/null 2>&1
startup_applied_missing_status="$?"
set -e
[[ "$startup_applied_missing_status" == 79 && -f "$authority_pending" && ! -s "$authority_calls" ]]
reset_startup_case
printf '%s\n' "{\"schemaVersion\":2,\"targetCommit\":\"$authority_target\",\"authorityKind\":\"APPLIED_MARKER\"}" \
  >"$authority_pending"
chmod 0600 "$authority_pending"
printf '%s\n' "$authority_target" >"$authority_marker"
CHILD_STATUS=79
set +e
reconcile_pending_backstage_deployment_before_runtime_recovery >/dev/null 2>&1
startup_applied_child_status="$?"
set -e
[[ "$startup_applied_child_status" == 79 && -f "$authority_pending" ]]

# The schema-v4 child-return -> parent-ARMED crash gap is rollback-only when
# external authority is definitely absent. DB requires the exact durable
# release candidate; APPLIED requires an absent or stable different marker.
reset_startup_case
create_bound_pending DB_PROMOTION "$repair_attempt"
printf '%s\n' \
  "{\"candidateId\":\"$postdeploy_candidate_id\",\"sourceCommit\":\"$authority_target\"}" \
  >"$POSTDEPLOY_ATTEMPT_JOURNAL_FILE"
AUTHORITY_STATUS=1
reconcile_pending_backstage_deployment_before_runtime_recovery
[[ "$(cat "$authority_calls")" == $'recover-pending\nverify-runtime-identity '"$authority_target" \
   && ! -e "$authority_pending" && ! -e "$parent_authority" \
   && "$backstage_runtime_identity_repair_required" == true \
   && "$backstage_pending_reconciled_to_target" == false ]]
reset_startup_case
create_bound_pending APPLIED_MARKER "$repair_attempt"
reconcile_pending_backstage_deployment_before_runtime_recovery
[[ "$(cat "$authority_calls")" == $'recover-pending\nverify-runtime-identity '"$authority_target" \
   && ! -e "$authority_pending" && ! -e "$parent_authority" \
   && "$backstage_runtime_identity_repair_required" == true \
   && "$backstage_pending_reconciled_to_target" == false ]]

# If that same artifact-free gap already exposes target authority, or the exact
# DB candidate is unavailable, startup performs zero child mutation and holds79.
for missing_authority_kind in DB_PROMOTION APPLIED_MARKER; do
  reset_startup_case
  create_bound_pending "$missing_authority_kind" "$repair_attempt"
  if [[ "$missing_authority_kind" == DB_PROMOTION ]]; then
    printf '%s\n' \
      "{\"candidateId\":\"$postdeploy_candidate_id\",\"sourceCommit\":\"$authority_target\"}" \
      >"$POSTDEPLOY_ATTEMPT_JOURNAL_FILE"
    AUTHORITY_STATUS=0
  else
    printf '%s\n' "$authority_target" >"$authority_marker"
  fi
  set +e
  reconcile_pending_backstage_deployment_before_runtime_recovery >/dev/null 2>&1
  missing_authority_hold_status="$?"
  set -e
  [[ "$missing_authority_hold_status" == 79 && -f "$authority_pending" \
     && ! -e "$parent_authority" && ! -s "$authority_calls" ]]
done
reset_startup_case
create_bound_pending DB_PROMOTION "$repair_attempt"
AUTHORITY_STATUS=1
set +e
reconcile_pending_backstage_deployment_before_runtime_recovery >/dev/null 2>&1
missing_candidate_hold_status="$?"
set -e
[[ "$missing_candidate_hold_status" == 79 && -f "$authority_pending" \
   && ! -s "$authority_calls" ]]

# Durable authority belongs to one attempt+pending digest. Replacing A with a
# same-target B after A is AUTHORIZED cannot transfer either authority kind.
for swapped_authority_kind in DB_PROMOTION APPLIED_MARKER; do
  reset_startup_case
  create_bound_pending "$swapped_authority_kind" "$repair_attempt"
  create_parent_authority_binding AUTHORIZED "$swapped_authority_kind"
  create_bound_pending "$swapped_authority_kind" eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
  if [[ "$swapped_authority_kind" == DB_PROMOTION ]]; then
    AUTHORITY_STATUS=0
  else
    printf '%s\n' "$authority_target" >"$authority_marker"
  fi
  set +e
  reconcile_pending_backstage_deployment_before_runtime_recovery >/dev/null 2>&1
  swapped_authority_status="$?"
  set -e
  [[ "$swapped_authority_status" == 79 \
     && "$(jq -r '.attemptId' "$authority_pending")" == \
        eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee \
     && -f "$parent_authority" && ! -s "$authority_calls" ]]
done

# Malformed, symlinked and wrong-owner receipts remain mutation-free holds.
reset_startup_case
create_bound_pending APPLIED_MARKER "$repair_attempt"
printf '%s\n' '{}' >"$parent_authority"
chmod 0600 "$parent_authority"
set +e
reconcile_pending_backstage_deployment_before_runtime_recovery >/dev/null 2>&1
malformed_parent_authority_status="$?"
set -e
[[ "$malformed_parent_authority_status" == 79 && -f "$authority_pending" \
   && ! -s "$authority_calls" ]]
reset_startup_case
create_bound_pending APPLIED_MARKER "$repair_attempt"
printf '%s\n' '{}' >"$runtime_config_fixture/foreign-parent-authority.json"
ln -s "$runtime_config_fixture/foreign-parent-authority.json" "$parent_authority"
set +e
reconcile_pending_backstage_deployment_before_runtime_recovery >/dev/null 2>&1
symlink_parent_authority_status="$?"
set -e
[[ "$symlink_parent_authority_status" == 79 && -L "$parent_authority" \
   && -f "$authority_pending" && ! -s "$authority_calls" ]]
reset_startup_case
create_bound_pending APPLIED_MARKER "$repair_attempt"
create_parent_authority_binding ARMED APPLIED_MARKER
real_stat_bin="$(type -P stat)"
stat() {
  if [[ "$*" == *"%a:%u:%h"* && "${*: -1}" == "$parent_authority" ]]; then
    printf '600:0:1\n'
    return 0
  fi
  "$real_stat_bin" "$@"
}
set +e
reconcile_pending_backstage_deployment_before_runtime_recovery >/dev/null 2>&1
wrong_owner_parent_authority_status="$?"
set -e
unset -f stat
[[ "$wrong_owner_parent_authority_status" == 79 && -f "$parent_authority" \
   && -f "$authority_pending" && ! -s "$authority_calls" ]]

# A crash after external authority but before ARMED->AUTHORIZED is recovered by
# promoting only the exact ARMED receipt, then finalizing it under the same FD.
for armed_cut_kind in DB_PROMOTION APPLIED_MARKER; do
  reset_startup_case
  create_bound_pending "$armed_cut_kind" "$repair_attempt"
  create_parent_authority_binding ARMED "$armed_cut_kind"
  if [[ "$armed_cut_kind" == DB_PROMOTION ]]; then
    AUTHORITY_STATUS=0
  else
    printf '%s\n' "$authority_target" >"$authority_marker"
  fi
  reconcile_pending_backstage_deployment_before_runtime_recovery
  [[ "$(cat "$authority_calls")" == $'reconcile-pending '"$authority_target"$'\nverify-runtime-identity '"$authority_target" \
     && ! -e "$authority_pending" && ! -e "$parent_authority" \
     && "$backstage_pending_reconciled_to_target" == true ]]
done

# Both no-change residue checks must route an artifact-only crash into the
# startup reconciler. Execute the exact parent clauses, then prove that an
# AUTHORIZED receipt and an ARMED receipt with an external authority cut clear
# only after identity+marker verification. Malformed regular files and broken
# symlinks are still routing hints, but the reconciler retains them with 79.
no_change_hint_clause="$(sed -n \
  '/^  if \[\[ -e "\$POSTDEPLOY_MARKER_PENDING_FILE"/,/^  fi$/p' \
  "$AUTO_DEPLOY")"
no_change_lock_failure_clause="$(sed -n \
  '/^    if (( no_change_lock_status != 0 )); then/,/^    fi$/p' \
  "$AUTO_DEPLOY")"
[[ -n "$no_change_hint_clause" && -n "$no_change_lock_failure_clause" ]]
RUNTIME_LEDGER_QUARANTINE_FILE="$runtime_config_fixture/no-change.quarantine"
POSTDEPLOY_LEGACY_RETIRE_DIR="$runtime_config_fixture/no-change-legacy-retire"
early_persistent_gate_active="$runtime_config_fixture/no-change-gate/active.env"
POSTDEPLOY_MARKER_PENDING_FILE="$runtime_config_fixture/no-change-marker.pending"
assert_parent_artifact_routes_no_change_recovery() {
  no_change_recovery_hint=false
  eval "$no_change_hint_clause"
  [[ "$no_change_recovery_hint" == true ]]
  no_change_recovery_hint=false
  no_change_lock_status=79
  eval "$no_change_lock_failure_clause"
  [[ "$no_change_recovery_hint" == true ]]
}
for no_change_orphan_state in AUTHORIZED ARMED; do
  no_change_orphan_expected_calls="verify-runtime-identity $authority_target"
  if [[ "$no_change_orphan_state" == AUTHORIZED ]]; then
    no_change_orphan_expected_calls+=$'\nverify-runtime-identity '"$authority_target"
  fi
  reset_startup_case
  create_bound_pending APPLIED_MARKER "$repair_attempt"
  create_parent_authority_binding "$no_change_orphan_state" APPLIED_MARKER
  printf '%s\n' "$authority_target" >"$authority_marker"
  printf '%s\n' "$authority_target" >"$backstage_marker"
  printf '%s\n' "$authority_target" >"$authority_runtime_identity"
  chmod 0600 "$authority_runtime_identity"
  rm -f -- "$authority_pending" "$RUNTIME_LEDGER_QUARANTINE_FILE" \
    "$POSTDEPLOY_MARKER_PENDING_FILE" "$early_persistent_gate_active"
  rm -rf -- "$POSTDEPLOY_LEGACY_RETIRE_DIR"
  assert_parent_artifact_routes_no_change_recovery
  reconcile_pending_backstage_deployment_before_runtime_recovery
  [[ ! -e "$parent_authority" && ! -L "$parent_authority" \
     && "$(cat "$authority_calls")" == "$no_change_orphan_expected_calls" \
     && "$backstage_pending_reconciled_before_runtime" == true \
     && "$backstage_pending_reconciled_to_target" == true ]]
done
for no_change_invalid_artifact in malformed symlink; do
  reset_startup_case
  rm -f -- "$authority_pending" "$parent_authority"
  if [[ "$no_change_invalid_artifact" == malformed ]]; then
    printf '%s\n' '{}' >"$parent_authority"
    chmod 0600 "$parent_authority"
  else
    ln -s "$runtime_config_fixture/missing-parent-authority" "$parent_authority"
  fi
  assert_parent_artifact_routes_no_change_recovery
  set +e
  reconcile_pending_backstage_deployment_before_runtime_recovery >/dev/null 2>&1
  no_change_invalid_artifact_status="$?"
  set -e
  [[ "$no_change_invalid_artifact_status" == 79 \
     && ! -s "$authority_calls" \
     && "$backstage_pending_reconciled_before_runtime" == false \
     && "$backstage_pending_reconciled_to_target" == false ]]
  if [[ "$no_change_invalid_artifact" == malformed ]]; then
    [[ -f "$parent_authority" && ! -L "$parent_authority" ]]
  else
    [[ -L "$parent_authority" ]]
  fi
done
unset -f assert_parent_artifact_routes_no_change_recovery

# A child can finish a pre-authority rollback (pending=0, identity=0) and the
# parent can crash before retiring its exact ARMED receipt. With DB/marker
# authority still definitively absent, startup clears only that receipt under
# the inherited FD; it performs no child mutation and never claims the target.
for rolled_back_orphan_kind in DB_PROMOTION APPLIED_MARKER; do
  reset_startup_case
  create_bound_pending "$rolled_back_orphan_kind" "$repair_attempt"
  create_parent_authority_binding ARMED "$rolled_back_orphan_kind"
  rm -f -- "$authority_pending" "$authority_runtime_identity"
  if [[ "$rolled_back_orphan_kind" == DB_PROMOTION ]]; then
    AUTHORITY_STATUS=1
  fi
  reconcile_pending_backstage_deployment_before_runtime_recovery
  [[ ! -e "$authority_pending" && ! -e "$authority_runtime_identity" \
     && ! -e "$parent_authority" \
     && "$(cat "$authority_calls")" == \
        "verify-runtime-identity $authority_target" \
     && "$backstage_pending_reconciled_before_runtime" == true \
     && "$backstage_pending_reconciled_to_target" == false \
     && "$backstage_runtime_identity_repair_required" == true \
     && "$(cat "$backstage_marker")" == "$authority_baseline" ]]
done

# Exercise the complete first- and second-invocation control flow, rather than
# only its helpers. Both an ARMED crash residue on same-target A and a residue-
# free identity-less A->C semantic no-op must prevalidate exact target bytes,
# classify under the shared FD, force REPAIR_TOKEN, bypass the no-change
# quarantine branch, and leave a clean second invocation after child repair.
recovery_repair_hint_clause="$(awk '
  /^# Any startup Backstage recovery residue may authenticate as a label-less/ {
    capture=1
    next
  }
  capture { print }
  capture && /^fi$/ { exit }
' "$AUTO_DEPLOY")"
postdeploy_status_one_body="$(awk '
  /^case "\$postdeploy_pending_recovery_status" in$/ { in_case=1; next }
  in_case && /^  1\)$/ { capture=1; next }
  capture && /^    ;;$/ { exit }
  capture { print }
' "$AUTO_DEPLOY")"
repair_authority_selection_clause="$(awk '
  /^  authority_kind=APPLIED_MARKER$/ { capture=1 }
  capture { print }
  capture && /authority_kind=REPAIR_TOKEN$/ { exit }
' "$AUTO_DEPLOY")"
early_no_change_status_zero_body="$(awk '
  /^      case "\$no_change_backstage_status" in$/ { in_case=1; next }
  in_case && /^        0\)$/ { capture=1; next }
  capture && /^          ;;$/ { exit }
  capture { print }
' "$AUTO_DEPLOY")"
[[ -n "$recovery_repair_hint_clause" && -n "$postdeploy_status_one_body" \
   && -n "$repair_authority_selection_clause" \
   && -n "$early_no_change_status_zero_body" ]]

repair_flow_repo="$runtime_config_fixture/forced-identity-repair-repo"
repair_flow_child_calls="$runtime_config_fixture/forced-identity-repair-child.calls"
mkdir -p "$repair_flow_repo/ops/scripts" "$repair_flow_repo/design"
printf '%s\n' '#!/usr/bin/env bash' 'exit 0' \
  >"$repair_flow_repo/ops/scripts/test-backstage-fast-deploy-policy.sh"
printf '%s\n' '#!/usr/bin/env bash' 'cat >/dev/null' \
  >"$repair_flow_repo/ops/scripts/select-catalog-contract-tests.sh"
printf '%s\n' base >"$repair_flow_repo/design/semantic-noop.txt"
chmod 0700 "$repair_flow_repo/ops/scripts/"*.sh
git -C "$repair_flow_repo" init -q
git -C "$repair_flow_repo" add .
git -C "$repair_flow_repo" -c user.name=repair-flow-test \
  -c user.email=repair-flow-test@example.invalid commit -qm base
repair_flow_base="$(git -C "$repair_flow_repo" rev-parse HEAD)"
git -C "$repair_flow_repo" -c user.name=repair-flow-test \
  -c user.email=repair-flow-test@example.invalid commit --allow-empty -qm target
repair_flow_target="$(git -C "$repair_flow_repo" rev-parse HEAD)"
repair_flow_base_tree="$(git -C "$repair_flow_repo" rev-parse "$repair_flow_base^{tree}")"
repair_flow_target_tree="$(git -C "$repair_flow_repo" rev-parse "$repair_flow_target^{tree}")"
[[ "$repair_flow_base" =~ ^[0-9a-f]{40}$ \
   && "$repair_flow_target" =~ ^[0-9a-f]{40}$ \
   && "$repair_flow_base" != "$repair_flow_target" \
   && "$repair_flow_base_tree" == "$repair_flow_target_tree" ]]

# Re-source the exact product prevalidation lane for this end-to-end fixture.
# It operates only on clean clones of this private temporary repository.
# shellcheck disable=SC1090
source "$policy_once_functions"
automation_only_fast_path_eligible() { return 1; }
reconcile_pending_backstage_deployment_after_authority_recovery() {
  reconcile_pending_backstage_deployment_before_runtime_recovery
}
quarantine_write_calls=0
write_postdeploy_promotion_quarantine() {
  quarantine_write_calls=$((quarantine_write_calls + 1))
  printf '%s\n' "$1" >"$RUNTIME_LEDGER_QUARANTINE_FILE"
}
run_forced_identity_repair_flow() {
  local flow_label="$1" flow_mode="$2" desired_target="$3" original_deployed="$4"
  local applied_sha_before backstage_sha_before second_verify_status=0
  local second_child_calls_before second_child_calls_after second_exit_status=0
  reset_startup_case
  rm -f -- "$authority_pending" "$repair_authority" "$parent_authority" \
    "$authority_runtime_identity" "$RUNTIME_LEDGER_QUARANTINE_FILE"
  target_commit="$desired_target"
  deployed_commit="$original_deployed"
  no_change_candidate=false
  [[ "$desired_target" != "$original_deployed" ]] || no_change_candidate=true
  no_change_backstage_repair_required=false
  backstage_runtime_identity_repair_required=false
  backstage_recovery_may_require_repair=false
  PLAN_RUNTIME_REQUIRED=false
  PLAN_FRONTEND_REQUIRED=false
  PLAN_BACKEND_REQUIRED=false
  PLAN_DATABASE_REQUIRED=false
  PLAN_BACKSTAGE_REQUIRED=false
  PLAN_INFRASTRUCTURE_REQUIRED=false
  PLAN_TESTS=""
  PLAN_REASONS=semantic-noop
  AUTHORITY_STATUS=1
  quarantine_write_calls=0
  : >"$repair_flow_child_calls"

  case "$flow_mode" in
    artifact)
      create_bound_pending DB_PROMOTION "$repair_attempt"
      create_parent_authority_binding ARMED DB_PROMOTION
      rm -f -- "$authority_pending" "$authority_runtime_identity"
      ;;
    residue-free)
      rm -f -- "$authority_pending" "$repair_authority" "$parent_authority" \
        "$authority_runtime_identity"
      ;;
    *) return 79 ;;
  esac

  # Run the exact plan-time hint and clean-target policy lane before any state
  # mutation. The receipt is later re-bound to this same target blob.
  eval "$recovery_repair_hint_clause"
  [[ "$backstage_recovery_may_require_repair" == true ]]
  POLICY_ROOT="$repair_flow_repo"
  ROOT_DIR="$repair_flow_repo"
  backstage_fast_policy_validated_sha256=""
  prevalidated_catalog_contract_sha256=()
  prevalidate_target_contract_lanes_before_mutation \
    >"$runtime_config_fixture/${flow_label}.prevalidate.out"
  [[ "$backstage_fast_policy_validated_sha256" =~ ^[0-9a-f]{64}$ ]]

  applied_sha_before="$(sha256sum "$authority_marker" | awk '{print $1}')"
  backstage_sha_before="$(sha256sum "$backstage_marker" | awk '{print $1}')"
  reconcile_pending_backstage_deployment_before_runtime_recovery
  [[ "$backstage_pending_reconciled_before_runtime" == true \
     && "$backstage_pending_reconciled_to_target" == false \
     && "$backstage_runtime_identity_repair_required" == true \
     && ! -e "$authority_pending" && ! -L "$authority_pending" \
     && ! -e "$repair_authority" && ! -L "$repair_authority" \
     && ! -e "$parent_authority" && ! -L "$parent_authority" ]]

  apply_backstage_runtime_identity_repair_plan_if_required
  [[ "$no_change_candidate" == false \
     && "$no_change_backstage_repair_required" == true \
     && "$PLAN_BACKSTAGE_REQUIRED" == true \
     && "$PLAN_INFRASTRUCTURE_REQUIRED" == true \
     && ",${PLAN_TESTS}," == *,backstage:build-deploy,* ]]

  # Execute the real status-1 branch body. The late repair must make its
  # no-change quarantine arm unreachable before any marker or child mutation.
  eval "$postdeploy_status_one_body"
  [[ "$quarantine_write_calls" == 0 \
     && ! -e "$RUNTIME_LEDGER_QUARANTINE_FILE" \
     && ! -L "$RUNTIME_LEDGER_QUARANTINE_FILE" \
     && "$(sha256sum "$authority_marker" | awk '{print $1}')" == "$applied_sha_before" \
     && "$(sha256sum "$backstage_marker" | awk '{print $1}')" == "$backstage_sha_before" ]]

  authority_kind=""
  eval "$repair_authority_selection_clause"
  [[ "$authority_kind" == REPAIR_TOKEN ]]
  printf '%s|%s\n' "$authority_kind" "$target_commit" >>"$repair_flow_child_calls"
  printf '%s\n' "$target_commit" >"$authority_runtime_identity"
  chmod 0600 "$authority_runtime_identity"
  printf '%s\n' "$target_commit" >"$backstage_marker"
  # Model the later global success cut only after the REPAIR_TOKEN child has
  # recreated exact runtime identity. This also makes the next invocation a
  # literal deployed==target no-change prestate.
  printf '%s\n' "$target_commit" >"$authority_marker"
  [[ "$(cat "$repair_flow_child_calls")" == "REPAIR_TOKEN|$target_commit" ]]

  # Model the immediate next timer invocation from durable terminal state. Its
  # exact hint is false, startup has no recovery route, and the same held-FD
  # verifier proves the repaired target without creating the old quarantine.
  backstage_recovery_may_require_repair=false
  backstage_runtime_identity_repair_required=false
  backstage_pending_reconciled_before_runtime=false
  backstage_pending_reconciled_to_target=false
  deployed_commit="$target_commit"
  no_change_candidate=true
  no_change_recovery_hint=false
  no_change_backstage_repair_required=false
  PLAN_BACKSTAGE_REQUIRED=false
  PLAN_INFRASTRUCTURE_REQUIRED=false
  PLAN_TESTS=""
  PLAN_REASONS=""
  eval "$recovery_repair_hint_clause"
  [[ "$deployed_commit" == "$target_commit" \
     && "$no_change_candidate" == true \
     && "$no_change_recovery_hint" == false \
     && "$no_change_backstage_repair_required" == false \
     && "$backstage_recovery_may_require_repair" == false ]]
  [[ "$backstage_pending_reconciled_before_runtime" == false \
     && "$backstage_pending_reconciled_to_target" == false \
     && "$backstage_runtime_identity_repair_required" == false ]]
  acquire_backstage_deployment_mutation_lock
  if verify_backstage_runtime_identity_for_ref_under_lock "$target_commit"; then
    second_verify_status=0
  else
    second_verify_status=$?
  fi
  release_backstage_deployment_mutation_lock
  second_child_calls_before="$(wc -l <"$repair_flow_child_calls" | tr -d '[:space:]')"
  set +e
  (
    set -e
    DEPLOY_STARTED_EPOCH_MILLISECONDS=0
    DEPLOY_PHASE_FILE="$runtime_config_fixture/${flow_label}.second.phase"
    CARBONET_DEPLOY_SNAPSHOT_PATH="$runtime_config_fixture/${flow_label}.second.snapshot"
    monotonic_milliseconds() { printf '%s\n' 1; }
    verify_semantic_success_operational_usage_ledger_identity() {
      [[ "$1" == "$target_commit" ]]
    }
    clear_no_change_runtime_checkpoint_if_present() { :; }
    terminal_deploy_recovery_residue_absent() {
      [[ ! -e "$authority_pending" && ! -L "$authority_pending" \
         && ! -e "$repair_authority" && ! -L "$repair_authority" \
         && ! -e "$parent_authority" && ! -L "$parent_authority" \
         && ! -e "$RUNTIME_LEDGER_QUARANTINE_FILE" \
         && ! -L "$RUNTIME_LEDGER_QUARANTINE_FILE" ]]
    }
    eval "$early_no_change_status_zero_body"
    exit 99
  ) >"$runtime_config_fixture/${flow_label}.second.out" 2>&1
  second_exit_status="$?"
  set -e
  second_child_calls_after="$(wc -l <"$repair_flow_child_calls" | tr -d '[:space:]')"
  [[ "$second_verify_status" == 0 && "$second_exit_status" == 0 \
     && "$second_child_calls_before" == 1 \
     && "$second_child_calls_after" == "$second_child_calls_before" \
     && "$quarantine_write_calls" == 0 \
     && ! -e "$RUNTIME_LEDGER_QUARANTINE_FILE" \
     && ! -L "$RUNTIME_LEDGER_QUARANTINE_FILE" ]]
}

run_forced_identity_repair_flow same-target-artifact artifact \
  "$repair_flow_base" "$repair_flow_base"
run_forced_identity_repair_flow remote-semantic-noop residue-free \
  "$repair_flow_target" "$repair_flow_base"
ROOT_DIR="$ROOT"
POLICY_ROOT="$ROOT"
unset -f run_forced_identity_repair_flow write_postdeploy_promotion_quarantine \
  reconcile_pending_backstage_deployment_after_authority_recovery \
  prevalidate_target_contract_lanes_before_mutation \
  validate_target_backstage_fast_deploy_policy_if_required \
  filter_prevalidated_backstage_fast_policy_contract_test \
  run_sha_pinned_catalog_contract_prevalidation \
  filter_sha_pinned_prevalidated_catalog_contract_tests \
  automation_only_fast_path_eligible

# Identity absence is not a shortcut for any externally authoritative cut.
# AUTHORIZED:0 and ARMED:0 retain the exact artifact and return 79 for both
# authority kinds; the read-only child verifier cannot manufacture identity.
for identity_absent_authority_kind in DB_PROMOTION APPLIED_MARKER; do
  for identity_absent_artifact_state in ARMED AUTHORIZED; do
    reset_startup_case
    create_bound_pending "$identity_absent_authority_kind" "$repair_attempt"
    create_parent_authority_binding "$identity_absent_artifact_state" \
      "$identity_absent_authority_kind"
    rm -f -- "$authority_pending" "$authority_runtime_identity"
    if [[ "$identity_absent_authority_kind" == DB_PROMOTION ]]; then
      AUTHORITY_STATUS=0
    else
      printf '%s\n' "$authority_target" >"$authority_marker"
    fi
    set +e
    reconcile_pending_backstage_deployment_before_runtime_recovery >/dev/null 2>&1
    identity_absent_authority_status="$?"
    set -e
    [[ "$identity_absent_authority_status" == 79 \
       && -f "$parent_authority" && ! -e "$authority_pending" \
       && ! -e "$authority_runtime_identity" \
       && "$(cat "$authority_calls")" == "verify-runtime-identity $authority_target" \
       && "$backstage_pending_reconciled_before_runtime" == false \
       && "$backstage_pending_reconciled_to_target" == false ]]
  done
done

# Startup uses the same fresh-attempt authority matrix before runtime recovery.
reset_startup_case
create_repair_pending
create_repair_authority ARMED
reconcile_pending_backstage_deployment_before_runtime_recovery
[[ "$(cat "$authority_calls")" == $'recover-pending\nverify-runtime-identity '"$authority_target" \
   && "$backstage_pending_reconciled_before_runtime" == true \
   && "$backstage_pending_reconciled_to_target" == false \
   && "$backstage_runtime_identity_repair_required" == true ]]
reset_startup_case
create_repair_pending
create_repair_authority AUTHORIZED
reconcile_pending_backstage_deployment_before_runtime_recovery
[[ "$(cat "$authority_calls")" == "reconcile-pending $authority_target" \
   && "$backstage_pending_reconciled_before_runtime" == true \
   && "$backstage_pending_reconciled_to_target" == true ]]
# Crash after pending clear but before token clear is repaired token-only. ARMED
# orphan authority remains a status-79 recovery hold.
reset_startup_case
create_repair_pending
create_repair_authority AUTHORIZED
rm -f -- "$authority_pending"
printf '%s\n' "$authority_target" >"$backstage_marker"
reconcile_pending_backstage_deployment_before_runtime_recovery
[[ "$(cat "$authority_calls")" == reconcile-repair-authority \
   && ! -e "$repair_authority" \
   && "$backstage_pending_reconciled_before_runtime" == true \
   && "$backstage_pending_reconciled_to_target" == true ]]
reset_startup_case
create_repair_pending
create_repair_authority ARMED
rm -f -- "$authority_pending"
set +e
reconcile_pending_backstage_deployment_before_runtime_recovery >/dev/null 2>&1
startup_orphan_armed_status="$?"
set -e
[[ "$startup_orphan_armed_status" == 79 && -f "$repair_authority" \
   && "$backstage_pending_reconciled_before_runtime" == false \
   && "$backstage_pending_reconciled_to_target" == false ]]

# The parent accepts and captures the current child deferred-handoff schema v4
# (auto coordinator + exact attempt), then revalidates the same SHA binding.
reset_authority_case
create_bound_pending APPLIED_MARKER "$repair_attempt"
schema4_bound_sha="$(sha256sum "$authority_pending" | awk '{print $1}')"
backstage_deployment_authority_kind=APPLIED_MARKER
backstage_deployment_target_commit="$authority_target"
backstage_deployment_attempt_id="$repair_attempt"
backstage_deployment_handoff_active=true
BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=true
capture_parent_backstage_handoff_binding_locked "$schema4_bound_sha"
validate_parent_backstage_handoff_binding_locked
[[ "$backstage_deployment_handoff_binding_captured" == true \
   && "$backstage_deployment_pending_sha256" == "$schema4_bound_sha" ]]
# Live parent capture and repair arming are current-v4 only. Legacy-v3 remains
# readable exclusively through the version-aware startup recovery router.
reset_authority_case
create_legacy_bound_pending APPLIED_MARKER "$repair_attempt"
legacy_bound_sha="$(sha256sum "$authority_pending" | awk '{print $1}')"
backstage_deployment_authority_kind=APPLIED_MARKER
backstage_deployment_target_commit="$authority_target"
backstage_deployment_attempt_id="$repair_attempt"
backstage_deployment_handoff_active=true
BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=true
set +e
capture_parent_backstage_handoff_binding_locked "$legacy_bound_sha" >/dev/null 2>&1
legacy_live_capture_status="$?"
set -e
[[ "$legacy_live_capture_status" == 79 \
   && "$backstage_deployment_handoff_binding_captured" == false ]]
create_legacy_bound_pending REPAIR_TOKEN "$repair_attempt"
legacy_repair_sha="$(sha256sum "$authority_pending" | awk '{print $1}')"
set +e
load_parent_backstage_repair_pending_binding "$legacy_repair_sha" >/dev/null 2>&1
legacy_live_repair_status="$?"
set -e
[[ "$legacy_live_repair_status" == 79 && ! -e "$repair_authority" ]]

# Parent token publication revalidates the v4 pending binding at the final
# rename boundary, rejects symlinked ancestors and retains a successfully
# renamed ARMED token when only the directory durability sync fails.
real_sync_bin="$(type -P sync)"
[[ -x "$real_sync_bin" ]]
WRITER_SYNC_MODE=pass
sync() {
  if [[ "$WRITER_SYNC_MODE" == swap-pending \
     && "${2:-}" == "$authority_dir"/.repair-authority.* ]]; then
    "$real_sync_bin" "$@"
    create_bound_pending REPAIR_TOKEN eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
    WRITER_SYNC_MODE=pass
    return 0
  fi
  if [[ "$WRITER_SYNC_MODE" == swap-parent-pending \
     && "${2:-}" == */.parent-authority-binding.* ]]; then
    "$real_sync_bin" "$@"
    create_bound_pending APPLIED_MARKER eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
    WRITER_SYNC_MODE=pass
    return 0
  fi
  if [[ "$WRITER_SYNC_MODE" == fail-directory \
     && "${2:-}" == "${authority_dir:-}" ]]; then
    WRITER_SYNC_MODE=pass
    return 1
  fi
  if [[ "$WRITER_SYNC_MODE" == fail-parent-directory \
     && "${2:-}" == "$(dirname "$parent_authority")" ]]; then
    WRITER_SYNC_MODE=pass
    return 1
  fi
  if [[ "$WRITER_SYNC_MODE" == resurrect-parent-directory \
     && "${2:-}" == "$(dirname "$parent_authority")" ]]; then
    printf '%s\n' "$PARENT_RESURRECT_JSON" >"$parent_authority"
    chmod 0600 "$parent_authority"
    WRITER_SYNC_MODE=pass
    "$real_sync_bin" "$@"
    return 0
  fi
  "$real_sync_bin" "$@"
}

reset_authority_case
create_repair_pending
BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=true
pending_before_swap="$(sha256sum "$authority_pending" | awk '{print $1}')"
WRITER_SYNC_MODE=swap-pending
set +e
write_parent_backstage_repair_authority ARMED "$authority_target" "$repair_attempt" \
  "$pending_before_swap" ABSENT >/dev/null 2>&1
pending_swap_status="$?"
set -e
[[ "$pending_swap_status" == 79 && ! -e "$repair_authority" \
   && "$(jq -r '.attemptId' "$authority_pending")" == eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee ]]

reset_authority_case
create_repair_pending
writer_original_authority="$repair_authority"
writer_symlink_root="$runtime_config_fixture/authority-ancestor-symlink"
mkdir -p "$writer_symlink_root/real-parent/state"
chmod 0700 "$writer_symlink_root/real-parent" "$writer_symlink_root/real-parent/state"
ln -s "$writer_symlink_root/real-parent" "$writer_symlink_root/logical-parent"
[[ -L "$writer_symlink_root/logical-parent" ]]
repair_authority="$writer_symlink_root/logical-parent/state/repair-authority.json"
BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE="$repair_authority"
pending_for_symlink="$(sha256sum "$authority_pending" | awk '{print $1}')"
set +e
write_parent_backstage_repair_authority ARMED "$authority_target" "$repair_attempt" \
  "$pending_for_symlink" ABSENT >/dev/null 2>&1
ancestor_symlink_status="$?"
set -e
[[ "$ancestor_symlink_status" == 79 \
   && ! -e "$writer_symlink_root/real-parent/state/repair-authority.json" ]]
repair_authority="$writer_original_authority"
BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE="$repair_authority"

reset_authority_case
create_repair_pending
BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=true
pending_before_sync_failure="$(sha256sum "$authority_pending" | awk '{print $1}')"
WRITER_SYNC_MODE=fail-directory
set +e
write_parent_backstage_repair_authority ARMED "$authority_target" "$repair_attempt" \
  "$pending_before_sync_failure" ABSENT >/dev/null 2>&1
directory_sync_status="$?"
set -e
[[ "$directory_sync_status" == 79 && -f "$repair_authority" ]]
set +e
parent_backstage_repair_authority_status "$authority_target" "$repair_attempt" \
  "$pending_before_sync_failure"
retained_armed_status="$?"
set -e
[[ "$retained_armed_status" == 1 \
   && "$PARENT_BACKSTAGE_REPAIR_AUTHORITY_STATUS" == ARMED ]]
: >"$authority_calls"
backstage_deployment_authority_kind=REPAIR_TOKEN
reconcile_backstage_deployment_during_cleanup
[[ "$(cat "$authority_calls")" == recover-pending \
   && ! -e "$authority_pending" && ! -e "$repair_authority" ]]

# Parent artifact publication applies the same final pending CAS, canonical
# ancestor binding and post-rename durability semantics as the repair token.
reset_authority_case
create_bound_pending APPLIED_MARKER "$repair_attempt"
parent_pending_before_swap="$(sha256sum "$authority_pending" | awk '{print $1}')"
BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=true
WRITER_SYNC_MODE=swap-parent-pending
set +e
write_parent_backstage_authority_binding ARMED APPLIED_MARKER "$authority_target" \
  "$repair_attempt" "$parent_pending_before_swap" "" >/dev/null 2>&1
parent_pending_swap_status="$?"
set -e
[[ "$parent_pending_swap_status" == 79 && ! -e "$parent_authority" \
   && "$(jq -r '.attemptId' "$authority_pending")" == \
      eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee ]]

reset_authority_case
create_bound_pending APPLIED_MARKER "$repair_attempt"
original_parent_authority="$parent_authority"
parent_symlink_root="$runtime_config_fixture/parent-authority-ancestor-symlink"
mkdir -p "$parent_symlink_root/real-parent/state"
chmod 0700 "$parent_symlink_root/real-parent" "$parent_symlink_root/real-parent/state"
ln -s "$parent_symlink_root/real-parent" "$parent_symlink_root/logical-parent"
parent_authority="$parent_symlink_root/logical-parent/state/parent-authority-binding.json"
BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE="$parent_authority"
parent_symlink_pending_sha="$(sha256sum "$authority_pending" | awk '{print $1}')"
BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=true
set +e
write_parent_backstage_authority_binding ARMED APPLIED_MARKER "$authority_target" \
  "$repair_attempt" "$parent_symlink_pending_sha" "" >/dev/null 2>&1
parent_ancestor_symlink_status="$?"
set -e
[[ "$parent_ancestor_symlink_status" == 79 \
   && ! -e "$parent_symlink_root/real-parent/state/parent-authority-binding.json" ]]
parent_authority="$original_parent_authority"
BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE="$parent_authority"

reset_authority_case
create_bound_pending APPLIED_MARKER "$repair_attempt"
retained_parent_pending_sha="$(sha256sum "$authority_pending" | awk '{print $1}')"
BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=true
WRITER_SYNC_MODE=fail-parent-directory
set +e
write_parent_backstage_authority_binding ARMED APPLIED_MARKER "$authority_target" \
  "$repair_attempt" "$retained_parent_pending_sha" "" >/dev/null 2>&1
retained_parent_sync_status="$?"
set -e
[[ "$retained_parent_sync_status" == 79 && -f "$parent_authority" \
   && "$(jq -r '.status' "$parent_authority")" == ARMED ]]
BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=false
BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD=""
: >"$authority_calls"
reconcile_pending_backstage_deployment_before_runtime_recovery
[[ "$(cat "$authority_calls")" == $'recover-pending\nverify-runtime-identity '"$authority_target" \
   && ! -e "$authority_pending" && ! -e "$parent_authority" ]]

# Once the child clears pending, every artifact-clear failure keeps rollback at
# zero. A retained AUTHORIZED receipt self-recovers; an already-unlinked receipt
# returns79 with pending still absent and can never be recreated by the parent.
for parent_clear_fault in fail-parent-directory resurrect-parent-directory; do
  reset_startup_case
  create_bound_pending APPLIED_MARKER "$repair_attempt"
  create_parent_authority_binding AUTHORIZED APPLIED_MARKER
  printf '%s\n' "$authority_target" >"$authority_marker"
  PARENT_RESURRECT_JSON="$(<"$parent_authority")"
  WRITER_SYNC_MODE="$parent_clear_fault"
  set +e
  reconcile_pending_backstage_deployment_before_runtime_recovery >/dev/null 2>&1
  parent_clear_fault_status="$?"
  set -e
  [[ "$parent_clear_fault_status" == 79 && ! -e "$authority_pending" \
     && "$(cat "$authority_calls")" == $'reconcile-pending '"$authority_target"$'\nverify-runtime-identity '"$authority_target" ]]
  if [[ "$parent_clear_fault" == fail-parent-directory ]]; then
    [[ ! -e "$parent_authority" ]]
  else
    [[ -f "$parent_authority" ]]
    : >"$authority_calls"
    reconcile_pending_backstage_deployment_before_runtime_recovery
    [[ ! -e "$parent_authority" && "$(cat "$authority_calls")" == \
       $'verify-runtime-identity '"$authority_target"$'\nverify-runtime-identity '"$authority_target" ]]
  fi
done

reset_startup_case
create_bound_pending APPLIED_MARKER "$repair_attempt"
create_parent_authority_binding AUTHORIZED APPLIED_MARKER
printf '%s\n' "$authority_target" >"$authority_marker"
real_rm_bin="$(type -P rm)"
RM_PARENT_FAIL_ONCE=true
rm() {
  if [[ "$RM_PARENT_FAIL_ONCE" == true && "${*: -1}" == "$parent_authority" ]]; then
    RM_PARENT_FAIL_ONCE=false
    return 1
  fi
  "$real_rm_bin" "$@"
}
set +e
reconcile_pending_backstage_deployment_before_runtime_recovery >/dev/null 2>&1
parent_pre_unlink_status="$?"
set -e
unset -f rm
[[ "$parent_pre_unlink_status" == 79 && ! -e "$authority_pending" \
   && -f "$parent_authority" \
   && "$(cat "$authority_calls")" == $'reconcile-pending '"$authority_target"$'\nverify-runtime-identity '"$authority_target" ]]
: >"$authority_calls"
reconcile_pending_backstage_deployment_before_runtime_recovery
[[ ! -e "$parent_authority" && "$(cat "$authority_calls")" == \
   $'verify-runtime-identity '"$authority_target"$'\nverify-runtime-identity '"$authority_target" ]]
unset -f sync

# The startup recovery fixtures above deliberately use the exact product
# parent-to-child verifier. Restore the original cleanup/authority fixture stub
# at this boundary so its inherited-FD call traces remain scoped to the child
# mutation being asserted, rather than leaking the startup classifier's
# read-only verifier into every later assertion.
verify_backstage_runtime_identity_for_ref_under_lock() {
  [[ "$BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD" == true \
     && -f "$backstage_marker" && ! -L "$backstage_marker" \
     && "$(tr -d '[:space:]' <"$backstage_marker")" == "$1" ]]
}

# A direct helper that rolls back A and publishes same-target B in the narrow
# final-gate/authority boundary cannot inherit A's applied-marker or DB
# authority. Both authority publications stop at status 79 with child
# finalize/reconcile mutation count 0.
write_applied_calls=0
WRITE_APPLIED_STATUS=0
write_applied_deploy_state() {
  write_applied_calls=$((write_applied_calls + 1))
  printf '%s\n' "$1" >"$authority_marker"
  return "$WRITE_APPLIED_STATUS"
}
for replacement_kind in APPLIED_MARKER DB_PROMOTION; do
  reset_authority_case
  create_bound_pending "$replacement_kind" "$repair_attempt"
  original_bound_sha="$(sha256sum "$authority_pending" | awk '{print $1}')"
  backstage_deployment_authority_kind="$replacement_kind"
  backstage_deployment_target_commit="$authority_target"
  backstage_deployment_attempt_id="$repair_attempt"
  backstage_deployment_pending_sha256="$original_bound_sha"
  backstage_deployment_handoff_binding_captured=true
  backstage_deployment_handoff_active=true
  : >"$authority_calls"
  write_applied_calls=0
  WRITE_APPLIED_STATUS=0
  REPLACE_BOUND_PENDING_ON_LOCK=true
  set +e
  if [[ "$replacement_kind" == APPLIED_MARKER ]]; then
    write_applied_deploy_state_with_backstage_binding "$authority_target" >/dev/null 2>&1
    replacement_publish_status="$?"
  else
    if begin_parent_backstage_authority_finalize_lock >/dev/null 2>&1; then
      write_applied_calls=$((write_applied_calls + 1))
      replacement_publish_status=0
    else
      replacement_publish_status="$?"
    fi
  fi
  set -e
  [[ "$replacement_publish_status" == 79 && "$write_applied_calls" == 0 \
     && ! -s "$authority_calls" \
     && "$(jq -r '.attemptId' "$authority_pending")" == \
        eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee ]]
done

# Successful APPLIED publication and child finalize share FD 19 and the exact
# schema-v4 SHA+attempt binding; the lock is released only after terminal proof.
reset_authority_case
create_bound_pending APPLIED_MARKER "$repair_attempt"
finalize_bound_sha="$(sha256sum "$authority_pending" | awk '{print $1}')"
backstage_deployment_authority_kind=APPLIED_MARKER
backstage_deployment_target_commit="$authority_target"
backstage_deployment_attempt_id="$repair_attempt"
backstage_deployment_pending_sha256="$finalize_bound_sha"
backstage_deployment_handoff_binding_captured=true
backstage_deployment_handoff_active=true
AUTHORITY_ENV_CALLS="$runtime_config_fixture/authority-finalize-env.calls"
: >"$AUTHORITY_ENV_CALLS"
write_applied_deploy_state_with_backstage_binding "$authority_target" >/dev/null
[[ "$BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD" == true \
   && "$backstage_authority_finalize_lock_active" == true ]]
finalize_backstage_deployment_after_release_success
[[ "$backstage_deployment_handoff_active" == false \
   && "$BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD" == false \
   && "$(cat "$AUTHORITY_ENV_CALLS")" == \
      "finalize-pending $authority_target|sha=$finalize_bound_sha|attempt=$repair_attempt|fd=19" ]]

# A marker writer can fail after rename. Its indeterminate status retains the
# same FD so EXIT cleanup reconciles exact A without reopening a B race.
reset_authority_case
create_bound_pending APPLIED_MARKER "$repair_attempt"
indeterminate_bound_sha="$(sha256sum "$authority_pending" | awk '{print $1}')"
backstage_deployment_authority_kind=APPLIED_MARKER
backstage_deployment_target_commit="$authority_target"
backstage_deployment_attempt_id="$repair_attempt"
backstage_deployment_pending_sha256="$indeterminate_bound_sha"
backstage_deployment_handoff_binding_captured=true
backstage_deployment_handoff_active=true
WRITE_APPLIED_STATUS=79
set +e
write_applied_deploy_state_with_backstage_binding "$authority_target" >/dev/null 2>&1
indeterminate_write_status="$?"
set -e
[[ "$indeterminate_write_status" == 79 \
   && "$BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD" == true \
   && "$backstage_authority_finalize_lock_active" == true ]]
AUTHORITY_ENV_CALLS="$runtime_config_fixture/authority-indeterminate.calls"
: >"$AUTHORITY_ENV_CALLS"
reconcile_backstage_deployment_during_cleanup
[[ "$BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD" == false \
   && "$(cat "$AUTHORITY_ENV_CALLS")" == \
      "reconcile-pending $authority_target|sha=$indeterminate_bound_sha|attempt=$repair_attempt|fd=19" ]]
WRITE_APPLIED_STATUS=0

# TERM/EXIT cleanup during the authority critical section reuses the already
# held OFD (newOpen=0), passes FD 19 inherited and releases only after the exact
# reconcile reaches terminal state.
for signal_kind in APPLIED_MARKER DB_PROMOTION; do
  reset_authority_case
  create_bound_pending "$signal_kind" "$repair_attempt"
  signal_bound_sha="$(sha256sum "$authority_pending" | awk '{print $1}')"
  backstage_deployment_authority_kind="$signal_kind"
  backstage_deployment_target_commit="$authority_target"
  backstage_deployment_attempt_id="$repair_attempt"
  backstage_deployment_pending_sha256="$signal_bound_sha"
  backstage_deployment_handoff_binding_captured=true
  backstage_deployment_handoff_active=true
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=true
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD=19
  write_parent_backstage_authority_binding ARMED "$signal_kind" "$authority_target" \
    "$repair_attempt" "$signal_bound_sha" \
    "$([[ "$signal_kind" == DB_PROMOTION ]] && printf '%s' "$postdeploy_candidate_id")"
  backstage_authority_finalize_lock_active=true
  AUTHORITY_LOCK_NEW_OPEN_CALLS=0
  AUTHORITY_STATUS=0
  printf '%s\n' "$authority_target" >"$authority_marker"
  AUTHORITY_ENV_CALLS="$runtime_config_fixture/authority-signal-$signal_kind.calls"
  : >"$AUTHORITY_ENV_CALLS"
  : >"$authority_calls"
  reconcile_backstage_deployment_during_cleanup
  [[ "$AUTHORITY_LOCK_NEW_OPEN_CALLS" == 0 \
     && "$BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD" == false \
     && "$(cat "$AUTHORITY_ENV_CALLS")" == \
        "reconcile-pending $authority_target|sha=$signal_bound_sha|attempt=$repair_attempt|fd=19" ]]
done
AUTHORITY_ENV_CALLS=""
unset -f write_applied_deploy_state

POSTDEPLOY_ATTEMPT_JOURNAL_FILE="$runtime_config_fixture/postdeploy-attempt.json"
postdeploy_candidate_promoted=false
postdeploy_candidate_initialized=false
recover_staged_postdeploy_attempt_after_failure() {
  printf '%s\n' staged-runtime-restore >>"$authority_calls"
}
reconcile_postdeploy_candidate_after_failure() {
  printf '%s\n' initialized-runtime-restore >>"$authority_calls"
}
printf '%s\n' '{"attempt":true}' >"$POSTDEPLOY_ATTEMPT_JOURNAL_FILE"
: >"$authority_calls"
backstage_startup_recovery_hold=true
set +e
recover_runtime_after_failure_if_safe >/dev/null 2>&1
startup_hold_status="$?"
set -e
[[ "$startup_hold_status" == 79 && ! -s "$authority_calls" ]]
backstage_startup_recovery_hold=false
recover_runtime_after_failure_if_safe
[[ "$(cat "$authority_calls")" == staged-runtime-restore ]]
rm -f -- "$POSTDEPLOY_ATTEMPT_JOURNAL_FILE"
: >"$authority_calls"
postdeploy_candidate_initialized=true
recover_runtime_after_failure_if_safe
[[ "$(cat "$authority_calls")" == initialized-runtime-restore ]]
unset -f reconcile_backstage_deployment_during_cleanup \
  finalize_backstage_deployment_after_release_success \
  reconcile_pending_backstage_deployment_before_runtime_recovery \
  recover_runtime_after_failure_if_safe \
  postdeploy_authoritative_promotion_status run_target_backstage_deploy_helper \
  rollback_backstage_deployment_after_failure reset_authority_case \
  load_parent_backstage_handoff_binding capture_parent_backstage_handoff_binding_locked \
  validate_parent_backstage_handoff_binding_locked clear_parent_backstage_handoff_binding \
  begin_parent_backstage_authority_finalize_lock write_applied_deploy_state_with_backstage_binding \
  load_parent_backstage_repair_pending_binding parent_backstage_repair_authority_status \
  write_parent_backstage_repair_authority create_repair_pending create_bound_pending create_standalone_pending create_repair_authority \
  load_parent_backstage_authority_binding write_parent_backstage_authority_binding \
  finalize_parent_backstage_authority_binding parent_backstage_authority_binding_active \
  parent_backstage_applied_marker_cut_status verify_backstage_runtime_identity_for_ref_under_lock \
  prepare_cleanup_parent_binding create_parent_authority_binding \
  acquire_backstage_deployment_mutation_lock release_backstage_deployment_mutation_lock \
  recover_persistent_postdeploy_attempt reset_startup_case \
  recover_staged_postdeploy_attempt_after_failure reconcile_postdeploy_candidate_after_failure

deploy_function="$runtime_config_fixture/parent-deploy-function.sh"
sed -n '/^deploy_backstage_if_required() {/,/^derive_backstage_e2e_routes() {/p' \
  "$AUTO_DEPLOY" | sed '$d' >"$deploy_function"
# shellcheck disable=SC1090
source "$deploy_function"
parent_deploy_calls="$runtime_config_fixture/parent-deploy.calls"
parent_deploy_state_dir="$runtime_config_fixture/parent-state"
mkdir -p "$parent_deploy_state_dir"
BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$parent_deploy_state_dir"
BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$parent_deploy_state_dir/deployment-rollback.pending.json"
BACKSTAGE_RUNTIME_IDENTITY_FILE="$parent_deploy_state_dir/runtime-success.identity.json"
BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE="$parent_deploy_state_dir/repair-authority.json"
BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE="$parent_deploy_state_dir/parent-authority-binding.json"
BACKSTAGE_DEPLOY_STATE_FILE="$runtime_config_fixture/parent-backstage.marker"
BACKSTAGE_DEPLOY_HELPER="$runtime_config_fixture/target-helper.sh"
BACKSTAGE_PUBLIC_URL=https://backstage.172.16.1.232.nip.io:32947
ROOT_DIR="$ROOT"
PLAN_BACKSTAGE_REQUIRED=true
PLAN_RUNTIME_REQUIRED=false
target_commit="$authority_target"
printf '%s\n' "$target_commit" >"$BACKSTAGE_DEPLOY_STATE_FILE"
: >"$parent_deploy_calls"
resolve_target_backstage_deploy_helper() { :; }
validate_backstage_public_url() {
  [[ "$BACKSTAGE_PUBLIC_URL" == https://backstage.172.16.1.232.nip.io:32947 ]]
}
backstage_runtime_fingerprint_at_ref() { printf '%064d\n' 0 | tr 0 a; }
openssl() { [[ "$*" == 'rand -hex 16' ]]; printf '%032d\n' 0 | tr 0 d; }
PARENT_CHILD_STATUS=0
PARENT_WRITE_PENDING=true
PARENT_REPLACE_ATTEMPT=false
PARENT_AUTHORITY_ARM_CALLS=0
bash() {
  printf '%s|fingerprint=%s\n' "$*" "${BACKSTAGE_DEPLOYMENT_RUNTIME_FINGERPRINT:-}" \
    >>"$parent_deploy_calls"
  if [[ "$PARENT_WRITE_PENDING" == true ]]; then
    local returned_attempt="${BACKSTAGE_DEPLOYMENT_ATTEMPT_ID:?}"
    [[ "$PARENT_REPLACE_ATTEMPT" != true ]] || returned_attempt=eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
    jq -cn \
      --arg attempt "$returned_attempt" \
      --arg target "${BACKSTAGE_DEPLOYMENT_TARGET_COMMIT:?}" \
      --arg authority "${BACKSTAGE_DEPLOYMENT_AUTHORITY_KIND:?}" \
      '{schemaVersion:4,phase:"CANDIDATE_READY",finalizeMode:"deferred",coordinator:"auto",
        attemptId:$attempt,targetCommit:$target,authorityKind:$authority}' \
      >"$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE"
    chmod 0600 "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE"
  fi
  return "$PARENT_CHILD_STATUS"
}
PARENT_PUBLIC_PROBE_MODE=pass
parent_public_probe_calls="$runtime_config_fixture/parent-public-probe.calls"
: >"$parent_public_probe_calls"
curl() {
  local url="${*: -1}"
  printf '%s\n' "$url" >>"$parent_public_probe_calls"
  if [[ "$PARENT_PUBLIC_PROBE_MODE" == fail-nodeport ]]; then
    case "$url" in
      https://backstage.172.16.1.232.nip.io:32947/*) printf '503' ;;
      https://backstage.172.16.1.232.nip.io/*) printf '200' ;;
      *) printf '000' ;;
    esac
  else
    printf '200'
  fi
}
sleep() { :; }
acquire_backstage_deployment_mutation_lock() {
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=true
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD=19
}
release_backstage_deployment_mutation_lock() {
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=false
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD=""
}
acquire_clean_backstage_deployment_mutation_lock() {
  [[ ! -e "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" \
     && ! -L "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" \
     && ! -e "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE" \
     && ! -L "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE" ]] || return 79
  acquire_backstage_deployment_mutation_lock
}
clear_parent_backstage_handoff_binding() {
  backstage_deployment_target_commit=""
  backstage_deployment_attempt_id=""
  backstage_deployment_pending_sha256=""
  backstage_deployment_handoff_binding_captured=false
}
capture_parent_backstage_handoff_binding_locked() {
  local expected_sha="$1"
  [[ "$BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD" == true \
     && "$(sha256sum "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" | awk '{print $1}')" == "$expected_sha" ]] \
    || return 79
  jq -e --arg target "$backstage_deployment_target_commit" \
      --arg attempt "$backstage_deployment_attempt_id" \
      --arg authority "$backstage_deployment_authority_kind" '
        .schemaVersion == 4 and .phase == "CANDIDATE_READY" and
        .finalizeMode == "deferred" and .coordinator == "auto" and
        .targetCommit == $target and .attemptId == $attempt and .authorityKind == $authority
      ' "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" >/dev/null || return 79
  backstage_deployment_pending_sha256="$expected_sha"
  backstage_deployment_handoff_binding_captured=true
}
load_parent_backstage_repair_pending_binding() {
  PARENT_BACKSTAGE_REPAIR_PENDING_TARGET="$(jq -r '.targetCommit' "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE")"
  PARENT_BACKSTAGE_REPAIR_PENDING_ATTEMPT_ID="$(jq -r '.attemptId' "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE")"
  PARENT_BACKSTAGE_REPAIR_PENDING_SHA256="$1"
}
write_parent_backstage_repair_authority() {
  [[ "$1" == ARMED && "$2" == "$target_commit" \
     && "$3" == "$backstage_deployment_attempt_id" \
     && "$4" == "$backstage_deployment_pending_sha256" && "$5" == ABSENT ]]
  printf '%s\n' ARMED >"$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE"
}
write_parent_backstage_authority_binding() {
  [[ "$1" == ARMED && "$2" == APPLIED_MARKER && "$3" == "$target_commit" \
     && "$4" == "$backstage_deployment_attempt_id" \
     && "$5" == "$backstage_deployment_pending_sha256" && -z "$6" ]]
  PARENT_AUTHORITY_ARM_CALLS=$((PARENT_AUTHORITY_ARM_CALLS + 1))
  printf '%s\n' ARMED >"$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE"
}
deploy_backstage_if_required >"$runtime_config_fixture/parent-deploy.out"
[[ "$(wc -l <"$parent_deploy_calls" | tr -d '[:space:]')" == 1 ]]
[[ "$backstage_deployment_handoff_active" == true ]]
[[ "$backstage_deployment_authority_kind" == APPLIED_MARKER ]]
[[ "$backstage_deployment_handoff_binding_captured" == true ]]
[[ "$PARENT_AUTHORITY_ARM_CALLS" == 1 \
   && "$(cat "$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE")" == ARMED ]]
[[ "$(jq -r '.attemptId' "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE")" == \
   dddddddddddddddddddddddddddddddd ]]
grep -Fq 'durable handoff retained until global promotion' \
  "$runtime_config_fixture/parent-deploy.out"

# A healthy default-TLS endpoint cannot substitute for the canonical external
# NodePort. The parent must probe :32947, retain the exact pending handoff, and
# stop before any finalize or marker publication when that endpoint is down.
rm -f -- "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" \
  "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE" \
  "$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE"
: >"$parent_deploy_calls"
: >"$parent_public_probe_calls"
PARENT_PUBLIC_PROBE_MODE=fail-nodeport
PARENT_CHILD_STATUS=0
PARENT_WRITE_PENDING=true
PARENT_REPLACE_ATTEMPT=false
no_change_backstage_repair_required=false
backstage_deployment_handoff_active=false
clear_parent_backstage_handoff_binding
marker_sha_before="$(sha256sum "$BACKSTAGE_DEPLOY_STATE_FILE" | awk '{print $1}')"
set +e
deploy_backstage_if_required >/dev/null 2>&1
parent_public_nodeport_status="$?"
set -e
[[ "$parent_public_nodeport_status" == 79 \
   && "$backstage_deployment_handoff_active" == true \
   && -f "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" \
   && "$(cat "$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE")" == ARMED \
   && "$(sha256sum "$BACKSTAGE_DEPLOY_STATE_FILE" | awk '{print $1}')" == "$marker_sha_before" ]]
[[ "$(wc -l <"$parent_public_probe_calls" | tr -d '[:space:]')" == 5 ]]
if grep -Fv ':32947/.backstage/health/v1/readiness' "$parent_public_probe_calls" | grep -q .; then
  echo 'Backstage parent readiness used a non-canonical public endpoint' >&2
  exit 1
fi
! grep -Eq '(^|[[:space:]])finalize-pending([[:space:]]|$)' "$parent_deploy_calls"
PARENT_PUBLIC_PROBE_MODE=pass

# A normal child failure before pending publication disarms the speculative
# handoff and preserves its original status. A failure with pending remains
# armed so the outer EXIT cleanup owns recovery.
rm -f -- "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" \
  "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE" \
  "$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE"
: >"$parent_deploy_calls"
PARENT_CHILD_STATUS=37
PARENT_WRITE_PENDING=false
set +e
deploy_backstage_if_required >/dev/null 2>&1
parent_pre_pending_status="$?"
set -e
[[ "$parent_pre_pending_status" == 37 \
   && "$backstage_deployment_handoff_active" == false \
   && ! -e "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" ]]
PARENT_WRITE_PENDING=true
set +e
deploy_backstage_if_required >/dev/null 2>&1
parent_with_pending_status="$?"
set -e
[[ "$parent_with_pending_status" == 37 \
   && "$backstage_deployment_handoff_active" == true \
   && -f "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" ]]

# A same-target repair receives a parent-generated attempt ID and a fresh ARMED
# token. Replacing A with another same-target attempt B before the bind is
# rejected and cannot inherit A's global gates.
rm -f -- "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" \
  "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE" \
  "$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE"
PARENT_CHILD_STATUS=0
PARENT_WRITE_PENDING=true
PARENT_REPLACE_ATTEMPT=false
no_change_backstage_repair_required=true
deploy_backstage_if_required >/dev/null
[[ "$backstage_deployment_authority_kind" == REPAIR_TOKEN \
   && "$(cat "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE")" == ARMED ]]
rm -f -- "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" \
  "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE" \
  "$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE"
PARENT_REPLACE_ATTEMPT=true
set +e
deploy_backstage_if_required >/dev/null 2>&1
parent_foreign_attempt_status="$?"
set -e
[[ "$parent_foreign_attempt_status" == 79 \
   && ! -e "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE" ]]
no_change_backstage_repair_required=false
unset -f deploy_backstage_if_required resolve_target_backstage_deploy_helper \
  validate_backstage_public_url backstage_runtime_fingerprint_at_ref openssl bash curl sleep \
  acquire_backstage_deployment_mutation_lock release_backstage_deployment_mutation_lock \
  acquire_clean_backstage_deployment_mutation_lock \
  clear_parent_backstage_handoff_binding capture_parent_backstage_handoff_binding_locked \
  load_parent_backstage_repair_pending_binding write_parent_backstage_repair_authority \
  write_parent_backstage_authority_binding

# The child's read-only serving proof must also use the external NodePort for
# readiness, purge health, and preview sign-in. A healthy implicit :443 preview
# cannot mask a failed canonical :32947 preview route.
public_serving_function="$runtime_config_fixture/public-serving-function.sh"
sed -n '/^verify_backstage_public_serving_plane() {/,/^verify_backstage_runtime_identity_against_live() {/p' \
  "$DEPLOY" | sed '$d' >"$public_serving_function"
# shellcheck disable=SC1090
source "$public_serving_function"
public_serving_calls="$runtime_config_fixture/public-serving.calls"
: >"$public_serving_calls"
BACKSTAGE_PUBLIC_URL=https://backstage.172.16.1.232.nip.io:32947
BACKSTAGE_URL=https://backstage.172.16.1.232.nip.io:32947
RESONANCE_PREVIEW_PUBLIC_URL=https://resonance.172.16.1.232.nip.io:32947
BACKSTAGE_RUNTIME_IDENTITY_VERIFY_TIMEOUT_SECONDS=4
backstage_rollback_fail() { :; }
curl() {
  local url="${*: -1}"
  printf '%s\n' "$url" >>"$public_serving_calls"
  if [[ "$url" == https://resonance.172.16.1.232.nip.io:32947/signin/loginView ]]; then
    return 22
  fi
  return 0
}
set +e
verify_backstage_public_serving_plane 4 >/dev/null 2>&1
public_preview_status="$?"
set -e
[[ "$public_preview_status" == 79 \
   && "$(wc -l <"$public_serving_calls" | tr -d '[:space:]')" == 3 ]]
if grep -Fv ':32947/' "$public_serving_calls" | grep -q .; then
  echo 'Backstage serving proof used a non-canonical public endpoint' >&2
  exit 1
fi
grep -Fxq 'https://resonance.172.16.1.232.nip.io:32947/signin/loginView' "$public_serving_calls"
unset -f verify_backstage_public_serving_plane backstage_rollback_fail curl

helper_fixture="$runtime_config_fixture/target-helper"
helper_repo="$helper_fixture/repo"
helper_snapshot="$helper_fixture/private"
mkdir -p "$helper_repo/ops/scripts" "$helper_snapshot"
chmod 0700 "$helper_snapshot"
git -C "$helper_repo" init -q
git -C "$helper_repo" config user.name helper-test
git -C "$helper_repo" config user.email helper-test@example.invalid
cat >"$helper_repo/ops/scripts/resonance-backstage-deploy.sh" <<'SH'
#!/usr/bin/env bash
printf 'A:%s\n' "$*" >>"${HELPER_EXEC_LOG:?}"
SH
git -C "$helper_repo" add .
git -C "$helper_repo" commit -qm helper-a
helper_a="$(git -C "$helper_repo" rev-parse HEAD)"
cat >"$helper_repo/ops/scripts/resonance-backstage-deploy.sh" <<'SH'
#!/usr/bin/env bash
printf 'B:%s\n' "$*" >>"${HELPER_EXEC_LOG:?}"
SH
git -C "$helper_repo" add .
git -C "$helper_repo" commit -qm helper-b
helper_b="$(git -C "$helper_repo" rev-parse HEAD)"
helper_b_sha="$(git -C "$helper_repo" show "$helper_b:ops/scripts/resonance-backstage-deploy.sh" | sha256sum | awk '{print $1}')"
git -C "$helper_repo" checkout -q "$helper_a"
helper_functions="$helper_fixture/functions.sh"
sed -n \
  '/^resolve_target_backstage_deploy_helper() {/,/^reconcile_pending_backstage_deployment_after_authority_recovery() {/p' \
  "$AUTO_DEPLOY" | sed '$d' >"$helper_functions"
# shellcheck disable=SC1090
source "$helper_functions"
unset BACKSTAGE_EXPECTED_PENDING_SHA256 || true
POLICY_ROOT="$helper_repo"
ROOT_DIR="$helper_repo"
target_commit="$helper_b"
CARBONET_DEPLOY_SNAPSHOT_PATH="$helper_snapshot/auto-deploy-main.sh"
: >"$CARBONET_DEPLOY_SNAPSHOT_PATH"
BACKSTAGE_DEPLOY_HELPER_EXPLICIT=false
BACKSTAGE_DEPLOY_HELPER="$helper_repo/ops/scripts/resonance-backstage-deploy.sh"
BACKSTAGE_DEPLOY_HELPER_SHA256=""
BACKSTAGE_DEPLOY_STATE_FILE="$helper_fixture/backstage.marker"
BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="$helper_fixture/state"
BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$helper_fixture/state/pending.json"
mkdir -p "$BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR"
HELPER_EXEC_LOG="$helper_fixture/executed.log"
export HELPER_EXEC_LOG
: >"$HELPER_EXEC_LOG"
run_target_backstage_deploy_helper status
[[ "$(cat "$HELPER_EXEC_LOG")" == B:status ]]
[[ "$(stat -c '%a:%u' "$BACKSTAGE_DEPLOY_HELPER")" == "700:$(id -u)" ]]
[[ "$(sha256sum "$BACKSTAGE_DEPLOY_HELPER" | awk '{print $1}')" == "$helper_b_sha" ]]
# A non-explicit tamper is repaired from the exact target blob before execute;
# neither the checked-out A helper nor the tampered bytes may run.
printf '%s\n' '# tampered' >"$BACKSTAGE_DEPLOY_HELPER"
run_target_backstage_deploy_helper recover-pending
[[ "$(cat "$HELPER_EXEC_LOG")" == $'B:status\nB:recover-pending' ]]
[[ "$(sha256sum "$BACKSTAGE_DEPLOY_HELPER" | awk '{print $1}')" == "$helper_b_sha" ]]
# An explicit helper with the wrong declared hash, and a public materialization
# directory, are both rejected before execution.
BACKSTAGE_DEPLOY_HELPER_EXPLICIT=true
BACKSTAGE_DEPLOY_HELPER_SHA256="$(printf wrong | sha256sum | awk '{print $1}')"
set +e
run_target_backstage_deploy_helper status >/dev/null 2>&1
explicit_wrong_status="$?"
set -e
[[ "$explicit_wrong_status" == 79 ]]
BACKSTAGE_DEPLOY_HELPER_EXPLICIT=false
BACKSTAGE_DEPLOY_HELPER="$helper_repo/ops/scripts/resonance-backstage-deploy.sh"
BACKSTAGE_DEPLOY_HELPER_SHA256=""
rm -f -- "$helper_snapshot/resonance-backstage-deploy.sh"
chmod 0755 "$helper_snapshot"
set +e
resolve_target_backstage_deploy_helper >/dev/null 2>&1
public_snapshot_status="$?"
set -e
[[ "$public_snapshot_status" == 79 ]]
[[ "$(cat "$HELPER_EXEC_LOG")" == $'B:status\nB:recover-pending' ]]
chmod 0700 "$helper_snapshot"
unset -f resolve_target_backstage_deploy_helper run_target_backstage_deploy_helper

runtime_config_function="$runtime_config_fixture/function.sh"
sed -n \
  '/^verify_frontend_auth_runtime_config() {/,/^wait_for_catalog() {/p' \
  "$DEPLOY" | sed '$d' >"$runtime_config_function"
# shellcheck disable=SC1090
source "$runtime_config_function"
CURL_TLS_ARGS=()
BACKSTAGE_URL=https://backstage.invalid
curl() {
  cat -- "$RUNTIME_CONFIG_HTML_FIXTURE"
}
cat >"$runtime_config_fixture/oidc.html" <<'HTML'
<html><script type="backstage.io/config">[{"context":"app-config.production.yaml","data":{"app":{"resonanceOidcEnabled":false}}},{"context":"app-config.oidc.yaml","data":{"app":{"resonanceOidcEnabled":true,"resonanceOidcDisplayName":"Resonance account"}}}]</script></html>
HTML
OIDC_READY=true RUNTIME_CONFIG_HTML_FIXTURE="$runtime_config_fixture/oidc.html" \
  verify_frontend_auth_runtime_config >"$runtime_config_fixture/oidc.out"
cat >"$runtime_config_fixture/missing.html" <<'HTML'
<html><script type="backstage.io/config">[{"context":"app-config.yaml","data":{"app":{"title":"Resonance Control Plane"}}}]</script></html>
HTML
set +e
OIDC_READY=true RUNTIME_CONFIG_HTML_FIXTURE="$runtime_config_fixture/missing.html" \
  verify_frontend_auth_runtime_config >"$runtime_config_fixture/missing.out" \
    2>"$runtime_config_fixture/missing.err"
runtime_config_missing_status="$?"
set -e
[[ "$runtime_config_missing_status" == 1 ]]
grep -Fq 'frontend OIDC runtime config is missing or inconsistent' \
  "$runtime_config_fixture/missing.err"
cat >"$runtime_config_fixture/object.html" <<'HTML'
<html><script type="backstage.io/config">{"app":{"resonanceOidcEnabled":true,"resonanceOidcDisplayName":"Resonance account"}}</script></html>
HTML
set +e
OIDC_READY=true RUNTIME_CONFIG_HTML_FIXTURE="$runtime_config_fixture/object.html" \
  verify_frontend_auth_runtime_config >"$runtime_config_fixture/object.out" \
    2>"$runtime_config_fixture/object.err"
runtime_config_object_status="$?"
set -e
[[ "$runtime_config_object_status" == 1 ]]
grep -Fq 'frontend OIDC runtime config is missing or inconsistent' \
  "$runtime_config_fixture/object.err"
cat >"$runtime_config_fixture/guest.html" <<'HTML'
<html><script type="backstage.io/config">[{"context":"app-config.oidc.yaml","data":{"app":{"resonanceOidcEnabled":true,"resonanceOidcDisplayName":"Resonance account"}}},{"context":"operator-override","data":{"app":{"resonanceOidcEnabled":false}}}]</script></html>
HTML
OIDC_READY=false RUNTIME_CONFIG_HTML_FIXTURE="$runtime_config_fixture/guest.html" \
  verify_frontend_auth_runtime_config >"$runtime_config_fixture/guest.out"
cat >"$runtime_config_fixture/multiple.html" <<'HTML'
<html><script type="backstage.io/config">[{"context":"app-config.oidc.yaml","data":{"app":{"resonanceOidcEnabled":true,"resonanceOidcDisplayName":"Resonance account"}}}]</script><script type="backstage.io/config">[{"context":"operator-override","data":{"app":{"resonanceOidcEnabled":false}}}]</script></html>
HTML
OIDC_READY=false RUNTIME_CONFIG_HTML_FIXTURE="$runtime_config_fixture/multiple.html" \
  verify_frontend_auth_runtime_config >"$runtime_config_fixture/multiple.out"
unset -f curl verify_frontend_auth_runtime_config

schema_function="$runtime_config_fixture/schema-function.sh"
sed -n \
  '/^verify_oidc_frontend_schema_json() {/,/^install_backstage_dependencies() {/p' \
  "$DEPLOY" | sed '$d' >"$schema_function"
# shellcheck disable=SC1090
source "$schema_function"
schema_app="$runtime_config_fixture/schema-app"
schema_dist="$schema_app/packages/app/dist"
schema_bundle_dist="$schema_app/packages/backend/dist"
mkdir -p "$schema_dist" "$schema_bundle_dist"
printf '%s\n' '{"name":"root"}' >"$schema_app/package.json"
cat >"$schema_dist/.config-schema.json" <<'JSON'
{"schemas":[{"packageName":"root","value":{"properties":{"app":{"properties":{"resonanceOidcEnabled":{"type":"boolean","visibility":"frontend"},"resonanceOidcDisplayName":{"type":"string","visibility":"frontend"}}}}}}]}
JSON
tar -czf "$schema_bundle_dist/bundle.tar.gz" \
  -C "$schema_app" packages/app/dist/.config-schema.json
APP="$schema_app" verify_backstage_frontend_schema_artifacts \
  >"$runtime_config_fixture/schema-valid.out"
cat >"$schema_dist/.config-schema.json" <<'JSON'
{"schemas":[{"packageName":"root","value":{"properties":{"app":{"properties":{"resonanceOidcEnabled":{"type":"boolean","visibility":"frontend"},"resonanceOidcDisplayName":{"type":"string","visibility":"frontend"}}}}}},{"packageName":"duplicate","value":{"properties":{"app":{"properties":{"resonanceOidcEnabled":{"type":"boolean","visibility":"frontend"}}}}}}]}
JSON
set +e
APP="$schema_app" verify_backstage_frontend_schema_artifacts \
  >"$runtime_config_fixture/schema-duplicate.out" \
  2>"$runtime_config_fixture/schema-duplicate.err"
schema_duplicate_status="$?"
set -e
[[ "$schema_duplicate_status" == 1 ]]
grep -Fq 'OIDC frontend schema artifact is missing or invalid' \
  "$runtime_config_fixture/schema-duplicate.err"
cat >"$schema_dist/.config-schema.json" <<'JSON'
{"schemas":[{"packageName":"app","value":{"properties":{"app":{"properties":{"resonanceOidcEnabled":{"type":"boolean","visibility":"frontend"},"resonanceOidcDisplayName":{"type":"string","visibility":"frontend"}}}}}}]}
JSON
set +e
APP="$schema_app" verify_backstage_frontend_schema_artifacts \
  >"$runtime_config_fixture/schema-wrong-package.out" \
  2>"$runtime_config_fixture/schema-wrong-package.err"
schema_wrong_package_status="$?"
set -e
[[ "$schema_wrong_package_status" == 1 ]]
grep -Fq 'OIDC frontend schema artifact is missing or invalid' \
  "$runtime_config_fixture/schema-wrong-package.err"
cat >"$schema_dist/.config-schema.json" <<'JSON'
{"schemas":[{"packageName":"root","value":{"properties":{"app":{"properties":{"resonanceOidcEnabled":{"type":"boolean","visibility":"frontend"},"resonanceOidcDisplayName":{"type":"string","visibility":"frontend"}}}}}}]}
JSON
schema_bad_bundle="$runtime_config_fixture/schema-bad-bundle"
mkdir -p "$schema_bad_bundle/packages/app/dist"
cat >"$schema_bad_bundle/packages/app/dist/.config-schema.json" <<'JSON'
{"schemas":[]}
JSON
tar -czf "$schema_bundle_dist/bundle.tar.gz" \
  -C "$schema_bad_bundle" packages/app/dist/.config-schema.json
set +e
APP="$schema_app" verify_backstage_frontend_schema_artifacts \
  >"$runtime_config_fixture/schema-bundle.out" \
  2>"$runtime_config_fixture/schema-bundle.err"
schema_bundle_status="$?"
set -e
[[ "$schema_bundle_status" == 1 ]]
grep -Fq 'bundled OIDC frontend schema artifact is missing or invalid' \
  "$runtime_config_fixture/schema-bundle.err"
unset -f verify_oidc_frontend_schema_json verify_backstage_frontend_schema_artifacts
rm -rf -- "$runtime_config_fixture"

lock_fixture="$(mktemp -d)"
mkdir -m 0700 "$lock_fixture/state"
lock_functions="$lock_fixture/auto-lock-functions.sh"
sed -n \
  '/^acquire_backstage_deployment_mutation_lock() {/,/^}/p; /^release_backstage_deployment_mutation_lock() {/,/^}/p; /^acquire_clean_backstage_deployment_mutation_lock() {/,/^}/p' \
  "$AUTO_DEPLOY" >"$lock_functions"
(
  # shellcheck disable=SC1090
  source "$lock_functions"
  BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$lock_fixture/state/deployment-rollback.pending.json"
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_WAIT_SECONDS=1
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD=""
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=false
  acquire_backstage_deployment_mutation_lock
  : >"$lock_fixture/holder.ready"
  # Keep the lock in the holder shell only; supported systemd execution kills
  # the whole cgroup, while this focused mutant terminates just that holder.
  sleep 30 {BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD}<&-
) &
lock_holder_pid="$!"
for _ in $(seq 1 100); do
  [[ -e "$lock_fixture/holder.ready" ]] && break
  sleep 0.01
done
[[ -e "$lock_fixture/holder.ready" ]]
set +e
(
  # shellcheck disable=SC1090
  source "$lock_functions"
  BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$lock_fixture/state/deployment-rollback.pending.json"
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_WAIT_SECONDS=1
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD=""
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=false
  acquire_backstage_deployment_mutation_lock
) >"$lock_fixture/contender.out" 2>"$lock_fixture/contender.err"
lock_contender_status="$?"
set -e
[[ "$lock_contender_status" == 79 ]]
kill -KILL "$lock_holder_pid" 2>/dev/null || true
wait "$lock_holder_pid" 2>/dev/null || true
(
  # shellcheck disable=SC1090
  source "$lock_functions"
  BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$lock_fixture/state/deployment-rollback.pending.json"
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_WAIT_SECONDS=1
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD=""
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=false
  acquire_backstage_deployment_mutation_lock
  release_backstage_deployment_mutation_lock
)

# Catalog changes have no raw supported writer: even a forced legacy planner
# token returns 79 with kubectl mutation 0. The remaining self-heal writer must
# still reject a durable pending baseline after acquiring the shared lock.
writer_functions="$lock_fixture/auto-writer-functions.sh"
{
  sed -n \
    '/^acquire_backstage_deployment_mutation_lock() {/,/^recover_pending_backstage_deployment_after_target_merge() {/p' \
    "$AUTO_DEPLOY" | sed '$d'
  sed -n \
    '/^backstage_actor_process_readiness_status() {/,/^run_serialized_carbonet_actor_process_e2e_job() {/p' \
    "$AUTO_DEPLOY" | sed '$d'
  sed -n \
    '/^sync_backstage_catalog_if_required() {/,/^# The standard build/p' \
    "$AUTO_DEPLOY" | sed '$d'
} >"$writer_functions"
mkdir -p "$lock_fixture/bin"
cat >"$lock_fixture/bin/kubectl" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$FAKE_BACKSTAGE_KUBECTL_CALLS"
exit 0
SH
cat >"$lock_fixture/bin/curl" <<'SH'
#!/usr/bin/env bash
printf '503'
SH
chmod +x "$lock_fixture/bin/kubectl" "$lock_fixture/bin/curl"
: >"$lock_fixture/kubectl.calls"
set +e
PATH="$lock_fixture/bin:$PATH" \
FAKE_BACKSTAGE_KUBECTL_CALLS="$lock_fixture/kubectl.calls" \
BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$lock_fixture/state/deployment-rollback.pending.json" \
BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE="$lock_fixture/state/repair-authority.json" \
BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_WAIT_SECONDS=1 \
BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD= BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=false \
ROOT_DIR="$ROOT" PLAN_TESTS=backstage:catalog-sync PLAN_BACKSTAGE_REQUIRED=false \
bash -c 'set -euo pipefail; source "$1"; sync_backstage_catalog_if_required' \
  _ "$writer_functions" >"$lock_fixture/catalog-pending.out" 2>"$lock_fixture/catalog-pending.err"
catalog_pending_status="$?"
printf '{"kind":"BackstageDeploymentRollbackPending"}\n' >"$lock_fixture/state/deployment-rollback.pending.json"
chmod 0600 "$lock_fixture/state/deployment-rollback.pending.json"
PATH="$lock_fixture/bin:$PATH" \
FAKE_BACKSTAGE_KUBECTL_CALLS="$lock_fixture/kubectl.calls" \
BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="$lock_fixture/state/deployment-rollback.pending.json" \
BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE="$lock_fixture/state/repair-authority.json" \
BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_WAIT_SECONDS=1 \
BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD= BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=false \
RESONANCE_BACKSTAGE_SELF_HEAL_TIMEOUT_SECONDS=1 \
RESONANCE_BACKSTAGE_SELF_HEAL_PRECHECK_ATTEMPTS=1 \
RESONANCE_BACKSTAGE_SELF_HEAL_READINESS_ATTEMPTS=1 \
RESONANCE_BACKSTAGE_SELF_HEAL_HTTP_TIMEOUT_SECONDS=1 \
RESONANCE_BACKSTAGE_SELF_HEAL_RETRY_DELAY_SECONDS=0 \
bash -c 'set -euo pipefail; source "$1"; ensure_backstage_actor_process_e2e_ready' \
  _ "$writer_functions" >"$lock_fixture/selfheal-pending.out" 2>"$lock_fixture/selfheal-pending.err"
selfheal_pending_status="$?"
set -e
[[ "$catalog_pending_status" == 79 && "$selfheal_pending_status" == 79 ]]
[[ ! -s "$lock_fixture/kubectl.calls" ]]
[[ -f "$lock_fixture/state/deployment-rollback.pending.json" ]]
grep -Fq 'legacy raw Backstage catalog mutation' "$lock_fixture/catalog-pending.err"
grep -Fq 'pending rollback must recover first' "$lock_fixture/selfheal-pending.err"

# The earliest no-change success proof is read-only but operationally complete:
# a self-consistent UID/annotation/ledger tuple cannot hide PodTemplate drift or
# an unavailable replica. Both mutants stop before any success cleanup/marker
# mutation; the fully coherent control reaches the terminal cleanup sequence.
early_ledger_function="$lock_fixture/early-ledger-function.sh"
sed -n \
  '/^verify_semantic_success_operational_usage_ledger_identity() {/,/^recover_flyway_cleanup_hold_if_present() {/p' \
  "$AUTO_DEPLOY" | sed '$d' >"$early_ledger_function"
early_initial_ledger_clause="$(sed -n \
  '/case "$no_change_backstage_status" in/,/^      esac$/p' "$AUTO_DEPLOY")"
early_commit=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
early_image=registry.invalid/runtime@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
early_image_id=sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
early_template="$(jq -nc --arg image "$early_image" '
  {metadata:{labels:{app:"runtime"}},spec:{containers:[
    {name:"carbonet-runtime",image:$image,env:[{name:"SAFE",value:"1"}]}
  ]}}
')"
early_template_hash="$(jq -cS . <<<"$early_template" | sha256sum | awk '{print $1}')"
early_deployment_json="$(jq -nc \
  --arg commit "$early_commit" --arg templateHash "$early_template_hash" \
  --argjson template "$early_template" '
  {metadata:{resourceVersion:"41",uid:"runtime-uid",generation:7,annotations:{
      "resonance.ai/target-commit":$commit,
      "resonance.ai/runtime-template-sha256":$templateHash}},
   spec:{replicas:1,selector:{matchLabels:{app:"runtime"}},template:$template},
   status:{observedGeneration:7,updatedReplicas:1,readyReplicas:1,
     availableReplicas:1,unavailableReplicas:0}}
')"
early_ledger_rows="$(jq -nc \
  --arg commit "$early_commit" --arg image "$early_image" \
  --arg imageId "$early_image_id" --arg templateHash "$early_template_hash" '
  [{sourceCommit:$commit,deploymentNamespace:"runtime-ns",
    deploymentName:"runtime-deployment",deploymentUid:"runtime-uid",
    deploymentGeneration:7,observedGeneration:7,desiredReplicas:1,
    imageRef:$image,imageId:$imageId,podTemplateSha256:$templateHash,
    healthStatus:"UP"}]
')"
early_pods_json="$(jq -nc --arg image "$early_image" --arg imageId "$early_image_id" '
  {items:[{metadata:{name:"runtime-0",deletionTimestamp:null},
    spec:{containers:[{name:"carbonet-runtime",image:$image}]},
    status:{phase:"Running",conditions:[{type:"Ready",status:"True"}],
      containerStatuses:[{name:"carbonet-runtime",ready:true,imageID:$imageId}]}}]}
')"
printf '%s\n' "$early_commit" >"$lock_fixture/runtime.marker"
early_marker_sha="$(sha256sum "$lock_fixture/runtime.marker" | awk '{print $1}')"
early_success_mutations="$lock_fixture/early-success-mutations.log"
for early_ledger_case in normal template-drift ready-zero; do
  : >"$early_success_mutations"
  case "$early_ledger_case" in
    normal)
      early_case_deployment="$early_deployment_json"
      early_expected_status=0
      ;;
    template-drift)
      early_case_deployment="$(jq -c \
        '.spec.template.spec.containers[0].env[0].value="drift"' \
        <<<"$early_deployment_json")"
      early_expected_status=79
      ;;
    ready-zero)
      early_case_deployment="$(jq -c \
        '.status.readyReplicas=0 | .status.availableReplicas=0 |
         .status.unavailableReplicas=1' <<<"$early_deployment_json")"
      early_expected_status=79
      ;;
  esac
  set +e
  (
    # shellcheck disable=SC1090
    source "$early_ledger_function"
    NAMESPACE=runtime-ns
    DEPLOYMENT=runtime-deployment
    RUNTIME_DEPLOY_STATE_FILE="$lock_fixture/runtime.marker"
    POSTGRES_POD=runtime-postgres-0
    POSTGRES_CONTAINER=postgres
    POSTGRES_USER=postgres
    POSTGRES_DB=runtime
    CARBONET_K8S_CONTAINER=carbonet-runtime
    deployed_commit="$early_commit"
    no_change_backstage_status=0
    DEPLOY_STARTED_EPOCH_MILLISECONDS=0
    DEPLOY_PHASE_FILE="$lock_fixture/early.phase"
    CARBONET_DEPLOY_SNAPSHOT_PATH="$lock_fixture/early.snapshot"
    resolve_postdeploy_postgres_pod() { :; }
    timeout() {
      shift
      "$@"
    }
    kubectl() {
      case " $* " in
        *' get deployment/runtime-deployment -o json '*)
          printf '%s\n' "$early_case_deployment"
          ;;
        *' get pods -l app=runtime -o json '*)
          printf '%s\n' "$early_pods_json"
          ;;
        *' exec -i runtime-postgres-0 '*)
          cat >/dev/null
          printf '%s\n' "$early_ledger_rows"
          ;;
        *' exec runtime-0 '*)
          printf '%s\n' '{"status":"UP"}'
          ;;
        *)
          return 1
          ;;
      esac
    }
    monotonic_milliseconds() { printf '1\n'; }
    clear_no_change_runtime_checkpoint_if_present() {
      printf 'clear-checkpoint\n' >>"$early_success_mutations"
    }
    terminal_deploy_recovery_residue_absent() {
      printf 'terminal-proof\n' >>"$early_success_mutations"
    }
    rm() {
      printf 'success-rm\n' >>"$early_success_mutations"
    }
    eval "$early_initial_ledger_clause"
    exit 99
  ) >"$lock_fixture/early-$early_ledger_case.out" \
    2>"$lock_fixture/early-$early_ledger_case.err"
  early_case_status="$?"
  set -e
  [[ "$early_case_status" == "$early_expected_status" ]]
  [[ "$(sha256sum "$lock_fixture/runtime.marker" | awk '{print $1}')" == \
     "$early_marker_sha" ]]
  if [[ "$early_ledger_case" == normal ]]; then
    [[ "$(cat "$early_success_mutations")" == \
       $'clear-checkpoint\nterminal-proof\nsuccess-rm' ]]
  else
    [[ ! -s "$early_success_mutations" ]]
  fi
done

# The conditional ledger E2E may legitimately select zero tests. Terminal
# automation success still re-reads the exact ledger before marker publication;
# ledger0 and UID drift both return79 with markerWrite=0.
automation_branch="$(sed -n \
  '/^if automation_only_fast_path_eligible; then/,/^# Source catalog closure/p' \
  "$AUTO_DEPLOY" | sed '$d')"
automation_marker_calls="$lock_fixture/automation-marker.calls"
for automation_ledger_case in ledger0 uid-drift normal; do
  : >"$automation_marker_calls"
  AUTOMATION_LEDGER_STATUS=79
  [[ "$automation_ledger_case" != normal ]] || AUTOMATION_LEDGER_STATUS=0
  set +e
  (
    PLAN_TESTS=automation:shell-syntax
    ROOT_DIR="$ROOT"
    live_frontend_overlay="$lock_fixture/overlay"
    FULL_SCREEN_GATE_STATE_DIR="$lock_fixture/automation-gate"
    runtime_deployed_commit=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
    deployed_commit="$runtime_deployed_commit"
    target_commit=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
    mkdir -p "$live_frontend_overlay" "$FULL_SCREEN_GATE_STATE_DIR"
    automation_only_fast_path_eligible() { return 0; }
    bash() { return 0; }
    node() { return 0; }
    curl() { printf '%s' '{"status":"UP"}'; }
    run_screen_contract_runtime_save_gate_if_required() { :; }
    run_actor_process_role_e2e_if_required() { :; }
    run_operational_usage_ledger_current_runtime_e2e_if_required() { :; }
    verify_operational_usage_ledger_current_runtime_identity() {
      return "$AUTOMATION_LEDGER_STATUS"
    }
    write_applied_deploy_state() { printf '%s\n' "$1" >>"$automation_marker_calls"; }
    prove_backstage_terminal_success() { :; }
    record_deploy_phase() { :; }
    record_deploy_performance() { :; }
    eval "$automation_branch"
  ) >/dev/null 2>&1
  automation_ledger_status="$?"
  set -e
  if [[ "$automation_ledger_case" == normal ]]; then
    [[ "$automation_ledger_status" == 0 \
       && "$(cat "$automation_marker_calls")" == \
          aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ]]
  else
    [[ "$automation_ledger_status" == 79 && ! -s "$automation_marker_calls" ]]
  fi
done

# Execute the four formerly uncovered terminal clauses directly from the parent
# source. Each ledger0 mutant must return79; the same clause with proof=0 must
# retain its normal success, so this is control-flow evidence rather than a
# static token check.
initial_ledger_clause="$(sed -n \
  '/case "$no_change_backstage_status" in/,/^      esac$/p' "$AUTO_DEPLOY")"
for terminal_ledger_status in 79 0; do
  set +e
  (
    no_change_backstage_status=0
    deployed_commit=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
    DEPLOY_STARTED_EPOCH_MILLISECONDS=0
    DEPLOY_PHASE_FILE="$lock_fixture/initial.phase"
    monotonic_milliseconds() { printf '1\n'; }
    verify_semantic_success_operational_usage_ledger_identity() {
      return "$terminal_ledger_status"
    }
    clear_no_change_runtime_checkpoint_if_present() { :; }
    terminal_deploy_recovery_residue_absent() { :; }
    eval "$initial_ledger_clause"
    exit 99
  ) >/dev/null 2>&1
  initial_ledger_status="$?"
  set -e
  [[ "$initial_ledger_status" == "$terminal_ledger_status" ]]
done

prepared_ledger_clause="$(sed -n \
  '/^    if \[\[ "$postdeploy_recovered_commit" == "$target_commit"/,/^    # Remote B may arrive/p' \
  "$AUTO_DEPLOY" | sed '$d')"
prepared_activation_calls="$lock_fixture/prepared-activation.calls"
for terminal_ledger_status in 79 0; do
  : >"$prepared_activation_calls"
  set +e
  (
    target_commit=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
    postdeploy_recovered_commit="$target_commit"
    no_change_backstage_repair_required=false
    early_composite_gate_status=PREPARED
    early_composite_gate_candidate=postdeploy:prepared-ledger-fixture
    ROOT_DIR="$ROOT"
    DEPLOY_PHASE_FILE="$lock_fixture/prepared.phase"
    acquire_clean_backstage_deployment_mutation_lock() { :; }
    terminal_deploy_recovery_residue_absent() { :; }
    verify_backstage_runtime_identity_for_ref_under_lock() { :; }
    verify_operational_usage_ledger_current_runtime_identity() {
      return "$terminal_ledger_status"
    }
    record_deploy_performance() { :; }
    bash() { printf '%s\n' "$*" >>"$prepared_activation_calls"; }
    eval "$prepared_ledger_clause"
    exit 99
  ) >/dev/null 2>&1
  prepared_ledger_status="$?"
  set -e
  [[ "$prepared_ledger_status" == "$terminal_ledger_status" ]]
  if [[ "$terminal_ledger_status" == 79 ]]; then
    [[ ! -s "$prepared_activation_calls" ]]
  else
    [[ "$(wc -l <"$prepared_activation_calls" | tr -d '[:space:]')" == 1 ]]
  fi
done

recovery_only_ledger_clause="$(awk '
  /^if \[\[ "\$\{CARBONET_RECOVERY_ONLY:-false\}" == true \]\]; then/ {
    capture=1
    block=$0
    next
  }
  capture && /^# Identity-design changes are evaluated/ {
    selected=block
    capture=0
    next
  }
  capture { block=block ORS $0 }
  END { printf "%s", selected }
' "$AUTO_DEPLOY")"
for terminal_ledger_status in 79 0; do
  set +e
  (
    CARBONET_RECOVERY_ONLY=true
    deployed_commit=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
    DEPLOY_PHASE_FILE="$lock_fixture/recovery-only.phase"
    acquire_clean_backstage_deployment_mutation_lock() { :; }
    retire_recovery_only_prepared_checkpoint_if_safe() { :; }
    terminal_deploy_recovery_residue_absent() { :; }
    verify_operational_usage_ledger_current_runtime_identity() {
      return "$terminal_ledger_status"
    }
    write_postdeploy_promotion_quarantine() { :; }
    verify_backstage_runtime_identity_for_ref_under_lock() { :; }
    record_deploy_performance() { :; }
    eval "$recovery_only_ledger_clause"
    exit 99
  ) >/dev/null 2>&1
  recovery_only_ledger_status="$?"
  set -e
  [[ "$recovery_only_ledger_status" == "$terminal_ledger_status" ]]
done

catalog_ledger_clause="$(sed -n \
  '/^  write_applied_deploy_state_with_backstage_binding "$target_commit"/,/^  exit 0$/p' \
  "$AUTO_DEPLOY")"
for terminal_ledger_status in 79 0; do
  set +e
  (
    target_commit=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
    runtime_deployed_commit=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
    PLAN_BACKSTAGE_REQUIRED=false
    write_applied_deploy_state_with_backstage_binding() { :; }
    finalize_backstage_deployment_after_release_success() { :; }
    prove_backstage_terminal_success() { :; }
    verify_operational_usage_ledger_current_runtime_identity() {
      return "$terminal_ledger_status"
    }
    record_deploy_phase() { :; }
    record_deploy_performance() { :; }
    eval "$catalog_ledger_clause"
    exit 99
  ) >/dev/null 2>&1
  catalog_ledger_status="$?"
  set -e
  [[ "$catalog_ledger_status" == "$terminal_ledger_status" ]]
done
if grep -Fq "awk '/^Driver:/ {print \$2; exit}'" "$DEPLOY"; then
  echo "buildx capability detection must not trigger SIGPIPE under pipefail" >&2
  exit 1
fi

# Build one exact v4 pending/v3 runtime-identity pair, then mutate every field
# that authorizes the narrow /system-operations route. The pure tuple predicate
# must fail even when each mutant recomputes its own integrity digest.
proof_fixture="$(mktemp -d)"
proof_functions="$proof_fixture/unchanged-serving-proof-functions.sh"
sed -n \
  '/^read_secure_backstage_json_file_under_lock() {/,/^derive_backstage_e2e_routes() {/p' \
  "$AUTO_DEPLOY" | sed '$d' >"$proof_functions"
# shellcheck disable=SC1090
source "$proof_functions"
proof_target=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
proof_deployed=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
proof_fingerprint="$(printf '%064d' 0 | tr 0 f)"
proof_target_deployment_closure="$(printf '%064d' 0 | tr 0 d)"
proof_deployed_deployment_closure="$(printf '%064d' 0 | tr 0 e)"
proof_content_sha="$(printf '%064d' 0 | tr 0 c)"
proof_empty_payload_sha="$(printf '{}' | sha256sum | awk '{print $1}')"
proof_image=registry.local/resonance-backstage@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
proof_spec="$(jq -cnS --arg image "$proof_image" '{replicas:1,
  selector:{matchLabels:{"app.kubernetes.io/name":"resonance-backstage"}},
  template:{metadata:{labels:{"app.kubernetes.io/name":"resonance-backstage"}},
    spec:{containers:[{name:"backstage",image:$image}]}}}')"
proof_spec_sha="$(printf '%s' "$proof_spec" | sha256sum | awk '{print $1}')"
proof_resources="$(jq -cnS --arg h "$proof_empty_payload_sha" '
  def s($kind;$name): {exists:true,kind:$kind,name:$name,uid:("uid-"+$name),
    resourceVersion:"17",payload:{},payloadSha256:$h};
  {"ConfigMap/resonance-backstage-catalog":s("ConfigMap";"resonance-backstage-catalog"),
   "ConfigMap/resonance-backstage-config":s("ConfigMap";"resonance-backstage-config"),
   "NetworkPolicy/resonance-backstage-ingress":s("NetworkPolicy";"resonance-backstage-ingress"),
   "Service/resonance-backstage":s("Service";"resonance-backstage"),
   "Service/resonance-backstage-catalog":s("Service";"resonance-backstage-catalog")}
')"
proof_intents="$(jq -cS '
  with_entries(.value |= {exists:.exists,kind:.kind,name:.name,payload:.payload,payloadSha256:.payloadSha256})
' <<<"$proof_resources")"
proof_dependencies="$(jq -cnS --arg h "$proof_content_sha" '
  def d($kind;$name): {kind:$kind,name:$name,uid:("uid-"+$name),contentSha256:$h};
  {"ConfigMap/resonance-internal-ca":d("ConfigMap";"resonance-internal-ca"),
   "Ingress/backstage":d("Ingress";"backstage"),
   "Ingress/preview":d("Ingress";"preview"),
   "Secret/carbonet-prod/resonance-ops-bridge":d("Secret";"carbonet-prod/resonance-ops-bridge"),
   "Secret/carbonet-prod/resonance-preview-tls":d("Secret";"carbonet-prod/resonance-preview-tls"),
   "Secret/resonance-backstage-auth":d("Secret";"resonance-backstage-auth"),
   "Secret/resonance-backstage-database":d("Secret";"resonance-backstage-database"),
   "Secret/resonance-backstage-tls":d("Secret";"resonance-backstage-tls"),
   "Secret/resonance-ops-bridge":d("Secret";"resonance-ops-bridge"),
   "Secret/resonance-runtime-purge-recovery":d("Secret";"resonance-runtime-purge-recovery"),
   "Service/ingress-nginx-controller":d("Service";"ingress-nginx-controller")}
')"
proof_dependency_closure="$(printf '%s' "$proof_dependencies" | sha256sum | awk '{print $1}')"
proof_resource_closure_payload="$(jq -cS '
  to_entries | map({resourceKey:.key,kind:.value.kind,name:.value.name,
    uid:.value.uid,payloadSha256:.value.payloadSha256}) | sort_by(.resourceKey)
' <<<"$proof_resources")"
proof_resource_closure="$(printf '%s' "$proof_resource_closure_payload" | sha256sum | awk '{print $1}')"
seal_proof_json() {
  local payload integrity
  payload="$(jq -cS 'del(.integritySha256)' <<<"$1")" || return 1
  integrity="$(printf '%s' "$payload" | sha256sum | awk '{print $1}')" || return 1
  jq -cS --arg integrity "$integrity" '. + {integritySha256:$integrity}' <<<"$payload"
}
proof_pending_payload="$(jq -cnS \
  --arg target "$proof_target" --arg fingerprint "$proof_fingerprint" \
  --arg deploymentClosure "$proof_target_deployment_closure" --arg image "$proof_image" \
  --arg specSha "$proof_spec_sha" --arg resourceClosure "$proof_resource_closure" \
  --arg dependencyClosure "$proof_dependency_closure" --argjson spec "$proof_spec" \
  --argjson resources "$proof_resources" --argjson intents "$proof_intents" \
  --argjson dependencies "$proof_dependencies" '
  {schemaVersion:4,kind:"BackstageDeploymentRollbackPending",namespace:"resonance-ops",
   deploymentName:"resonance-backstage",targetCommit:$target,authorityKind:"APPLIED_MARKER",
   finalizeMode:"deferred",coordinator:"auto",attemptId:"dddddddddddddddddddddddddddddddd",
   runtimeFingerprint:$fingerprint,deploymentClosureSha256:$deploymentClosure,
   resourceIntents:$intents,runtimeDependencies:$dependencies,phase:"CANDIDATE_READY",
   baseline:{uid:"deployment-uid",resourceVersion:"17",spec:$spec,specSha256:$specSha,
     rollbackSpec:$spec,rollbackSpecSha256:$specSha,resources:$resources},
   plannedDeployment:{spec:$spec,specSha256:$specSha},
   candidate:{image:$image,baselineTagProof:null,spec:$spec,specSha256:$specSha,resources:$resources,
     liveResourceClosureSha256:$resourceClosure,runtimeDependencyClosureSha256:$dependencyClosure}}
')"
proof_pending="$(seal_proof_json "$proof_pending_payload")"
proof_identity_payload="$(jq -cnS \
  --arg target "$proof_deployed" --arg fingerprint "$proof_fingerprint" \
  --arg deploymentClosure "$proof_deployed_deployment_closure" --arg image "$proof_image" \
  --arg specSha "$proof_spec_sha" --arg resourceClosure "$proof_resource_closure" \
  --arg dependencyClosure "$proof_dependency_closure" --argjson dependencies "$proof_dependencies" '
  {schemaVersion:3,targetCommit:$target,attemptId:"cccccccccccccccccccccccccccccccc",
   runtimeFingerprint:$fingerprint,deploymentClosureSha256:$deploymentClosure,
   liveResourceClosureSha256:$resourceClosure,deploymentUid:"deployment-uid",
   candidateImage:$image,candidateSpecSha256:$specSha,runtimeDependencies:$dependencies,
   runtimeDependencyClosureSha256:$dependencyClosure}
')"
proof_identity="$(seal_proof_json "$proof_identity_payload")"
target_commit="$proof_target"
deployed_commit="$proof_deployed"
[[ "$proof_target_deployment_closure" != "$proof_deployed_deployment_closure" ]]
backstage_unchanged_serving_tuple_matches \
  "$proof_pending" "$proof_identity" "$proof_fingerprint" "$proof_fingerprint" \
  "$proof_target_deployment_closure" "$proof_deployed_deployment_closure"

proof_mutants=(
  'P|.runtimeFingerprint=("e"*64)'
  'P|.baseline.spec.replicas=2'
  'P|.baseline.rollbackSpec.replicas=2'
  'P|.baseline.rollbackSpecSha256=("e"*64)'
  'P|.plannedDeployment.spec.replicas=2'
  'P|.candidate.spec.replicas=2'
  'P|.candidate.image="registry.local/foreign:tag"'
  'P|.deploymentClosureSha256=("e"*64)'
  'P|.candidate.liveResourceClosureSha256=("e"*64)'
  'P|del(.runtimeDependencies["Secret/carbonet-prod/resonance-preview-tls"])'
  'P|.candidate.runtimeDependencyClosureSha256=("e"*64)'
  'I|.candidateImage="registry.local/foreign:tag"'
  'I|.candidateSpecSha256=("e"*64)'
  'I|.deploymentUid="foreign-uid"'
)
for proof_mutant in "${proof_mutants[@]}"; do
  proof_side="${proof_mutant%%|*}"
  proof_filter="${proof_mutant#*|}"
  mutant_pending="$proof_pending"
  mutant_identity="$proof_identity"
  if [[ "$proof_side" == P ]]; then
    mutant_pending="$(seal_proof_json "$(jq -cS "$proof_filter" <<<"$proof_pending")")"
  else
    mutant_identity="$(seal_proof_json "$(jq -cS "$proof_filter" <<<"$proof_identity")")"
  fi
  if backstage_unchanged_serving_tuple_matches \
      "$mutant_pending" "$mutant_identity" "$proof_fingerprint" "$proof_fingerprint" \
      "$proof_target_deployment_closure" "$proof_deployed_deployment_closure"; then
    echo "unchanged-serving tuple mutant was accepted: $proof_mutant" >&2
    exit 1
  fi
done

# One release may replace only the live Backstage container image text from
# the mutable fingerprint tag to its registry-proved immutable digest. The v4
# pending receipt binds that pre-mutation tag proof; legacy v2 identity binds
# the exact baseline, and every non-image spec/resource field stays equal.
proof_tag=registry.local/resonance-backstage:ffffffffffff
proof_hold_tag=registry.local/resonance-backstage:rollback-hold-dddddddddddddddddddddddddddddddd
proof_migration_baseline_spec="$(jq -cS --arg tag "$proof_tag" '
  .template.spec.containers |= map(if .name == "backstage" then .image=$tag else . end)
' <<<"$proof_spec")"
proof_migration_baseline_sha="$(printf '%s' "$proof_migration_baseline_spec" |
  sha256sum | awk '{print $1}')"
proof_baseline_tag_proof="$(jq -cnS --arg tag "$proof_tag" --arg holdTag "$proof_hold_tag" \
  --arg digestImage "$proof_image" \
  '{deploymentUid:"deployment-uid",digestImage:$digestImage,holdTag:$holdTag,tag:$tag}')"
proof_migration_pending="$(seal_proof_json "$(jq -cS \
  --argjson baselineSpec "$proof_migration_baseline_spec" \
  --arg baselineSha "$proof_migration_baseline_sha" \
  --argjson baselineTagProof "$proof_baseline_tag_proof" '
    .baseline.spec=$baselineSpec |
    .baseline.specSha256=$baselineSha |
    .candidate.baselineTagProof=$baselineTagProof
  ' <<<"$proof_pending")")"
proof_legacy_dependencies="$(jq -cS 'with_entries(select(.key == "ConfigMap/resonance-internal-ca" or
  .key == "Secret/resonance-backstage-auth" or
  .key == "Secret/resonance-backstage-database" or
  .key == "Secret/resonance-ops-bridge" or
  .key == "Secret/resonance-runtime-purge-recovery"))' <<<"$proof_dependencies")"
proof_legacy_dependency_closure="$(printf '%s' "$proof_legacy_dependencies" |
  sha256sum | awk '{print $1}')"
proof_migration_identity="$(seal_proof_json "$(jq -cS \
  --arg tag "$proof_tag" --arg baselineSha "$proof_migration_baseline_sha" \
  --argjson dependencies "$proof_legacy_dependencies" \
  --arg dependencyClosure "$proof_legacy_dependency_closure" '
    .schemaVersion=2 |
    .candidateImage=$tag |
    .candidateSpecSha256=$baselineSha |
    .runtimeDependencies=$dependencies |
    .runtimeDependencyClosureSha256=$dependencyClosure
  ' <<<"$proof_identity")")"
backstage_unchanged_serving_tuple_matches \
  "$proof_migration_pending" "$proof_migration_identity" \
  "$proof_fingerprint" "$proof_fingerprint" \
  "$proof_target_deployment_closure" "$proof_deployed_deployment_closure" \
  tag-digest-migration
if backstage_unchanged_serving_tuple_matches \
    "$proof_migration_pending" "$proof_migration_identity" \
    "$proof_fingerprint" "$proof_fingerprint" \
    "$proof_target_deployment_closure" "$proof_deployed_deployment_closure" exact; then
  echo 'tag-to-digest migration incorrectly matched the ordinary exact tuple' >&2
  exit 1
fi

migration_registry_mismatch="$(seal_proof_json "$(jq -cS \
  '.candidate.baselineTagProof.digestImage="registry.local/resonance-backstage@sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"' \
  <<<"$proof_migration_pending")")"
if backstage_unchanged_serving_tuple_matches \
    "$migration_registry_mismatch" "$proof_migration_identity" \
    "$proof_fingerprint" "$proof_fingerprint" \
    "$proof_target_deployment_closure" "$proof_deployed_deployment_closure" \
    tag-digest-migration; then
  echo 'foreign registry digest proof incorrectly authorized narrow E2E' >&2
  exit 1
fi
migration_tag_mismatch="$(seal_proof_json "$(jq -cS \
  '.candidate.baselineTagProof.tag="registry.local/resonance-backstage:foreign"' \
  <<<"$proof_migration_pending")")"
if backstage_unchanged_serving_tuple_matches \
    "$migration_tag_mismatch" "$proof_migration_identity" \
    "$proof_fingerprint" "$proof_fingerprint" \
    "$proof_target_deployment_closure" "$proof_deployed_deployment_closure" \
    tag-digest-migration; then
  echo 'foreign baseline tag proof incorrectly authorized narrow E2E' >&2
  exit 1
fi
migration_hold_tag_missing="$(seal_proof_json "$(jq -cS \
  'del(.candidate.baselineTagProof.holdTag)' <<<"$proof_migration_pending")")"
if backstage_unchanged_serving_tuple_matches \
    "$migration_hold_tag_missing" "$proof_migration_identity" \
    "$proof_fingerprint" "$proof_fingerprint" \
    "$proof_target_deployment_closure" "$proof_deployed_deployment_closure" \
    tag-digest-migration; then
  echo 'missing baseline rollback hold tag incorrectly authorized narrow E2E' >&2
  exit 1
fi
migration_hold_tag_foreign="$(seal_proof_json "$(jq -cS \
  '.candidate.baselineTagProof.holdTag="registry.local/resonance-backstage:rollback-hold-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"' \
  <<<"$proof_migration_pending")")"
if backstage_unchanged_serving_tuple_matches \
    "$migration_hold_tag_foreign" "$proof_migration_identity" \
    "$proof_fingerprint" "$proof_fingerprint" \
    "$proof_target_deployment_closure" "$proof_deployed_deployment_closure" \
    tag-digest-migration; then
  echo 'foreign baseline rollback hold tag incorrectly authorized narrow E2E' >&2
  exit 1
fi
migration_env_spec="$(jq -cS \
  '.template.spec.containers |= map(if .name == "backstage" then .env=[{name:"FOREIGN",value:"1"}] else . end)' \
  <<<"$proof_migration_baseline_spec")"
migration_env_sha="$(printf '%s' "$migration_env_spec" | sha256sum | awk '{print $1}')"
migration_env_pending="$(seal_proof_json "$(jq -cS \
  --argjson spec "$migration_env_spec" --arg specSha "$migration_env_sha" \
  '.baseline.spec=$spec | .baseline.specSha256=$specSha' \
  <<<"$proof_migration_pending")")"
migration_env_identity="$(seal_proof_json "$(jq -cS --arg specSha "$migration_env_sha" \
  '.candidateSpecSha256=$specSha' <<<"$proof_migration_identity")")"
if backstage_unchanged_serving_tuple_matches \
    "$migration_env_pending" "$migration_env_identity" \
    "$proof_fingerprint" "$proof_fingerprint" \
    "$proof_target_deployment_closure" "$proof_deployed_deployment_closure" \
    tag-digest-migration; then
  echo 'non-image Deployment spec drift incorrectly authorized narrow E2E' >&2
  exit 1
fi
legacy_dependency_mismatch="$(seal_proof_json "$(jq -cS \
  '.runtimeDependencies["Secret/resonance-backstage-auth"].contentSha256=("e"*64)' \
  <<<"$proof_migration_pending")")"
if backstage_unchanged_serving_tuple_matches \
    "$legacy_dependency_mismatch" "$proof_migration_identity" \
    "$proof_fingerprint" "$proof_fingerprint" \
    "$proof_target_deployment_closure" "$proof_deployed_deployment_closure" \
    tag-digest-migration; then
  echo 'legacy runtime dependency drift incorrectly authorized narrow E2E' >&2
  exit 1
fi
if backstage_unchanged_serving_tuple_matches \
    "$proof_pending" "$proof_identity" "$(printf '%064d' 0 | tr 0 e)" "$proof_fingerprint" \
    "$proof_target_deployment_closure" "$proof_deployed_deployment_closure"; then
  echo 'runtime fingerprint mismatch incorrectly authorized narrow E2E' >&2
  exit 1
fi

# The live Pod proof requires the exact image ref and one nonempty, consistent
# imageID across every desired Ready Pod.
proof_deployment_json="$(jq -cnS --arg image "$proof_image" '
  {apiVersion:"apps/v1",kind:"Deployment",metadata:{namespace:"resonance-ops",
   name:"resonance-backstage",uid:"deployment-uid"},spec:{replicas:1,
   selector:{matchLabels:{"app.kubernetes.io/name":"resonance-backstage"}},
   template:{spec:{containers:[{name:"backstage",image:$image}]}}}}
')"
proof_pods_json="$(jq -cnS --arg image "$proof_image" '
  {items:[{metadata:{deletionTimestamp:null,labels:{"app.kubernetes.io/name":"resonance-backstage"}},
   spec:{containers:[{name:"backstage",image:$image}]},status:{phase:"Running",
   containerStatuses:[{name:"backstage",ready:true,image:$image,imageID:"containerd://sha256:exact"}]}}]}
')"
BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=true
kubectl() {
  if [[ "$*" == *' get deployment '* ]]; then printf '%s\n' "$proof_deployment_json"
  else printf '%s\n' "$proof_pods_json"; fi
}
verify_backstage_candidate_pod_image_identity_under_lock "$proof_image" deployment-uid
proof_pods_exact="$proof_pods_json"
proof_pods_json="$(jq -cS '.items[0].status.containerStatuses[0].image="registry.local/foreign:tag"' \
  <<<"$proof_pods_exact")"
if verify_backstage_candidate_pod_image_identity_under_lock "$proof_image" deployment-uid; then
  echo 'foreign Backstage Pod image ref incorrectly authorized narrow E2E' >&2
  exit 1
fi
proof_pods_json="$proof_pods_exact"
proof_pods_json="$(jq -cS '.items[0].status.containerStatuses[0].imageID=""' <<<"$proof_pods_json")"
if verify_backstage_candidate_pod_image_identity_under_lock "$proof_image" deployment-uid; then
  echo 'empty Backstage Pod imageID incorrectly authorized narrow E2E' >&2
  exit 1
fi
unset -f kubectl

# Exercise the orchestration boundary dynamically: the exact in-memory SHA and
# attempt must be checked under FD 19 before the old runtime identity helper is
# invoked, and that helper must inherit the same descriptor.
BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE=pending.json
BACKSTAGE_RUNTIME_IDENTITY_FILE=runtime.identity.json
BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=false
BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD=""
BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_WAIT_SECONDS=5
backstage_deployment_handoff_active=true
backstage_deployment_handoff_binding_captured=true
backstage_deployment_target_commit="$proof_target"
backstage_deployment_attempt_id=dddddddddddddddddddddddddddddddd
backstage_deployment_pending_sha256="$(printf '%064d' 0 | tr 0 a)"
backstage_deployment_authority_kind=APPLIED_MARKER
proof_expected_pending_sha="$backstage_deployment_pending_sha256"
proof_current_pending="$proof_pending"
proof_current_identity="$proof_identity"
proof_runtime_helper_calls=0
proof_candidate_helper_calls=0
proof_candidate_helper_status=0
proof_pod_calls=0
proof_pod_status=0
backstage_runtime_fingerprint_at_ref() { printf '%s\n' "$proof_fingerprint"; }
backstage_deployment_closure_at_ref() {
  if [[ "$1" == "$proof_target" ]]; then printf '%s\n' "$proof_target_deployment_closure"
  else printf '%s\n' "$proof_deployed_deployment_closure"; fi
}
acquire_backstage_deployment_mutation_lock() {
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=true
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD=19
}
release_backstage_deployment_mutation_lock() {
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD=false
  BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_FD=""
}
validate_parent_backstage_handoff_binding_locked() {
  [[ "$BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD" == true \
     && "$backstage_deployment_pending_sha256" == "$proof_expected_pending_sha" \
     && "$backstage_deployment_attempt_id" == dddddddddddddddddddddddddddddddd ]]
}
load_parent_backstage_authority_binding() {
  [[ "$1" == APPLIED_MARKER && "$2" == "$proof_target" \
     && "$3" == dddddddddddddddddddddddddddddddd \
     && "$4" == "$proof_expected_pending_sha" && -z "$5" ]] || return 79
  PARENT_BACKSTAGE_AUTHORITY_BINDING_STATUS=ARMED
  return 3
}
read_secure_backstage_json_file_under_lock() {
  [[ "$BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD" == true ]] || return 79
  if [[ "$1" == pending.json ]]; then printf '%s' "$proof_current_pending"
  else printf '%s' "$proof_current_identity"; fi
}
run_target_backstage_deploy_helper() {
  [[ "$BACKSTAGE_EXPECTED_PENDING_SHA256" == "$proof_expected_pending_sha" \
     && "$BACKSTAGE_EXPECTED_ATTEMPT_ID" == dddddddddddddddddddddddddddddddd \
     && "$BACKSTAGE_DEPLOYMENT_INHERITED_LOCK_FD" == 19 ]] || return 79
  case "$1:$2" in
    verify-runtime-identity:"$proof_deployed")
      [[ "${BACKSTAGE_REQUIRE_BASELINE_TAG_DIGEST_PROOF:-false}" != true ]] || return 79
      proof_runtime_helper_calls=$((proof_runtime_helper_calls + 1))
      ;;
    verify-pending-candidate:"$proof_target")
      [[ "${BACKSTAGE_REQUIRE_BASELINE_TAG_DIGEST_PROOF:-false}" == true ]] || return 79
      proof_candidate_helper_calls=$((proof_candidate_helper_calls + 1))
      return "$proof_candidate_helper_status"
      ;;
    *) return 79 ;;
  esac
}
verify_backstage_candidate_pod_image_identity_under_lock() {
  [[ "$BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD" == true \
     && "$1" == "$proof_image" && "$2" == deployment-uid ]] || return 1
  proof_pod_calls=$((proof_pod_calls + 1))
  return "$proof_pod_status"
}
prove_backstage_unchanged_serving_handoff
[[ "$proof_runtime_helper_calls" == 1 && "$proof_candidate_helper_calls" == 0 \
   && "$proof_pod_calls" == 1 && "$BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD" == false ]]
backstage_deployment_pending_sha256="$(printf '%064d' 0 | tr 0 e)"
set +e
prove_backstage_unchanged_serving_handoff >/dev/null 2>&1
proof_pending_swap_status="$?"
set -e
[[ "$proof_pending_swap_status" == 1 && "$proof_runtime_helper_calls" == 1 \
   && "$BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD" == false ]]
backstage_deployment_pending_sha256="$proof_expected_pending_sha"
backstage_deployment_attempt_id=eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
set +e
prove_backstage_unchanged_serving_handoff >/dev/null 2>&1
proof_attempt_swap_status="$?"
set -e
[[ "$proof_attempt_swap_status" == 1 && "$proof_runtime_helper_calls" == 1 \
   && "$BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD" == false ]]

# The migration branch must select the new target candidate CLI explicitly;
# it must never attempt to prove the old tag identity against the new digest
# Deployment. Both the child and the local Pod proof share FD 19.
backstage_deployment_attempt_id=dddddddddddddddddddddddddddddddd
proof_current_pending="$proof_migration_pending"
proof_current_identity="$proof_migration_identity"
prove_backstage_unchanged_serving_handoff
[[ "$proof_runtime_helper_calls" == 1 && "$proof_candidate_helper_calls" == 1 \
   && "$proof_pod_calls" == 2 && "$BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD" == false ]]
proof_current_pending="$migration_registry_mismatch"
set +e
prove_backstage_unchanged_serving_handoff >/dev/null 2>&1
proof_registry_mismatch_status="$?"
set -e
[[ "$proof_registry_mismatch_status" == 1 && "$proof_candidate_helper_calls" == 1 \
   && "$proof_pod_calls" == 2 && "$BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD" == false ]]
proof_current_pending="$proof_migration_pending"
proof_candidate_helper_status=79
set +e
prove_backstage_unchanged_serving_handoff >/dev/null 2>&1
proof_candidate_failure_status="$?"
set -e
[[ "$proof_candidate_failure_status" == 1 && "$proof_candidate_helper_calls" == 2 \
   && "$proof_pod_calls" == 2 && "$BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD" == false ]]
proof_candidate_helper_status=0
proof_pod_status=1
set +e
prove_backstage_unchanged_serving_handoff >/dev/null 2>&1
proof_pod_failure_status="$?"
set -e
[[ "$proof_pod_failure_status" == 1 && "$proof_candidate_helper_calls" == 3 \
   && "$proof_pod_calls" == 3 && "$BACKSTAGE_DEPLOYMENT_MUTATION_LOCK_HELD" == false ]]
unset -f backstage_runtime_fingerprint_at_ref backstage_deployment_closure_at_ref \
  acquire_backstage_deployment_mutation_lock \
  release_backstage_deployment_mutation_lock validate_parent_backstage_handoff_binding_locked \
  load_parent_backstage_authority_binding read_secure_backstage_json_file_under_lock \
  run_target_backstage_deploy_helper verify_backstage_candidate_pod_image_identity_under_lock

eval "$(sed -n '/^derive_backstage_e2e_routes() {/,/^run_backstage_visual_e2e_if_required() {/p' "$AUTO_DEPLOY" | sed '$d')"
deployed_commit=base
target_commit=target
PROOF_ROUTE_STATUS=0
prove_backstage_unchanged_serving_handoff() { return "$PROOF_ROUTE_STATUS"; }
git() {
  printf 'M\t%s\n' \
    platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/SystemOperationsControlPage.tsx
}
[[ "$(derive_backstage_e2e_routes)" == "/system-operations" ]]
git() {
  printf 'M\t%s\n' \
    platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/SystemRecoveryControlPage.tsx \
    platform/control-plane/backstage/packages/backend/src/plugins/resonanceRecovery.ts
}
[[ "$(derive_backstage_e2e_routes)" == "/system-recovery" ]]
git() {
  printf 'M\t%s\n' deploy/k8s/control-plane/backstage.yaml
}
[[ "$(derive_backstage_e2e_routes)" == "/actor-process-control,/identity-administration,/system-operations" ]]
git() {
  printf 'M\t%s\n' \
    .github/workflows/carbonet-push-deploy.yml \
    ops/scripts/carbonet-auto-deploy-failure-handler.sh \
    ops/scripts/plan-incremental-work.sh \
    ops/scripts/test-auto-deploy-failure-handler.sh \
    ops/scripts/test-plan-incremental-work.sh \
    ops/scripts/test-push-deploy-dispatch.sh \
    ops/scripts/test-select-catalog-contract-tests.sh \
    ops/tests/test-flyway-job-timeout-contract.sh \
    ops/scripts/auto-deploy-main.sh \
    ops/scripts/resonance-backstage-deploy.sh \
    ops/scripts/test-backstage-fast-deploy-policy.sh \
    ops/scripts/test-backstage-deployment-rollback.sh \
    ops/scripts/resonance-backstage-visual-e2e.sh \
    ops/scripts/resonance-backstage-full-e2e.sh \
    ops/systemd/resonance-backstage-full-e2e.service
}
PROOF_ROUTE_STATUS=0
[[ "$(derive_backstage_e2e_routes)" == "/system-operations" ]]
PROOF_ROUTE_STATUS=1
[[ -z "$(derive_backstage_e2e_routes)" ]]
git() {
  printf 'M\t%s\n' \
    ops/scripts/test-plan-incremental-work.sh \
    platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/SystemOperationsControlPage.tsx
}
PROOF_ROUTE_STATUS=0
[[ "$(derive_backstage_e2e_routes)" == "/system-operations" ]]
git() {
  printf 'M\t%s\n' \
    platform/control-plane/backstage/packages/app/src/plugins/ccus-screen-designs/plugin.tsx
}
[[ -z "$(derive_backstage_e2e_routes)" ]]
git() {
  printf 'D\t%s\n' ops/scripts/test-backstage-deployment-rollback.sh
}
PROOF_ROUTE_STATUS=0
[[ -z "$(derive_backstage_e2e_routes)" ]]
unset -f git derive_backstage_e2e_routes add_route add_core_routes \
  prove_backstage_unchanged_serving_handoff backstage_unchanged_serving_tuple_matches \
  seal_proof_json
rm -rf -- "$proof_fixture"

grep -Fq 'resonance-backstage-full-e2e.timer' "$AUTO_DEPLOY"
grep -Fq 'RESONANCE_BACKSTAGE_E2E_SCOPE=full' "$FULL_E2E_RUNNER"
grep -Fq '[[ -f "$RUNNER" ]]' "$FULL_E2E_RUNNER"
grep -Fq 'resonance-backstage-full-e2e.sh' "$FULL_E2E_SERVICE"
grep -Fq 'BACKSTAGE_E2E_USERNAME=sjkim' "$FULL_E2E_SERVICE"
grep -Fq 'BACKSTAGE_E2E_SECRET_NAME=resonance-keycloak-integrated-admin' "$FULL_E2E_SERVICE"
grep -Fq 'MemoryHigh=2560M' "$FULL_E2E_SERVICE"
grep -Fq 'MemoryMax=3G' "$FULL_E2E_SERVICE"
grep -Fq 'targetedRouteMode ? 4 : 16' "$E2E_SPEC"
grep -Fq 'OnCalendar=*-*-* 02:40:00 Asia/Seoul' "$FULL_E2E_TIMER"
grep -Fq 'token_pids+=("$!")' "$ROLE_E2E"
grep -Fq 'dataset_pids+=("$!")' "$ROLE_E2E"
grep -Fq 'concurrent dataset fetch failed' "$ROLE_E2E"

join_parallel_child_contracts

echo "PASS Backstage deploy reuses dependencies, performs one fast rollout, scopes E2E by impact, and serializes all supported Deployment writers pendingRawWriters=1 sealedCatalogWriter=1 pendingMutation=0 schemaArtifactCases=4 frontendConfigCases=5 guestFailClosed=1"
