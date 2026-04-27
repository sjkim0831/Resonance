#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

FAIL=0

echo "[audit] screenbuilder legacy root core paths"

LEGACY_DIRS=(
  "src/main/java/egovframework/com/platform/screenbuilder"
  "src/main/java/egovframework/com/framework/builder"
)

LEGACY_FILES=(
  "src/main/java/egovframework/com/common/trace/UiComponentRegistryVO.java"
  "src/main/java/egovframework/com/common/trace/UiComponentUsageVO.java"
  "src/main/java/egovframework/com/common/trace/UiPageComponentDetailVO.java"
  "src/main/java/egovframework/com/common/trace/UiPageManifestVO.java"
  "src/main/java/egovframework/com/framework/authority/model/FrameworkAuthorityRoleContractVO.java"
  "src/main/java/egovframework/com/framework/contract/model/FrameworkAuthorityDefaultsMetadataVO.java"
  "src/main/java/egovframework/com/framework/contract/model/FrameworkBuilderProfilesMetadataVO.java"
  "src/main/java/egovframework/com/framework/contract/model/FrameworkContractMetadataVO.java"
)

for dir in "${LEGACY_DIRS[@]}"; do
  if [[ -d "$dir" ]] && find "$dir" -type f 2>/dev/null | grep -q .; then
    echo "[audit] unexpected legacy core directory still contains files: $dir"
    find "$dir" -type f | sort
    FAIL=1
  fi
done

for file in "${LEGACY_FILES[@]}"; do
  if [[ -f "$file" ]]; then
    echo "[audit] unexpected legacy core file remains: $file"
    FAIL=1
  fi
done

if [[ $FAIL -ne 0 ]]; then
  echo "[audit] FAILED"
  exit 1
fi

echo "[audit] OK"
