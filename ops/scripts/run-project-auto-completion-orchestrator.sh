#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"; NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"; DB="${PGDATABASE:-carbonet}"; DB_USER="${PGUSER:-postgres}"; MAX_PARALLEL_WORKERS="${MAX_PARALLEL_WORKERS:-3}"
PROJECT_WORK_RUNNER="${PROJECT_WORK_RUNNER:-$ROOT_DIR/ops/scripts/run-hermes-project-work.sh}"
LOCK_FILE="${PROJECT_AUTO_COMPLETION_LOCK:-/tmp/resonance-project-auto-completion.lock}"
exec 9>"$LOCK_FILE"; flock -n 9 || exit 0
leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U "$DB_USER" -d "$DB" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
[[ -n "$leader" ]] || { echo "[project-auto-completion] writable PostgreSQL leader not found" >&2; exit 1; }
psqlq(){ kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- psql -h 127.0.0.1 -U "$DB_USER" -d "$DB" -X -q -v ON_ERROR_STOP=1 -At "$@"; }
run_id="$(cat /proc/sys/kernel/random/uuid)"
psqlq -c "insert into framework_project_completion_run(run_id) values('$run_id');" >/dev/null
trap 'psqlq -c "update framework_project_completion_run set run_status='"'"'FAILED'"'"',completed_at=current_timestamp where run_id='"'"'$run_id'"'"';" >/dev/null 2>&1 || true' ERR
selected="$(psqlq -c "select count(*) from framework_process_delivery_priority_queue where next_action<>'COMPLETE';")"
legacy_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_status='FAILED'
    and (j.last_error like 'Kilo exited with code %' or j.job_type in ('FRONTEND_USER','FRONTEND_ADMIN'))
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='HERMES_ENGINE_MIGRATION_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'HERMES_ENGINE_MIGRATION_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','legacy Kilo timeout released after Hermes engine migration')
  from recovered returning 1
)
select count(*) from recovered;")"
pool_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_status='FAILED'
    and j.last_error='Hermes project worker exited with code 1'
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='NVIDIA_POOL_EXPANDED_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'NVIDIA_POOL_EXPANDED_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','secure NVIDIA credential pool expanded')
  from recovered returning 1
)
select count(*) from recovered;")"
adoption_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_status='FAILED' and j.job_type in ('FRONTEND_USER','FRONTEND_ADMIN')
    and j.last_error='AI completed without a source or metadata change'
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='ADOPTION_GATE_RETRY'
    )
), recovered as (
  update framework_development_job j set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'ADOPTION_GATE_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','deterministic existing frontend adoption gate installed')
  from recovered returning 1
)
select count(*) from recovered;")"
binding_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_status='FAILED' and j.job_type in ('FRONTEND_USER','FRONTEND_ADMIN')
    and j.last_error='existing frontend adoption contract failed'
    and not exists (select 1 from framework_development_job_event e where e.job_id=j.job_id and e.event_type='ROUTE_BINDING_ADOPTION_RETRY')
), recovered as (
  update framework_development_job j set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'ROUTE_BINDING_ADOPTION_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','exact route-family binding accepted as registered implementation evidence') from recovered returning 1
)
select count(*) from recovered;")"
cache_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_status='FAILED' and j.job_type in ('FRONTEND_USER','FRONTEND_ADMIN')
    and j.last_error='existing frontend adoption type check failed'
    and not exists (select 1 from framework_development_job_event e where e.job_id=j.job_id and e.event_type='ADOPTION_CACHE_PATH_RETRY')
), recovered as (
  update framework_development_job j set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'ADOPTION_CACHE_PATH_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','frontend verification cache moved to worker-writable var directory') from recovered returning 1
)
select count(*) from recovered;")"
router_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_status='FAILED'
    and j.last_error='Hermes project worker exited with code 1'
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='HERMES_ROUTER_FIX_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'HERMES_ROUTER_FIX_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','E4B selector input bounded after HTTP 400')
  from recovered returning 1
)
select count(*) from recovered;")"
retried="$(psqlq -c "
with candidate as (
  select j.job_id,
    (j.attempt_count>=j.max_attempts) as infrastructure_retry
  from framework_development_job j
  where j.job_status='FAILED'
    and (
      j.attempt_count<j.max_attempts
      or (
        j.last_error in ('unexpected worker error at line 111','Kilo exited with code 124','AI completed without a source or metadata change')
        and not exists (
          select 1 from framework_development_job_event e
          where e.job_id=j.job_id and e.event_type='INFRA_RETRY_GRANTED'
        )
      )
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=case when c.infrastructure_retry then greatest(0,j.max_attempts-1) else j.attempt_count end,
      updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id
  returning j.job_id,c.infrastructure_retry
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,case when infrastructure_retry then 'INFRA_RETRY_GRANTED' else 'RETRY_GRANTED' end,
         'FAILED','RETRY','project-auto-completion',jsonb_build_object('infrastructureRetry',infrastructure_retry)
  from recovered returning 1
)
select count(*) from recovered;")"
retried="$((retried+legacy_retried+pool_retried+adoption_retried+binding_retried+cache_retried+router_retried))"
executable="$(psqlq -c "
select count(*) from framework_development_job j
where j.approval_status='APPROVED' and (j.job_status='PLANNED' or (j.job_status='RETRY' and (j.lease_until is null or j.lease_until<current_timestamp))) and j.attempt_count<j.max_attempts
  and not exists (
    select 1 from framework_development_job_dependency d
    join framework_development_job required_job on required_job.job_id=d.depends_on_job_id
    where d.job_id=j.job_id and d.dependency_type='REQUIRED'
      and required_job.job_status not in ('VERIFIED','COMPLETED')
  );")"
if [[ "$executable" -gt 0 ]] && ! bash "$ROOT_DIR/ops/scripts/verify-hermes-project-work-policy.sh" >/dev/null 2>&1; then
  psqlq -c "update framework_project_completion_run set run_status='ATTENTION_REQUIRED',selected_process_count=$selected,executable_job_count=$executable,retried_job_count=$retried,blocked_process_count=1,result_json='{\"reason\":\"HERMES_PROJECT_WORK_POLICY_INVALID\"}',completed_at=current_timestamp where run_id='$run_id';" >/dev/null
  trap - ERR
  echo "[project-auto-completion] ATTENTION_REQUIRED reason=HERMES_PROJECT_WORK_POLICY_INVALID executable=$executable"
  exit 0
fi
if [[ "$executable" -gt 0 ]]; then
  ROOT_DIR="$ROOT_DIR" MAX_PARALLEL_WORKERS="$MAX_PARALLEL_WORKERS" \
    PGDATABASE="$DB" PGUSER="$DB_USER" PGPASSWORD="${PGPASSWORD:-local-trust}" \
    POSTGRES_POD="$leader" PGHOST="127.0.0.1" K8S_NAMESPACE="$NAMESPACE" \
    PROJECT_WORK_RUNNER="$PROJECT_WORK_RUNNER" bash "$ROOT_DIR/ops/scripts/run-process-development-dispatcher.sh"
fi
completed="$(psqlq -c "with done as (update framework_process_definition p set process_status='DEVELOPMENT_READY',updated_at=current_timestamp from framework_process_delivery_priority_queue q where q.process_code=p.process_code and q.next_action='COMPLETE' and p.process_status<>'DEVELOPMENT_READY' returning 1) select count(*) from done;")"
blocked="$(psqlq -c "select count(*) from framework_process_delivery_priority_queue where delivery_priority='BLOCKER';")"
remaining="$(psqlq -c "select count(*) from framework_process_delivery_priority_queue where next_action<>'COMPLETE';")"
status="PROGRESSING"; [[ "$remaining" == "0" ]] && status="COMPLETED"; [[ "$blocked" -gt 0 || ( "$remaining" -gt 0 && "$executable" == "0" ) ]] && status="ATTENTION_REQUIRED"
psqlq -c "update framework_project_completion_run set run_status='$status',selected_process_count=$selected,executable_job_count=$executable,retried_job_count=$retried,completed_process_count=$completed,blocked_process_count=$blocked,result_json='{\"remainingProcesses\":$remaining}',completed_at=current_timestamp where run_id='$run_id';" >/dev/null
echo "[project-auto-completion] $status selected=$selected executable=$executable retried=$retried completed=$completed blocked=$blocked remaining=$remaining"
