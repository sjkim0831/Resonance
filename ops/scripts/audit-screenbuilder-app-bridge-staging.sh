#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "[audit] screenbuilder app bridge staging"
if find apps/carbonet-app/src/main/java -type f 2>/dev/null | grep -q .; then
  echo "[audit] unexpected staged app bridge files remain"
  find apps/carbonet-app/src/main/java -type f | sort
  echo "[audit] FAILED"
  exit 1
fi

echo "[audit] OK"
