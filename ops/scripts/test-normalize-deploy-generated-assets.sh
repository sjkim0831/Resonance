#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
normalizer="$script_dir/normalize-deploy-generated-assets.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git -C "$tmp" init -q
git -C "$tmp" config user.email test@example.invalid
git -C "$tmp" config user.name test
mkdir -p \
  "$tmp/apps/carbonet-api/src/main/resources/static/react-app/assets" \
  "$tmp/projects/carbonet-frontend/src/main/resources/static/react-app/assets" \
  "$tmp/projects/carbonet-frontend/source/src/generated/screen-generation/definitions" \
  "$tmp/.gradle/caches"
printf 'tracked\n' >"$tmp/apps/carbonet-api/src/main/resources/static/react-app/index.html"
printf 'tracked\n' >"$tmp/projects/carbonet-frontend/src/main/resources/static/react-app/index.html"
printf '.gradle/\n' >"$tmp/.gitignore"
git -C "$tmp" add .
git -C "$tmp" commit -qm seed

printf 'modified\n' >"$tmp/apps/carbonet-api/src/main/resources/static/react-app/index.html"
printf 'generated\n' >"$tmp/apps/carbonet-api/src/main/resources/static/react-app/assets/new.js"
printf 'generated\n' >"$tmp/projects/carbonet-frontend/src/main/resources/static/react-app/assets/new.js"
printf 'generated\n' >"$tmp/projects/carbonet-frontend/source/src/generated/screen-generation/definitions/new.json"
printf 'cache\n' >"$tmp/.gradle/caches/keep.bin"

bash "$normalizer" "$tmp" | grep -q GENERATED_WORKTREE_CLEAN
[[ "$(cat "$tmp/apps/carbonet-api/src/main/resources/static/react-app/index.html")" == tracked ]]
[[ -f "$tmp/.gradle/caches/keep.bin" ]]
[[ -z "$(git -C "$tmp" status --porcelain=v1)" ]]
echo "GENERATED_WORKTREE_NORMALIZE_TEST_PASS"
