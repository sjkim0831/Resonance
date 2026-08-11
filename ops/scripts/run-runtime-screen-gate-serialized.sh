#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$ROOT"
# shellcheck source=ops/scripts/runtime-qa-auth-common.sh
source "$ROOT/ops/scripts/runtime-qa-auth-common.sh"
export CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS="${CARBONET_QA_AUTH_LOCK_TIMEOUT_SECONDS:-300}"

carbonet_qa_auth_run_serialized runtime-screen-gate \
  env FULL_SCREEN_SMOKE_CHANGED_ONLY="${FULL_SCREEN_SMOKE_CHANGED_ONLY:-false}" \
      FULL_SCREEN_SMOKE_ROUTE_PATTERN="${FULL_SCREEN_SMOKE_ROUTE_PATTERN:-}" \
      FULL_SCREEN_SMOKE_CACHE_DIR="${FULL_SCREEN_SMOKE_CACHE_DIR:-}" \
      bash ops/scripts/resonance-full-screen-deploy-gate.sh verify
