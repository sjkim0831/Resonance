#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PLANNER="$ROOT_DIR/ops/scripts/plan-incremental-work.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

cd "$TMP_DIR"
git init -q
git config user.name planner-test
git config user.email planner-test@example.invalid
mkdir -p docs projects/carbonet-frontend/source/src apps/carbonet-api/src/main/java/example \
  apps/carbonet-api/src/main/resources/db/migration
printf 'base\n' > README.md
git add . && git commit -qm base
base="$(git rev-parse HEAD)"

printf 'design\n' > docs/design.md
git add . && git commit -qm docs
docs="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$base" "$docs" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == false ]]
[[ "$PLAN_CATALOG_ONLY" == true ]]

printf 'export const page = 1;\n' > projects/carbonet-frontend/source/src/page.tsx
git add . && git commit -qm frontend
frontend="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$docs" "$frontend" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == true ]]
[[ "$PLAN_FRONTEND_REQUIRED" == true ]]
[[ "$PLAN_BACKEND_REQUIRED" == false ]]
[[ "$PLAN_DATABASE_REQUIRED" == false ]]

printf 'class App {}\n' > apps/carbonet-api/src/main/java/example/App.java
git add . && git commit -qm backend
backend="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$frontend" "$backend" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == true ]]
[[ "$PLAN_FRONTEND_REQUIRED" == false ]]
[[ "$PLAN_BACKEND_REQUIRED" == true ]]

printf 'select 1;\n' > apps/carbonet-api/src/main/resources/db/migration/V1__test.sql
git add . && git commit -qm database
database="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$backend" "$database" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == true ]]
[[ "$PLAN_FRONTEND_REQUIRED" == false ]]
[[ "$PLAN_BACKEND_REQUIRED" == true ]]
[[ "$PLAN_DATABASE_REQUIRED" == true ]]

echo "[incremental-plan] PASS frontend-only avoids backend/image rollout"
