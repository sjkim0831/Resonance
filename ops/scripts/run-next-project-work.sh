#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
DB="${PGDATABASE:-carbonet}"
DB_USER="${PGUSER:-postgres}"
REPORT_DIR="${NEXT_WORK_REPORT_DIR:-$ROOT_DIR/var/reports/next-work}"
STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_FILE="$REPORT_DIR/$STAMP.json"
LATEST_FILE="$REPORT_DIR/latest.json"

mkdir -p "$REPORT_DIR"

leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- \
    psql -h 127.0.0.1 -U "$DB_USER" -d "$DB" -Atqc \
    'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]] && {
      leader="$pod"
      break
    }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni \
  -o name | sed 's#^pod/##')
[[ -n "$leader" ]] || {
  echo "[next-work] writable PostgreSQL leader not found" >&2
  exit 1
}

psqlq() {
  kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- \
    psql -h 127.0.0.1 -U "$DB_USER" -d "$DB" \
    -X -q -v ON_ERROR_STOP=1 -At "$@"
}

before_job_id="$(psqlq -c "
  select coalesce(max(job_id),0) from framework_development_job;")"
started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
start_epoch="$(date +%s)"

set +e
ROOT_DIR="$ROOT_DIR" \
MAX_PARALLEL_WORKERS=1 \
PROJECT_AUTO_COMPLETION_WAIT_FOR_LOCK=true \
PROJECT_AUTO_COMPLETION_LOCK_WAIT_SECONDS="${NEXT_WORK_LOCK_WAIT_SECONDS:-14400}" \
  bash "$ROOT_DIR/ops/scripts/run-project-auto-completion-orchestrator.sh"
orchestrator_rc=$?
set -e

finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
elapsed_seconds="$(( $(date +%s) - start_epoch ))"

summary_json="$(psqlq -c "
with latest_run as (
  select run_id,run_status,selected_process_count,executable_job_count,
         retried_job_count,completed_process_count,blocked_process_count,
         coalesce(framework_try_jsonb(result_json),'{}'::jsonb) result_json
  from framework_project_completion_run
  order by started_at desc limit 1
), executed_work as (
  select job_id,process_code,step_code,job_type,job_status,quality_status,
         approval_status,coalesce(target_path,'') target_path,
         coalesce(evidence_ref,'') evidence_ref,
         coalesce(last_error,'') last_error
  from framework_development_job
  where started_at >= '$started_at'::timestamptz
     or completed_at >= '$started_at'::timestamptz
  order by updated_at desc,job_id desc limit 1
), next_candidate as (
  select job_id,process_code,step_code,job_type,job_status,quality_status,
         approval_status,coalesce(target_path,'') target_path,
         coalesce(last_error,'') last_error
  from framework_development_job
  where job_status in ('RETRY','FAILED','PLANNED','PENDING')
  order by
    case job_status
      when 'RETRY' then 0 when 'FAILED' then 1
      when 'PLANNED' then 2 else 3
    end,
    case approval_status when 'APPROVED' then 0 else 1 end,
    updated_at desc,job_id desc
  limit 1
), blockers as (
  select coalesce(jsonb_agg(to_jsonb(item)),'[]'::jsonb) value
  from (
    select job_id,process_code,step_code,job_type,job_status,
           approval_status,coalesce(target_path,'') target_path,
           coalesce(last_error,'') last_error
    from framework_development_job
    where job_status='FAILED'
    order by updated_at desc,job_id desc
    limit 20
  ) item
), pending_retries as (
  select coalesce(jsonb_agg(to_jsonb(item)),'[]'::jsonb) value
  from (
    select job_id,process_code,step_code,job_type,job_status,
           approval_status,coalesce(target_path,'') target_path,
           coalesce(last_error,'') last_error
    from framework_development_job
    where job_status='RETRY'
    order by updated_at desc,job_id desc
    limit 20
  ) item
), counts as (
  select jsonb_object_agg(job_status,total) value
  from (
    select job_status,count(*) total
    from framework_development_job group by job_status
  ) grouped
)
select jsonb_build_object(
  'schemaVersion',2,
  'command','next-work',
  'outcome',case
    when $orchestrator_rc <> 0 then 'FAILED'
    when exists(select 1 from executed_work) then 'EXECUTED'
    when coalesce((select blocked_process_count from latest_run),0) > 0
      then 'ATTENTION_REQUIRED'
    when coalesce((select completed_process_count from latest_run),0) =
         coalesce((select selected_process_count from latest_run),0)
      then 'COMPLETE'
    else 'NO_EXECUTABLE_WORK'
  end,
  'startedAt','$started_at',
  'finishedAt','$finished_at',
  'elapsedSeconds',$elapsed_seconds,
  'orchestratorExitCode',$orchestrator_rc,
  'run',coalesce((select to_jsonb(latest_run) from latest_run),'{}'::jsonb),
  'executedWork',coalesce((select to_jsonb(executed_work) from executed_work),'{}'::jsonb),
  'createdWorkCount',(select count(*) from framework_development_job where job_id > $before_job_id),
  'nextCandidate',coalesce((select to_jsonb(next_candidate) from next_candidate),'{}'::jsonb),
  'blockers',coalesce((select value from blockers),'[]'::jsonb),
  'pendingRetries',coalesce((select value from pending_retries),'[]'::jsonb),
  'jobCounts',coalesce((select value from counts),'{}'::jsonb)
)::text;")"

printf '%s\n' "$summary_json" | jq . >"$REPORT_FILE"
latest_tmp="$REPORT_DIR/.latest.$$.json"
cp "$REPORT_FILE" "$latest_tmp"
mv -f "$latest_tmp" "$LATEST_FILE"
printf '%s\n' "$summary_json" | jq -c .

if (( orchestrator_rc != 0 )); then
  exit "$orchestrator_rc"
fi
