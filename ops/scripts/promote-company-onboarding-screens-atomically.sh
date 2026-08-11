#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
COMMON_PROMOTER="$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh"
PROCESS=COMPANY_ONBOARDING
REQUIRED_CHECKS="api,database,authority,responsive,accessibility,exceptionStates,audit,recovery,cleanup,desktop,mobile"
STEPS=(
  COMPANY_ONBOARDING_APPLY
  COMPANY_ONBOARDING_APPROVE
  COMPANY_ONBOARDING_SITE
  COMPANY_ONBOARDING_ACTORS
  COMPANY_ONBOARDING_READY
)

EVIDENCE="$(cat)"
TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT
printf '%s' "$EVIDENCE" >"$TMP/evidence.json"

for step in "${STEPS[@]}"; do
  RESONANCE_ROOT="$ROOT" E2E_EXECUTION_ENVIRONMENT="$NAMESPACE" \
    bash "$COMMON_PROMOTER" "$PROCESS" "$step" "$REQUIRED_CHECKS" ALL --prepare-only \
      <"$TMP/evidence.json" >>"$TMP/prepared.jsonl"
done
jq -s 'if length==5 and ([.[].stepCode]|unique|length)==5 then . else error("exactly five unique prepared steps are required") end' \
  "$TMP/prepared.jsonl" >"$TMP/prepared.json"

sed -n '/^BEGIN;$/,/^COMMIT;$/p' "$COMMON_PROMOTER" | sed '1d;$d' >"$TMP/promotion-body.sql"
[[ -s "$TMP/promotion-body.sql" ]] || { echo COMPANY_ONBOARDING_PROMOTION_SQL_MISSING >&2; exit 2; }

node - "$TMP/prepared.json" "$TMP/promotion-body.sql" "$TMP/transaction.sql" <<'NODE'
const fs=require('node:fs');
const [preparedPath,bodyPath,outPath]=process.argv.slice(2);
const prepared=JSON.parse(fs.readFileSync(preparedPath,'utf8'));
const body=fs.readFileSync(bodyPath,'utf8');
const fields=['processCode','stepCode','audience','evidenceB64','evidenceSha256','sourceCommit',
  'processVersion','contractFingerprint','executionEnvironment','evidenceUri'];
const patterns={
  processCode:/^[A-Z0-9_]+$/,stepCode:/^[A-Z0-9_]+$/,audience:/^(USER|ADMIN|PUBLIC|ALL)$/,
  evidenceB64:/^[A-Za-z0-9+/=]+$/,evidenceSha256:/^[0-9a-f]{64}$/,
  sourceCommit:/^[0-9a-fA-F]{7,80}$/,processVersion:/^[A-Za-z0-9._-]+$/,
  contractFingerprint:/^[0-9a-f]{32,128}$/,executionEnvironment:/^[A-Za-z0-9._-]+$/,
  evidenceUri:/^[A-Za-z0-9:/._-]+$/,
};
const psqlNames={processCode:'process_code',stepCode:'step_code',audience:'audience',
  evidenceB64:'evidence_b64',evidenceSha256:'evidence_sha256',sourceCommit:'source_commit',
  processVersion:'process_version',contractFingerprint:'contract_fingerprint',
  executionEnvironment:'execution_environment',evidenceUri:'evidence_uri'};
const lines=['BEGIN;'];
for(const item of prepared){
  for(const field of fields){
    const value=String(item[field]??'');
    if(!patterns[field].test(value)) throw new Error(`invalid prepared field ${field}`);
    lines.push(`\\set ${psqlNames[field]} '${value}'`);
  }
  lines.push(body);
}
lines.push(`DO $$\nDECLARE passed integer;\nBEGIN\n  SELECT count(*) INTO passed FROM framework_current_business_e2e_evidence\n  WHERE process_code='COMPANY_ONBOARDING' AND business_test_result='PASSED' AND current_version;\n  IF passed<>5 THEN RAISE EXCEPTION 'atomic onboarding evidence mismatch passed=%',passed; END IF;\nEND $$;`);
lines.push('COMMIT;');
fs.writeFileSync(outPath,lines.join('\n'),'utf8');
NODE

PATRONI_POD="${PATRONI_POD:-$(K8S_NAMESPACE="$NAMESPACE" bash "$ROOT/ops/scripts/resolve-patroni-primary-pod.sh")}" 
kubectl -n "$NAMESPACE" exec -i "$PATRONI_POD" -c patroni -- \
  psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d carbonet -X -q -o /dev/null \
  <"$TMP/transaction.sql"

printf '{"status":"PROMOTED","processCode":"%s","steps":5,"atomic":true}\n' "$PROCESS"
