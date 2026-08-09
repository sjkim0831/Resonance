#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PROMOTER="$ROOT/ops/scripts/promote-company-onboarding-after-e2e.sh"
VALID="$(jq -n '{status:"PASS",promotionEligible:true,processCode:"COMPANY_ONBOARDING",stepCount:5,caseCount:7,cleanup:1,api:1,database:1,authority:1,responsive:1,accessibility:1,exceptionStates:1,audit:1,recovery:1,desktop:1,mobile:1,routes:[range(0;20)|{}],performanceSampleCount:42,performanceP95Ms:395,sourceCommit:("a"*40),validationCommit:("a"*40),steps:{a:{result:"PASSED"},b:{result:"PASSED"},c:{result:"PASSED"},d:{result:"PASSED"},e:{result:"PASSED"}},cases:{COMPANY_ONBOARDING_HAPPY:{result:"PASSED"},COMPANY_ONBOARDING_NO_COMPANY:{result:"PASSED"},COMPANY_ONBOARDING_NO_SITE:{result:"PASSED"},COMPANY_ONBOARDING_RETRY:{result:"PASSED"},COMPANY_ONBOARDING_ROLE_GAP:{result:"PASSED"},COMPANY_ONBOARDING_SOD:{result:"PASSED"},COMPANY_ONBOARDING_TENANT:{result:"PASSED"}}}')"
printf '%s' "$VALID" | bash "$PROMOTER" --validate-only | jq -e '.status=="VALID" and .cases==7' >/dev/null
for mutation in \
  '.performanceP95Ms=501' \
  '.performanceSampleCount=19' \
  '.cleanup=0' \
  '.routes=[]' \
  '.cases.COMPANY_ONBOARDING_TENANT.result="FAILED"' \
  '.validationCommit="stale"'; do
  if jq "$mutation" <<<"$VALID" | bash "$PROMOTER" --validate-only >/dev/null 2>&1; then
    echo "mutation unexpectedly passed: $mutation" >&2; exit 1
  fi
done
echo COMPANY_ONBOARDING_PROMOTER_CONTRACT_PASS
