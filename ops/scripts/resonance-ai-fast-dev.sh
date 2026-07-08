#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'USAGE'
Usage:
  bash ops/scripts/resonance-ai-fast-dev.sh [--dry-run] [--staged] [--base <git-ref>] [--allow-framework]

Purpose:
  Single AI-agent entrypoint for the fastest safe development lane.

Lanes:
  project/no-build     -> apply screen/static/backend metadata overlay; no Gradle, image, rollout
  project-core         -> build and rolling-deploy project runtime only
  resonance/framework  -> stop by default; requires explicit review/build
  ops-review           -> dry-run/report only unless handled by a dedicated ops script

Examples:
  bash ops/scripts/resonance-ai-fast-dev.sh --dry-run --staged
  bash ops/scripts/resonance-ai-fast-dev.sh --staged
  bash ops/scripts/resonance-ai-fast-dev.sh --base origin/main --dry-run
USAGE
}

DRY_RUN=false
ALLOW_FRAMEWORK=false
CLASSIFIER_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --staged)
      CLASSIFIER_ARGS+=("--staged")
      shift
      ;;
    --base)
      CLASSIFIER_ARGS+=("--base" "${2:-}")
      shift 2
      ;;
    --allow-framework)
      ALLOW_FRAMEWORK=true
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

json_value() {
  local key="$1"
  python3 -c 'import json,sys; data=json.load(sys.stdin); print(data.get(sys.argv[1], ""))' "$key"
}

classifier_json="$(bash ops/scripts/resonance-change-classifier.sh "${CLASSIFIER_ARGS[@]}")"
mode="$(printf '%s' "$classifier_json" | json_value mode)"
build_required="$(printf '%s' "$classifier_json" | json_value buildRequired)"
deploy_required="$(printf '%s' "$classifier_json" | json_value deployRequired)"

json_bool() {
  case "$1" in
    true|True|TRUE) echo true ;;
    *) echo false ;;
  esac
}
build_required="$(json_bool "$build_required")"
deploy_required="$(json_bool "$deploy_required")"

echo "$classifier_json"
echo
echo "[ai-fast-dev] mode=$mode buildRequired=$build_required deployRequired=$deploy_required dryRun=$DRY_RUN"

write_status() {
  local status="$1"
  local action="$2"
  mkdir -p var/run
  cat > var/run/ai-fast-dev-status.json <<STATUS
{
  "status": "$status",
  "action": "$action",
  "mode": "$mode",
  "buildRequired": $build_required,
  "deployRequired": $deploy_required,
  "dryRun": $DRY_RUN,
  "recordedAt": "$(date -Is)"
}
STATUS
  cat var/run/ai-fast-dev-status.json
}

case "$mode" in
  clean)
    write_status "clean" "none"
    exit 0
    ;;

  no-build-no-deploy)
    if [[ "$DRY_RUN" == true ]]; then
      write_status "planned" "screen-overlay-apply"
      exit 0
    fi
    bash ops/scripts/resonance-screen-overlay-apply.sh
    write_status "applied" "screen-overlay-apply"
    exit 0
    ;;

  project-core-build-deploy)
    if [[ "$DRY_RUN" == true ]]; then
      write_status "planned" "project-core-rolling-deploy"
      exit 0
    fi
    bash ops/scripts/resonance-project-core-deploy.sh "${CLASSIFIER_ARGS[@]}"
    write_status "applied" "project-core-rolling-deploy"
    exit 0
    ;;

  ops-review)
    write_status "blocked" "ops-review-required"
    cat <<'MESSAGE' >&2
[ai-fast-dev] Ops changes are present. Use a dedicated ops dry-run/script instead of the generic fast-dev lane.
MESSAGE
    exit 4
    ;;

  framework-build-review)
    if [[ "$ALLOW_FRAMEWORK" != true ]]; then
      write_status "blocked" "framework-review-required"
      cat <<'MESSAGE' >&2
[ai-fast-dev] Resonance framework/adaptor/unknown changes are present.
Review boundaries first, then run one of:
  bash ops/scripts/resonance-core-build.sh core
  bash ops/scripts/resonance-core-build.sh adaptor
  bash ops/scripts/resonance-core-build.sh ops
Only deploy project runtime after deciding the framework change must be consumed by the runtime.
MESSAGE
      exit 3
    fi
    if [[ "$DRY_RUN" == true ]]; then
      write_status "planned" "framework-compile"
      exit 0
    fi
    bash ops/scripts/resonance-core-build.sh all
    write_status "applied" "framework-compile"
    exit 0
    ;;

  *)
    write_status "blocked" "unknown-mode"
    echo "Unknown classifier mode: $mode" >&2
    exit 5
    ;;
esac

