#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
frontend="$ROOT_DIR/projects/carbonet-frontend/source"
runner="$frontend/scripts/run-full-screen-smoke.sh"
spec="$frontend/e2e/full-screen-smoke.spec.ts"

node --check "$frontend/scripts/prepare-full-screen-auth-state.mjs"
grep -Fq 'storageState: process.env.FULL_SCREEN_SMOKE_STORAGE_STATE' "$frontend/playwright.config.ts"
grep -Fq 'FULL_SCREEN_SMOKE_PREAUTHENTICATED === "true"' "$spec"
grep -Fq 'prepare-full-screen-auth-state.mjs' "$runner"
grep -Fq 'trap cleanup_smoke_secrets EXIT' "$runner"
grep -Fq 'chmod(output, 0o600)' "$frontend/scripts/prepare-full-screen-auth-state.mjs"
grep -Fq 'using per-shard UI login' "$runner"
grep -Fq 'FULL_SCREEN_SMOKE_SHARDS="${FULL_SCREEN_SMOKE_SHARDS:-1}"' \
  "$ROOT_DIR/ops/scripts/resonance-full-screen-deploy-gate.sh"

echo "[shared-smoke-auth-state-test] PASS"
