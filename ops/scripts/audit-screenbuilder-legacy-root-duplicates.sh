#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

LEGACY_DIR="src/main/java/egovframework/com/feature/admin/model"

echo "[audit] screenbuilder legacy root duplicates"

if find "$LEGACY_DIR" -maxdepth 1 -name 'ScreenBuilder*.java' -type f 2>/dev/null | grep -q .; then
  echo "[audit] unexpected legacy screenbuilder wrapper files remain"
  find "$LEGACY_DIR" -maxdepth 1 -name 'ScreenBuilder*.java' -type f | sort
  echo "[audit] FAILED"
  exit 1
fi

echo "[audit] OK"
