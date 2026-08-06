#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AUTO_DEPLOY="$ROOT_DIR/ops/scripts/auto-deploy-main.sh"
BUILD_DEPLOY="$ROOT_DIR/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"
PLANNER_TEST="$ROOT_DIR/ops/scripts/test-plan-incremental-work.sh"

grep -Fq 'RUN_FLYWAY_MIGRATION_JOB="$PLAN_DATABASE_REQUIRED"' "$AUTO_DEPLOY"
grep -Fq '${RUN_FLYWAY_MIGRATION_JOB:-true}' "$BUILD_DEPLOY"
grep -Fq 'apps/carbonet-api/src/main/resources/db/migration/*|db/*)' \
  "$ROOT_DIR/ops/scripts/plan-incremental-work.sh"
grep -Fq '[[ "$PLAN_DATABASE_REQUIRED" == true ]]' "$PLANNER_TEST"
grep -Fq 'backup_cleanup_required=false' "$AUTO_DEPLOY"
grep -Fq '[[ "$backup_cleanup_required" == "true" ]] || return 0' "$AUTO_DEPLOY"
grep -Fq 'backup_cleanup_required=true' "$AUTO_DEPLOY"

echo "[database-plan-flyway-gate] PASS Flyway and stale backup cleanup run only for fail-closed database plans"
