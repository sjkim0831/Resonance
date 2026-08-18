#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
base_ref="${1:-}"
target_ref="${2:-HEAD}"
declare -a selected=()

all_tests=(
  ops/scripts/test-catalog-identity-parallel-deploy.sh
  ops/scripts/test-catalog-overlay-fast-path.sh
  ops/scripts/test-atomic-asset-e4b-validation.sh
  ops/scripts/test-no-change-preflight-fast-path.sh
  ops/scripts/test-candidate-release-rollout-gate.sh
  ops/scripts/test-runtime-candidate-checkpoint.sh
  ops/scripts/test-frontend-deploy-performance-budget.sh
  ops/scripts/test-deploy-phase-telemetry.sh
  ops/scripts/test-database-plan-flyway-gate.sh
  ops/tests/test-flyway-job-timeout-contract.sh
  ops/scripts/test-process-worker-deploy-marker.sh
  ops/scripts/test-frontend-parallel-build-pipeline.sh
  ops/scripts/test-push-deploy-dispatch.sh
  ops/scripts/test-github-deploy-webhook.sh
  ops/scripts/test-post-reboot-runtime-recovery.sh
  ops/scripts/test-runtime-startup-profile.sh
  ops/scripts/test-auto-deploy-failure-handler.sh
  ops/tests/test-auto-deploy-bootstrap-helper-snapshot.sh
  ops/tests/test-emission-workflow-health-postgres.sh
  ops/tests/test-runtime-release-state.sh
  ops/tests/test-postdeploy-candidate-evidence-contract.sh
  ops/tests/test-postdeploy-candidate-evidence-postgres.sh
  ops/tests/test-durable-postdeploy-rollback-reconciler.sh
  ops/tests/test-postdeploy-promotion-recovery.sh
  ops/tests/test-account-lock-recovery-assurance-contract.sh
  ops/tests/test-auto-deploy-legacy-orphan-quarantine-recovery.sh
  ops/tests/test-current-business-e2e-evidence.sh
  ops/tests/test-reconcile-deployed-retry-jobs-contract.sh
  ops/tests/test-runtime-identity-authority-consumers-contract.sh
  ops/scripts/test-operational-usage-ledger-e2e-contract.sh
  ops/scripts/test-startup-watchdog-runtime-mutation-guard.sh
  ops/scripts/test-runtime-systemd-contracts.sh
  ops/scripts/test-retire-legacy-runtime-mutation-automation.sh
  ops/scripts/test-prune-predeploy-backups.sh
  ops/scripts/test-backstage-fast-deploy-policy.sh
)

add_test() {
  local candidate="$1" existing
  for existing in "${selected[@]:-}"; do
    [[ "$existing" == "$candidate" ]] && return 0
  done
  selected+=("$candidate")
}

add_all_tests() {
  local test_path
  for test_path in "${all_tests[@]}"; do add_test "$test_path"; done
}

add_runtime_identity_tests() {
  add_test ops/tests/test-runtime-release-state.sh
  add_test ops/tests/test-postdeploy-candidate-evidence-contract.sh
  add_test ops/tests/test-postdeploy-candidate-evidence-postgres.sh
  add_test ops/tests/test-durable-postdeploy-rollback-reconciler.sh
  add_test ops/tests/test-postdeploy-promotion-recovery.sh
  add_test ops/tests/test-account-lock-recovery-assurance-contract.sh
  add_test ops/tests/test-auto-deploy-legacy-orphan-quarantine-recovery.sh
  add_test ops/tests/test-current-business-e2e-evidence.sh
  add_test ops/tests/test-reconcile-deployed-retry-jobs-contract.sh
  add_test ops/tests/test-runtime-identity-authority-consumers-contract.sh
  add_test ops/scripts/test-operational-usage-ledger-e2e-contract.sh
  add_test ops/scripts/test-runtime-startup-profile.sh
  add_test ops/scripts/test-startup-watchdog-runtime-mutation-guard.sh
  add_test ops/scripts/test-runtime-systemd-contracts.sh
}

select_for_path() {
  local path="$1"
  case "$path" in
    ops/scripts/auto-deploy-main.sh|ops/scripts/select-catalog-contract-tests.sh|ops/scripts/test-select-catalog-contract-tests.sh)
      add_all_tests ;;
    ops/scripts/sync-unified-asset-catalog.sh|ops/scripts/test-atomic-asset-e4b-validation.sh)
      add_test ops/scripts/test-atomic-asset-e4b-validation.sh ;;
    ops/scripts/test-catalog-identity-parallel-deploy.sh|ops/scripts/run-post-deploy-validation-groups.sh)
      add_test ops/scripts/test-catalog-identity-parallel-deploy.sh ;;
    ops/scripts/test-catalog-overlay-fast-path.sh|ops/scripts/resonance-screen-overlay-apply.sh)
      add_test ops/scripts/test-catalog-overlay-fast-path.sh ;;
    ops/scripts/test-no-change-preflight-fast-path.sh)
      add_test ops/scripts/test-no-change-preflight-fast-path.sh ;;
    ops/scripts/test-candidate-release-rollout-gate.sh)
      add_test ops/scripts/test-candidate-release-rollout-gate.sh ;;
    ops/scripts/runtime-candidate-checkpoint.sh|ops/scripts/test-runtime-candidate-checkpoint.sh)
      add_test ops/scripts/test-runtime-candidate-checkpoint.sh
      add_runtime_identity_tests ;;
    ops/scripts/record-deploy-performance.sh|ops/scripts/test-frontend-deploy-performance-budget.sh)
      add_test ops/scripts/test-frontend-deploy-performance-budget.sh
      add_test ops/scripts/test-deploy-phase-telemetry.sh ;;
    ops/scripts/test-deploy-phase-telemetry.sh)
      add_test ops/scripts/test-deploy-phase-telemetry.sh ;;
    ops/scripts/plan-incremental-work.sh|ops/scripts/test-database-plan-flyway-gate.sh)
      add_test ops/scripts/test-database-plan-flyway-gate.sh ;;
    ops/scripts/run-flyway-migration-job.sh|ops/tests/test-flyway-job-timeout-contract.sh|apps/carbonet-api/src/main/java/egovframework/com/migration/FlywayMigrationApplication.java)
      add_test ops/tests/test-flyway-job-timeout-contract.sh ;;
    apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260816154000__compile_composite_executable_design_authority.sql|ops/tests/test-composite-axis-migration-performance-postgres.sh|ops/tests/fixtures/composite-axis-migration-performance-prerequisites.sql|ops/tests/test-composite-executable-design-authority-postgres.sql|ops/tests/test-project-runtime-purge-composite-migrations-postgres.sh)
      add_test ops/tests/test-composite-axis-migration-performance-postgres.sh ;;
    ops/scripts/resonance-full-screen-deploy-gate.sh|ops/scripts/test-fast-overlay-snapshot.sh)
      add_test ops/scripts/test-fast-overlay-snapshot.sh
      add_test ops/tests/test-durable-postdeploy-rollback-reconciler.sh ;;
    ops/scripts/resonance-backstage-deploy.sh|\
    ops/scripts/test-backstage-runtime-fingerprint.sh|\
    ops/scripts/test-backstage-runtime-purge-recovery-secret.sh|\
    ops/scripts/test-backstage-deployment-rollback.sh|\
    ops/scripts/test-backstage-fast-deploy-policy.sh|\
    platform/control-plane/backstage/*|\
    modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/web/ActorProcessControlPlaneBridgeController.java|\
    modules/resonance-common/carbonet-common-core/src/test/java/egovframework/com/platform/governance/web/ActorProcessControlPlaneBridgeProjectPurgeTest.java)
      add_test ops/scripts/test-backstage-fast-deploy-policy.sh ;;
    apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260817210500__align_emission_workflow_entry_predecessor_health.sql|ops/tests/test-emission-workflow-health-postgres.sh)
      add_test ops/tests/test-emission-workflow-health-postgres.sh ;;
    apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260817235000__bind_runtime_identity_to_pod_template.sql|\
    ops/scripts/record-runtime-release-state.sh|ops/scripts/stage-postdeploy-evidence-candidate.sh|\
    ops/scripts/promote-postdeploy-candidate-evidence.sh|\
    ops/scripts/check-postdeploy-authoritative-promotion.sh|ops/scripts/audit-account-lock-recovery-assurance.sh|\
    ops/scripts/complete-account-lock-recovery-assurance.sh|ops/scripts/reconcile-exact-legacy-orphan-runtime-quarantine.sh|\
    ops/scripts/capture-business-e2e-contract.sh|ops/scripts/validate-operational-usage-ledger-e2e.sh|\
    ops/scripts/test-operational-usage-ledger-e2e-contract.sh|\
    ops/scripts/reconcile-deployed-retry-jobs.sh|\
    ops/scripts/promote-runtime-startup-profile.sh|ops/scripts/test-runtime-startup-profile.sh|\
    ops/scripts/resonance-v3-deploy.sh|ops/scripts/resonance-command-index.sh|ops/scripts/resonance-file-watch.sh|\
    ops/scripts/resonance-project-core-deploy.sh|ops/scripts/resonance-ai-fast-dev.sh|\
    ops/scripts/resonance-startup-watchdog.sh|ops/scripts/resonance-start-best-effort.sh|\
    ops/scripts/restart-local-carbonet-k8s.sh|ops/scripts/test-startup-watchdog-runtime-mutation-guard.sh|\
    ops/scripts/resonance-up.sh|ops/systemd/resonance-recovery.service|ops/scripts/test-runtime-systemd-contracts.sh|\
    ops/scripts/promote-company-manager-delegation-after-e2e.sh|ops/tests/run-company-manager-delegation-business-e2e.sh|\
    ops/tests/test-promote-company-manager-delegation-after-e2e.sh|\
    ops/scripts/complete-regulatory-submission-assurance.sh|ops/tests/test-regulatory-submission-assurance-contract.sh|\
    ops/runtime-metadata/business-e2e-runner-registry.json|\
    ops/scripts/promote-screen-contract-after-e2e.sh|ops/scripts/promote-project-portfolio-after-e2e.sh|\
    ops/scripts/complete-emission-project-assurance.sh|\
    modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/CompositeAutocompletionReadinessService.java|\
    modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/CompositeDesignOperationalWorker.java|\
    modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/CompositeLiveSmokeEvidenceService.java|\
    modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/CompositePhysicalEvidenceService.java|\
    modules/resonance-common/carbonet-common-core/src/test/java/egovframework/com/platform/governance/service/ActorProcessGovernanceMutationPropagationPostgresTest.java|\
    modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/platform/governance/service/ActorProcessGovernanceService.java|\
    modules/resonance-common/carbonet-common-core/src/test/java/egovframework/com/platform/governance/service/ActorProcessGovernanceServiceSecurityTest.java|\
    modules/resonance-common/carbonet-common-core/src/test/java/egovframework/com/platform/governance/service/CompositeDesignOperationalWorkerReplicaCapacityTest.java|\
    ops/tests/test-runtime-release-state.sh|ops/tests/test-postdeploy-candidate-evidence-contract.sh|ops/tests/test-postdeploy-candidate-evidence-postgres.sh|\
    ops/tests/test-durable-postdeploy-rollback-reconciler.sh|ops/tests/test-postdeploy-promotion-recovery.sh|\
    ops/tests/test-account-lock-recovery-assurance-contract.sh|ops/tests/test-auto-deploy-legacy-orphan-quarantine-recovery.sh|\
    ops/tests/test-current-business-e2e-evidence.sh|ops/tests/test-reconcile-deployed-retry-jobs-contract.sh|\
    ops/tests/test-runtime-identity-authority-consumers-contract.sh)
      add_runtime_identity_tests ;;
    ops/scripts/retire-legacy-runtime-mutation-automation.sh|ops/scripts/test-retire-legacy-runtime-mutation-automation.sh|\
    ops/scripts/autorecovery/check-and-recover.sh|ops/scripts/autorecovery/watchdog-daemon.sh|\
    ops/scripts/resonance-k8s-ops-automation-install.sh|ops/scripts/resonance-react-route-self-heal.sh|\
    ops/systemd/resonance-react-route-self-heal.service|ops/systemd/resonance-react-route-self-heal.timer)
      add_runtime_identity_tests
      add_test ops/scripts/test-retire-legacy-runtime-mutation-automation.sh ;;
    ops/scripts/prune-predeploy-backups.sh|ops/scripts/test-prune-predeploy-backups.sh)
      add_test ops/scripts/test-prune-predeploy-backups.sh ;;
    ops/scripts/run-process-development-worker.sh|ops/scripts/run-process-development-dispatcher.sh|ops/scripts/test-process-worker-deploy-marker.sh)
      add_test ops/scripts/test-process-worker-deploy-marker.sh ;;
    ops/scripts/test-frontend-parallel-build-pipeline.sh)
      add_test ops/scripts/test-frontend-parallel-build-pipeline.sh ;;
    ops/scripts/resonance-k8s-build-deploy-80-v2.sh)
      add_test ops/tests/test-flyway-job-timeout-contract.sh
      add_test ops/scripts/test-frontend-parallel-build-pipeline.sh
      add_test ops/scripts/test-runtime-candidate-checkpoint.sh
      add_runtime_identity_tests ;;
    ops/scripts/carbonet-auto-deploy-failure-handler.sh|ops/scripts/test-auto-deploy-failure-handler.sh)
      add_test ops/tests/test-flyway-job-timeout-contract.sh
      add_test ops/scripts/test-auto-deploy-failure-handler.sh ;;
    ops/scripts/auto-deploy-main-launcher.sh)
      add_test ops/tests/test-flyway-job-timeout-contract.sh
      add_test ops/scripts/test-auto-deploy-failure-handler.sh
      add_test ops/tests/test-auto-deploy-bootstrap-helper-snapshot.sh
      add_test ops/scripts/test-retire-legacy-runtime-mutation-automation.sh ;;
    ops/tests/test-auto-deploy-bootstrap-helper-snapshot.sh)
      add_test ops/tests/test-auto-deploy-bootstrap-helper-snapshot.sh ;;
    ops/scripts/test-push-deploy-dispatch.sh|.github/workflows/carbonet-push-deploy.yml)
      add_test ops/scripts/test-push-deploy-dispatch.sh ;;
    ops/scripts/resonance-github-deploy-webhook.py|ops/scripts/sync-github-deploy-webhook-url.py|ops/scripts/test-github-deploy-webhook.sh)
      add_test ops/scripts/test-github-deploy-webhook.sh ;;
    ops/scripts/reconcile-post-reboot-runtime.sh|ops/scripts/test-post-reboot-runtime-recovery.sh|\
    ops/scripts/resonance-k8s-self-heal.sh|ops/scripts/hermes-builder-monitoring-automation.sh|\
    ops/systemd/carbonet-post-reboot-recovery.service)
      add_test ops/scripts/test-post-reboot-runtime-recovery.sh ;;
  esac
}

if [[ "${1:-}" == "--paths-stdin" ]]; then
  while IFS= read -r path; do [[ -n "$path" ]] && select_for_path "$path"; done
else
  [[ -n "$base_ref" ]] || { echo "base revision is required" >&2; exit 2; }
  cd "$root"
  while IFS= read -r path; do [[ -n "$path" ]] && select_for_path "$path"; done \
    < <(git diff --name-only --diff-filter=ACMRD "$base_ref" "$target_ref")
fi

if (( ${#selected[@]} > 0 )); then
  printf '%s\n' "${selected[@]}"
fi
