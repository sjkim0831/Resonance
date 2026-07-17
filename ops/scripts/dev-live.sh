#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"
if [[ "${DEV_LIVE_LEGACY:-false}" == "true" ]]; then
  exec node ops/scripts/dev-live.mjs
fi
exec bash ops/scripts/java-fast-dev.sh "$@"
