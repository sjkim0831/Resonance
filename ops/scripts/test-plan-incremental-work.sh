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
mkdir -p docs tests ops/scripts ops/tests projects/carbonet-frontend/source/src projects/carbonet-frontend/source/scripts apps/carbonet-api/src/main/java/example \
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
[[ "$PLAN_TESTS" == *"runtime:postdeploy-candidate-evidence"* ]]

printf 'export const page = 1;\n' > projects/carbonet-frontend/source/src/page.tsx
git add . && git commit -qm frontend
frontend="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$docs" "$frontend" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == true ]]
[[ "$PLAN_FRONTEND_REQUIRED" == true ]]
[[ "$PLAN_BACKEND_REQUIRED" == false ]]
[[ "$PLAN_DATABASE_REQUIRED" == false ]]
[[ "$PLAN_TESTS" == *"runtime:postdeploy-candidate-evidence"* ]]

printf '#!/usr/bin/env bash\n' > projects/carbonet-frontend/source/scripts/run-contract-typecheck.sh
git add . && git commit -qm frontend-test-automation
frontend_test_automation="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$frontend" "$frontend_test_automation" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == false ]]
[[ "$PLAN_FRONTEND_REQUIRED" == false ]]
[[ "$PLAN_INFRASTRUCTURE_REQUIRED" == true ]]
[[ "$PLAN_TESTS" == *"automation:full-screen-smoke"* ]]

printf 'export const prepare = true;\n' > projects/carbonet-frontend/source/scripts/prepare-full-screen-auth-state.mjs
printf 'export const logout = true;\n' > projects/carbonet-frontend/source/scripts/logout-full-screen-auth-state.mjs
git add . && git commit -qm full-screen-auth-helper-automation
full_screen_auth_helpers="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$frontend_test_automation" "$full_screen_auth_helpers" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == false ]]
[[ "$PLAN_FRONTEND_REQUIRED" == false ]]
[[ "$PLAN_BACKEND_REQUIRED" == false ]]
[[ "$PLAN_DATABASE_REQUIRED" == false ]]
[[ "$PLAN_INFRASTRUCTURE_REQUIRED" == true ]]
[[ "$PLAN_TESTS" == *"automation:full-screen-smoke"* ]]
[[ ",$PLAN_TESTS," != *",frontend:build,"* ]]
[[ "$PLAN_REASONS" == *"smoke-automation-only"* ]]

# Consecutive deployment contract: the helper commit advances only the overall
# applied source. The immediately following runtime commit must still plan a
# real frontend runtime build from that helper commit without inheriting a
# false backend/database requirement.
printf 'export const afterHelperRuntime = true;\n' > projects/carbonet-frontend/source/src/after-helper-runtime.ts
git add . && git commit -qm runtime-after-full-screen-helper
runtime_after_full_screen_helper="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$full_screen_auth_helpers" "$runtime_after_full_screen_helper" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == true ]]
[[ "$PLAN_FRONTEND_REQUIRED" == true ]]
[[ "$PLAN_BACKEND_REQUIRED" == false ]]
[[ "$PLAN_DATABASE_REQUIRED" == false ]]
[[ "$PLAN_INFRASTRUCTURE_REQUIRED" == false ]]
[[ "$PLAN_TESTS" == *"frontend:build"* ]]

# Race contract: promoted runtime A may be awaiting marker reconciliation when
# a helper-only remote B arrives. Re-planning A..B must remain automation-only.
printf 'export const prepare = "after-runtime";\n' > projects/carbonet-frontend/source/scripts/prepare-full-screen-auth-state.mjs
git add . && git commit -qm helper-after-promoted-runtime
helper_after_promoted_runtime="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$runtime_after_full_screen_helper" "$helper_after_promoted_runtime" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == false ]]
[[ "$PLAN_FRONTEND_REQUIRED" == false ]]
[[ "$PLAN_BACKEND_REQUIRED" == false ]]
[[ "$PLAN_DATABASE_REQUIRED" == false ]]
[[ "$PLAN_INFRASTRUCTURE_REQUIRED" == true ]]
[[ ",$PLAN_TESTS," != *",frontend:build,"* ]]

printf '#!/usr/bin/env bash\n' > ops/scripts/resonance-k8s-build-deploy-80-v2.sh
git add . && git commit -qm build-deploy-engine
build_deploy_engine="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$helper_after_promoted_runtime" "$build_deploy_engine" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == false ]]
[[ "$PLAN_INFRASTRUCTURE_REQUIRED" == true ]]
[[ "$PLAN_TESTS" == *"automation:shell-syntax"* ]]
[[ "$PLAN_TESTS" == *"runtime:postdeploy-candidate-evidence"* ]]

printf '#!/usr/bin/env bash\n' > ops/tests/runtime-contract-e2e.sh
git add . && git commit -qm ops-contract-test
ops_contract_test="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$build_deploy_engine" "$ops_contract_test" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == false ]]
[[ "$PLAN_FRONTEND_REQUIRED" == false ]]
[[ "$PLAN_BACKEND_REQUIRED" == false ]]
[[ "$PLAN_INFRASTRUCTURE_REQUIRED" == true ]]
[[ "$PLAN_TESTS" == *"automation:shell-syntax"* ]]

printf 'class App {}\n' > apps/carbonet-api/src/main/java/example/App.java
git add . && git commit -qm backend
backend="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$ops_contract_test" "$backend" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == true ]]
[[ "$PLAN_FRONTEND_REQUIRED" == false ]]
[[ "$PLAN_BACKEND_REQUIRED" == true ]]
[[ "$PLAN_TESTS" == *"runtime:postdeploy-candidate-evidence"* ]]

printf 'select 1;\n' > apps/carbonet-api/src/main/resources/db/migration/V1__test.sql
git add . && git commit -qm database
database="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$backend" "$database" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == true ]]
[[ "$PLAN_FRONTEND_REQUIRED" == false ]]
[[ "$PLAN_BACKEND_REQUIRED" == true ]]
[[ "$PLAN_DATABASE_REQUIRED" == true ]]
[[ "$PLAN_TESTS" == *"runtime:postdeploy-candidate-evidence"* ]]

printf 'class IdentityPolicy {}\n' > apps/carbonet-api/src/main/java/example/IdentityPolicy.java
git add . && git commit -qm identity-design
identity_design="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$database" "$identity_design" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == true ]]
[[ "$PLAN_TESTS" == *"runtime:identity-staged-reconcile-required"* ]]
[[ "$PLAN_REASONS" == *"identity-design-requires-staged-reconcile"* ]]

printf '*.sh text eol=lf\n' > .gitattributes
git add . && git commit -qm repository-policy
policy="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$identity_design" "$policy" --format env)"
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

printf 'kind: Group\n' > platform/control-plane/catalog/organization.yaml
git add . && git commit -qm backstage-catalog
backstage_catalog="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$control_plane" "$backstage_catalog" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == false ]]
[[ "$PLAN_BACKSTAGE_REQUIRED" == false ]]
[[ "$PLAN_TESTS" == *"backstage:catalog-sync"* ]]
[[ "$PLAN_REASONS" == *"backstage-catalog"* ]]

printf 'export const page = true;\n' > platform/control-plane/backstage/packages/app/src/page.tsx
git add . && git commit -qm backstage
backstage="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$backstage_catalog" "$backstage" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == false ]]
[[ "$PLAN_FRONTEND_REQUIRED" == false ]]
[[ "$PLAN_BACKEND_REQUIRED" == false ]]
[[ "$PLAN_DATABASE_REQUIRED" == false ]]
[[ "$PLAN_INFRASTRUCTURE_REQUIRED" == true ]]
[[ "$PLAN_BACKSTAGE_REQUIRED" == true ]]
[[ "$PLAN_CATALOG_ONLY" == true ]]
[[ "$PLAN_TESTS" == *"backstage:build-deploy"* ]]
[[ "$PLAN_REASONS" == *"backstage-runtime"* ]]

mkdir -p platform/control-plane/backstage/packages/app/e2e-tests
printf 'test(\"live\", async () => {});\n' \
  > platform/control-plane/backstage/packages/app/e2e-tests/live.test.ts
git add . && git commit -qm backstage-test
backstage_test="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$backstage" "$backstage_test" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == false ]]
[[ "$PLAN_BACKSTAGE_REQUIRED" == false ]]
[[ "$PLAN_INFRASTRUCTURE_REQUIRED" == true ]]
[[ "$PLAN_TESTS" == *"backstage:visual-e2e"* ]]
[[ "$PLAN_REASONS" == *"backstage-test-only"* ]]

echo "[incremental-plan] PASS source changes build selectively while policy and generated metadata remain no-build"
