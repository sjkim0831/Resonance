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
mkdir -p docs tests projects/carbonet-frontend/source/src apps/carbonet-api/src/main/java/example \
  apps/carbonet-api/src/main/resources/db/migration projects/carbonet-backend-metadata/process-runtime/generated \
  platform/control-plane/catalog platform/control-plane/backstage/packages/app/src deploy/k8s/control-plane
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

printf '*.sh text eol=lf\n' > .gitattributes
git add . && git commit -qm repository-policy
policy="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$database" "$policy" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == false ]]
[[ "$PLAN_CATALOG_ONLY" == true ]]

printf '{}\n' > projects/carbonet-backend-metadata/process-runtime/generated/index.json
git add . && git commit -qm runtime-metadata
metadata="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$policy" "$metadata" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == false ]]
[[ "$PLAN_CATALOG_ONLY" == true ]]

printf 'print(\"ok\")\n' > tests/test_ai_builder_contract_generator.py
git add . && git commit -qm builder-test
builder_test="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$metadata" "$builder_test" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == false ]]
[[ "$PLAN_CATALOG_ONLY" == true ]]
[[ "$PLAN_TESTS" == *"builder:unit-test"* ]]

printf 'apiVersion: backstage.io/v1alpha1\nkind: Component\n' > platform/control-plane/catalog/catalog-info.yaml
printf 'apiVersion: v1\nkind: Namespace\n' > deploy/k8s/control-plane/environment-foundation.yaml
git add . && git commit -qm control-plane
control_plane="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$builder_test" "$control_plane" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == false ]]
[[ "$PLAN_FRONTEND_REQUIRED" == false ]]
[[ "$PLAN_BACKEND_REQUIRED" == false ]]
[[ "$PLAN_DATABASE_REQUIRED" == false ]]
[[ "$PLAN_INFRASTRUCTURE_REQUIRED" == true ]]
[[ "$PLAN_CATALOG_ONLY" == true ]]
[[ "$PLAN_TESTS" == *"control-plane:validate"* ]]
[[ "$PLAN_REASONS" == *"control-plane-only"* ]]

printf 'export const page = true;\n' > platform/control-plane/backstage/packages/app/src/page.tsx
git add . && git commit -qm backstage
backstage="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$control_plane" "$backstage" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == false ]]
[[ "$PLAN_FRONTEND_REQUIRED" == false ]]
[[ "$PLAN_BACKEND_REQUIRED" == false ]]
[[ "$PLAN_DATABASE_REQUIRED" == false ]]
[[ "$PLAN_INFRASTRUCTURE_REQUIRED" == true ]]
[[ "$PLAN_BACKSTAGE_REQUIRED" == true ]]
[[ "$PLAN_CATALOG_ONLY" == true ]]
[[ "$PLAN_TESTS" == *"backstage:build-deploy"* ]]
[[ "$PLAN_REASONS" == *"backstage-runtime"* ]]

echo "[incremental-plan] PASS source changes build selectively while policy and generated metadata remain no-build"
