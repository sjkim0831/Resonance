#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PLANNER="$ROOT_DIR/ops/scripts/plan-incremental-work.sh"
USAGE_LEDGER_CONTRACT="$ROOT_DIR/ops/scripts/test-operational-usage-ledger-e2e-contract.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

fail() {
  printf '[incremental-plan] FAIL: %s\n' "$*" >&2
  exit 1
}

assert_usage_ledger_plan() {
  local planner="$1" base_ref="$2" target_ref="$3" summary
  summary="$(bash "$planner" "$base_ref" "$target_ref")" || return 1
  grep -Fq 'runtime:operational-usage-ledger-e2e' <<<"$summary" &&
    grep -Fq 'operational-usage-ledger-contract' <<<"$summary"
}

assert_leader_contract_caller() {
  local candidate="$1"
  grep -Fq 'AUTH_LOGOUT_LEADER_CONTRACT="$ROOT/ops/tests/test-auth-logout-revocation-leader-contract.sh"' "$candidate" &&
    grep -Fq 'bash "$AUTH_LOGOUT_LEADER_CONTRACT" >/dev/null' "$candidate"
}

cd "$TMP_DIR"
git init -q
git config user.name planner-test
git config user.email planner-test@example.invalid
mkdir -p docs tests ops/scripts ops/tests projects/carbonet-frontend/source/src projects/carbonet-frontend/source/scripts apps/carbonet-api/src/main/java/example \
  apps/carbonet-api/src/main/resources/db/migration projects/carbonet-backend-metadata/process-runtime/generated \
  projects/carbonet-backend-metadata/process-runtime/generated-endpoints/PROCESS_A/src/main/java/example \
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

# Changing the source-hash algorithm makes the previous build marker
# incomparable. Bootstrap that one release with a real frontend build, while
# keeping unrelated backend/database work disabled.
printf '#!/usr/bin/env bash\n' > ops/scripts/resonance-frontend-overlay-guard.sh
git add . && git commit -qm frontend-overlay-source-hash-contract
overlay_source_hash_contract="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$build_deploy_engine" "$overlay_source_hash_contract" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == true ]]
[[ "$PLAN_FRONTEND_REQUIRED" == true ]]
[[ "$PLAN_BACKEND_REQUIRED" == false ]]
[[ "$PLAN_DATABASE_REQUIRED" == false ]]
[[ "$PLAN_INFRASTRUCTURE_REQUIRED" == true ]]
[[ "$PLAN_CATALOG_ONLY" == false ]]
[[ "$PLAN_TESTS" == *"frontend:build"* ]]
[[ "$PLAN_TESTS" == *"automation:shell-syntax"* ]]
[[ "$PLAN_REASONS" == *"frontend-overlay-source-hash-contract"* ]]

printf '#!/usr/bin/env bash\n' > ops/tests/runtime-contract-e2e.sh
git add . && git commit -qm ops-contract-test
ops_contract_test="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$overlay_source_hash_contract" "$ops_contract_test" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == false ]]
[[ "$PLAN_FRONTEND_REQUIRED" == false ]]
[[ "$PLAN_BACKEND_REQUIRED" == false ]]
[[ "$PLAN_INFRASTRUCTURE_REQUIRED" == true ]]
[[ "$PLAN_TESTS" == *"automation:shell-syntax"* ]]

printf '#!/usr/bin/env bash\n' > ops/tests/test-auth-logout-revocation-live.sh
git add ops/tests/test-auth-logout-revocation-live.sh && git commit -qm auth-logout-live
auth_logout_live="$(git rev-parse HEAD)"
assert_usage_ledger_plan "$PLANNER" "$ops_contract_test" "$auth_logout_live" \
  || fail 'auth logout live verifier did not select the operational usage-ledger E2E'

printf '#!/usr/bin/env bash\n' > ops/tests/test-auth-logout-revocation-leader-contract.sh
git add ops/tests/test-auth-logout-revocation-leader-contract.sh && git commit -qm auth-logout-leader-contract
auth_logout_leader_contract="$(git rev-parse HEAD)"
assert_usage_ledger_plan "$PLANNER" "$auth_logout_live" "$auth_logout_leader_contract" \
  || fail 'auth logout leader contract did not select the operational usage-ledger E2E'

printf 'class App {}\n' > apps/carbonet-api/src/main/java/example/App.java
git add . && git commit -qm backend
backend="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$auth_logout_leader_contract" "$backend" --format env)"
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

mkdir -p apps/carbonet-api/src/main/resources/db/migration/postgresql
printf 'select 1;\n' \
  > apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260817235000__bind_runtime_identity_to_pod_template.sql
git add . && git commit -qm runtime-release-identity
runtime_release_identity="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$database" "$runtime_release_identity" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == true ]]
[[ "$PLAN_BACKEND_REQUIRED" == true ]]
[[ "$PLAN_DATABASE_REQUIRED" == true ]]
[[ "$PLAN_TESTS" == *"database:migration-validate"* ]]
[[ "$PLAN_TESTS" == *"runtime:postdeploy-candidate-evidence"* ]]
[[ ",$PLAN_TESTS," != *",runtime:identity-staged-reconcile-required,"* ]]
[[ "$PLAN_REASONS" == *"runtime-release-identity-candidate-contract"* ]]
[[ "$PLAN_REASONS" != *"identity-design-requires-staged-reconcile"* ]]

printf 'select 1;\n' \
  > apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260818151500__make_runtime_identity_hpa_stable.sql
git add . && git commit -qm hpa-stable-runtime-identity
hpa_stable_runtime_identity="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$runtime_release_identity" "$hpa_stable_runtime_identity" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == true ]]
[[ "$PLAN_BACKEND_REQUIRED" == true ]]
[[ "$PLAN_DATABASE_REQUIRED" == true ]]
[[ "$PLAN_TESTS" == *"runtime:postdeploy-candidate-evidence"* ]]
[[ ",$PLAN_TESTS," != *",runtime:identity-staged-reconcile-required,"* ]]
[[ "$PLAN_REASONS" == *"runtime-release-identity-candidate-contract"* ]]

printf 'select 1;\n' \
  > apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260817235100__identity_policy.sql
git add . && git commit -qm database-identity-design
database_identity_design="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$hpa_stable_runtime_identity" "$database_identity_design" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == true ]]
[[ "$PLAN_DATABASE_REQUIRED" == true ]]
[[ "$PLAN_TESTS" == *"runtime:identity-staged-reconcile-required"* ]]
[[ "$PLAN_REASONS" == *"identity-design-requires-staged-reconcile"* ]]

printf 'class IdentityPolicy {}\n' > apps/carbonet-api/src/main/java/example/IdentityPolicy.java
git add . && git commit -qm identity-design
identity_design="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$database_identity_design" "$identity_design" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == true ]]
[[ "$PLAN_TESTS" == *"runtime:identity-staged-reconcile-required"* ]]
[[ "$PLAN_REASONS" == *"identity-design-requires-staged-reconcile"* ]]

printf '*.sh text eol=lf\n' > .gitattributes
git add . && git commit -qm repository-policy
policy="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$identity_design" "$policy" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == false ]]
[[ "$PLAN_CATALOG_ONLY" == true ]]

# Generated endpoint Java is compiled by carbonet-common-core. Its more
# specific path must win before the generic backend-metadata catalog rule and
# select a real backend runtime deployment.
printf 'package example; public class GeneratedEndpoint {}\n' \
  > projects/carbonet-backend-metadata/process-runtime/generated-endpoints/PROCESS_A/src/main/java/example/GeneratedEndpoint.java
git add . && git commit -qm generated-endpoint-runtime
endpoint_runtime="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$policy" "$endpoint_runtime" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == true ]]
[[ "$PLAN_FRONTEND_REQUIRED" == false ]]
[[ "$PLAN_BACKEND_REQUIRED" == true ]]
[[ "$PLAN_DATABASE_REQUIRED" == false ]]
[[ "$PLAN_CATALOG_ONLY" == false ]]
[[ "$PLAN_TESTS" == *"backend:compile"* ]]
[[ "$PLAN_REASONS" == *"generated-endpoint-runtime-source"* ]]

# Legacy mounted process metadata keeps its no-build behavior; endpoint source
# classification must not widen the generic metadata rule.
printf '{}\n' > projects/carbonet-backend-metadata/process-runtime/generated/index.json
git add . && git commit -qm runtime-metadata
metadata="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$endpoint_runtime" "$metadata" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == false ]]
[[ "$PLAN_BACKEND_REQUIRED" == false ]]
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
[[ "$PLAN_BACKSTAGE_REQUIRED" == true ]]
[[ "$PLAN_TESTS" == *"backstage:build-deploy"* ]]
[[ "$PLAN_TESTS" != *"backstage:catalog-sync"* ]]
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

printf '# runtime purge recovery Secret contract\n' \
  > ops/scripts/test-backstage-runtime-purge-recovery-secret.sh
git add . && git commit -qm backstage-secret-contract
backstage_secret_contract="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$backstage" "$backstage_secret_contract" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == false ]]
[[ "$PLAN_BACKSTAGE_REQUIRED" == true ]]
[[ "$PLAN_INFRASTRUCTURE_REQUIRED" == true ]]
[[ "$PLAN_TESTS" == *"backstage:build-deploy"* ]]
[[ "$PLAN_REASONS" == *"backstage-deploy-contract"* ]]

printf '# durable Backstage Deployment rollback contract\n' \
  > ops/scripts/test-backstage-deployment-rollback.sh
git add . && git commit -qm backstage-deployment-rollback-contract
backstage_rollback_contract="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$backstage_secret_contract" "$backstage_rollback_contract" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == false ]]
[[ "$PLAN_BACKSTAGE_REQUIRED" == true ]]
[[ "$PLAN_INFRASTRUCTURE_REQUIRED" == true ]]
[[ "$PLAN_TESTS" == *"backstage:build-deploy"* ]]
[[ "$PLAN_REASONS" == *"backstage-deploy-contract"* ]]

# The aggregate policy test changes no Backstage serving byte. It is executed
# in the target prevalidation lane and must not trigger an image build/rollout.
printf '# Backstage policy expectation only\n' \
  > ops/scripts/test-backstage-fast-deploy-policy.sh
git add . && git commit -qm backstage-policy-test-only
backstage_policy_test_only="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$backstage_rollback_contract" "$backstage_policy_test_only" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == false ]]
[[ "$PLAN_FRONTEND_REQUIRED" == false ]]
[[ "$PLAN_BACKEND_REQUIRED" == false ]]
[[ "$PLAN_DATABASE_REQUIRED" == false ]]
[[ "$PLAN_INFRASTRUCTURE_REQUIRED" == true ]]
[[ "$PLAN_BACKSTAGE_REQUIRED" == false ]]
[[ "$PLAN_TESTS" == *"automation:shell-syntax"* ]]

mkdir -p platform/control-plane/backstage/packages/app/e2e-tests
printf 'test(\"live\", async () => {});\n' \
  > platform/control-plane/backstage/packages/app/e2e-tests/live.test.ts
git add . && git commit -qm backstage-test
backstage_test="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$backstage_policy_test_only" "$backstage_test" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == false ]]
[[ "$PLAN_BACKSTAGE_REQUIRED" == false ]]
[[ "$PLAN_INFRASTRUCTURE_REQUIRED" == true ]]
[[ "$PLAN_TESTS" == *"backstage:visual-e2e"* ]]
[[ "$PLAN_REASONS" == *"backstage-test-only"* ]]

# Mixed plans must retain both axes. The deploy orchestrator deliberately
# excludes these two combinations from its frontend/profile fast exits so the
# deferred Backstage handoff reaches the shared global authority.
printf 'export const mixedFrontend = true;\n' \
  > projects/carbonet-frontend/source/src/mixed-frontend.tsx
printf 'export const mixedBackstage = true;\n' \
  > platform/control-plane/backstage/packages/app/src/mixed-frontend.tsx
git add . && git commit -qm mixed-frontend-backstage
mixed_frontend_backstage="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$backstage_test" "$mixed_frontend_backstage" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == true ]]
[[ "$PLAN_FRONTEND_REQUIRED" == true ]]
[[ "$PLAN_BACKSTAGE_REQUIRED" == true ]]
[[ "$PLAN_INFRASTRUCTURE_REQUIRED" == true ]]
[[ "$PLAN_TESTS" == *"frontend:build"* ]]
[[ "$PLAN_TESTS" == *"backstage:build-deploy"* ]]

mkdir -p ops/config
printf 'JAVA_OPTS=-Xms1g\n' > ops/config/runtime-jvm-profile.env
printf 'export const mixedProfile = true;\n' \
  > platform/control-plane/backstage/packages/app/src/mixed-profile.tsx
git add . && git commit -qm mixed-startup-profile-backstage
mixed_profile_backstage="$(git rev-parse HEAD)"
eval "$(bash "$PLANNER" "$mixed_frontend_backstage" "$mixed_profile_backstage" --format env)"
[[ "$PLAN_RUNTIME_REQUIRED" == true ]]
[[ "$PLAN_FRONTEND_REQUIRED" == false ]]
[[ "$PLAN_BACKEND_REQUIRED" == false ]]
[[ "$PLAN_DATABASE_REQUIRED" == false ]]
[[ "$PLAN_BACKSTAGE_REQUIRED" == true ]]
[[ "$PLAN_INFRASTRUCTURE_REQUIRED" == true ]]
[[ "$PLAN_TESTS" == *"runtime:startup-profile"* ]]
[[ "$PLAN_TESTS" == *"backstage:build-deploy"* ]]

assert_leader_contract_caller "$USAGE_LEDGER_CONTRACT" \
  || fail 'operational usage-ledger static gate does not call the logout leader contract'

grep -vF 'ops/tests/test-auth-logout-revocation-live.sh' "$PLANNER" > "$TMP_DIR/planner-without-auth-logout-live.sh"
bash -n "$TMP_DIR/planner-without-auth-logout-live.sh"
if assert_usage_ledger_plan "$TMP_DIR/planner-without-auth-logout-live.sh" "$ops_contract_test" "$auth_logout_live"; then
  fail 'auth logout live planner-path removal mutation survived'
fi

grep -vF 'ops/tests/test-auth-logout-revocation-leader-contract.sh' "$PLANNER" > "$TMP_DIR/planner-without-auth-logout-leader.sh"
bash -n "$TMP_DIR/planner-without-auth-logout-leader.sh"
if assert_usage_ledger_plan "$TMP_DIR/planner-without-auth-logout-leader.sh" "$auth_logout_live" "$auth_logout_leader_contract"; then
  fail 'auth logout leader planner-path removal mutation survived'
fi

grep -vF 'bash "$AUTH_LOGOUT_LEADER_CONTRACT" >/dev/null' "$USAGE_LEDGER_CONTRACT" > "$TMP_DIR/usage-ledger-without-leader-caller.sh"
if assert_leader_contract_caller "$TMP_DIR/usage-ledger-without-leader-caller.sh"; then
  fail 'logout leader-contract caller removal mutation survived'
fi

mkdir -p "$TMP_DIR/failing-git-bin"
REAL_GIT="$(command -v git)"
cat > "$TMP_DIR/failing-git-bin/git" <<EOF
#!/usr/bin/env bash
if [[ "\${1:-}" == diff ]]; then
  exit 42
fi
exec "$REAL_GIT" "\$@"
EOF
chmod 755 "$TMP_DIR/failing-git-bin/git"
set +e
PATH="$TMP_DIR/failing-git-bin:$PATH" \
  bash "$PLANNER" "$base" "$docs" --format env >/dev/null 2>&1
git_inventory_status=$?
set -e
[[ "$git_inventory_status" == 2 ]] \
  || fail "Git inventory failure did not fail closed: $git_inventory_status"

echo "[incremental-plan] PASS source changes build selectively while policy and generated metadata remain no-build usageLedgerAuthPaths=2 removalMutations=3 inventoryFailureMutants=1"
