#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PROMOTER="$ROOT/ops/scripts/promote-project-portfolio-after-e2e.sh"
RUNNER="$ROOT/ops/tests/run-project-portfolio-contract-e2e.sh"
bash -n "$PROMOTER" "$RUNNER"
for token in E2E_VALIDATION_COMMIT plan-incremental-work.sh PLAN_RUNTIME_REQUIRED PLAN_FRONTEND_REQUIRED PLAN_BACKEND_REQUIRED PLAN_DATABASE_REQUIRED merge-base; do
  grep -Fq "$token" "$PROMOTER" || { echo "[portfolio-freshness] missing=$token" >&2; exit 1; }
done
grep -Fq 'validationCommit:$validationCommit' "$RUNNER"
grep -Fq 'E2E_VALIDATION_COMMIT="$VALIDATION_COMMIT"' "$RUNNER"
if grep -Fq '[[ "$SOURCE_COMMIT" == "$CURRENT_DEPLOYED_COMMIT" ]]' "$PROMOTER"; then
  echo '[portfolio-freshness] legacy exact-commit assumption remains' >&2
  exit 1
fi
echo '[portfolio-freshness] PASS runtime-identity=separate validation-lineage=checked runtime-gap=blocked'
