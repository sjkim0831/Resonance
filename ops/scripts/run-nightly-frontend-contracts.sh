#!/usr/bin/env bash
set -euo pipefail

root="${CARBONET_DEPLOY_ROOT:-/opt/Resonance}"
candidate="$root/var/deploy-worktrees/runtime-build"
if [[ -d "$candidate/projects/carbonet-frontend/source" ]]; then
  root="$candidate"
fi
frontend="$root/projects/carbonet-frontend/source"

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

