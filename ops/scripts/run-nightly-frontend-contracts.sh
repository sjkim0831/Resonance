#!/usr/bin/env bash
set -euo pipefail

root="${CARBONET_DEPLOY_ROOT:-/opt/Resonance}"
candidate="$root/var/deploy-worktrees/runtime-build"
if [[ -d "$candidate/projects/carbonet-frontend/source" ]]; then
  root="$candidate"
fi
frontend="$root/projects/carbonet-frontend/source"
generated="$frontend/src/generated/screen-generation"
shared_generated="${SHARED_GENERATED_SCREEN_DIR:-/opt/Resonance/projects/carbonet-frontend/source/src/generated/screen-generation}"
created_links=()
quality_artifact_dir="${FULL_SCREEN_QUALITY_ARTIFACT_DIR:-/opt/resonance-data/quality/full-screen/latest}"

# The shared smoke credential file predates the full-screen suite and exposes
# ADMIN_SMOKE_* names. Keep that file compatible without duplicating secrets.
export FULL_SCREEN_SMOKE_ADMIN_USER="${FULL_SCREEN_SMOKE_ADMIN_USER:-${ADMIN_SMOKE_USER:-}}"
export FULL_SCREEN_SMOKE_ADMIN_PASSWORD="${FULL_SCREEN_SMOKE_ADMIN_PASSWORD:-${ADMIN_SMOKE_PASSWORD:-}}"

[[ -d "$frontend" && -x "$frontend/node_modules/.bin/tsc" ]] || {
  echo "[nightly-frontend-contracts] frontend dependencies are unavailable: $frontend" >&2
  exit 2
}

# Generated definitions are DB materializations and intentionally remain
# outside Git. Materialize the same verified-worktree links used by deployment,
# then remove only links created by this run.
mkdir -p "$generated"
if [[ ! -e "$generated/definitions" && -d "$shared_generated/definitions" ]]; then
  ln -s "$shared_generated/definitions" "$generated/definitions"
  created_links+=("$generated/definitions")
fi
if [[ ! -e "$generated/generatedScreenTypes.ts" && -f "$shared_generated/generatedScreenTypes.ts" ]]; then
  ln -s "$shared_generated/generatedScreenTypes.ts" "$generated/generatedScreenTypes.ts"
  created_links+=("$generated/generatedScreenTypes.ts")
fi
cleanup_generated_links() {
  local exit_status=$?
  local path
  mkdir -p "$quality_artifact_dir" 2>/dev/null || true
  if [[ -d "$frontend/.cache/full-screen-smoke" && -d "$quality_artifact_dir" ]]; then
    cp -a "$frontend/.cache/full-screen-smoke/." "$quality_artifact_dir/" 2>/dev/null || true
  fi
  for path in "${created_links[@]}"; do
    [[ -L "$path" ]] && rm -f "$path"
  done
  git -C "$root" restore --worktree -- \
    projects/carbonet-frontend/source/.cache/full-screen-smoke 2>/dev/null || true
  git -C "$root" clean -ffd -- \
    projects/carbonet-frontend/source/.cache/full-screen-smoke >/dev/null 2>&1 || true
  /usr/bin/bash "$root/ops/scripts/normalize-deploy-generated-assets.sh" "$root" >/dev/null 2>&1 || true
  return "$exit_status"
}
trap cleanup_generated_links EXIT
[[ -d "$generated/definitions" && -f "$generated/generatedScreenTypes.ts" ]] || {
  echo "[nightly-frontend-contracts] generated screen assets are unavailable" >&2
  exit 2
}

cd "$frontend"
echo "[nightly-frontend-contracts] TypeScript validation started"
bash scripts/run-contract-typecheck.sh
echo "[nightly-frontend-contracts] generated route identity validation started"
npm run audit:generated-route-family
echo "[nightly-frontend-contracts] 1000-screen browser regression started"
FULL_SCREEN_SMOKE_CHANGED_ONLY=false \
  bash scripts/run-full-screen-smoke.sh
echo "[nightly-frontend-contracts] PASS typecheck=governed routeIdentity=closed browser=full"
