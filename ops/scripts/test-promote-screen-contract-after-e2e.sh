#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMOTER="$ROOT/promote-screen-contract-after-e2e.sh"

PASS='{"status":"PASS","api":1,"database":1,"authority":1,"responsive":1,"accessibility":1,"exceptionStates":1,"audit":1,"recovery":1,"performanceP95Ms":250,"read":1,"write":1,"reread":1,"staleConflict":1,"restore":1}'
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
if printf '%s' '{"status":"PASS","api":1,"database":1,"authority":1,"responsive":1,"accessibility":0,"exceptionStates":1,"audit":1,"recovery":1,"performanceP95Ms":250,"read":1}' | bash "$PROMOTER" EMISSION_PROJECT_PORTFOLIO \
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

echo "[contract-e2e-promoter] PASS valid=1 missing=blocked failed=blocked unsafe=blocked"

DEPLOY_STATE="$(mktemp)"
trap 'rm -f "$DEPLOY_STATE"' EXIT
printf '%s\n' '0123456789abcdef0123456789abcdef01234567' > "$DEPLOY_STATE"
if printf '%s' "$PASS" | CARBONET_DEPLOY_STATE_FILE="$DEPLOY_STATE" bash "$PROMOTER" \
  EMISSION_PROJECT_PORTFOLIO EMISSION_PROJECT_PORTFOLIO_LIST read >/dev/null 2>&1; then
  echo "promotion without a pre-run contract envelope was accepted" >&2
  exit 1
fi
STALE='{"status":"PASS","api":1,"database":1,"authority":1,"responsive":1,"accessibility":1,"exceptionStates":1,"audit":1,"recovery":1,"performanceP95Ms":250,"read":1,"contract":{"processCode":"EMISSION_PROJECT_PORTFOLIO","stepCode":"EMISSION_PROJECT_PORTFOLIO_LIST","processVersion":"1.0.0","contractFingerprint":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","sourceCommit":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}}'
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
assert(source.indexOf("SET binding_status='ACTIVE'") > source.indexOf('contract promotion rejected'),
  'binding activation must occur after professional contract verification');
assert(source.includes('mandatoryChecks=["api","database","authority","responsive","accessibility","exceptionStates","audit","recovery"]'),
  'same-envelope mandatory assertion gate missing');
assert(!source.includes('api_verified=contract.api_verified OR'), 'verification flags must not accumulate across evidence envelopes');
NODE
echo "[contract-e2e-promoter] PASS publicBinding=draft-to-active exactRoute=guarded"
