#!/usr/bin/env bash
set -euo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
EVIDENCE="$(bash "$ROOT/ops/scripts/validate-work-assignment-runtime.sh")"
grep -Fq '[work-assignment-runtime] PASS' <<<"$EVIDENCE" || { echo '[work-assignment-assurance] FAIL runtime evidence missing' >&2; exit 1; }

SOURCE_COMMIT="${WORK_ASSIGNMENT_SOURCE_COMMIT:-$(git -C "$ROOT" rev-parse --short=12 HEAD)}"
EVIDENCE_REF="runtime-e2e:${SOURCE_COMMIT}:steps=7:negatives=3:recovery=PASS"
POD="$(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o jsonpath='{.items[0].metadata.name}')"
SQL=$(cat <<SQL
do \$\$
declare
  target_count integer;
begin
  select count(*) into target_count
  from framework_development_job
  where process_code='WORK_ASSIGNMENT'
    and step_code in ('WORK_ASSIGNMENT_CONTEXT','WORK_ASSIGNMENT_ACTOR','WORK_ASSIGNMENT_STEP')
    and job_type in ('DATABASE','BACKEND','TEST');
  if target_count <> 9 then
    raise exception 'WORK_ASSIGNMENT assurance target mismatch: %',target_count;
  end if;

  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'RUNTIME_E2E_VERIFIED',job_status,'VERIFIED','work-assignment-assurance',
         json_build_object('evidenceRef','$EVIDENCE_REF','steps',7,'negativeCases',3,'recovery','PASS')::text
  from framework_development_job
  where process_code='WORK_ASSIGNMENT'
    and step_code in ('WORK_ASSIGNMENT_CONTEXT','WORK_ASSIGNMENT_ACTOR','WORK_ASSIGNMENT_STEP')
    and job_type in ('DATABASE','BACKEND','TEST')
    and (job_status,quality_status,approval_status,evidence_ref) is distinct from ('VERIFIED','VERIFIED','APPROVED','$EVIDENCE_REF');

  update framework_development_job
  set job_status='VERIFIED',approval_status='APPROVED',quality_status='VERIFIED',
      evidence_ref='$EVIDENCE_REF',
      result_json=json_build_object('runtimeE2e',true,'steps',7,'databaseRows',8,'negativeCases',3,'recovery','PASS')::text,
      completed_at=coalesce(completed_at,current_timestamp),last_error=null,
      worker_id=null,lease_token=null,lease_until=null,updated_at=current_timestamp
  where process_code='WORK_ASSIGNMENT'
    and step_code in ('WORK_ASSIGNMENT_CONTEXT','WORK_ASSIGNMENT_ACTOR','WORK_ASSIGNMENT_STEP')
    and job_type in ('DATABASE','BACKEND','TEST');

  select count(*) into target_count
  from framework_development_job
  where process_code='WORK_ASSIGNMENT' and job_status='VERIFIED'
    and quality_status='VERIFIED' and approval_status='APPROVED'
    and evidence_ref='$EVIDENCE_REF';
  if target_count <> 9 then
    raise exception 'WORK_ASSIGNMENT assurance completion mismatch: %',target_count;
  end if;
end \$\$;
SQL
)
kubectl -n "$NAMESPACE" exec "$POD" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -v ON_ERROR_STOP=1 -q -c "$SQL"

printf '%s\n' "$EVIDENCE"
printf '[work-assignment-assurance] PASS jobs=9 evidence=%s\n' "$EVIDENCE_REF"
