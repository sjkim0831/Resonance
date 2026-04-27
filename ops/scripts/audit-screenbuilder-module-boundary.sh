#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

CORE_PATHS=(
  "src/main/java/egovframework/com/platform/screenbuilder"
  "src/main/java/egovframework/com/framework/builder"
)

FAIL=0

echo "[audit] screenbuilder module boundary"

for path in "${CORE_PATHS[@]}"; do
  if [[ ! -d "$path" ]]; then
    continue
  fi

  echo "[audit] scanning core candidate path: $path"

  if rg -n "egovframework\.com\.feature\.admin" "$path" >/tmp/screenbuilder-boundary-audit.out 2>/dev/null; then
    echo "[audit] forbidden import detected under $path"
    cat /tmp/screenbuilder-boundary-audit.out
    FAIL=1
  fi
done

if rg -n "egovframework\.com\.common\.mapper\.ObservabilityMapper|egovframework\.com\.framework\.contract\.service\.FrameworkContractMetadataService|egovframework\.com\.framework\.builder\.mapper\.FrameworkBuilderCompatibilityMapper" \
  src/main/java/egovframework/com/framework/builder >/tmp/screenbuilder-boundary-audit-framework.out 2>/dev/null; then
  echo "[audit] forbidden direct runtime dependency detected under src/main/java/egovframework/com/framework/builder"
  cat /tmp/screenbuilder-boundary-audit-framework.out
  FAIL=1
fi

if find src/main/java/egovframework/com/platform/screenbuilder/web -type f 2>/dev/null | grep -q .; then
  echo "[audit] forbidden controller path detected under src/main/java/egovframework/com/platform/screenbuilder/web"
  find src/main/java/egovframework/com/platform/screenbuilder/web -type f | sort
  FAIL=1
fi

if find src/main/java/egovframework/com/framework/builder/web -type f 2>/dev/null | grep -q .; then
  echo "[audit] forbidden controller path detected under src/main/java/egovframework/com/framework/builder/web"
  find src/main/java/egovframework/com/framework/builder/web -type f | sort
  FAIL=1
fi

if find src/main/java/egovframework/com/framework/builder/mapper -type f 2>/dev/null | grep -q .; then
  echo "[audit] forbidden mapper path detected under src/main/java/egovframework/com/framework/builder/mapper"
  find src/main/java/egovframework/com/framework/builder/mapper -type f | sort
  FAIL=1
fi

if [[ $FAIL -ne 0 ]]; then
  echo "[audit] FAILED"
  exit 1
fi

echo "[audit] OK"
