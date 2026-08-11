#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
COMMON_PROMOTER="$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh"
PROCESS=COMPANY_REAPPLICATION_PUBLIC
PUBLIC_STEP=COMPANY_REAPPLICATION_PUBLIC_RESUBMIT
ADMIN_STEP=COMPANY_REAPPLICATION_APPROVER_REVIEW
REQUIRED="api,database,authority,responsive,accessibility,exceptionStates,audit,recovery,cleanup,token,replayBlocked,rateLimitFixtureCleanup,browserRateLimitFixtureCleanup,screenContextPreflight,desktop,mobile,browserJourney,browserPersistence,businessJourneyDesktop,businessJourneyMobile,downloadVerified,representativeUpdateVerified,applicantResponseVerified,adminRelay"
EVIDENCE="$(cat)"
TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT
printf '%s' "$EVIDENCE" >"$TMP/public.json"

admin_contract="$(K8S_NAMESPACE="$NAMESPACE" bash "$ROOT/ops/scripts/capture-business-e2e-contract.sh" "$PROCESS" "$ADMIN_STEP")"
jq -c --argjson adminContract "$admin_contract" '
  .contracts=(((.contracts // []) + [.contract,$adminContract]) | unique_by(.stepCode))
  | .contract=$adminContract
' "$TMP/public.json" >"$TMP/admin.json"

RESONANCE_ROOT="$ROOT" E2E_EXECUTION_ENVIRONMENT="$NAMESPACE" \
  bash "$COMMON_PROMOTER" "$PROCESS" "$PUBLIC_STEP" "$REQUIRED" PUBLIC --prepare-only \
  <"$TMP/public.json" >>"$TMP/prepared.jsonl"
RESONANCE_ROOT="$ROOT" E2E_EXECUTION_ENVIRONMENT="$NAMESPACE" \
  bash "$COMMON_PROMOTER" "$PROCESS" "$ADMIN_STEP" "$REQUIRED" ADMIN --prepare-only \
  <"$TMP/admin.json" >>"$TMP/prepared.jsonl"
jq -s 'if length==2 and ([.[].stepCode]|unique|length)==2 then . else error("exactly two unique prepared steps are required") end' \
  "$TMP/prepared.jsonl" >"$TMP/prepared.json"

sed -n '/^BEGIN;$/,/^COMMIT;$/p' "$COMMON_PROMOTER" | sed '1d;$d' >"$TMP/body.sql"
[[ -s "$TMP/body.sql" ]] || { echo COMPANY_REAPPLICATION_ATOMIC_PROMOTION_SQL_MISSING >&2; exit 2; }
node - "$TMP/prepared.json" "$TMP/body.sql" "$TMP/transaction.sql" <<'NODE'
const fs=require('node:fs');
const [preparedPath,bodyPath,outPath]=process.argv.slice(2);
const prepared=JSON.parse(fs.readFileSync(preparedPath,'utf8'));
const body=fs.readFileSync(bodyPath,'utf8');
const fields=['processCode','stepCode','audience','evidenceB64','evidenceSha256','sourceCommit','processVersion','contractFingerprint','executionEnvironment','evidenceUri'];
const patterns={processCode:/^[A-Z0-9_]+$/,stepCode:/^[A-Z0-9_]+$/,audience:/^(USER|ADMIN|PUBLIC|ALL)$/,evidenceB64:/^[A-Za-z0-9+/=]+$/,evidenceSha256:/^[0-9a-f]{64}$/,sourceCommit:/^[0-9a-fA-F]{7,80}$/,processVersion:/^[A-Za-z0-9._-]+$/,contractFingerprint:/^[0-9a-f]{32,128}$/,executionEnvironment:/^[A-Za-z0-9._-]+$/,evidenceUri:/^[A-Za-z0-9:/._-]+$/};
const names={processCode:'process_code',stepCode:'step_code',audience:'audience',evidenceB64:'evidence_b64',evidenceSha256:'evidence_sha256',sourceCommit:'source_commit',processVersion:'process_version',contractFingerprint:'contract_fingerprint',executionEnvironment:'execution_environment',evidenceUri:'evidence_uri'};
const lines=['BEGIN;'];
for(const item of prepared){for(const field of fields){const value=String(item[field]??'');if(!patterns[field].test(value))throw new Error(`invalid prepared field ${field}`);lines.push(`\\set ${names[field]} '${value}'`);}lines.push(body);}
lines.push(`DO $$ DECLARE passed integer; BEGIN SELECT count(*) INTO passed FROM framework_current_business_e2e_evidence WHERE process_code='COMPANY_REAPPLICATION_PUBLIC' AND step_code IN ('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT','COMPANY_REAPPLICATION_APPROVER_REVIEW') AND business_test_result='PASSED' AND current_version; IF passed<>2 THEN RAISE EXCEPTION 'atomic reapplication evidence mismatch passed=%',passed; END IF; END $$;`);
lines.push('COMMIT;');
fs.writeFileSync(outPath,lines.join('\n'),'utf8');
NODE

pod="${PATRONI_POD:-$(K8S_NAMESPACE="$NAMESPACE" bash "$ROOT/ops/scripts/resolve-patroni-primary-pod.sh")}"
kubectl -n "$NAMESPACE" exec -i "$pod" -c patroni -- env PGOPTIONS='-c lock_timeout=10000 -c statement_timeout=60000' \
  psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d carbonet -X -q -o /dev/null <"$TMP/transaction.sql"
printf '{"status":"PROMOTED","processCode":"%s","steps":2,"atomic":true}\n' "$PROCESS"
