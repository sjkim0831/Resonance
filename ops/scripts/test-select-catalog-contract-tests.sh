#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
selector="$root/ops/scripts/select-catalog-contract-tests.sh"

mapfile -t all < <(printf '%s\n' ops/scripts/auto-deploy-main.sh | bash "$selector" --paths-stdin)
[[ "${#all[@]}" == 13 ]]

mapfile -t asset < <(printf '%s\n' ops/scripts/sync-unified-asset-catalog.sh | bash "$selector" --paths-stdin)
[[ "${#asset[@]}" == 1 && "${asset[0]}" == ops/scripts/test-atomic-asset-e4b-validation.sh ]]

mapfile -t performance < <(printf '%s\n' ops/scripts/record-deploy-performance.sh | bash "$selector" --paths-stdin)
[[ "${#performance[@]}" == 2 ]]
[[ "${performance[0]}" == ops/scripts/test-frontend-deploy-performance-budget.sh ]]
[[ "${performance[1]}" == ops/scripts/test-deploy-phase-telemetry.sh ]]

mapfile -t webhook < <(printf '%s\n' ops/scripts/resonance-github-deploy-webhook.py | bash "$selector" --paths-stdin)
[[ "${#webhook[@]}" == 1 && "${webhook[0]}" == ops/scripts/test-github-deploy-webhook.sh ]]

mapfile -t deduplicated < <(
  printf '%s\n' ops/scripts/record-deploy-performance.sh ops/scripts/test-deploy-phase-telemetry.sh |
    bash "$selector" --paths-stdin
)
[[ "${#deduplicated[@]}" == 2 ]]

echo "[catalog-contract-selector-test] PASS all=13 asset=1 performance=2 webhook=1"
