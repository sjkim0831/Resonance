#!/usr/bin/env bash
set -euo pipefail

ROOT="${RESONANCE_FULL_E2E_ROOT:-/opt/Resonance/var/deploy-worktrees/runtime-build}"
RUNNER="$ROOT/ops/scripts/resonance-backstage-visual-e2e.sh"
[[ -f "$RUNNER" ]] || {
  echo "[backstage-full-e2e] current runtime worktree runner is missing: $RUNNER" >&2
  exit 2
}

export RESONANCE_ROOT="$ROOT"
export RESONANCE_BACKSTAGE_URL="https://backstage.172.16.1.232.nip.io:32947"
export RESONANCE_BACKSTAGE_E2E_SCOPE=full
unset RESONANCE_BACKSTAGE_E2E_ROUTES
exec bash "$RUNNER"
