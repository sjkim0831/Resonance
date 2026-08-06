#!/usr/bin/env bash
set -euo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
EVIDENCE="$(cat)"
node -e '
const evidence=JSON.parse(process.argv[1]);
for(const check of ["admin","api","database","authority","responsive","accessibility","exceptionStates","audit","recovery"]){
  if(evidence.status!=="PASS" || Number(evidence[check])!==1) throw new Error(`admin portfolio evidence missing ${check}`);
}
if(!Array.isArray(evidence.results) || evidence.results.length!==2) throw new Error("desktop and mobile evidence required");
' "$EVIDENCE"
SOURCE_COMMIT="$(git -C "$ROOT" rev-parse HEAD)"
EVIDENCE_SHA256="$(printf '%s' "$EVIDENCE" | sha256sum | awk '{print $1}')"
EVIDENCE_B64="$(printf '%s' "$EVIDENCE" | base64 -w0)"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
PATRONI_POD="${PATRONI_POD:-$(K8S_NAMESPACE="$NAMESPACE" bash "$ROOT/ops/scripts/resolve-patroni-primary-pod.sh")}" 

kubectl -n "$NAMESPACE" exec -i "$PATRONI_POD" -c patroni -- \
  psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d carbonet -X -q \
    -v evidence_b64="$EVIDENCE_B64" -v evidence_hash="$EVIDENCE_SHA256" -v source_commit="$SOURCE_COMMIT" <<'SQL'
BEGIN;
INSERT INTO framework_simulation_case(
  case_code,process_code,case_name,case_type,preconditions,steps_json,assertions_json,
  case_status,severity,required_evidence,automated,expected_duration_minutes,updated_at
)
VALUES (
  'PROJECT_PORTFOLIO_ADMIN_UI','EMISSION_PROJECT_PORTFOLIO','관리자 프로젝트 포트폴리오 계약 검증',
  'HAPPY_PATH','관리자 인증 및 프로젝트 데이터가 존재한다.',
  '["관리자 화면 진입","상태 필터","검색","데스크톱·모바일 검증"]',
  '["완료 건수 일치","검색 결과 일치","권한 차단","접근성·반응형 충족"]',
  'ACTIVE','CRITICAL','authenticated-admin-e2e-json',true,1,current_timestamp
)
ON CONFLICT (case_code) DO UPDATE
SET case_status='ACTIVE',automated=true,required_evidence=excluded.required_evidence,updated_at=current_timestamp;

INSERT INTO framework_simulation_run(
  case_code,process_version,result,failure_reason,evidence_json,executed_by,executed_at,
  source_commit,execution_environment,evidence_hash
)
VALUES (
  'PROJECT_PORTFOLIO_ADMIN_UI','1.0','PASSED',NULL,
  convert_from(decode(:'evidence_b64','base64'),'UTF8'),
  'PROJECT_PORTFOLIO_ADMIN_E2E',current_timestamp,:'source_commit','carbonet-prod',:'evidence_hash'
);

UPDATE framework_development_job
SET job_status='VERIFIED',approval_status='APPROVED',quality_status='VERIFIED',
    completed_at=current_timestamp,updated_at=current_timestamp,
    evidence_ref=concat('portfolio-admin-e2e:sha256:',:'evidence_hash'),
    execution_log='Authenticated admin project portfolio desktop/mobile E2E passed.',
    result_json=convert_from(decode(:'evidence_b64','base64'),'UTF8')
WHERE process_code='EMISSION_PROJECT_PORTFOLIO'
  AND step_code='EMISSION_PROJECT_PORTFOLIO_LIST'
  AND job_type='FRONTEND_ADMIN'
  AND job_status IN ('PLANNED','COMPLETED','VERIFIED');

DO $$
DECLARE pending integer;
BEGIN
  SELECT count(*) INTO pending
  FROM framework_development_job
  WHERE process_code='EMISSION_PROJECT_PORTFOLIO'
    AND step_code='EMISSION_PROJECT_PORTFOLIO_LIST'
    AND job_type='FRONTEND_ADMIN'
    AND (job_status<>'VERIFIED' OR quality_status<>'VERIFIED');
  IF pending<>0 THEN RAISE EXCEPTION 'admin portfolio promotion incomplete pending=%',pending; END IF;
END $$;
COMMIT;
SQL
printf '{"status":"PROMOTED","audience":"ADMIN","sha256":"%s"}\n' "$EVIDENCE_SHA256"
