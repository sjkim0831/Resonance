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
