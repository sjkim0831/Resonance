#!/usr/bin/env bash
set -euo pipefail

root_dir="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cache_dir="${FULL_SCREEN_SMOKE_CACHE_DIR:-$root_dir/.cache/full-screen-smoke}"
result_dir="${FULL_SCREEN_SMOKE_RESULT_DIR:-$cache_dir/results}"
export FULL_SCREEN_SMOKE_MANIFEST="${FULL_SCREEN_SMOKE_MANIFEST:-$cache_dir/manifest.json}"
export FULL_SCREEN_SMOKE_RESULT_DIR="$result_dir"
export FULL_SCREEN_SMOKE_BASELINE="${FULL_SCREEN_SMOKE_BASELINE:-$cache_dir/last-success.json}"

case "$result_dir" in
  "$root_dir"/.cache/full-screen-smoke/*) ;;
  *) echo "unsafe smoke result directory: $result_dir" >&2; exit 2 ;;
esac
mkdir -p "$result_dir"
rm -f "$result_dir"/shard-*.json

bash "$root_dir/scripts/export-full-screen-smoke-manifest.sh"
set +e
PLAYWRIGHT_HOST_PLATFORM_OVERRIDE="${PLAYWRIGHT_HOST_PLATFORM_OVERRIDE:-ubuntu24.04-x64}" \
  npx playwright test e2e/full-screen-smoke.spec.ts \
  --workers="${FULL_SCREEN_SMOKE_WORKERS:-8}" \
  --reporter="${FULL_SCREEN_SMOKE_REPORTER:-list}"
test_status=$?
set -e

set +e
node "$root_dir/scripts/finalize-full-screen-smoke.mjs"
finalize_status=$?
set -e
if [[ "$test_status" -ne 0 || "$finalize_status" -ne 0 ]]; then
  exit 1
fi
