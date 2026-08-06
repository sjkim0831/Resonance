#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
[[ -n "${CARBONET_ADMIN_TEST_PASSWORD:-}" ]] || { echo "CARBONET_ADMIN_TEST_PASSWORD is required" >&2; exit 2; }
[[ -d "$ROOT/projects/carbonet-frontend/source/node_modules/@playwright/test" ]] || { echo "Playwright dependency missing" >&2; exit 2; }
RESONANCE_ROOT="$ROOT" node "$ROOT/ops/scripts/resonance-regulatory-admin-e2e.mjs"
