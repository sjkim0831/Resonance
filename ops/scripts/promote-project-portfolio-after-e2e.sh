#!/usr/bin/env bash
set -euo pipefail
if [[ -n "${RESONANCE_ROOT:-}" ]]; then
  ROOT="$RESONANCE_ROOT"
else
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fi
EVIDENCE="$(cat)"
SOURCE_COMMIT="$(git -C "$ROOT" rev-parse HEAD)"
node -e '
const e=JSON.parse(process.argv[1]);
const required=["AUTH","DELETE","FILTER","HAPPY","ISOLATION","PAGING","RECOVERY"].map(x=>`PROJECT_PORTFOLIO_${x}`);
if(e.status!=="PASS" || e.caseCount!==7 || required.some(code=>e.cases?.[code]?.result!=="PASSED")) throw new Error("portfolio E2E evidence is incomplete");
' "$EVIDENCE"
EVIDENCE_SHA256="$(printf '%s' "$EVIDENCE" | sha256sum | awk '{print $1}')"
EVIDENCE_B64="$(printf '%s' "$EVIDENCE" | base64 -w0)"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
if [[ -z "${PATRONI_POD:-}" ]]; then
  PATRONI_POD="$(K8S_NAMESPACE="$NAMESPACE" bash "$ROOT/ops/scripts/resolve-patroni-primary-pod.sh")"
fi
kubectl -n "$NAMESPACE" exec -i "$PATRONI_POD" -c patroni -- psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d carbonet -X -q \
  -v evidence_b64="$EVIDENCE_B64" -v evidence_hash="$EVIDENCE_SHA256" -v source_commit="$SOURCE_COMMIT" <<'SQL'
BEGIN;
WITH evidence AS (
  SELECT convert_from(decode(:'evidence_b64','base64'),'UTF8')::jsonb AS body
), required(case_code) AS (
  VALUES ('PROJECT_PORTFOLIO_AUTH'),('PROJECT_PORTFOLIO_DELETE'),('PROJECT_PORTFOLIO_FILTER'),
         ('PROJECT_PORTFOLIO_HAPPY'),('PROJECT_PORTFOLIO_ISOLATION'),('PROJECT_PORTFOLIO_PAGING'),
         ('PROJECT_PORTFOLIO_RECOVERY')
)
INSERT INTO framework_simulation_run(case_code,process_version,result,failure_reason,evidence_json,executed_by,executed_at,source_commit,execution_environment,evidence_hash)
SELECT required.case_code,'1.0','PASSED',NULL,
       jsonb_build_object('suite',evidence.body,'case',evidence.body->'cases'->required.case_code)::text,
       'PROJECT_PORTFOLIO_CONTRACT_E2E',current_timestamp,:'source_commit','carbonet-prod',:'evidence_hash'
FROM required CROSS JOIN evidence;

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
END $$;
COMMIT;
SQL
printf '{"status":"PROMOTED","tests":7,"jobs":4,"sha256":"%s"}\n' "$EVIDENCE_SHA256"
