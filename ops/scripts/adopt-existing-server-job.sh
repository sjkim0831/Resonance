#!/usr/bin/env bash
set -Eeuo pipefail

# Independent adoption lane. It deliberately does not claim jobs and therefore
# cannot race the normal development worker. Pass an explicit approved job id.
ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
JOB_ID="${1:?usage: adopt-existing-server-job.sh JOB_ID [--apply]}"
APPLY="${2:-}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"
K8S_NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
POSTGRES_POD="${POSTGRES_POD:-postgres-patroni-0}"
PGHOST="${PGHOST:-postgres-haproxy}"

psqlq() {
  kubectl -n "$K8S_NAMESPACE" exec "$POSTGRES_POD" -- env PGPASSWORD="$PGPASSWORD" \
    psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -X -q -v ON_ERROR_STOP=1 -At "$@"
}

JOB_JSON="$(psqlq -c "select row_to_json(j)::text from (
 select d.job_id,d.process_code,d.step_code,d.job_type,d.target_path,d.specification_json,
        s.user_path,s.admin_path,s.api_contract,s.requirement_text,s.input_contract,
        s.output_contract,s.command_code,s.from_state,s.to_state
 from framework_development_job d
 left join framework_process_step s on s.process_code=d.process_code and s.step_code=d.step_code
 where d.job_id=${JOB_ID} and d.approval_status='APPROVED'
   and d.job_status in ('PLANNED','RETRY','FAILED')
) j")"
[[ -n "$JOB_JSON" ]] || { echo "eligible approved job not found: $JOB_ID" >&2; exit 2; }
case "$(jq -r .job_type <<<"$JOB_JSON")" in BACKEND|API|API_QUALITY|DATABASE|DATABASE_QUALITY|TEST|ACTOR_TEST) ;; *) echo "unsupported job type" >&2; exit 2;; esac

PROCESS="$(jq -r .process_code <<<"$JOB_JSON")"
STEP="$(jq -r .step_code <<<"$JOB_JSON")"
TYPE="$(jq -r .job_type <<<"$JOB_JSON")"
OUT="$ROOT_DIR/var/ai-runtime/adopt-existing-server/job-${JOB_ID}.json"
python3 "$ROOT_DIR/ops/scripts/verify-existing-server-job.py" --root "$ROOT_DIR" --job-json "$JOB_JSON" --out "$OUT"

[[ "$APPLY" == "--apply" ]] || { echo "DRY_RUN adoptable job=$JOB_ID evidence=$OUT"; exit 0; }
EVIDENCE="verified:existing-server-job:${JOB_ID}:${OUT}"
psqlq -c "do \$adopt\$
declare adopted_id bigint;
begin
 update framework_development_job set job_status='VERIFIED',approval_status='APPROVED',quality_status='PASSED',
  result_json=jsonb_build_object('strategy','ADOPT_EXISTING_SERVER_IMPLEMENTATION','evidence','${OUT}'),evidence_ref='${EVIDENCE}',
  last_error=null,completed_at=current_timestamp,lease_token=null,lease_until=null,updated_at=current_timestamp
  where job_id=${JOB_ID} and approval_status='APPROVED' and job_status in ('PLANNED','RETRY','FAILED') returning job_id into adopted_id;
 if adopted_id is null then raise exception 'job %% changed state before adoption',${JOB_ID}; end if;
 update framework_process_artifact set delivery_status='VERIFIED',evidence_ref='${EVIDENCE}',updated_at=current_timestamp
  where process_code='${PROCESS}' and step_code='${STEP}' and contract_ref='AUTO:${TYPE}';
 insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  values(${JOB_ID},'ADOPT_EXISTING_SERVER','ELIGIBLE','VERIFIED','deterministic-adopter',jsonb_build_object('evidence','${OUT}'));
end \$adopt\$;" >/dev/null
echo "VERIFIED existing-server job=$JOB_ID evidence=$OUT"
