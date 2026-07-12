#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(git rev-parse --show-toplevel)"
BASE="${AI_UI_BASE_REF:-main}"
mapfile -t CHANGED < <(git -C "$ROOT_DIR" diff --name-only "$BASE"...HEAD; git -C "$ROOT_DIR" diff --name-only)
[[ ${#CHANGED[@]} -gt 0 ]] || { echo "no UI changes found" >&2; exit 2; }
for file in "${CHANGED[@]}"; do
  case "$file" in
    projects/carbonet-frontend/source/src/features/*|projects/carbonet-frontend/source/src/components/*|projects/carbonet-frontend/source/src/styles/*|projects/carbonet-frontend/source/src/app/routes/*) ;;
    KILO_UI_TASK.md) ;;
    *) echo "forbidden path changed: $file" >&2; exit 3 ;;
  esac
done
if git -C "$ROOT_DIR" grep -nE '(password|secret|token)[[:space:]]*=[[:space:]]*["'"'][^"'"']+' -- "${CHANGED[@]}"; then
  echo "possible embedded secret detected" >&2; exit 4
fi
(cd "$ROOT_DIR/projects/carbonet-frontend/source" && npm run build)
node "$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs" \
  "$ROOT_DIR/projects/carbonet-frontend/src/main/resources/static/react-app"
echo "AI UI task verification passed (${#CHANGED[@]} changed paths)"
