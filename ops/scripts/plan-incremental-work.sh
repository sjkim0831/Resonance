#!/usr/bin/env bash
set -euo pipefail

# Produces a shell-safe build/test plan from a Git change range.
# Usage: eval "$(bash ops/scripts/plan-incremental-work.sh <base> <target> --format env)"

BASE_REF="${1:-HEAD^}"
TARGET_REF="${2:-HEAD}"
FORMAT="${4:-${3:-summary}}"
[[ "$FORMAT" == "--format" ]] && FORMAT="${4:-summary}"

runtime_required=false
frontend_required=false
backend_required=false
database_required=false
infrastructure_required=false
backstage_required=false
catalog_only=true
declare -a tests=()
declare -a reasons=()

add_test() {
  local candidate="$1" existing
  for existing in "${tests[@]:-}"; do [[ "$existing" == "$candidate" ]] && return; done
  tests+=("$candidate")
}

add_reason() {
  local candidate="$1" existing
  for existing in "${reasons[@]:-}"; do [[ "$existing" == "$candidate" ]] && return; done
  reasons+=("$candidate")
}

while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  case "$path" in
    ops/scripts/resonance-backstage-deploy.sh|\
    ops/scripts/resonance-backstage-runtime-fingerprint.sh|\
    ops/scripts/test-backstage-runtime-fingerprint.sh|\
    ops/scripts/test-backstage-fast-deploy-policy.sh)
      infrastructure_required=true; backstage_required=true
      add_test "control-plane:validate"
      add_test "backstage:build-deploy"
      add_reason "backstage-deploy-contract"
      ;;
    projects/carbonet-frontend/source/scripts/run-full-screen-smoke.sh|\
    projects/carbonet-frontend/source/scripts/finalize-full-screen-smoke.mjs|\
    projects/carbonet-frontend/source/scripts/generate-full-screen-smoke-manifest.mjs|\
    projects/carbonet-frontend/source/scripts/export-full-screen-smoke-manifest.sh|\
    projects/carbonet-frontend/source/scripts/export-full-screen-quality-context.sh|\
    projects/carbonet-frontend/source/scripts/build-full-screen-quality-queue.mjs|\
    projects/carbonet-frontend/source/scripts/run-contract-typecheck.sh|\
    projects/carbonet-frontend/source/scripts/derive-frontend-smoke-route-pattern.mjs|\
    projects/carbonet-frontend/source/e2e/full-screen-smoke.spec.ts)
      infrastructure_required=true
      add_test "automation:full-screen-smoke"
      add_reason "smoke-automation-only"
      ;;
    projects/carbonet-frontend/source/*|frontend/*)
      # React source is served from the verified hostPath overlay. It requires
      # a Vite build, but not a Java/image build or Kubernetes rollout.
      runtime_required=true; frontend_required=true; catalog_only=false
      add_test "frontend:build"
      add_reason "frontend-source"
      ;;
    apps/carbonet-api/src/main/resources/db/migration/*|db/*)
      runtime_required=true; backend_required=true; database_required=true; catalog_only=false
      add_test "database:migration-validate"
      add_reason "database-migration"
      ;;
    apps/*/src/main/*|modules/*/src/main/*|common/*/src/main/*)
      runtime_required=true; backend_required=true; catalog_only=false
      add_test "backend:compile"
      add_reason "backend-source"
      ;;
    apps/*/src/test/*|modules/*/src/test/*|common/*/src/test/*)
      backend_required=true; catalog_only=false
      add_test "backend:related-test"
      add_reason "backend-test"
      ;;
    platform/control-plane/backstage/packages/app/e2e-tests/*|\
    platform/control-plane/backstage/playwright.config.ts)
      # Browser specifications and their runner configuration verify the live
      # control plane; they must not rebuild its production image.
      infrastructure_required=true
      add_test "backstage:visual-e2e"
      add_reason "backstage-test-only"
      ;;
    platform/control-plane/backstage/*|deploy/k8s/control-plane/backstage.yaml)
      # Backstage owns the design/development/operations control-plane UI and
      # has an independent image and rollout. Never rebuild Carbonet for it,
      # but do require its dedicated deployment pipeline.
      infrastructure_required=true; backstage_required=true
      add_test "control-plane:validate"
      add_test "backstage:build-deploy"
      add_reason "backstage-runtime"
      ;;
    platform/control-plane/catalog/*)
      # Production Backstage serves these files from a ConfigMap. Synchronize
      # and verify the live catalog without rebuilding the Backstage image.
      infrastructure_required=true
      add_test "control-plane:validate"
      add_test "backstage:catalog-sync"
      add_reason "backstage-catalog"
      ;;
    platform/control-plane/*|deploy/k8s/control-plane/*)
      # Backstage catalog and control-plane boundary declarations describe
      # environments outside the Carbonet application runtime. Validate them,
      # but never rebuild or roll the customer-facing Java/React workload.
      infrastructure_required=true
      add_test "control-plane:validate"
      add_reason "control-plane-only"
      ;;
    ops/config/runtime-jvm-profile.env)
      # JVM tuning is a declarative runtime setting. Roll it with the measured
      # startup-profile promoter; never rebuild identical Java or React bytes.
      runtime_required=true; infrastructure_required=true; catalog_only=false
      add_test "runtime:startup-profile"
      add_reason "runtime-jvm-profile"
      ;;
    ops/docker/*|deploy/*|manifests/*)
      runtime_required=true; backend_required=true; infrastructure_required=true; catalog_only=false
      add_test "deployment:preflight"
      add_reason "runtime-infrastructure"
      ;;
    build.gradle.kts|settings.gradle.kts|gradle.properties|gradle/*|pom.xml|apps/*/build.gradle.kts|modules/*/build.gradle.kts)
      runtime_required=true; backend_required=true; catalog_only=false
      add_test "backend:compile"
      add_reason "build-configuration"
      ;;
    projects/carbonet-assets/*|projects/carbonet-frontend/src/main/resources/static/*)
      runtime_required=true; frontend_required=true; backend_required=true; catalog_only=false
      add_test "frontend:asset-closure"
      add_reason "frontend-artifact"
      ;;
    ops/scripts/*|ops/systemd/*|.github/workflows/*|.githooks/*|.gitattributes)
      infrastructure_required=true
      add_test "automation:shell-syntax"
      add_reason "automation-only"
      ;;
    ops/runtime-metadata/*|projects/carbonet-backend-metadata/*)
      # These declarative packages are consumed from the mounted project path.
      # Contract validation/reload is sufficient; no Java or Vite build.
      add_test "catalog:sync"
      add_reason "runtime-metadata"
      ;;
    docs/*|plans/*|catalog/*|templates/*|skills/*|ai-builder/*|*.md|*.txt)
      add_test "catalog:sync"
      add_reason "catalog-only"
      ;;
    tests/test_ai_builder_*.py)
      # Builder/governance unit tests validate offline generation only.
      # They do not alter the Java or React runtime.
      add_test "builder:unit-test"
      add_reason "builder-test"
      ;;
    *)
      # Unknown files are treated conservatively so a new runtime source root
      # cannot silently bypass a required build.
      runtime_required=true; frontend_required=true; backend_required=true; catalog_only=false
      add_test "fallback:full-build"
      add_reason "unclassified-change"
      ;;
  esac
done < <(git diff --name-only --diff-filter=ACMRD "$BASE_REF" "$TARGET_REF")

tests_csv="$(IFS=,; echo "${tests[*]:-catalog:sync}")"
reasons_csv="$(IFS=,; echo "${reasons[*]:-no-change}")"

if [[ "$FORMAT" == "env" ]]; then
  printf 'PLAN_RUNTIME_REQUIRED=%q\n' "$runtime_required"
  printf 'PLAN_FRONTEND_REQUIRED=%q\n' "$frontend_required"
  printf 'PLAN_BACKEND_REQUIRED=%q\n' "$backend_required"
  printf 'PLAN_DATABASE_REQUIRED=%q\n' "$database_required"
  printf 'PLAN_INFRASTRUCTURE_REQUIRED=%q\n' "$infrastructure_required"
  printf 'PLAN_BACKSTAGE_REQUIRED=%q\n' "$backstage_required"
  printf 'PLAN_CATALOG_ONLY=%q\n' "$catalog_only"
  printf 'PLAN_TESTS=%q\n' "$tests_csv"
  printf 'PLAN_REASONS=%q\n' "$reasons_csv"
else
  printf 'runtime=%s frontend=%s backend=%s database=%s infrastructure=%s backstage=%s catalogOnly=%s\n' \
    "$runtime_required" "$frontend_required" "$backend_required" "$database_required" "$infrastructure_required" "$backstage_required" "$catalog_only"
  printf 'tests=%s\nreasons=%s\n' "$tests_csv" "$reasons_csv"
fi
