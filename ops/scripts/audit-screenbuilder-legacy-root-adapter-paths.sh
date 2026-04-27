#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

FAIL=0

echo "[audit] screenbuilder legacy root adapter paths"

LEGACY_DIRS=(
  "src/main/java/egovframework/com/feature/admin/framework/builder"
  "src/main/java/egovframework/com/feature/admin/screenbuilder"
)

LEGACY_FILES=(
  "src/main/java/egovframework/com/feature/admin/web/AdminScreenBuilderController.java"
  "src/main/java/egovframework/com/feature/admin/web/CarbonetAdminRouteSource.java"
  "src/main/java/egovframework/com/feature/admin/web/CarbonetAdminRouteSourceBridge.java"
)

for dir in "${LEGACY_DIRS[@]}"; do
  if [[ -d "$dir" ]] && find "$dir" -type f 2>/dev/null | grep -q .; then
    echo "[audit] unexpected legacy adapter directory still contains files: $dir"
    find "$dir" -type f | sort
    FAIL=1
  fi
done

for file in "${LEGACY_FILES[@]}"; do
  if [[ -f "$file" ]]; then
    echo "[audit] unexpected legacy adapter file remains: $file"
    FAIL=1
  fi
done

if [[ $FAIL -ne 0 ]]; then
  echo "[audit] FAILED"
  exit 1
fi

echo "[audit] OK"
