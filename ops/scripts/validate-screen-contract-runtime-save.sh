#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${CARBONET_DEPLOY_ROOT:-}" ]]; then
  ROOT="$CARBONET_DEPLOY_ROOT"
elif ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  ROOT="$SCRIPT_DIR"
fi
NODE_BIN="${NODE_BIN:-node}"

if [[ -z "${CARBONET_VALIDATE_USER:-}" ]]; then
  export CARBONET_VALIDATE_USER=webmaster
fi
if [[ -z "${CARBONET_VALIDATE_PASSWORD:-}" && -f "$ROOT/ops/scripts/validate-customer-work-journey.sh" ]]; then
  CARBONET_VALIDATE_PASSWORD="$("$NODE_BIN" -e "const fs=require('fs');const text=fs.readFileSync(process.argv[1],'utf8');const match=text.match(/\\\"userPw\\\":\\\"([^\\\"]+)\\\"/);if(!match)process.exit(2);process.stdout.write(match[1]);" "$ROOT/ops/scripts/validate-customer-work-journey.sh")"
  export CARBONET_VALIDATE_PASSWORD
fi

"$NODE_BIN" "$ROOT/ops/scripts/validate-screen-contract-runtime-save.mjs"
