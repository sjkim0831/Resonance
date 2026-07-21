#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:?repository root is required}"
JOB_TYPE="${2:?job type is required}"
SPEC_FILE="${3:?specification file is required}"
GOVERNANCE_FILE="${4:?governance file is required}"
POLICY="$ROOT/ops/runtime-metadata/professional-development-policy.json"

jq -e '
  . as $policy |
  $policy.policyId == "resonance-professional-development-pipeline" and
  ($policy.completionOrder | length == 8) and
  ($policy.mandatoryDimensions | length >= 10) and
  ($policy.minimumProfessionalScore >= 90) and
  $policy.failClosed == true and $policy.allowPromptOnlyCompletion == false and
  $policy.allowUnverifiedCompletion == false and
  (["LIST","FORM","DETAIL","APPROVAL","CALCULATION","UPLOAD","REPORT","ADMIN"] |
    all(. as $type | ($policy.screenTypeTemplates[$type] | type == "array" and length >= 5)))
' "$POLICY" >/dev/null

jq -e '
  type == "object" and
  (.requirement | type == "string" and length >= 10)
' "$SPEC_FILE" >/dev/null

jq -e '
  type == "object" and
  (.processCode | type == "string" and length > 0) and
  (.stepCode | type == "string" and length > 0) and
  (.actorCode | type == "string" and length > 0) and
  (.requirement | type == "string" and length >= 10)
' "$GOVERNANCE_FILE" >/dev/null

if jq -e --arg type "$JOB_TYPE" '.screenGovernedJobTypes | index($type) != null' "$POLICY" >/dev/null; then
  jq -e '
    (.screenContractCount >= 1) and
    (.routeCount >= 1) and
    .apiVerified and .databaseVerified and .authorityVerified and
    .responsiveVerified and .accessibilityVerified and .exceptionStatesVerified
  ' "$GOVERNANCE_FILE" >/dev/null
fi

jq -cn \
  --arg policy "$(jq -r .policyId "$POLICY")" \
  --arg version "$(jq -r .version "$POLICY")" \
  --arg jobType "$JOB_TYPE" \
  --argjson screenGoverned "$(jq -e --arg type "$JOB_TYPE" '.screenGovernedJobTypes | index($type) != null' "$POLICY" >/dev/null && echo true || echo false)" \
  --argjson professionalScore "$(jq -r .minimumProfessionalScore "$POLICY")" \
  '{policy:$policy,version:$version,jobType:$jobType,screenGoverned:$screenGoverned,minimumProfessionalScore:$professionalScore,result:"PASSED"}'
