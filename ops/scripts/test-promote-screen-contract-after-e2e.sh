#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMOTER="$ROOT/promote-screen-contract-after-e2e.sh"

PASS='{"status":"PASS","api":1,"database":1,"authority":1,"responsive":1,"accessibility":1,"exceptionStates":1,"audit":1,"recovery":1,"performanceP95Ms":250,"performanceSampleCount":20,"read":1,"write":1,"reread":1,"staleConflict":1,"restore":1}'
printf '%s' "$PASS" | bash "$PROMOTER" EMISSION_PROJECT_PORTFOLIO EMISSION_PROJECT_PORTFOLIO_LIST \
  read,write,reread,staleConflict,restore --validate-only >/dev/null

printf '%s' "$PASS" | bash "$PROMOTER" COMPANY_REAPPLICATION_PUBLIC \
  COMPANY_REAPPLICATION_PUBLIC_RESUBMIT read PUBLIC --validate-only >/dev/null
echo "[contract-e2e-promoter] PASS public=accepted"

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

# A partial envelope may be validated, but must fail before any promotion path.
if printf '%s' '{"status":"PASS","api":1,"database":1,"authority":1,"responsive":1,"accessibility":0,"exceptionStates":1,"audit":1,"recovery":1,"performanceP95Ms":250,"performanceSampleCount":20,"read":1}' | bash "$PROMOTER" EMISSION_PROJECT_PORTFOLIO \
  EMISSION_PROJECT_PORTFOLIO_LIST read >/dev/null 2>&1; then
  echo "split or incomplete evidence envelope was accepted" >&2
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

printf '%s' '{"status":"PASS","read":1}' | bash "$PROMOTER" EMISSION_PROJECT_PORTFOLIO \
  EMISSION_PROJECT_PORTFOLIO_LIST read --validate-only >/dev/null
echo "[contract-e2e-promoter] PASS partial-evidence=validate-only"

for invalid_samples in 19 null; do
  if printf '%s' "${PASS/\"performanceSampleCount\":20/\"performanceSampleCount\":$invalid_samples}" | \
    bash "$PROMOTER" EMISSION_PROJECT_PORTFOLIO EMISSION_PROJECT_PORTFOLIO_LIST read >/dev/null 2>&1; then
    echo "insufficient performance samples were accepted: $invalid_samples" >&2
    exit 1
  fi
done
MISSING_SAMPLES="$(printf '%s' "$PASS" | sed 's/,\"performanceSampleCount\":20//')"
if printf '%s' "$MISSING_SAMPLES" | bash "$PROMOTER" EMISSION_PROJECT_PORTFOLIO \
  EMISSION_PROJECT_PORTFOLIO_LIST read >/dev/null 2>&1; then
  echo "missing performance samples were accepted" >&2
  exit 1
fi
echo "[contract-e2e-promoter] PASS performanceSamples=min-20 low=blocked missing=blocked"

echo "[contract-e2e-promoter] PASS valid=1 missing=blocked failed=blocked unsafe=blocked"

DEPLOY_STATE="$(mktemp)"
trap 'rm -f "$DEPLOY_STATE"' EXIT
printf '%s\n' '0123456789abcdef0123456789abcdef01234567' > "$DEPLOY_STATE"
if printf '%s' "$PASS" | CARBONET_DEPLOY_STATE_FILE="$DEPLOY_STATE" bash "$PROMOTER" \
  EMISSION_PROJECT_PORTFOLIO EMISSION_PROJECT_PORTFOLIO_LIST read >/dev/null 2>&1; then
  echo "promotion without a pre-run contract envelope was accepted" >&2
  exit 1
fi
STALE='{"status":"PASS","api":1,"database":1,"authority":1,"responsive":1,"accessibility":1,"exceptionStates":1,"audit":1,"recovery":1,"performanceP95Ms":250,"performanceSampleCount":20,"read":1,"contract":{"processCode":"EMISSION_PROJECT_PORTFOLIO","stepCode":"EMISSION_PROJECT_PORTFOLIO_LIST","processVersion":"1.0.0","contractFingerprint":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","sourceCommit":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}}'
if printf '%s' "$STALE" | CARBONET_DEPLOY_STATE_FILE="$DEPLOY_STATE" bash "$PROMOTER" \
  EMISSION_PROJECT_PORTFOLIO EMISSION_PROJECT_PORTFOLIO_LIST read >/dev/null 2>&1; then
  echo "promotion bound to a different deployed commit was accepted" >&2
  exit 1
fi
echo "[contract-e2e-promoter] PASS preRunEnvelope=required deployedCommit=stable"

RELAY='{"status":"PASSED","api":1,"database":1,"authority":1,"responsive":1,"accessibility":1,"exceptionStates":1,"audit":1,"recovery":1,"performanceP95Ms":250,"processCount":5,"stepCount":20,"transitionCount":21,"accountCount":5,"correctionReplayCount":1}'
printf '%s' "$RELAY" | bash "$PROMOTER" EMISSION_PROJECT_PORTFOLIO EMISSION_PROJECT_PORTFOLIO_LIST \
  processCount=5,stepCount=20,transitionCount=21,accountCount=5,correctionReplayCount=1 \
  --validate-only >/dev/null
echo "[contract-e2e-promoter] PASS relay-assertions=5"

node - "$PROMOTER" <<'NODE'
const fs = require('fs');
const source = fs.readFileSync(process.argv[2], 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(source.includes("binding.audience='PUBLIC'"), 'PUBLIC binding promotion scope missing');
assert(source.includes("binding.binding_status='DRAFT'"), 'DRAFT-only activation guard missing');
assert(source.includes("SET binding_status='ACTIVE'"), 'PUBLIC binding activation missing');
assert(source.includes("contract.contract_status='VERIFIED'"), 'verified-contract gate missing');
assert(source.includes("contract.audit_evidence_ref=concat('qa-run:sha256:'"), 'same-evidence gate missing');
assert(source.includes("AND :'audience' IN ('PUBLIC','ALL')"), 'PUBLIC/ALL invocation gate missing');
assert(source.includes('active_exact_count<>public_contract_count'), 'exact active binding count guard missing');
assert(source.includes('wrong_active_count<>0'), 'wrong active binding rollback guard missing');
assert(source.includes('resource.screen_resource_id IN ('), 'wrong-active guard is not current-route scoped');
assert(source.includes('target_contract.process_code=current_setting'), 'current PUBLIC contract route missing');
assert(source.includes('target_contract.audit_evidence_ref='), 'wrong-active route is not bound to the same E2E SHA');
assert(source.includes('INSERT INTO framework_screen_workflow_policy('),
  'PUBLIC promotion does not close the route policy atomically');
assert(source.includes("'EXECUTABLE','RUNTIME_WORKFLOW_RESOLVED'"),
  'promoted route policy is not executable runtime evidence');
assert(source.includes("framework_screen_workflow_policy.reason_code='MISSING_WORKFLOW_EVIDENCE'"),
  'stale pre-promotion policy guard missing');
assert(source.includes("framework_screen_workflow_policy.review_status='PENDING'"),
  'human-reviewed route policy could be overwritten');
assert(source.includes("framework_screen_workflow_policy.source='CONTRACT_E2E_PROMOTER'"),
  'idempotent promoter-owned policy update missing');
assert(source.includes("framework_screen_workflow_policy.source='CONTRACT_E2E_PROMOTER'\n       AND framework_screen_workflow_policy.review_status='AUTO_APPROVED'\n       AND framework_screen_workflow_policy.reviewed_by IS NULL\n       AND framework_screen_workflow_policy.reviewed_at IS NULL"),
  'promoter-owned retry can overwrite a human-reviewed policy');
assert(source.includes('executable_policy_count<>public_contract_count'),
  'binding and workflow policy are not count-closed together');
assert(source.indexOf("SET binding_status='ACTIVE'") > source.indexOf('contract promotion rejected'),
  'binding activation must occur after professional contract verification');
assert(source.indexOf('INSERT INTO framework_screen_workflow_policy(') > source.indexOf("SET binding_status='ACTIVE'"),
  'route policy must be synchronized only after exact binding activation');
assert(source.includes('mandatoryChecks=["api","database","authority","responsive","accessibility","exceptionStates","audit","recovery"]'),
  'same-envelope mandatory assertion gate missing');
assert(source.includes('Number(evidence.performanceSampleCount)<20'),
  'minimum 20 route-sample assertion gate missing');
assert(source.includes("performanceSampleCount')::integer,0)>=20"),
  'SQL promotion gate does not enforce 20 route samples');
assert(!source.includes('api_verified=contract.api_verified OR'), 'verification flags must not accumulate across evidence envelopes');

const policyContractValid = (candidate) => [
  'INSERT INTO framework_screen_workflow_policy(',
  "'EXECUTABLE','RUNTIME_WORKFLOW_RESOLVED'",
  "framework_screen_workflow_policy.reason_code='MISSING_WORKFLOW_EVIDENCE'",
  "framework_screen_workflow_policy.review_status='PENDING'",
  "framework_screen_workflow_policy.review_status='AUTO_APPROVED'",
  'framework_screen_workflow_policy.reviewed_by IS NULL',
  'framework_screen_workflow_policy.reviewed_at IS NULL',
  'executable_policy_count<>public_contract_count',
].every((token) => candidate.includes(token));
for (const [name, mutated] of [
  ['classification', source.replace("'EXECUTABLE','RUNTIME_WORKFLOW_RESOLVED'", "'REVIEW_REQUIRED','MISSING_WORKFLOW_EVIDENCE'")],
  ['reason-guard', source.replace("framework_screen_workflow_policy.reason_code='MISSING_WORKFLOW_EVIDENCE'", "framework_screen_workflow_policy.reason_code='ANY'")],
  ['review-guard', source.replace("framework_screen_workflow_policy.review_status='PENDING'", "framework_screen_workflow_policy.review_status='APPROVED'")],
  ['human-status-preservation', source.replace("framework_screen_workflow_policy.review_status='AUTO_APPROVED'", "framework_screen_workflow_policy.review_status IN ('AUTO_APPROVED','APPROVED','REJECTED')")],
  ['human-reviewer-preservation', source.replace('framework_screen_workflow_policy.reviewed_by IS NULL', 'framework_screen_workflow_policy.reviewed_by IS NOT NULL')],
  ['human-reviewed-at-preservation', source.replace('framework_screen_workflow_policy.reviewed_at IS NULL', 'framework_screen_workflow_policy.reviewed_at IS NOT NULL')],
  ['count-closure', source.replace('executable_policy_count<>public_contract_count', 'executable_policy_count<0')],
]) assert(!policyContractValid(mutated), `route-policy mutation escaped: ${name}`);
NODE
echo "[contract-e2e-promoter] PASS publicBinding=draft-to-active exactRoute=guarded policy=atomic humanReview=preserved mutations=7"
