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
    ops/scripts/*|ops/systemd/*)
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
  printf 'PLAN_CATALOG_ONLY=%q\n' "$catalog_only"
  printf 'PLAN_TESTS=%q\n' "$tests_csv"
  printf 'PLAN_REASONS=%q\n' "$reasons_csv"
else
  printf 'runtime=%s frontend=%s backend=%s database=%s infrastructure=%s catalogOnly=%s\n' \
    "$runtime_required" "$frontend_required" "$backend_required" "$database_required" "$infrastructure_required" "$catalog_only"
  printf 'tests=%s\nreasons=%s\n' "$tests_csv" "$reasons_csv"
fi
