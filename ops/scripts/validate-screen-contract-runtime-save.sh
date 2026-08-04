#!/usr/bin/env bash
set -euo pipefail

ROOT="${CARBONET_DEPLOY_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NODE_BIN="${NODE_BIN:-node}"

"$NODE_BIN" "$ROOT/ops/scripts/validate-screen-contract-runtime-save.mjs"
