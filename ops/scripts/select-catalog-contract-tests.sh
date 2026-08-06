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
  ops/scripts/test-frontend-deploy-performance-budget.sh
  ops/scripts/test-deploy-phase-telemetry.sh
  ops/scripts/test-database-plan-flyway-gate.sh
  ops/scripts/test-process-worker-deploy-marker.sh
  ops/scripts/test-frontend-parallel-build-pipeline.sh
  ops/scripts/test-push-deploy-dispatch.sh
  ops/scripts/test-github-deploy-webhook.sh
  ops/scripts/test-post-reboot-runtime-recovery.sh
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
    ops/scripts/record-deploy-performance.sh|ops/scripts/test-frontend-deploy-performance-budget.sh)
      add_test ops/scripts/test-frontend-deploy-performance-budget.sh
      add_test ops/scripts/test-deploy-phase-telemetry.sh ;;
    ops/scripts/test-deploy-phase-telemetry.sh)
      add_test ops/scripts/test-deploy-phase-telemetry.sh ;;
    ops/scripts/plan-incremental-work.sh|ops/scripts/test-database-plan-flyway-gate.sh)
      add_test ops/scripts/test-database-plan-flyway-gate.sh ;;
    ops/scripts/run-process-development-worker.sh|ops/scripts/run-process-development-dispatcher.sh|ops/scripts/test-process-worker-deploy-marker.sh)
      add_test ops/scripts/test-process-worker-deploy-marker.sh ;;
    ops/scripts/test-frontend-parallel-build-pipeline.sh|ops/scripts/resonance-k8s-build-deploy-80-v2.sh)
      add_test ops/scripts/test-frontend-parallel-build-pipeline.sh ;;
    ops/scripts/test-push-deploy-dispatch.sh|.github/workflows/carbonet-push-deploy.yml)
      add_test ops/scripts/test-push-deploy-dispatch.sh ;;
    ops/scripts/resonance-github-deploy-webhook.py|ops/scripts/sync-github-deploy-webhook-url.py|ops/scripts/test-github-deploy-webhook.sh)
      add_test ops/scripts/test-github-deploy-webhook.sh ;;
    ops/scripts/reconcile-post-reboot-runtime.sh|ops/scripts/test-post-reboot-runtime-recovery.sh|ops/systemd/carbonet-post-reboot-recovery.service)
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
