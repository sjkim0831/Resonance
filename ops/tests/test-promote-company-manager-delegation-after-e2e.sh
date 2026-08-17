#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"; P="$ROOT/ops/scripts/promote-company-manager-delegation-after-e2e.sh"
bash -n "$P"
VALID="$(jq -n '{status:"PASS",promotionEligible:true,processCode:"COMPANY_MANAGER_DELEGATION",stepCount:3,caseCount:5,cleanup:1,request:1,idempotency:1,authorityDenial:1,approval:1,atomicHandover:1,successorVisible:1,projectCleanup:1,sourceCommit:("a"*40),contracts:[range(0;3)|{sourceCommit:("a"*40),runtimeIdentityHash:("b"*64),podTemplateSha256:("c"*64)}],steps:{CMD_REQUEST:{result:"PASSED"},CMD_APPROVE:{result:"PASSED"},CMD_HANDOVER:{result:"PASSED"}},cases:{COMPANY_MANAGER_DELEGATION_AUTHORITY:{result:"PASSED"},COMPANY_MANAGER_DELEGATION_EXCEPTION:{result:"PASSED"},COMPANY_MANAGER_DELEGATION_HAPPY:{result:"PASSED"},COMPANY_MANAGER_DELEGATION_ISOLATION:{result:"PASSED"},COMPANY_MANAGER_DELEGATION_RECOVERY:{result:"PASSED"}}}')"
printf '%s' "$VALID" | bash "$P" --validate-only | jq -e '.status=="VALID" and .cases==5' >/dev/null
for mutation in '.cleanup=0' '.atomicHandover=0' '.authorityDenial=0' '.steps.CMD_HANDOVER.result="FAILED"' '.cases.COMPANY_MANAGER_DELEGATION_RECOVERY.result="FAILED"' '.sourceCommit="stale"' '.contracts[2].sourceCommit=("d"*40)' '.contracts[2].runtimeIdentityHash=("d"*64)' '.contracts[2].podTemplateSha256=("d"*64)' 'del(.contracts[2])'; do if jq "$mutation" <<<"$VALID" | bash "$P" --validate-only >/dev/null 2>&1; then echo "mutation unexpectedly passed: $mutation" >&2; exit 1; fi; done
for token in \
  'framework_runtime_release_identity_hash(runtime)' \
  "pod_template_sha256=:'pod_template_sha256'" \
  'FOR SHARE' \
  "r.evidence_json::jsonb->>'runtimeIdentityHash'=:'runtime_identity_hash'"; do
  grep -Fq "$token" "$P" || { echo "manager delegation runtime contract missing: $token" >&2; exit 1; }
done
echo COMPANY_MANAGER_DELEGATION_PROMOTER_CONTRACT_PASS runtimeIdentity=contracts3+DBlock+liveTemplate
