#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FIXTURE="$ROOT/ops/tests/fixtures/canonical-design-generation-contract.mjs"

[[ -f "$FIXTURE" ]] || { echo "FAIL: fixture missing: $FIXTURE" >&2; exit 1; }
node --check "$FIXTURE"
node "$FIXTURE" "$ROOT"
