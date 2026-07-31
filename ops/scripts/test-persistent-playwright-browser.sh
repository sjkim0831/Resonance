#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
frontend="$ROOT_DIR/projects/carbonet-frontend/source"
runner="$frontend/scripts/run-full-screen-smoke.sh"
config="$frontend/playwright.config.ts"

node --check "$frontend/scripts/playwright-browser-server.mjs"
bash -n "$frontend/scripts/ensure-playwright-browser-server.sh"
grep -Fq 'connectOptions: process.env.PLAYWRIGHT_WS_ENDPOINT' "$config"
grep -Fq 'FULL_SCREEN_SMOKE_PERSISTENT_BROWSER:-true' "$runner"
grep -Fq 'retrying direct launch once' "$runner"
grep -Fq 'unset PLAYWRIGHT_WS_ENDPOINT' "$runner"
grep -Fq -- '--disable-dev-shm-usage' "$frontend/scripts/playwright-browser-server.mjs"
grep -Fq 'resonance-playwright-browser-server.service' "$frontend/scripts/ensure-playwright-browser-server.sh"
grep -Fq 'Restart=always' "$frontend/scripts/ensure-playwright-browser-server.sh"
grep -Fq 'sudo -n systemctl restart "$service_name"' "$frontend/scripts/ensure-playwright-browser-server.sh"

echo "[persistent-playwright-browser-test] PASS"
