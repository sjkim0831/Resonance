#!/usr/bin/env bash
set -euo pipefail

root_dir="${FRONTEND_ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cache_dir="${FULL_SCREEN_SMOKE_CACHE_DIR:-$root_dir/.cache/full-screen-smoke}"
result_dir="${FULL_SCREEN_SMOKE_RESULT_DIR:-$cache_dir/results}"
export FULL_SCREEN_SMOKE_MANIFEST="${FULL_SCREEN_SMOKE_MANIFEST:-$cache_dir/manifest.json}"
export FULL_SCREEN_SMOKE_RESULT_DIR="$result_dir"
export FULL_SCREEN_SMOKE_BASELINE="${FULL_SCREEN_SMOKE_BASELINE:-$cache_dir/last-success.json}"

# Interrupted operator runs can leave Playwright's default output owned by a
# different account. Repair only these bounded generated directories before
# the fail-closed browser gate starts; source files are never changed here.
for generated_output in "$root_dir/test-results" "$root_dir/playwright-report"; do
  [[ -e "$generated_output" ]] || continue
  if [[ ! -w "$generated_output" ]]; then
    sudo -n chown -R "$(id -u):$(id -g)" "$generated_output"
  fi
done

case "$result_dir" in
  "$root_dir"/.cache/full-screen-smoke/*) ;;
  *) echo "unsafe smoke result directory: $result_dir" >&2; exit 2 ;;
esac
mkdir -p "$result_dir"
rm -f "$result_dir"/shard-*.json

bash "$root_dir/scripts/export-full-screen-smoke-manifest.sh"
bash "$root_dir/scripts/export-full-screen-quality-context.sh"

detect_safe_workers() {
  if [[ -n "${FULL_SCREEN_SMOKE_WORKERS:-}" ]]; then
    printf '%s' "$FULL_SCREEN_SMOKE_WORKERS"
    return
  fi

  local cpu_count available_kb load_one workers
  cpu_count="$(getconf _NPROCESSORS_ONLN 2>/dev/null || printf '2')"
  available_kb="$(awk '/MemAvailable:/ {print $2}' /proc/meminfo 2>/dev/null || printf '0')"
  load_one="$(awk '{print $1}' /proc/loadavg 2>/dev/null || printf '0')"
  workers=4

  (( cpu_count < workers )) && workers="$cpu_count"
  (( available_kb > 0 && available_kb < 3145728 )) && workers=2
  if awk -v load_value="$load_one" -v cpu="$cpu_count" 'BEGIN { exit !(cpu > 0 && load_value / cpu >= 0.75) }'; then
    workers=2
  elif awk -v load_value="$load_one" -v cpu="$cpu_count" 'BEGIN { exit !(cpu > 0 && load_value / cpu >= 0.50) }'; then
    (( workers > 3 )) && workers=3
  fi
  (( workers < 1 )) && workers=1
  printf '%s' "$workers"
}

smoke_workers="$(detect_safe_workers)"
printf '[full-screen-smoke] workers=%s cpu=%s load=%s memAvailableKb=%s\n' \
  "$smoke_workers" \
  "$(getconf _NPROCESSORS_ONLN 2>/dev/null || printf '?')" \
  "$(awk '{print $1}' /proc/loadavg 2>/dev/null || printf '?')" \
  "$(awk '/MemAvailable:/ {print $2}' /proc/meminfo 2>/dev/null || printf '?')"
set +e
PLAYWRIGHT_HOST_PLATFORM_OVERRIDE="${PLAYWRIGHT_HOST_PLATFORM_OVERRIDE:-ubuntu24.04-x64}" \
  npx playwright test e2e/full-screen-smoke.spec.ts \
  --workers="$smoke_workers" \
  --retries="${FULL_SCREEN_SMOKE_RETRIES:-1}" \
  --reporter="${FULL_SCREEN_SMOKE_REPORTER:-list}"
test_status=$?
set -e

set +e
node "$root_dir/scripts/finalize-full-screen-smoke.mjs"
finalize_status=$?
set -e

set +e
node "$root_dir/scripts/build-full-screen-quality-queue.mjs"
quality_status=$?
set -e
if [[ "$quality_status" -eq 0 ]]; then
  publish_dir="${FULL_SCREEN_QUALITY_PUBLISH_DIR:-$root_dir/../src/main/resources/static/react-app}"
  mkdir -p "$publish_dir"
  cp "$cache_dir/quality-report.json" "$publish_dir/full-screen-quality-report.json"
  cp "$cache_dir/development-priority-queue.json" "$publish_dir/full-screen-development-priority-queue.json"
fi
if [[ "$test_status" -ne 0 || "$finalize_status" -ne 0 || "$quality_status" -ne 0 ]]; then
  exit 1
fi
