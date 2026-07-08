#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bash ops/scripts/resonance-change-classifier.sh [--base <git-ref>] [--staged]

Purpose:
  Classify changed files into the canonical Resonance boundaries:
    - project: no-build/no-deploy overlay
    - project-core: runtime Java build/deploy
    - resonance-core: shared framework Java
    - resonance-adaptor: builder/adapter Java
    - resonance-ops: operations/deployment

This script does not build, deploy, restart, or modify files.
USAGE
}

BASE=""
STAGED=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --base)
      BASE="${2:-}"
      shift 2
      ;;
    --staged)
      STAGED=true
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

changed_files=()
if [[ "$STAGED" == true ]]; then
  mapfile -t changed_files < <(git diff --cached --name-only --diff-filter=ACMRTUXB | sort -u)
elif [[ -n "$BASE" ]]; then
  mapfile -t changed_files < <(git diff --name-only --diff-filter=ACMRTUXB "$BASE" -- | sort -u)
else
  mapfile -t changed_files < <({ git diff --name-only --diff-filter=ACMRTUXB; git ls-files --others --exclude-standard; } | sort -u)
fi

if [[ ${#changed_files[@]} -eq 0 ]]; then
  cat <<'JSON'
{
  "mode": "clean",
  "buildRequired": false,
  "deployRequired": false,
  "changedFiles": []
}
JSON
  exit 0
fi

is_project_path() {
  local f="$1"
  [[ "$f" == projects/carbonet-frontend/src/main/resources/static/react-app/* ]] && return 0
  [[ "$f" == projects/carbonet-assets/static/* ]] && return 0
  [[ "$f" == projects/carbonet-backend-metadata/* ]] && return 0
  [[ "$f" == var/k8s/carbonet-runtime-manifest.json ]] && return 0
  [[ "$f" == ops/runtime-metadata/* ]] && return 0
  return 1
}

is_project_core_path() {
  local f="$1"
  [[ "$f" == modules/resonance-common/carbonet-common-core/* ]] && return 0
  [[ "$f" == modules/resonance-common/carbonet-contract-metadata/* ]] && return 0
  [[ "$f" == modules/resonance-common/platform-help/* ]] && return 0
  [[ "$f" == modules/resonance-common/platform-help-content/* ]] && return 0
  [[ "$f" == modules/resonance-common/platform-observability-web/* ]] && return 0
  [[ "$f" == modules/resonance-common/platform-observability-query/* ]] && return 0
  [[ "$f" == modules/resonance-common/platform-observability-payload/* ]] && return 0
  [[ "$f" == apps/project-runtime/* ]] && return 0
  [[ "$f" == apps/carbonet-app/* ]] && return 0
  [[ "$f" == projects/carbonet-frontend/source/* ]] && return 0
  return 1
}

is_resonance_core_path() {
  local f="$1"
  [[ "$f" == modules/resonance-common/* ]] && return 0
  [[ "$f" == settings.gradle.kts ]] && return 0
  [[ "$f" == build.gradle.kts ]] && return 0
  [[ "$f" == gradle/* ]] && return 0
  [[ "$f" == gradlew ]] && return 0
  [[ "$f" == gradlew.bat ]] && return 0
  return 1
}

is_resonance_adaptor_path() {
  local f="$1"
  [[ "$f" == modules/resonance-builder/* ]] && return 0
  return 1
}

is_resonance_ops_path() {
  local f="$1"
  [[ "$f" == ops/* ]] && return 0
  [[ "$f" == deploy/* ]] && return 0
  [[ "$f" == modules/resonance-ops/* ]] && return 0
  [[ "$f" == Dockerfile ]] && return 0
  return 1
}

project=()
project_core=()
resonance_core=()
resonance_adaptor=()
resonance_ops=()
unknown=()

for f in "${changed_files[@]}"; do
  if is_project_path "$f"; then
    project+=("$f")
  elif is_project_core_path "$f"; then
    project_core+=("$f")
  elif is_resonance_core_path "$f"; then
    resonance_core+=("$f")
  elif is_resonance_adaptor_path "$f"; then
    resonance_adaptor+=("$f")
  elif is_resonance_ops_path "$f"; then
    resonance_ops+=("$f")
  else
    unknown+=("$f")
  fi
done

mode="no-build-no-deploy"
build_required=false
deploy_required=false
if [[ ${#resonance_core[@]} -gt 0 || ${#resonance_adaptor[@]} -gt 0 || ${#unknown[@]} -gt 0 ]]; then
  mode="framework-build-review"
  build_required=true
  deploy_required=true
elif [[ ${#project_core[@]} -gt 0 ]]; then
  mode="project-core-build-deploy"
  build_required=true
  deploy_required=true
elif [[ ${#resonance_ops[@]} -gt 0 ]]; then
  mode="ops-review"
fi

case "$mode" in
  no-build-no-deploy)
    guidance="Project overlay/metadata only: no Java build or runtime rollout required."
    ;;
  project-core-build-deploy)
    guidance="Build and deploy project-core/runtime only; avoid resonance-core/adaptor rebuild unless dependencies changed."
    ;;
  framework-build-review)
    guidance="Review resonance-core/adaptor boundary impact and run affected Gradle checks before deployment."
    ;;
  ops-review)
    guidance="Review operational blast radius; use dry-run where available and avoid unplanned workload deletion."
    ;;
esac

printf '{\n'
printf '  "mode": "%s",\n' "$mode"
printf '  "buildRequired": %s,\n' "$build_required"
printf '  "deployRequired": %s,\n' "$deploy_required"
printf '  "counts": {"project": %d, "projectCore": %d, "resonanceCore": %d, "resonanceAdaptor": %d, "resonanceOps": %d, "unknown": %d},\n' "${#project[@]}" "${#project_core[@]}" "${#resonance_core[@]}" "${#resonance_adaptor[@]}" "${#resonance_ops[@]}" "${#unknown[@]}"
printf '  "guidance": "%s"\n' "$guidance"
printf '}\n'
