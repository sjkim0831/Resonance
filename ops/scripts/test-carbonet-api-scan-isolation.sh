#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APPLICATION="$ROOT_DIR/apps/carbonet-api/src/main/java/egovframework/com/CarbonetApiApplication.java"

grep -Fq 'FilterType.ASSIGNABLE_TYPE, classes = CarbonetApplication.class' "$APPLICATION" || {
  echo "[carbonet-api-scan-test] FAIL: legacy application is not excluded" >&2
  exit 1
}

echo "[carbonet-api-scan-test] PASS"
