#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
selector="$root/ops/scripts/select-catalog-contract-tests.sh"

mapfile -t all < <(printf '%s\n' ops/scripts/auto-deploy-main.sh | bash "$selector" --paths-stdin)
[[ "${#all[@]}" == 17 ]]

mapfile -t asset < <(printf '%s\n' ops/scripts/sync-unified-asset-catalog.sh | bash "$selector" --paths-stdin)
[[ "${#asset[@]}" == 1 && "${asset[0]}" == ops/scripts/test-atomic-asset-e4b-validation.sh ]]

mapfile -t performance < <(printf '%s\n' ops/scripts/record-deploy-performance.sh | bash "$selector" --paths-stdin)
[[ "${#performance[@]}" == 2 ]]
[[ "${performance[0]}" == ops/scripts/test-frontend-deploy-performance-budget.sh ]]
[[ "${performance[1]}" == ops/scripts/test-deploy-phase-telemetry.sh ]]

mapfile -t webhook < <(printf '%s\n' ops/scripts/resonance-github-deploy-webhook.py | bash "$selector" --paths-stdin)
[[ "${#webhook[@]}" == 1 && "${webhook[0]}" == ops/scripts/test-github-deploy-webhook.sh ]]

mapfile -t runtime_checkpoint < <(printf '%s\n' ops/scripts/runtime-candidate-checkpoint.sh | bash "$selector" --paths-stdin)
[[ "${#runtime_checkpoint[@]}" == 1 && "${runtime_checkpoint[0]}" == ops/scripts/test-runtime-candidate-checkpoint.sh ]]

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
PY

mapfile -t flyway_handoff < <(
  printf '%s\n' \
    ops/scripts/resonance-k8s-build-deploy-80-v2.sh \
    ops/scripts/carbonet-auto-deploy-failure-handler.sh \
    ops/scripts/auto-deploy-main-launcher.sh |
    bash "$selector" --paths-stdin
)
[[ "${#flyway_handoff[@]}" == 5 ]]
[[ "${flyway_handoff[0]}" == ops/tests/test-flyway-job-timeout-contract.sh ]]
[[ "${flyway_handoff[1]}" == ops/scripts/test-frontend-parallel-build-pipeline.sh ]]
[[ "${flyway_handoff[2]}" == ops/scripts/test-runtime-candidate-checkpoint.sh ]]
[[ "${flyway_handoff[3]}" == ops/scripts/test-auto-deploy-failure-handler.sh ]]
[[ "${flyway_handoff[4]}" == ops/tests/test-auto-deploy-bootstrap-helper-snapshot.sh ]]

mapfile -t deduplicated < <(
  printf '%s\n' ops/scripts/record-deploy-performance.sh ops/scripts/test-deploy-phase-telemetry.sh |
    bash "$selector" --paths-stdin
)
[[ "${#deduplicated[@]}" == 2 ]]

echo "[catalog-contract-selector-test] PASS all=17 asset=1 performance=2 webhook=1 runtimeCheckpoint=1 flywayTimeout=1 compositeMigration=1 handoff=5"
