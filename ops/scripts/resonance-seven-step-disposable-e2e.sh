#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${RESONANCE_ROOT:-/opt/Resonance/var/deploy-worktrees/runtime-build}"
ACTOR_ENV_FILE="${CARBONET_ACTOR_TEST_ENV_FILE:-/opt/carbonet-data/config/actor-test.env}"
if [[ -r "$ACTOR_ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ACTOR_ENV_FILE"
  set +a
fi

export RESONANCE_ROOT="$ROOT_DIR"
export CARBONET_RUNTIME_BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}"
exec node "$ROOT_DIR/ops/scripts/resonance-seven-step-disposable-e2e.mjs"
