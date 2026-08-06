#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMOTER="$ROOT/promote-screen-contract-after-e2e.sh"

PASS='{"status":"PASS","read":1,"write":1,"reread":1,"staleConflict":1,"restore":1}'
printf '%s' "$PASS" | bash "$PROMOTER" EMISSION_PROJECT_PORTFOLIO EMISSION_PROJECT_PORTFOLIO_LIST \
  read,write,reread,staleConflict,restore --validate-only >/dev/null

if printf '%s' '{"status":"PASS","read":1}' | bash "$PROMOTER" EMISSION_PROJECT_PORTFOLIO \
  EMISSION_PROJECT_PORTFOLIO_LIST read,write --validate-only >/dev/null 2>&1; then
  echo "missing assertion was accepted" >&2
  exit 1
fi

if printf '%s' '{"status":"FAIL","read":1,"write":1}' | bash "$PROMOTER" EMISSION_PROJECT_PORTFOLIO \
  EMISSION_PROJECT_PORTFOLIO_LIST read,write --validate-only >/dev/null 2>&1; then
  echo "failed E2E was accepted" >&2
  exit 1
fi

if printf '%s' "$PASS" | bash "$PROMOTER" 'BAD;SQL' EMISSION_PROJECT_PORTFOLIO_LIST \
  read --validate-only >/dev/null 2>&1; then
  echo "unsafe process code was accepted" >&2
  exit 1
fi

if printf '%s' "$PASS" | bash "$PROMOTER" EMISSION_PROJECT_PORTFOLIO \
  EMISSION_PROJECT_PORTFOLIO_LIST read DESKTOP --validate-only >/dev/null 2>&1; then
  echo "unsafe audience was accepted" >&2
  exit 1
fi

echo "[contract-e2e-promoter] PASS valid=1 missing=blocked failed=blocked unsafe=blocked"

RELAY='{"status":"PASSED","processCount":5,"stepCount":20,"transitionCount":21,"accountCount":5,"correctionReplayCount":1}'
printf '%s' "$RELAY" | bash "$PROMOTER" EMISSION_PROJECT_PORTFOLIO EMISSION_PROJECT_PORTFOLIO_LIST \
  processCount=5,stepCount=20,transitionCount=21,accountCount=5,correctionReplayCount=1 \
  --validate-only >/dev/null
echo "[contract-e2e-promoter] PASS relay-assertions=5"
