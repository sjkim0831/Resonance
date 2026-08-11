#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
ENV_FILE="${CARBONET_ACTOR_TEST_ENV_FILE:-/opt/carbonet-data/config/actor-test.env}"
[[ -r "$ENV_FILE" ]] && { set -a; source "$ENV_FILE"; set +a; }
bash "$ROOT/ops/tests/run-co2-quality-analysis-business-e2e.sh"
export CARBONET_RELAY_STEPS="CQA_PLAN,CQA_TEST,CQA_DECIDE"
export CARBONET_RELAY_ADMIN_ROUTE="/admin/work/co2-quality-analysis"
export CARBONET_RELAY_EVIDENCE_FILE="$ROOT/var/test-evidence/co2_quality_analysis-latest.json"
RESONANCE_ROOT="$ROOT" node "$ROOT/ops/scripts/resonance-declared-process-admin-browser-e2e.mjs"
RUNTIME_COMMIT="$(jq -er '.sourceCommit' "$CARBONET_RELAY_EVIDENCE_FILE")"
VALIDATION_COMMIT="$(jq -er '.validationCommit' "$CARBONET_RELAY_EVIDENCE_FILE")"
required="api,database,authority,responsive,accessibility,exceptionStates,audit,recovery,cleanup,adminBrowser,adminResponsive,adminAccessibility"
IFS=',' read -r -a STEPS <<<"$CARBONET_RELAY_STEPS"
for step in "${STEPS[@]}"; do
  contract="$(jq -c --arg step "$step" '.contracts[]|select(.stepCode==$step)' "$CARBONET_RELAY_EVIDENCE_FILE")"
  jq -c --argjson contract "$contract" '.contract=$contract' "$CARBONET_RELAY_EVIDENCE_FILE" | E2E_DEPLOYED_COMMIT="$RUNTIME_COMMIT" E2E_VALIDATION_COMMIT="$VALIDATION_COMMIT" bash "$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh" "CO2_QUALITY_ANALYSIS" "$step" "$required" ADMIN >/dev/null
done
printf '{"status":"ADMIN_PROMOTED","processCode":"CO2_QUALITY_ANALYSIS","steps":3,"adminRoutes":6}\n'
