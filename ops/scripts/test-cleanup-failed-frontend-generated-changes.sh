#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

repo="$TMP_ROOT/repo"
mkdir -p "$repo/projects/carbonet-frontend/source/src/generated"
mkdir -p "$repo/projects/carbonet-frontend/source/src/features/builder-studio"
mkdir -p "$repo/projects/carbonet-frontend/source/src/features/example"
mkdir -p "$repo/projects/carbonet-frontend/source/.cache/full-screen-smoke/results"
mkdir -p "$repo/apps/carbonet-api/src/main/resources/static/react-app"
mkdir -p "$repo/projects/carbonet-assets/static/react-app"
mkdir -p "$repo/projects/carbonet-frontend/src/main/resources/static/react-app"
git -C "$repo" init -q
git -C "$repo" config user.email test@localhost
git -C "$repo" config user.name test
printf 'baseline\n' > "$repo/projects/carbonet-frontend/source/src/generated/verificationCenterInventory.json"
printf 'baseline\n' > "$repo/projects/carbonet-frontend/source/src/features/example/source.ts"
printf 'baseline\n' > "$repo/projects/carbonet-frontend/source/.cache/full-screen-smoke/results/shard-0.json"
printf 'baseline\n' > "$repo/apps/carbonet-api/src/main/resources/static/react-app/index.html"
printf 'baseline\n' > "$repo/projects/carbonet-assets/static/react-app/index.html"
printf 'baseline\n' > "$repo/projects/carbonet-frontend/src/main/resources/static/react-app/full-screen-deploy-gate-status.json"
printf 'baseline\n' > "$repo/projects/carbonet-frontend/src/main/resources/static/react-app/index.html"
git -C "$repo" add .
git -C "$repo" commit -qm baseline

printf 'generated-change\n' > "$repo/projects/carbonet-frontend/source/src/generated/verificationCenterInventory.json"
printf 'smoke-change\n' > "$repo/projects/carbonet-frontend/source/.cache/full-screen-smoke/results/shard-0.json"
printf 'api-package-change\n' > "$repo/apps/carbonet-api/src/main/resources/static/react-app/index.html"
printf 'asset-package-change\n' > "$repo/projects/carbonet-assets/static/react-app/index.html"
printf 'gate-change\n' > "$repo/projects/carbonet-frontend/src/main/resources/static/react-app/full-screen-deploy-gate-status.json"
printf 'overlay-change\n' > "$repo/projects/carbonet-frontend/src/main/resources/static/react-app/index.html"
bash "$SCRIPT_DIR/cleanup-failed-frontend-generated-changes.sh" "$repo"
grep -qx baseline "$repo/projects/carbonet-frontend/source/src/generated/verificationCenterInventory.json"
grep -qx baseline "$repo/projects/carbonet-frontend/source/.cache/full-screen-smoke/results/shard-0.json"
grep -qx baseline "$repo/apps/carbonet-api/src/main/resources/static/react-app/index.html"
grep -qx baseline "$repo/projects/carbonet-assets/static/react-app/index.html"
grep -qx baseline "$repo/projects/carbonet-frontend/src/main/resources/static/react-app/full-screen-deploy-gate-status.json"
grep -qx baseline "$repo/projects/carbonet-frontend/src/main/resources/static/react-app/index.html"
[[ -z "$(git -C "$repo" status --porcelain --untracked-files=no)" ]]

printf 'generated-change\n' > "$repo/projects/carbonet-frontend/source/src/generated/verificationCenterInventory.json"
printf 'user-source-change\n' > "$repo/projects/carbonet-frontend/source/src/features/example/source.ts"
if bash "$SCRIPT_DIR/cleanup-failed-frontend-generated-changes.sh" "$repo"; then
  echo '[cleanup-test] expected preserved source change to keep cleanup fail-closed' >&2
  exit 1
fi
grep -qx baseline "$repo/projects/carbonet-frontend/source/src/generated/verificationCenterInventory.json"
grep -qx user-source-change "$repo/projects/carbonet-frontend/source/src/features/example/source.ts"

echo '[cleanup-test] PASS generated files restored and source changes preserved'
