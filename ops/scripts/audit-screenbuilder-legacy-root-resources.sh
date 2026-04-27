#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

FAIL=0

echo "[audit] screenbuilder legacy root resources"

LEGACY_RESOURCES=(
  "src/main/resources/framework/contracts/framework-contract-metadata.json"
  "src/main/resources/egovframework/mapper/com/feature/admin/framework/builder/FrameworkBuilderCompatibilityMapper.xml"
  "src/main/resources/egovframework/mapper/com/framework/builder/runtime/FrameworkBuilderObservabilityMapper.xml"
  "src/main/resources/egovframework/mapper/com/common/UiObservabilityRegistryMapper.xml"
)

for file in "${LEGACY_RESOURCES[@]}"; do
  if [[ -f "$file" ]]; then
    echo "[audit] unexpected legacy builder resource remains: $file"
    FAIL=1
  fi
done

if [[ $FAIL -ne 0 ]]; then
  echo "[audit] FAILED"
  exit 1
fi

echo "[audit] OK"
