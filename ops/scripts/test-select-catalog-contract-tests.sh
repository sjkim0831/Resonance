#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
selector="$root/ops/scripts/select-catalog-contract-tests.sh"
expected_all_count="$(awk '
  $0 == "all_tests=(" { inside=1; next }
  inside && $0 == ")" { print count; exit }
  inside && $0 ~ /^[[:space:]]+[^[:space:]]/ { count++ }
' "$selector")"
[[ "$expected_all_count" =~ ^[1-9][0-9]*$ ]]

mapfile -t all < <(printf '%s\n' ops/scripts/auto-deploy-main.sh | bash "$selector" --paths-stdin)
[[ "${#all[@]}" == "$expected_all_count" ]]
[[ "$(printf '%s\n' "${all[@]}" | sort -u | wc -l)" == "$expected_all_count" ]]
printf '%s\n' "${all[@]}" | grep -Fxq ops/tests/test-process-account-relay-design-compiler.mjs
printf '%s\n' "${all[@]}" | grep -Fxq ops/tests/test-my-work-summary-screen-contract.mjs
for selector_path in \
    ops/scripts/select-catalog-contract-tests.sh \
    ops/scripts/test-select-catalog-contract-tests.sh; do
  mapfile -t selector_self < <(printf '%s\n' "$selector_path" | bash "$selector" --paths-stdin)
  [[ "${#selector_self[@]}" == "$expected_all_count" ]]
done

python3 - "$root/ops/scripts/auto-deploy-main.sh" <<'PY'
import pathlib
import sys

source = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
start = source.index("run_parallel_contract_tests() {")
runner = source[start:source.index("\n}\n", start) + 3]

def extension_aware(block: str) -> bool:
    if '*.mjs|*.js)' not in block:
        return False
    node_branch = block.split('*.mjs|*.js)', 1)[1].split(';;', 1)[0]
    fallback = block.split('*)', 1)[1].split(';;', 1)[0]
    return (
        'runner=(node "$test_path")' in node_branch
        and 'runner=(bash "$test_path")' in fallback
        and '("${runner[@]}")' in block
    )

if not extension_aware(runner):
    raise SystemExit("catalog contract runner must use node for .mjs/.js and bash for other tests")
bash_only_mutant = runner.replace('runner=(node "$test_path")', 'runner=(bash "$test_path")', 1)
if extension_aware(bash_only_mutant):
    raise SystemExit("bash-only catalog runner mutant survived")
PY

for my_work_contract_path in \
    ops/tests/test-my-work-summary-screen-contract.mjs \
    ops/scripts/resonance-project-task-browser-e2e.mjs \
    projects/carbonet-frontend/source/src/features/emission-project-list/EmissionMyTasksPage.tsx \
    projects/carbonet-frontend/source/src/features/emission-project-list/emissionMyTasksScreen.contract.json \
    projects/carbonet-frontend/source/src/features/home-entry/TestAccountSwitcher.tsx \
    projects/carbonet-frontend/source/src/platform/screen-registry/pageManifests.ts \
    projects/carbonet-frontend/source/src/platform/screen-registry/helpContent.ts \
    projects/carbonet-frontend/source/src/generated/verificationCenterInventory.json \
    projects/carbonet-frontend/source/src/app/routes/families/emissionMonitoringFamily.ts \
    docs/design/emission-my-tasks-screen.md \
    modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/service/EmissionProjectRegistryService.java \
    modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/web/EmissionProjectRegistryController.java; do
  mapfile -t my_work_contract_tests < <(printf '%s\n' "$my_work_contract_path" | bash "$selector" --paths-stdin)
  [[ "${#my_work_contract_tests[@]}" == 1 ]]
  [[ "${my_work_contract_tests[0]}" == ops/tests/test-my-work-summary-screen-contract.mjs ]]
done

for failure_handler_contract_path in \
    ops/scripts/carbonet-auto-deploy-failure-handler.sh \
    ops/scripts/test-auto-deploy-failure-handler.sh; do
  mapfile -t failure_handler_contract_tests < <(
    printf '%s\n' "$failure_handler_contract_path" | bash "$selector" --paths-stdin
  )
  [[ "${#failure_handler_contract_tests[@]}" == 2 ]]
  [[ "${failure_handler_contract_tests[0]}" == ops/tests/test-flyway-job-timeout-contract.sh ]]
  [[ "${failure_handler_contract_tests[1]}" == ops/scripts/test-auto-deploy-failure-handler.sh ]]
done

for push_dispatch_contract_path in \
    .github/workflows/carbonet-push-deploy.yml \
    ops/scripts/test-push-deploy-dispatch.sh; do
  mapfile -t push_dispatch_contract_tests < <(
    printf '%s\n' "$push_dispatch_contract_path" | bash "$selector" --paths-stdin
  )
  [[ "${#push_dispatch_contract_tests[@]}" == 1 ]]
  [[ "${push_dispatch_contract_tests[0]}" == ops/scripts/test-push-deploy-dispatch.sh ]]
done

for backstage_contract_path in \
    ops/scripts/resonance-backstage-deploy.sh \
    ops/scripts/test-backstage-runtime-fingerprint.sh \
    ops/scripts/test-backstage-runtime-purge-recovery-secret.sh \
    ops/scripts/test-backstage-deployment-rollback.sh \
    ops/scripts/test-backstage-fast-deploy-policy.sh \
    platform/control-plane/backstage/package.json \
    platform/control-plane/backstage/config.d.ts \
    platform/control-plane/backstage/packages/app/package.json \
    platform/control-plane/backstage/packages/app/e2e-tests/resonance-control-plane.test.ts \
    modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/web/ActorProcessControlPlaneBridgeController.java \
    modules/resonance-common/carbonet-common-core/src/test/java/egovframework/com/platform/governance/web/ActorProcessControlPlaneBridgeProjectPurgeTest.java; do
  mapfile -t backstage_contract_tests < <(printf '%s\n' "$backstage_contract_path" | bash "$selector" --paths-stdin)
  [[ "${#backstage_contract_tests[@]}" == 1 ]]
  [[ "${backstage_contract_tests[0]}" == ops/scripts/test-backstage-fast-deploy-policy.sh ]]
done

mapfile -t asset < <(printf '%s\n' ops/scripts/sync-unified-asset-catalog.sh | bash "$selector" --paths-stdin)
[[ "${#asset[@]}" == 1 && "${asset[0]}" == ops/scripts/test-atomic-asset-e4b-validation.sh ]]

mapfile -t performance < <(printf '%s\n' ops/scripts/record-deploy-performance.sh | bash "$selector" --paths-stdin)
[[ "${#performance[@]}" == 2 ]]
[[ "${performance[0]}" == ops/scripts/test-frontend-deploy-performance-budget.sh ]]
[[ "${performance[1]}" == ops/scripts/test-deploy-phase-telemetry.sh ]]

mapfile -t webhook < <(printf '%s\n' ops/scripts/resonance-github-deploy-webhook.py | bash "$selector" --paths-stdin)
[[ "${#webhook[@]}" == 1 && "${webhook[0]}" == ops/scripts/test-github-deploy-webhook.sh ]]

mapfile -t runtime_checkpoint < <(printf '%s\n' ops/scripts/runtime-candidate-checkpoint.sh | bash "$selector" --paths-stdin)
[[ "${#runtime_checkpoint[@]}" == 15 && "${runtime_checkpoint[0]}" == ops/scripts/test-runtime-candidate-checkpoint.sh ]]
[[ "${runtime_checkpoint[1]}" == ops/tests/test-runtime-release-state.sh ]]
[[ "${runtime_checkpoint[10]}" == ops/tests/test-runtime-identity-authority-consumers-contract.sh ]]
[[ "${runtime_checkpoint[11]}" == ops/scripts/test-operational-usage-ledger-e2e-contract.sh ]]
[[ "${runtime_checkpoint[12]}" == ops/scripts/test-runtime-startup-profile.sh ]]
[[ "${runtime_checkpoint[13]}" == ops/scripts/test-startup-watchdog-runtime-mutation-guard.sh ]]
[[ "${runtime_checkpoint[14]}" == ops/scripts/test-runtime-systemd-contracts.sh ]]

mapfile -t flyway_timeout < <(
  printf '%s\n' \
    ops/scripts/run-flyway-migration-job.sh \
    apps/carbonet-api/src/main/java/egovframework/com/migration/FlywayMigrationApplication.java \
    ops/tests/test-flyway-job-timeout-contract.sh |
    bash "$selector" --paths-stdin
)
[[ "${#flyway_timeout[@]}" == 1 ]]
[[ "${flyway_timeout[0]}" == ops/tests/test-flyway-job-timeout-contract.sh ]]

mapfile -t composite_migration < <(
  printf '%s\n' \
    apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260816154000__compile_composite_executable_design_authority.sql \
    ops/tests/fixtures/composite-axis-migration-performance-prerequisites.sql \
    ops/tests/test-composite-axis-migration-performance-postgres.sh \
    ops/tests/test-composite-executable-design-authority-postgres.sql \
    ops/tests/test-project-runtime-purge-composite-migrations-postgres.sh |
    bash "$selector" --paths-stdin
)
[[ "${#composite_migration[@]}" == 1 ]]
[[ "${composite_migration[0]}" == ops/tests/test-composite-axis-migration-performance-postgres.sh ]]

for rollback_gate_path in \
    ops/scripts/resonance-full-screen-deploy-gate.sh \
    ops/scripts/test-fast-overlay-snapshot.sh; do
  mapfile -t rollback_gate_tests < <(printf '%s\n' "$rollback_gate_path" | bash "$selector" --paths-stdin)
  [[ "${#rollback_gate_tests[@]}" == 2 ]]
  [[ "${rollback_gate_tests[0]}" == ops/scripts/test-fast-overlay-snapshot.sh ]]
  [[ "${rollback_gate_tests[1]}" == ops/tests/test-durable-postdeploy-rollback-reconciler.sh ]]
done

mapfile -t emission_workflow < <(
  printf '%s\n' \
    apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260817210500__align_emission_workflow_entry_predecessor_health.sql \
    ops/tests/test-emission-workflow-health-postgres.sh \
    apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260817210500__align_emission_workflow_entry_predecessor_health.sql |
    bash "$selector" --paths-stdin
)
[[ "${#emission_workflow[@]}" == 1 ]]
[[ "${emission_workflow[0]}" == ops/tests/test-emission-workflow-health-postgres.sh ]]

mapfile -t runtime_template_identity < <(
  printf '%s\n' \
    apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260817235000__bind_runtime_identity_to_pod_template.sql \
    ops/scripts/record-runtime-release-state.sh \
    ops/scripts/stage-postdeploy-evidence-candidate.sh \
    ops/scripts/complete-account-lock-recovery-assurance.sh \
    ops/scripts/reconcile-exact-legacy-orphan-runtime-quarantine.sh \
    ops/scripts/capture-business-e2e-contract.sh \
    ops/scripts/validate-operational-usage-ledger-e2e.sh \
    ops/scripts/test-operational-usage-ledger-e2e-contract.sh \
    ops/scripts/reconcile-deployed-retry-jobs.sh \
    ops/scripts/promote-company-manager-delegation-after-e2e.sh \
    ops/scripts/complete-regulatory-submission-assurance.sh \
    ops/scripts/promote-runtime-startup-profile.sh \
    ops/scripts/test-runtime-startup-profile.sh \
    ops/scripts/resonance-v3-deploy.sh \
    ops/scripts/resonance-command-index.sh \
    ops/scripts/resonance-file-watch.sh \
    ops/scripts/resonance-project-core-deploy.sh \
    ops/scripts/resonance-ai-fast-dev.sh \
    ops/scripts/resonance-startup-watchdog.sh \
    ops/scripts/resonance-start-best-effort.sh \
    ops/scripts/restart-local-carbonet-k8s.sh \
    ops/scripts/test-startup-watchdog-runtime-mutation-guard.sh \
    ops/scripts/resonance-up.sh \
    ops/systemd/resonance-recovery.service \
    ops/scripts/test-runtime-systemd-contracts.sh \
    ops/scripts/retire-legacy-runtime-mutation-automation.sh \
    ops/scripts/test-retire-legacy-runtime-mutation-automation.sh \
    ops/scripts/autorecovery/check-and-recover.sh \
    ops/scripts/autorecovery/watchdog-daemon.sh \
    ops/scripts/resonance-k8s-ops-automation-install.sh \
    ops/tests/run-company-manager-delegation-business-e2e.sh \
    ops/runtime-metadata/business-e2e-runner-registry.json \
    modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/ActorProcessGovernanceService.java \
    modules/resonance-common/carbonet-common-core/src/test/java/egovframework/com/platform/governance/service/ActorProcessGovernanceServiceSecurityTest.java \
    modules/resonance-common/carbonet-common-core/src/test/java/egovframework/com/platform/governance/service/CompositeDesignOperationalWorkerReplicaCapacityTest.java \
    modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/CompositeAutocompletionReadinessService.java \
    ops/tests/test-durable-postdeploy-rollback-reconciler.sh \
    ops/tests/test-postdeploy-promotion-recovery.sh \
    ops/tests/test-postdeploy-candidate-evidence-postgres.sh |
    bash "$selector" --paths-stdin
)
[[ "${#runtime_template_identity[@]}" == 15 ]]
[[ "${runtime_template_identity[0]}" == ops/tests/test-runtime-release-state.sh ]]
[[ "${runtime_template_identity[1]}" == ops/tests/test-postdeploy-candidate-evidence-contract.sh ]]
[[ "${runtime_template_identity[2]}" == ops/tests/test-postdeploy-candidate-evidence-postgres.sh ]]
[[ "${runtime_template_identity[3]}" == ops/tests/test-durable-postdeploy-rollback-reconciler.sh ]]
[[ "${runtime_template_identity[4]}" == ops/tests/test-postdeploy-promotion-recovery.sh ]]
[[ "${runtime_template_identity[5]}" == ops/tests/test-account-lock-recovery-assurance-contract.sh ]]
[[ "${runtime_template_identity[6]}" == ops/tests/test-auto-deploy-legacy-orphan-quarantine-recovery.sh ]]
[[ "${runtime_template_identity[7]}" == ops/tests/test-current-business-e2e-evidence.sh ]]
[[ "${runtime_template_identity[8]}" == ops/tests/test-reconcile-deployed-retry-jobs-contract.sh ]]
[[ "${runtime_template_identity[9]}" == ops/tests/test-runtime-identity-authority-consumers-contract.sh ]]
[[ "${runtime_template_identity[10]}" == ops/scripts/test-operational-usage-ledger-e2e-contract.sh ]]
[[ "${runtime_template_identity[11]}" == ops/scripts/test-runtime-startup-profile.sh ]]
[[ "${runtime_template_identity[12]}" == ops/scripts/test-startup-watchdog-runtime-mutation-guard.sh ]]
[[ "${runtime_template_identity[13]}" == ops/scripts/test-runtime-systemd-contracts.sh ]]
[[ "${runtime_template_identity[14]}" == ops/scripts/test-retire-legacy-runtime-mutation-automation.sh ]]

for p2_identity_path in \
    ops/scripts/test-operational-usage-ledger-e2e-contract.sh \
    modules/resonance-common/carbonet-common-core/src/test/java/egovframework/com/platform/governance/service/CompositeDesignOperationalWorkerReplicaCapacityTest.java; do
  mapfile -t p2_identity_tests < <(printf '%s\n' "$p2_identity_path" | bash "$selector" --paths-stdin)
  [[ "${#p2_identity_tests[@]}" == 14 ]]
  [[ "${p2_identity_tests[10]}" == ops/scripts/test-operational-usage-ledger-e2e-contract.sh ]]
  [[ "${p2_identity_tests[11]}" == ops/scripts/test-runtime-startup-profile.sh ]]
  [[ "${p2_identity_tests[12]}" == ops/scripts/test-startup-watchdog-runtime-mutation-guard.sh ]]
  [[ "${p2_identity_tests[13]}" == ops/scripts/test-runtime-systemd-contracts.sh ]]
done

for retirement_path in \
    ops/scripts/retire-legacy-runtime-mutation-automation.sh \
    ops/scripts/test-retire-legacy-runtime-mutation-automation.sh \
    ops/scripts/autorecovery/check-and-recover.sh \
    ops/scripts/autorecovery/watchdog-daemon.sh \
    ops/scripts/resonance-k8s-ops-automation-install.sh \
    ops/scripts/resonance-react-route-self-heal.sh \
    ops/systemd/resonance-react-route-self-heal.service \
    ops/systemd/resonance-react-route-self-heal.timer; do
  mapfile -t retirement_tests < <(printf '%s\n' "$retirement_path" | bash "$selector" --paths-stdin)
  [[ "${#retirement_tests[@]}" == 15 ]]
  [[ "${retirement_tests[0]}" == ops/tests/test-runtime-release-state.sh ]]
  [[ "${retirement_tests[13]}" == ops/scripts/test-runtime-systemd-contracts.sh ]]
  [[ "${retirement_tests[14]}" == ops/scripts/test-retire-legacy-runtime-mutation-automation.sh ]]
done

mapfile -t post_reboot_identity < <(
  printf '%s\n' \
    ops/scripts/reconcile-post-reboot-runtime.sh \
    ops/scripts/test-post-reboot-runtime-recovery.sh \
    ops/scripts/resonance-k8s-self-heal.sh \
    ops/scripts/hermes-builder-monitoring-automation.sh \
    ops/systemd/carbonet-post-reboot-recovery.service |
    bash "$selector" --paths-stdin
)
[[ "${#post_reboot_identity[@]}" == 1 ]]
[[ "${post_reboot_identity[0]}" == ops/scripts/test-post-reboot-runtime-recovery.sh ]]
for recovery_path in \
    ops/scripts/reconcile-post-reboot-runtime.sh \
    ops/scripts/test-post-reboot-runtime-recovery.sh \
    ops/scripts/resonance-k8s-self-heal.sh \
    ops/scripts/hermes-builder-monitoring-automation.sh \
    ops/systemd/carbonet-post-reboot-recovery.service; do
  mapfile -t recovery_path_tests < <(printf '%s\n' "$recovery_path" | bash "$selector" --paths-stdin)
  [[ "${#recovery_path_tests[@]}" == 1 ]]
  [[ "${recovery_path_tests[0]}" == ops/scripts/test-post-reboot-runtime-recovery.sh ]]
done

mapfile -t startup_profile_identity < <(
  printf '%s\n' \
    ops/scripts/promote-runtime-startup-profile.sh \
    ops/scripts/test-runtime-startup-profile.sh |
    bash "$selector" --paths-stdin
)
[[ "${#startup_profile_identity[@]}" == 14 ]]
[[ "${startup_profile_identity[0]}" == ops/tests/test-runtime-release-state.sh ]]
[[ "${startup_profile_identity[10]}" == ops/scripts/test-operational-usage-ledger-e2e-contract.sh ]]
[[ "${startup_profile_identity[11]}" == ops/scripts/test-runtime-startup-profile.sh ]]
[[ "${startup_profile_identity[12]}" == ops/scripts/test-startup-watchdog-runtime-mutation-guard.sh ]]
[[ "${startup_profile_identity[13]}" == ops/scripts/test-runtime-systemd-contracts.sh ]]
for startup_path in \
    ops/scripts/promote-runtime-startup-profile.sh \
    ops/scripts/test-runtime-startup-profile.sh; do
  mapfile -t startup_path_tests < <(printf '%s\n' "$startup_path" | bash "$selector" --paths-stdin)
  [[ "${#startup_path_tests[@]}" == 14 ]]
  [[ "${startup_path_tests[1]}" == ops/tests/test-postdeploy-candidate-evidence-contract.sh ]]
  [[ "${startup_path_tests[11]}" == ops/scripts/test-runtime-startup-profile.sh ]]
  [[ "${startup_path_tests[12]}" == ops/scripts/test-startup-watchdog-runtime-mutation-guard.sh ]]
  [[ "${startup_path_tests[13]}" == ops/scripts/test-runtime-systemd-contracts.sh ]]
done

for watchdog_path in \
    ops/scripts/resonance-startup-watchdog.sh \
    ops/scripts/resonance-start-best-effort.sh \
    ops/scripts/restart-local-carbonet-k8s.sh \
    ops/scripts/test-startup-watchdog-runtime-mutation-guard.sh; do
  mapfile -t watchdog_identity_tests < <(printf '%s\n' "$watchdog_path" | bash "$selector" --paths-stdin)
  [[ "${#watchdog_identity_tests[@]}" == 14 ]]
  [[ "${watchdog_identity_tests[1]}" == ops/tests/test-postdeploy-candidate-evidence-contract.sh ]]
  [[ "${watchdog_identity_tests[12]}" == ops/scripts/test-startup-watchdog-runtime-mutation-guard.sh ]]
  [[ "${watchdog_identity_tests[13]}" == ops/scripts/test-runtime-systemd-contracts.sh ]]
done

for legacy_boot_path in \
    ops/scripts/resonance-up.sh \
    ops/systemd/resonance-recovery.service \
    ops/scripts/test-runtime-systemd-contracts.sh; do
  mapfile -t legacy_boot_tests < <(printf '%s\n' "$legacy_boot_path" | bash "$selector" --paths-stdin)
  [[ "${#legacy_boot_tests[@]}" == 14 ]]
  [[ "${legacy_boot_tests[1]}" == ops/tests/test-postdeploy-candidate-evidence-contract.sh ]]
  [[ "${legacy_boot_tests[13]}" == ops/scripts/test-runtime-systemd-contracts.sh ]]
done

mapfile -t retired_entrypoint_identity < <(
  printf '%s\n' \
    ops/scripts/resonance-v3-deploy.sh \
    ops/scripts/resonance-command-index.sh \
    ops/scripts/resonance-file-watch.sh |
    bash "$selector" --paths-stdin
)
[[ "${#retired_entrypoint_identity[@]}" == 14 ]]
[[ "${retired_entrypoint_identity[1]}" == ops/tests/test-postdeploy-candidate-evidence-contract.sh ]]
[[ "${retired_entrypoint_identity[11]}" == ops/scripts/test-runtime-startup-profile.sh ]]
[[ "${retired_entrypoint_identity[12]}" == ops/scripts/test-startup-watchdog-runtime-mutation-guard.sh ]]
[[ "${retired_entrypoint_identity[13]}" == ops/scripts/test-runtime-systemd-contracts.sh ]]
for retired_path in \
    ops/scripts/resonance-v3-deploy.sh \
    ops/scripts/resonance-command-index.sh \
    ops/scripts/resonance-file-watch.sh \
    ops/scripts/resonance-project-core-deploy.sh \
    ops/scripts/resonance-ai-fast-dev.sh; do
  mapfile -t retired_path_tests < <(printf '%s\n' "$retired_path" | bash "$selector" --paths-stdin)
  [[ "${#retired_path_tests[@]}" == 14 ]]
  [[ "${retired_path_tests[1]}" == ops/tests/test-postdeploy-candidate-evidence-contract.sh ]]
done

mapfile -t build_deploy_identity < <(
  printf '%s\n' ops/scripts/resonance-k8s-build-deploy-80-v2.sh |
    bash "$selector" --paths-stdin
)
[[ "${#build_deploy_identity[@]}" == 17 ]]
[[ "${build_deploy_identity[0]}" == ops/tests/test-flyway-job-timeout-contract.sh ]]
[[ "${build_deploy_identity[1]}" == ops/scripts/test-frontend-parallel-build-pipeline.sh ]]
[[ "${build_deploy_identity[2]}" == ops/scripts/test-runtime-candidate-checkpoint.sh ]]
[[ "${build_deploy_identity[3]}" == ops/tests/test-runtime-release-state.sh ]]
[[ "${build_deploy_identity[12]}" == ops/tests/test-runtime-identity-authority-consumers-contract.sh ]]
[[ "${build_deploy_identity[13]}" == ops/scripts/test-operational-usage-ledger-e2e-contract.sh ]]
[[ "${build_deploy_identity[14]}" == ops/scripts/test-runtime-startup-profile.sh ]]
[[ "${build_deploy_identity[15]}" == ops/scripts/test-startup-watchdog-runtime-mutation-guard.sh ]]
[[ "${build_deploy_identity[16]}" == ops/scripts/test-runtime-systemd-contracts.sh ]]

mapfile -t backup_prune < <(
  printf '%s\n' \
    ops/scripts/prune-predeploy-backups.sh \
    ops/scripts/test-prune-predeploy-backups.sh \
    ops/scripts/prune-predeploy-backups.sh |
    bash "$selector" --paths-stdin
)
[[ "${#backup_prune[@]}" == 1 ]]
[[ "${backup_prune[0]}" == ops/scripts/test-prune-predeploy-backups.sh ]]

python3 - "$root/ops/tests/test-emission-workflow-health-postgres.sh" <<'PY'
import pathlib
import sys

source = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
cleanup = source.index("cleanup() {")
exit_trap = source.index("trap cleanup EXIT", cleanup)
run = source.index('sudo ctr -n "$namespace" run --detach', exit_trap)
for contract in (
    'tasks kill --signal SIGKILL "$container_id"',
    'tasks rm --force "$container_id"',
    'containers rm "$container_id"',
    "trap 'exit 130' INT",
    "trap 'exit 143' TERM",
):
    if contract not in source:
        raise SystemExit(f"emission PostgreSQL cleanup contract missing: {contract}")
if "started=" in source or "if (( started ))" in source:
    raise SystemExit("emission PostgreSQL cleanup must be armed before ctr run")
if not cleanup < exit_trap < run:
    raise SystemExit("emission PostgreSQL cleanup trap must precede ctr run")
PY

python3 - "$root/ops/scripts/auto-deploy-main.sh" <<'PY'
import pathlib
import sys

source = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
gate = source.split("run_composite_axis_migration_performance_if_required() {", 1)[1].split("\n}", 1)[0]
for path in (
    "V20260816154000__compile_composite_executable_design_authority.sql",
    "composite-axis-migration-performance-prerequisites.sql",
    "test-composite-axis-migration-performance-postgres.sh",
    "test-composite-executable-design-authority-postgres.sql",
    "test-project-runtime-purge-composite-migrations-postgres.sh",
):
    if path not in gate:
        raise SystemExit(f"auto-deploy composite migration gate mapping missing: {path}")
if 'timeout --signal=TERM --kill-after=10s "${timeout_seconds}s"' not in gate:
    raise SystemExit("auto-deploy composite migration gate is not hard bounded")
merge = source.index('git merge --ff-only "$target_commit"')
call = source.index("\nrun_composite_axis_migration_performance_if_required\n", merge)
flyway = source.index("bash ops/scripts/resonance-k8s-build-deploy-80-v2.sh", call)
if not merge < call < flyway:
    raise SystemExit("operational-scale migration gate must run after target merge and before Flyway/rollout")

runtime_gate = source.split("run_runtime_template_identity_migration_contract_if_required() {", 1)[1].split("\n}", 1)[0]
for path in (
    "V20260817235000__bind_runtime_identity_to_pod_template.sql",
    "record-runtime-release-state.sh",
    "stage-postdeploy-evidence-candidate.sh",
    "promote-postdeploy-candidate-evidence.sh",
    "runtime-candidate-checkpoint.sh",
    "resonance-full-screen-deploy-gate.sh",
    "test-fast-overlay-snapshot.sh",
    "resonance-k8s-build-deploy-80-v2.sh",
    "resonance-v3-deploy.sh",
    "resonance-command-index.sh",
    "resonance-file-watch.sh",
    "resonance-project-core-deploy.sh",
    "resonance-ai-fast-dev.sh",
    "resonance-startup-watchdog.sh",
    "resonance-start-best-effort.sh",
    "restart-local-carbonet-k8s.sh",
    "test-startup-watchdog-runtime-mutation-guard.sh",
    "resonance-up.sh",
    "resonance-recovery.service",
    "test-runtime-systemd-contracts.sh",
    "retire-legacy-runtime-mutation-automation.sh",
    "test-retire-legacy-runtime-mutation-automation.sh",
    "autorecovery/check-and-recover.sh",
    "autorecovery/watchdog-daemon.sh",
    "resonance-k8s-ops-automation-install.sh",
    "resonance-react-route-self-heal.sh",
    "resonance-react-route-self-heal.service",
    "resonance-react-route-self-heal.timer",
    "auto-deploy-main-launcher.sh",
    "test-auto-deploy-bootstrap-helper-snapshot.sh",
    "test-postdeploy-candidate-evidence-postgres.sh",
    "CompositeAutocompletionReadinessService.java",
    "CompositeDesignOperationalWorker.java",
    "CompositeLiveSmokeEvidenceService.java",
    "CompositePhysicalEvidenceService.java",
    "ActorProcessGovernanceService.java",
    "ActorProcessGovernanceServiceSecurityTest.java",
    "complete-account-lock-recovery-assurance.sh",
    "reconcile-exact-legacy-orphan-runtime-quarantine.sh",
    "capture-business-e2e-contract.sh",
    "validate-operational-usage-ledger-e2e.sh",
    "reconcile-deployed-retry-jobs.sh",
    "promote-company-manager-delegation-after-e2e.sh",
    "run-company-manager-delegation-business-e2e.sh",
    "test-promote-company-manager-delegation-after-e2e.sh",
    "complete-regulatory-submission-assurance.sh",
    "test-regulatory-submission-assurance-contract.sh",
    "business-e2e-runner-registry.json",
    "test-runtime-identity-authority-consumers-contract.sh",
    "promote-runtime-startup-profile.sh",
    "test-runtime-startup-profile.sh",
    "test-startup-watchdog-runtime-mutation-guard.sh",
    "test-runtime-systemd-contracts.sh",
    "test-postdeploy-candidate-evidence-contract.sh",
    "test-fast-overlay-snapshot.sh",
    "test-durable-postdeploy-rollback-reconciler.sh",
    "test-postdeploy-promotion-recovery.sh",
):
    if path not in runtime_gate:
        raise SystemExit(f"runtime template identity gate mapping missing: {path}")
if 'timeout --signal=TERM --kill-after=10s "${timeout_seconds}s"' not in runtime_gate:
    raise SystemExit("runtime template identity PostgreSQL gate is not hard bounded")
if '"$timeout_seconds" -ge 60' not in runtime_gate or '"$timeout_seconds" -le 600' not in runtime_gate:
    raise SystemExit("runtime template identity PostgreSQL gate timeout must be bounded to 60..600 seconds")
for contract in (
    "test-runtime-candidate-checkpoint.sh",
    "test-runtime-release-state.sh",
    "test-postdeploy-candidate-evidence-contract.sh",
    "test-durable-postdeploy-rollback-reconciler.sh",
    "test-postdeploy-promotion-recovery.sh",
    "test-account-lock-recovery-assurance-contract.sh",
    "test-auto-deploy-legacy-orphan-quarantine-recovery.sh",
    "test-current-business-e2e-evidence.sh",
    "test-reconcile-deployed-retry-jobs-contract.sh",
    "test-runtime-identity-authority-consumers-contract.sh",
    "test-operational-usage-ledger-e2e-contract.sh",
    "test-runtime-startup-profile.sh",
    "test-retire-legacy-runtime-mutation-automation.sh",
):
    if runtime_gate.count(contract) < 2:
        raise SystemExit(f"runtime template identity gate does not inventory and execute {contract}")
parallel_call = runtime_gate.index("run_parallel_contract_tests")
postgres_call = runtime_gate.index('timeout --signal=TERM --kill-after=10s "${timeout_seconds}s"')
if not parallel_call < postgres_call:
    raise SystemExit("runtime template identity static contracts must precede the PostgreSQL gate")
runtime_call = source.index("\nrun_runtime_template_identity_migration_contract_if_required\n", merge)
if not merge < runtime_call < flyway:
    raise SystemExit("runtime template identity PostgreSQL gate must run after target merge and before Flyway/rollout")

static_branch = source.split('if [[ "$PLAN_RUNTIME_REQUIRED" != "true" ]]; then', 1)[1]
changed_paths = static_branch.index("mapfile -t deploy_changed_paths")
selector_map = static_branch.index("mapfile -t catalog_contract_tests", changed_paths)
control_plane_allowlist = static_branch.index("  if deploy_path_changed \\", selector_map)
if not changed_paths < selector_map < control_plane_allowlist:
    raise SystemExit("catalog selector must run for every static-only changed path before the control-plane allowlist")
PY

mapfile -t flyway_handoff < <(
  printf '%s\n' \
    ops/scripts/resonance-k8s-build-deploy-80-v2.sh \
    ops/scripts/carbonet-auto-deploy-failure-handler.sh \
    ops/scripts/auto-deploy-main-launcher.sh |
    bash "$selector" --paths-stdin
)
[[ "${#flyway_handoff[@]}" == 20 ]]
[[ "${flyway_handoff[0]}" == ops/tests/test-flyway-job-timeout-contract.sh ]]
[[ "${flyway_handoff[1]}" == ops/scripts/test-frontend-parallel-build-pipeline.sh ]]
[[ "${flyway_handoff[2]}" == ops/scripts/test-runtime-candidate-checkpoint.sh ]]
[[ "${flyway_handoff[3]}" == ops/tests/test-runtime-release-state.sh ]]
[[ "${flyway_handoff[12]}" == ops/tests/test-runtime-identity-authority-consumers-contract.sh ]]
[[ "${flyway_handoff[13]}" == ops/scripts/test-operational-usage-ledger-e2e-contract.sh ]]
[[ "${flyway_handoff[14]}" == ops/scripts/test-runtime-startup-profile.sh ]]
[[ "${flyway_handoff[15]}" == ops/scripts/test-startup-watchdog-runtime-mutation-guard.sh ]]
[[ "${flyway_handoff[16]}" == ops/scripts/test-runtime-systemd-contracts.sh ]]
[[ "${flyway_handoff[17]}" == ops/scripts/test-auto-deploy-failure-handler.sh ]]
[[ "${flyway_handoff[18]}" == ops/tests/test-auto-deploy-bootstrap-helper-snapshot.sh ]]
[[ "${flyway_handoff[19]}" == ops/scripts/test-retire-legacy-runtime-mutation-automation.sh ]]

mapfile -t deduplicated < <(
  printf '%s\n' ops/scripts/record-deploy-performance.sh ops/scripts/test-deploy-phase-telemetry.sh |
    bash "$selector" --paths-stdin
)
[[ "${#deduplicated[@]}" == 2 ]]

echo "[catalog-contract-selector-test] PASS all=$expected_all_count asset=1 performance=2 webhook=1 backstageContract=1 runtimeCheckpoint=15 flywayTimeout=1 compositeMigration=1 rollbackGate=2 emissionWorkflow=1 runtimeTemplateIdentity=15 retirementIdentity=15 postRebootIdentity=1 startupProfileIdentity=14 watchdogIdentity=14 legacyBootIdentity=14 retiredEntrypointIdentity=14 buildDeployIdentity=17 backupPrune=1 handoff=20 myWorkPaths=12 runnerMutants=1"
