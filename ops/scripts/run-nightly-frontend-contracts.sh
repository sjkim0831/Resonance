#!/usr/bin/env bash
set -euo pipefail

root="${CARBONET_DEPLOY_ROOT:-/opt/Resonance}"
candidate="$root/var/deploy-worktrees/runtime-build"
if [[ -d "$candidate/projects/carbonet-frontend/source" ]]; then
  root="$candidate"
fi
frontend="$root/projects/carbonet-frontend/source"

# The shared smoke credential file predates the full-screen suite and exposes
# ADMIN_SMOKE_* names. Keep that file compatible without duplicating secrets.
export FULL_SCREEN_SMOKE_ADMIN_USER="${FULL_SCREEN_SMOKE_ADMIN_USER:-${ADMIN_SMOKE_USER:-}}"
export FULL_SCREEN_SMOKE_ADMIN_PASSWORD="${FULL_SCREEN_SMOKE_ADMIN_PASSWORD:-${ADMIN_SMOKE_PASSWORD:-}}"

[[ -d "$frontend" && -x "$frontend/node_modules/.bin/tsc" ]] || {
  echo "[nightly-frontend-contracts] frontend dependencies are unavailable: $frontend" >&2
  exit 2
}

cd "$frontend"
echo "[nightly-frontend-contracts] full TypeScript validation started"
npm run typecheck:full
echo "[nightly-frontend-contracts] generated route identity validation started"
npm run audit:generated-route-family
echo "[nightly-frontend-contracts] 1000-screen browser regression started"
FULL_SCREEN_SMOKE_CHANGED_ONLY=false \
  bash scripts/run-full-screen-smoke.sh
echo "[nightly-frontend-contracts] PASS typecheck=full routeIdentity=closed browser=full"
