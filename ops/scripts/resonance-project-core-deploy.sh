#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'USAGE'
Usage:
  bash ops/scripts/resonance-project-core-deploy.sh [--dry-run] [--staged] [--base <git-ref>]

Purpose:
  Build and deploy project-core/runtime Java only.

Guarantees:
  - skips frontend build
  - skips frontend overlay sync
  - refuses rollout when resonance-core/adaptor/unknown changes are present
  - uses the existing Kubernetes rollout script
USAGE
}

DRY_RUN=false
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
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

classifier_json="$(bash ops/scripts/resonance-change-classifier.sh "${CLASSIFIER_ARGS[@]}" || true)"
echo "$classifier_json"

if echo "$classifier_json" | grep -q '"mode": "framework-build-review"'; then
  echo "Project-core deploy refused: resonance-core/adaptor/unknown changes are present." >&2
  echo "Run resonance-core-build.sh first and review framework impact before runtime rollout." >&2
  exit 3
fi

if [[ "$DRY_RUN" == true ]]; then
  echo "Dry run only. No build, image, or rollout executed."
  exit 0
fi

IMAGE_NAME="${IMAGE_NAME:-localhost:5000/carbonet-runtime:$(date +%Y.%m.%d-%H%M%S-project-core)}"
SKIP_FRONTEND=true \
SKIP_OVERLAY_SYNC=true \
SKIP_NOTIFY="${SKIP_NOTIFY:-true}" \
IMAGE_NAME="$IMAGE_NAME" \
  bash ops/scripts/resonance-k8s-build-deploy-80-v2.sh
