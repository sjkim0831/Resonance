#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
ENV_FILE="${CARBONET_ACTOR_TEST_ENV_FILE:-/opt/carbonet-data/config/actor-test.env}"
if [[ -r "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi
[[ -d "$ROOT/projects/carbonet-frontend/source/node_modules/@playwright/test" ]] || {
  echo '[twenty-step-relay-e2e] FAIL Playwright dependency missing' >&2
  exit 2
}
RESONANCE_ROOT="$ROOT" node "$ROOT/ops/scripts/resonance-twenty-step-relay-e2e.mjs"
