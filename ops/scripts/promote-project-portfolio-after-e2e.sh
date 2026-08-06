#!/usr/bin/env bash
set -euo pipefail
if [[ -n "${RESONANCE_ROOT:-}" ]]; then
  ROOT="$RESONANCE_ROOT"
else
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fi
EVIDENCE="$(cat)"
node -e '
const e=JSON.parse(process.argv[1]);
const required=["AUTH","DELETE","FILTER","HAPPY","ISOLATION","PAGING","RECOVERY"].map(x=>`PROJECT_PORTFOLIO_${x}`);
if(e.status!=="PASS" || e.caseCount!==7 || required.some(code=>e.cases?.[code]?.result!=="PASSED")) throw new Error("portfolio E2E evidence is incomplete");
if(e.contract?.processCode!=="EMISSION_PROJECT_PORTFOLIO" || e.contract?.stepCode!=="EMISSION_PROJECT_PORTFOLIO_LIST" ||
   !e.contract?.processVersion || !/^[0-9a-f]{32,128}$/.test(e.contract?.contractFingerprint||"") ||
   !/^[0-9a-f]{7,80}$/i.test(e.contract?.sourceCommit||"")) throw new Error("portfolio E2E contract envelope is missing");
' "$EVIDENCE"
SOURCE_COMMIT="$(jq -r '.contract.sourceCommit' <<<"$EVIDENCE")"
PROCESS_VERSION="$(jq -r '.contract.processVersion' <<<"$EVIDENCE")"
CONTRACT_FINGERPRINT="$(jq -r '.contract.contractFingerprint' <<<"$EVIDENCE")"
DEPLOY_STATE_FILE="${CARBONET_DEPLOY_STATE_FILE:-/opt/resonance-data/deploy/carbonet-main-success.commit}"
CURRENT_DEPLOYED_COMMIT="${E2E_DEPLOYED_COMMIT:-$(tr -d '[:space:]' < "$DEPLOY_STATE_FILE" 2>/dev/null || true)}"
[[ "$SOURCE_COMMIT" == "$CURRENT_DEPLOYED_COMMIT" ]] || { echo '[portfolio-promoter] deployed commit changed during E2E; refusing stale evidence' >&2; exit 3; }
EVIDENCE_SHA256="$(printf '%s' "$EVIDENCE" | sha256sum | awk '{print $1}')"
EVIDENCE_B64="$(printf '%s' "$EVIDENCE" | base64 -w0)"
EXECUTION_ENVIRONMENT="${E2E_EXECUTION_ENVIRONMENT:-carbonet-prod}"
EVIDENCE_URI="${E2E_EVIDENCE_URI:-inline://business-e2e/sha256/$EVIDENCE_SHA256}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
if [[ -z "${PATRONI_POD:-}" ]]; then
  PATRONI_POD="$(K8S_NAMESPACE="$NAMESPACE" bash "$ROOT/ops/scripts/resolve-patroni-primary-pod.sh")"
fi
kubectl -n "$NAMESPACE" exec -i "$PATRONI_POD" -c patroni -- psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d carbonet -X -q \
  -v evidence_b64="$EVIDENCE_B64" -v evidence_hash="$EVIDENCE_SHA256" -v source_commit="$SOURCE_COMMIT" \
  -v process_version="$PROCESS_VERSION" -v contract_fingerprint="$CONTRACT_FINGERPRINT" \
  -v execution_environment="$EXECUTION_ENVIRONMENT" -v evidence_uri="$EVIDENCE_URI" <<'SQL'
BEGIN;
SELECT set_config('resonance.portfolio_source_commit',:'source_commit',true);
SELECT set_config('resonance.portfolio_evidence_hash',:'evidence_hash',true);
WITH evidence AS (
  SELECT convert_from(decode(:'evidence_b64','base64'),'UTF8')::jsonb AS body
), required(case_code) AS (
  VALUES ('PROJECT_PORTFOLIO_AUTH'),('PROJECT_PORTFOLIO_DELETE'),('PROJECT_PORTFOLIO_FILTER'),
         ('PROJECT_PORTFOLIO_HAPPY'),('PROJECT_PORTFOLIO_ISOLATION'),('PROJECT_PORTFOLIO_PAGING'),
         ('PROJECT_PORTFOLIO_RECOVERY')
)
INSERT INTO framework_simulation_run(case_code,process_version,result,failure_reason,evidence_json,executed_by,executed_at,source_commit,execution_environment,evidence_hash)
SELECT required.case_code,process.process_version,'PASSED',NULL,
       jsonb_build_object('suite',evidence.body,'case',evidence.body->'cases'->required.case_code)::text,
       'PROJECT_PORTFOLIO_CONTRACT_E2E',current_timestamp,:'source_commit','carbonet-prod',:'evidence_hash'
FROM required CROSS JOIN evidence
CROSS JOIN framework_process_definition process
WHERE process.process_code='EMISSION_PROJECT_PORTFOLIO';

INSERT INTO framework_process_qa_run(
  process_code,step_code,result,failure_reason,evidence_json,executed_by,executed_at,
  evidence_type,process_version,source_commit,contract_fingerprint,
  execution_environment,evidence_uri,evidence_hash
)
SELECT process.process_code,'EMISSION_PROJECT_PORTFOLIO_LIST','PASSED',NULL,evidence.body,
       'PROJECT_PORTFOLIO_CONTRACT_E2E',current_timestamp,'BUSINESS_E2E',process.process_version,
       :'source_commit',fingerprint.contract_fingerprint,:'execution_environment',:'evidence_uri',:'evidence_hash'
FROM framework_process_definition process
CROSS JOIN LATERAL (
  SELECT convert_from(decode(:'evidence_b64','base64'),'UTF8')::jsonb body
) evidence
CROSS JOIN LATERAL (
  SELECT framework_current_process_step_contract_fingerprint(
    'EMISSION_PROJECT_PORTFOLIO','EMISSION_PROJECT_PORTFOLIO_LIST'
  ) contract_fingerprint
) fingerprint
WHERE process.process_code='EMISSION_PROJECT_PORTFOLIO'
  AND process.process_version=:'process_version'
  AND fingerprint.contract_fingerprint=:'contract_fingerprint'
  AND fingerprint.contract_fingerprint IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE framework_development_job
SET job_status='VERIFIED', approval_status='APPROVED', quality_status='VERIFIED',
    completed_at=current_timestamp, updated_at=current_timestamp,
    evidence_ref=concat('portfolio-e2e:sha256:',:'evidence_hash'),
    execution_log='Authenticated project portfolio contract E2E passed.',
    result_json=convert_from(decode(:'evidence_b64','base64'),'UTF8')
WHERE process_code='EMISSION_PROJECT_PORTFOLIO'
  AND step_code='EMISSION_PROJECT_PORTFOLIO_LIST'
  AND job_type IN ('DATABASE','BACKEND','FRONTEND_USER','TEST')
  AND job_status IN ('PLANNED','COMPLETED','VERIFIED');

DO $$
DECLARE passed integer; promoted integer;
BEGIN
  SELECT count(DISTINCT run.case_code) INTO passed
  FROM framework_simulation_run run
  JOIN framework_simulation_case scenario ON scenario.case_code=run.case_code
  WHERE scenario.process_code='EMISSION_PROJECT_PORTFOLIO' AND run.result='PASSED';
  SELECT count(*) INTO promoted FROM framework_development_job
  WHERE process_code='EMISSION_PROJECT_PORTFOLIO' AND step_code='EMISSION_PROJECT_PORTFOLIO_LIST'
    AND job_type IN ('DATABASE','BACKEND','FRONTEND_USER','TEST')
    AND job_status='VERIFIED' AND quality_status='VERIFIED';
  IF passed<>7 OR promoted<>4 THEN RAISE EXCEPTION 'portfolio promotion incomplete tests=% jobs=%',passed,promoted; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM framework_current_business_e2e_evidence
    WHERE process_code='EMISSION_PROJECT_PORTFOLIO'
      AND step_code='EMISSION_PROJECT_PORTFOLIO_LIST'
      AND business_test_result='PASSED'
      AND source_commit=current_setting('resonance.portfolio_source_commit')
      AND evidence_hash=current_setting('resonance.portfolio_evidence_hash')
  ) THEN RAISE EXCEPTION 'current portfolio business E2E evidence was not recorded'; END IF;
END $$;
COMMIT;
SQL
printf '{"status":"PROMOTED","tests":7,"jobs":4,"sha256":"%s"}\n' "$EVIDENCE_SHA256"
