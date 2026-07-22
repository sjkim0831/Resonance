#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"; NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"; DB="${PGDATABASE:-carbonet}"; DB_USER="${PGUSER:-postgres}"; MAX_PARALLEL_WORKERS="${MAX_PARALLEL_WORKERS:-3}"
PROJECT_WORK_RUNNER="${PROJECT_WORK_RUNNER:-$ROOT_DIR/ops/scripts/run-hermes-project-work.sh}"
LOCK_FILE="${PROJECT_AUTO_COMPLETION_LOCK:-/tmp/resonance-project-auto-completion.lock}"
exec 9>"$LOCK_FILE"; flock -n 9 || exit 0
# framework_development_job_event.event_type is varchar(30). Fail before any
# mutation if a newly added static recovery event exceeds that DB contract.
while IFS= read -r event_code; do
  if (( ${#event_code} > 30 )); then
    echo "[project-auto-completion] event code exceeds 30 characters: $event_code" >&2
    exit 2
  fi
done < <(sed -n "s/.*select job_id,'\([A-Z_][A-Z_]*\)'.*/\1/p" "$0" | sort -u)
leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U "$DB_USER" -d "$DB" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
[[ -n "$leader" ]] || { echo "[project-auto-completion] writable PostgreSQL leader not found" >&2; exit 1; }
psqlq(){ kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- psql -h 127.0.0.1 -U "$DB_USER" -d "$DB" -X -q -v ON_ERROR_STOP=1 -At "$@"; }
contract_completion_result="$(psqlq -c "select framework_run_contract_completion('project-auto-completion',${CONTRACT_COMPLETION_BATCH_SIZE:-25},false);")"
host_worker_prefix="$(hostname)-hermes-"
while IFS='|' read -r orphan_job_id orphan_worker_id; do
  [[ -n "$orphan_job_id" && "$orphan_worker_id" == "$host_worker_prefix"* ]] || continue
  orphan_pid="${orphan_worker_id##*-}"
  [[ "$orphan_pid" =~ ^[0-9]+$ ]] || continue
  if kill -0 "$orphan_pid" 2>/dev/null; then
    orphan_cmd="$(tr '\0' ' ' <"/proc/$orphan_pid/cmdline" 2>/dev/null || true)"
    [[ "$orphan_cmd" == *run-process-development-worker.sh* && "$orphan_cmd" == *" $orphan_job_id "* ]] && continue
  fi
  psqlq -c "
    with recovered as (
      update framework_development_job
      set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
          attempt_count=greatest(0,attempt_count-1),
          last_error='orphan worker process disappeared',updated_at=current_timestamp
      where job_id=${orphan_job_id} and job_status='RUNNING' and worker_id='${orphan_worker_id}'
      returning job_id
    )
    insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
    select job_id,'ORPHAN_WORKER_RECOVERED','RUNNING','RETRY','project-auto-completion',
           jsonb_build_object('missingPid',${orphan_pid}) from recovered;" >/dev/null
done < <(psqlq -c "
  select job_id,worker_id from framework_development_job
  where job_status='RUNNING' and worker_id like '${host_worker_prefix}%'
    and updated_at < current_timestamp - interval '${ORPHAN_WORKER_GRACE_MINUTES:-5} minutes';")
run_id="$(cat /proc/sys/kernel/random/uuid)"
psqlq -c "insert into framework_project_completion_run(run_id) values('$run_id');" >/dev/null
trap 'psqlq -c "update framework_project_completion_run set run_status='"'"'FAILED'"'"',completed_at=current_timestamp where run_id='"'"'$run_id'"'"';" >/dev/null 2>&1 || true' ERR
selected="$(psqlq -c "select count(*) from framework_process_delivery_priority_queue where next_action<>'COMPLETE';")"
design_evidence_adopted="$(psqlq -c "
with candidate as (
  select j.job_id,j.job_status old_status,source_job.job_id source_job_id,
         source_job.evidence_ref,source_job.result_json
  from framework_development_job j
  join framework_step_execution_spec spec
    on spec.process_code=j.process_code and spec.step_code=j.step_code
   and spec.design_status='DESIGN_COMPLETE' and spec.approval_status='APPROVED'
  join lateral (
    select verified.job_id,verified.evidence_ref,verified.result_json
    from framework_development_job verified
    where verified.process_code=j.process_code and verified.step_code=j.step_code
      and verified.job_id<>j.job_id
      and verified.job_type in ('DESIGN','FULL_STACK','FULL_STACK_GENERATION')
      and verified.job_status='VERIFIED' and verified.quality_status='VERIFIED'
      and nullif(verified.evidence_ref,'') is not null
    order by case verified.job_type when 'DESIGN' then 0 else 1 end,verified.completed_at desc nulls last,verified.job_id desc
    limit 1
  ) source_job on true
  where j.job_type='DESIGN' and j.approval_status in ('PENDING','APPROVED')
    and j.job_status in ('PLANNED','RETRY')
), adopted as (
  update framework_development_job j
  set job_status='VERIFIED',quality_status='VERIFIED',approval_status='APPROVED',
      evidence_ref=c.evidence_ref,
      result_json=jsonb_build_object('strategy','VERIFIED_DESIGN_EVIDENCE_ADOPTION','sourceJobId',c.source_job_id,'sourceResult',framework_try_jsonb(c.result_json))::text,
      completed_at=current_timestamp,worker_id=null,lease_token=null,lease_until=null,
      last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id
  returning j.job_id,c.old_status,c.source_job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'DESIGN_EVIDENCE_ADOPTED',old_status,'VERIFIED','project-auto-completion',
         jsonb_build_object('sourceJobId',source_job_id,'reason','same approved process-step design already has verified evidence')
  from adopted returning 1
)
select count(*) from adopted;")"
not_applicable_completed="$(psqlq -c "
with candidate as (
  select j.job_id,j.job_status old_status,j.job_type,
         source_job.job_id source_job_id,source_job.evidence_ref
  from framework_development_job j
  join framework_process_step step
    on step.process_code=j.process_code and step.step_code=j.step_code
   and ((j.job_type='FRONTEND_USER' and step.requires_user_page=false)
     or (j.job_type='FRONTEND_ADMIN' and step.requires_admin_page=false))
  join lateral (
    select verified.job_id,verified.evidence_ref
    from framework_development_job verified
    where verified.process_code=j.process_code and verified.step_code=j.step_code
      and verified.job_type in ('FULL_STACK','FULL_STACK_GENERATION')
      and verified.job_status='VERIFIED' and verified.quality_status='VERIFIED'
      and nullif(verified.evidence_ref,'') is not null
    order by verified.completed_at desc nulls last,verified.job_id desc limit 1
  ) source_job on true
  where j.job_type in ('FRONTEND_USER','FRONTEND_ADMIN')
    and j.approval_status in ('PENDING','APPROVED')
    and j.job_status in ('PLANNED','RETRY','FAILED','BLOCKED')
), completed as (
  update framework_development_job j
  set job_status='COMPLETED',quality_status='VERIFIED',approval_status='APPROVED',
      evidence_ref=c.evidence_ref,
      result_json=jsonb_build_object('strategy','APPROVED_CONTRACT_NOT_APPLICABLE',
        'sourceJobId',c.source_job_id,'jobType',c.job_type,'requiredAudiencePage',false)::text,
      completed_at=current_timestamp,worker_id=null,lease_token=null,lease_until=null,
      last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id
  returning j.job_id,c.old_status,c.source_job_id,c.job_type
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'CONTRACT_NOT_APPLICABLE',old_status,'COMPLETED','project-auto-completion',
         jsonb_build_object('sourceJobId',source_job_id,'jobType',job_type,
           'reason','approved step contract does not require this audience page')
  from completed returning 1
)
select count(*) from completed;")"
contract_jobs_approved="$(psqlq -c "
with candidate as (
  select j.job_id,full_stack.job_id source_job_id
  from framework_development_job j
  join framework_step_execution_spec spec
    on spec.process_code=j.process_code and spec.step_code=j.step_code
   and spec.design_status='DESIGN_COMPLETE' and spec.approval_status='APPROVED'
  join lateral (
    select verified.job_id
    from framework_development_job verified
    where verified.process_code=j.process_code and verified.step_code=j.step_code
      and verified.job_type in ('FULL_STACK','FULL_STACK_GENERATION')
      and verified.job_status='VERIFIED' and verified.quality_status='VERIFIED'
      and nullif(verified.evidence_ref,'') is not null
    order by verified.completed_at desc nulls last,verified.job_id desc limit 1
  ) full_stack on true
  where j.approval_status='PENDING' and j.job_status in ('PLANNED','RETRY')
    and j.job_type in ('DATABASE','DATABASE_QUALITY','API','API_QUALITY','BACKEND','BACKEND_QUALITY','FRONTEND_ADMIN','TEST','ACTOR_TEST','INTEGRATION')
), approved as (
  update framework_development_job j
  set approval_status='APPROVED',
      result_json=(coalesce(framework_try_jsonb(j.result_json),'{}'::jsonb)||jsonb_build_object('approvalStrategy','APPROVED_STEP_CONTRACT','approvalSourceJobId',c.source_job_id))::text,
      updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id
  returning j.job_id,c.source_job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'STEP_CONTRACT_APPROVED','PENDING','PLANNED','project-auto-completion',
         jsonb_build_object('sourceJobId',source_job_id,'reason','approved execution spec and verified full-stack package cover the exact process step')
  from approved returning 1
)
select count(*) from approved;")"
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
shared_evidence_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.process_code='ORGANIZATIONAL_BOUNDARY'
    and j.job_type in ('API','API_QUALITY','BACKEND','BACKEND_QUALITY')
    and j.job_status='FAILED'
    and j.last_error='deterministic generator failed with code 1'
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='SHARED_EVIDENCE_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'SHARED_EVIDENCE_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','runtime evidence lookup now resolves through the shared primary worktree')
  from recovered returning 1
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
metadata_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_status='FAILED' and j.job_type in ('FRONTEND_USER','FRONTEND_ADMIN')
    and j.last_error='root tracked worktree changed before metadata fast-forward'
    and not exists (select 1 from framework_development_job_event e where e.job_id=j.job_id and e.event_type='ADOPTION_CLOSEOUT_RETRY')
), recovered as (
  update framework_development_job j set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'ADOPTION_CLOSEOUT_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','adoption evidence already exists on main; close without a duplicate commit') from recovered returning 1
)
select count(*) from recovered;")"
symlink_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_status='FAILED' and j.last_error like 'unexpected worker error at line %'
    and not exists (select 1 from framework_development_job_event e where e.job_id=j.job_id and e.event_type='WORKTREE_LINK_RETRY')
), recovered as (
  update framework_development_job j set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'WORKTREE_LINK_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','worktree dependency symlink creation made idempotent') from recovered returning 1
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
legacy_design_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_type='DESIGN'
    and j.job_status='FAILED'
    and j.last_error='unexpected worker error at line 316'
    and not (j.specification_json::jsonb ? 'designContracts')
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='LEGACY_DESIGN_SPEC_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'LEGACY_DESIGN_SPEC_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','legacy DESIGN specification will be enriched from governed screen contracts')
  from recovered returning 1
)
select count(*) from recovered;")"
design_factory_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_type='DESIGN' and j.job_status='FAILED'
    and j.last_error='governed professional screen contracts are missing for legacy DESIGN specification'
    and to_regprocedure('framework_ensure_step_screen_contract(character varying,character varying,character varying)') is not null
    and exists (
      select 1 from framework_page_design d
      where d.process_code=j.process_code and d.step_code=j.step_code
        and d.design_status='DESIGN_COMPLETE' and d.route_status='IMPLEMENTED'
    )
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='DESIGN_FACTORY_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'DESIGN_FACTORY_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','professional screen contract factory completed the missing design prerequisite')
  from recovered returning 1
)
select count(*) from recovered;")"
design_preflight_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_type='DESIGN' and j.job_status='FAILED'
    and j.last_error in ('professional development contract preflight failed',
      'AI completed without a source or metadata change')
    and exists (
      select 1 from framework_professional_screen_contract c
      where c.process_code=j.process_code and c.step_code=j.step_code
        and length(coalesce(c.business_purpose,''))>=10
    )
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='DESIGN_PREFLIGHT_V3_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'DESIGN_PREFLIGHT_V3_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','governed contract renderer can adopt an identical existing professional design')
  from recovered returning 1
)
select count(*) from recovered;")"
generator_spec_retried="$(psqlq -c "
with candidate as (
  select j.job_id,s.requirement_text,s.step_name
  from framework_development_job j
  join framework_process_step s
    on s.process_code=j.process_code and s.step_code=j.step_code
  where j.job_type='FULL_STACK' and j.job_status='FAILED'
    and j.last_error in ('professional development contract preflight failed',
      'deterministic generator failed with code 1')
    and (
      not (coalesce(nullif(j.specification_json,''),'{}')::jsonb ? 'generatorRequired')
      or coalesce((coalesce(nullif(j.specification_json,''),'{}')::jsonb->>'generatorRequired')::boolean,false)=false
      or nullif(btrim(coalesce(coalesce(nullif(j.specification_json,''),'{}')::jsonb->>'requirement','')),'') is null
    )
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='GENERATOR_SPEC_SYNC_RETRY'
    )
), recovered as (
  update framework_development_job j
  set specification_json=(coalesce(nullif(j.specification_json,''),'{}')::jsonb
        || jsonb_build_object(
          'generatorRequired',true,
          'reuseCommonAssets',true,
          'requirement',coalesce(nullif(btrim(c.requirement_text),''),
            c.step_name||' 업무를 전문적으로 완료하고 검증 가능한 산출물을 생성한다.'),
          'specRepairVersion','CONTRACT_GENERATOR_SPEC_V2'))::text,
      job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'GENERATOR_SPEC_SYNC_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','stale full-stack job synchronized with the governed generator contract')
  from recovered returning 1
)
select count(*) from recovered;")"
post_design_fullstack_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_type='FULL_STACK' and j.job_status='FAILED'
    and j.last_error='deterministic generator failed with code 1'
    and exists (
      select 1 from framework_development_job design_job
      where design_job.process_code=j.process_code and design_job.step_code=j.step_code
        and design_job.job_type='DESIGN' and design_job.job_status='VERIFIED'
        and design_job.quality_status='VERIFIED' and nullif(design_job.evidence_ref,'') is not null
    )
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='POST_DESIGN_STACK_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'POST_DESIGN_STACK_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','verified professional DESIGN evidence now satisfies the full-stack prerequisite')
  from recovered returning 1
)
select count(*) from recovered;")"
flat_field_contract_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_type='FULL_STACK' and j.job_status='FAILED'
    and j.last_error='deterministic generator failed with code 1'
    and exists (
      select 1
      from framework_step_execution_spec s
      cross join lateral jsonb_array_elements(s.field_contract) field
      where s.process_code=j.process_code and s.step_code=j.step_code
        and field ? 'fieldCode' and not (field ? 'fields')
    )
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='FLAT_FIELD_CONTRACT_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'FLAT_FIELD_CONTRACT_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','deterministic generator now supports flat professional field contracts')
  from recovered returning 1
)
select count(*) from recovered;")"
ready_package_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_type='FULL_STACK' and j.job_status='FAILED'
    and j.last_error='deterministic generator failed with code 1'
    and exists (
      select 1 from framework_step_execution_spec s
      where s.process_code=j.process_code and s.step_code=j.step_code
        and s.design_status='DESIGN_COMPLETE' and s.approval_status='APPROVED'
        and jsonb_array_length(s.screen_contract)>0
        and (
          jsonb_array_length(s.field_contract)>=8
          or exists (
            select 1 from jsonb_array_elements(s.field_contract) field_group
            where jsonb_typeof(field_group->'fields')='array'
              and jsonb_array_length(field_group->'fields')>=8
          )
        )
    )
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='READY_PACKAGE_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'READY_PACKAGE_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','approved screen and professional field package is now generator-ready')
  from recovered returning 1
)
select count(*) from recovered;")"
frontend_inventory_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.job_type in ('FRONTEND_USER','FRONTEND_ADMIN')
    and j.job_status='FAILED'
    and j.last_error='deterministic generation unavailable and the single automatic AI escalation was already consumed'
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='FRONTEND_INVENTORY_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'FRONTEND_INVENTORY_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','route-source inventory refreshed; retry exact existing frontend adoption')
  from recovered returning 1
)
select count(*) from recovered;")"
database_adoption_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.process_code='EMISSION_PROJECT'
    and j.job_type in ('DATABASE','DATABASE_QUALITY')
    and j.job_status='FAILED'
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='DB_ADOPTION_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'DB_ADOPTION_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','exact migration and live schema validator installed')
  from recovered returning 1
)
select count(*) from recovered;")"
collect_database_validator_retried="$(psqlq -c "
with candidate as (
  select j.job_id from framework_development_job j
  where j.process_code='EMISSION_PROJECT'
    and j.step_code='EMISSION_PROJECT_COLLECT'
    and j.job_type in ('DATABASE','DATABASE_QUALITY')
    and j.job_status='FAILED'
    and j.last_error='deterministic generator failed with code 1'
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='COLLECT_DB_VALIDATOR_RETRY'
    )
), recovered as (
  update framework_development_job j
  set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,
      attempt_count=greatest(0,j.max_attempts-1),last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'COLLECT_DB_VALIDATOR_RETRY','FAILED','RETRY','project-auto-completion',
         jsonb_build_object('reason','activity collection database contract added to exact validator')
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
retried="$((retried+legacy_retried+pool_retried+adoption_retried+binding_retried+shared_evidence_retried+cache_retried+metadata_retried+symlink_retried+router_retried+legacy_design_retried+design_factory_retried+design_preflight_retried+generator_spec_retried+post_design_fullstack_retried+flat_field_contract_retried+ready_package_retried+frontend_inventory_retried+database_adoption_retried+collect_database_validator_retried))"

# Before invoking a model, deterministically adopt server work that is already
# implemented and covered by tests. The adopter is state-guarded, so a job that
# another worker claims concurrently is never overwritten.
server_adopted=0
if [[ -x "$ROOT_DIR/ops/scripts/adopt-existing-server-job.sh" ]]; then
  while IFS= read -r adoption_job_id; do
    [[ -n "$adoption_job_id" ]] || continue
    if ROOT_DIR="$ROOT_DIR" PGDATABASE="$DB" PGUSER="$DB_USER" PGPASSWORD="${PGPASSWORD:-local-trust}" \
      POSTGRES_POD="$leader" PGHOST="127.0.0.1" K8S_NAMESPACE="$NAMESPACE" \
      bash "$ROOT_DIR/ops/scripts/adopt-existing-server-job.sh" "$adoption_job_id" --apply; then
      server_adopted=$((server_adopted + 1))
    fi
  done < <(psqlq -c "
    select j.job_id
    from framework_development_job j
    left join framework_process_delivery_priority_queue q on q.process_code=j.process_code
    where j.approval_status='APPROVED'
      and j.job_status in ('PLANNED','RETRY','FAILED')
      and j.job_type in ('BACKEND','API','API_QUALITY','DATABASE','DATABASE_QUALITY','TEST','ACTOR_TEST')
    order by case q.delivery_priority when 'BLOCKER' then 4 when 'HIGH' then 3 when 'MEDIUM' then 2 when 'LOW' then 1 else 0 end desc,
             coalesce(q.development_order,2147483647),j.job_id
    limit ${SERVER_ADOPTION_SCAN_LIMIT:-3};")
fi
exhausted_planned_retried="$(psqlq -c "
with candidate as (
  select j.job_id
  from framework_development_job j
  where j.approval_status='APPROVED'
    and j.job_status='PLANNED'
    and j.attempt_count>=j.max_attempts
    and coalesce(j.last_error,'')=''
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='EXHAUSTED_PLANNED_RETRY'
    )
    and not exists (
      select 1 from framework_development_job_dependency d
      join framework_development_job required_job on required_job.job_id=d.depends_on_job_id
      where d.job_id=j.job_id and d.dependency_type='REQUIRED'
        and required_job.job_status not in ('VERIFIED','COMPLETED')
    )
), recovered as (
  update framework_development_job j
  set attempt_count=greatest(0,j.max_attempts-1),worker_id=null,lease_token=null,
      lease_until=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'EXHAUSTED_PLANNED_RETRY','PLANNED','PLANNED','project-auto-completion',
         jsonb_build_object('reason','planned job exhausted attempts without an error or execution result')
  from recovered returning 1
)
select count(*) from recovered;")"

# FULL_STACK generation is allowed only after the governed execution spec is
# approved. Older workers treated REVIEW_REQUIRED as a generator failure and
# exhausted retries. Reconcile that state without claiming implementation:
# pending reviews wait, while an approved package is released automatically.
incomplete_spec_demoted="$(psqlq -c "
with candidate as (
  select e.process_code,e.step_code,
    jsonb_array_length(e.screen_contract)=0 as screen_missing,
    (case
      when jsonb_array_length(e.field_contract)=0 then 0
      when jsonb_typeof(e.field_contract->0->'fields')='array' then
        coalesce((select sum(jsonb_array_length(grouped->'fields'))
                  from jsonb_array_elements(e.field_contract) grouped),0)
      else jsonb_array_length(e.field_contract)
    end)<8 as fields_incomplete
  from framework_step_execution_spec e
  join framework_process_step s using(process_code,step_code)
  where e.approval_status='APPROVED'
    and (s.requires_user_page or s.requires_admin_page)
    and (
      jsonb_array_length(e.screen_contract)=0
      or (case
        when jsonb_array_length(e.field_contract)=0 then 0
        when jsonb_typeof(e.field_contract->0->'fields')='array' then
          coalesce((select sum(jsonb_array_length(grouped->'fields'))
                    from jsonb_array_elements(e.field_contract) grouped),0)
        else jsonb_array_length(e.field_contract)
      end)<8
    )
), demoted as (
  update framework_step_execution_spec e
  set design_status='DESIGN_BLOCKED',approval_status='REVIEW_REQUIRED',
      generation_status='BLOCKED',approved_by=null,approved_at=null,
      blocker_codes=(select jsonb_agg(distinct blocker)
        from jsonb_array_elements(
          e.blocker_codes
          ||case when c.screen_missing then '[\"SCREEN_CONTRACT_MISSING\"]'::jsonb else '[]'::jsonb end
          ||case when c.fields_incomplete then '[\"FIELD_CONTRACT_INCOMPLETE\"]'::jsonb else '[]'::jsonb end
        ) blocker),
      updated_at=current_timestamp
  from candidate c where e.process_code=c.process_code and e.step_code=c.step_code
  returning e.process_code,e.step_code
)
select count(*) from demoted;")"

spec_approval_waiting="$(psqlq -c "
with candidate as (
  select j.job_id
  from framework_development_job j
  join framework_step_execution_spec s
    on s.process_code=j.process_code and s.step_code=j.step_code
  where j.job_type in ('FULL_STACK','FULL_STACK_GENERATION')
    and j.job_status in ('FAILED','RETRY')
    and s.approval_status<>'APPROVED'
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='SPEC_APPROVAL_WAIT_V1'
    )
), waiting as (
  update framework_development_job j
  set job_status='PLANNED',approval_status='PENDING',attempt_count=0,
      worker_id=null,lease_token=null,lease_until=null,
      last_error='awaiting governed execution spec approval',updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'SPEC_APPROVAL_WAIT_V1','FAILED','PLANNED','project-auto-completion',
         jsonb_build_object('reason','full-stack generation waits for governed execution spec approval')
  from waiting returning 1
)
select count(*) from waiting;")"

approved_generator_retried="$(psqlq -c "
with candidate as (
  select j.job_id,j.job_status
  from framework_development_job j
  join framework_step_execution_spec s
    on s.process_code=j.process_code and s.step_code=j.step_code
  join framework_process_step step
    on step.process_code=j.process_code and step.step_code=j.step_code
  where j.job_type in ('FULL_STACK','FULL_STACK_GENERATION')
    and j.job_status in ('FAILED','PLANNED')
    and s.design_status='DESIGN_COMPLETE' and s.approval_status='APPROVED'
    and ((jsonb_array_length(s.screen_contract)>0 and jsonb_array_length(s.field_contract)>0)
      or (not step.requires_user_page and not step.requires_admin_page
        and (step.requires_api or step.requires_database)))
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='APPROVED_GENERATOR_V7_RETRY'
    )
), released as (
  update framework_development_job j
  set job_status='RETRY',approval_status='APPROVED',
      attempt_count=greatest(0,j.max_attempts-1),worker_id=null,
      lease_token=null,lease_until=null,last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id,c.job_status
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'APPROVED_GENERATOR_V7_RETRY',job_status,'RETRY','project-auto-completion',
         jsonb_build_object('reason','approved UI or backend-only package released to generator v7')
  from released returning 1
)
select count(*) from released;")"

generated_dimension_retried="$(psqlq -c "
with candidate as (
  select j.job_id,j.job_status
  from framework_development_job j
  join framework_step_execution_spec s
    on s.process_code=j.process_code and s.step_code=j.step_code
  where j.job_status='FAILED'
    and j.job_type in ('FRONTEND_USER','FRONTEND_ADMIN','API','API_QUALITY',
      'BACKEND','BACKEND_QUALITY','DATABASE','DATABASE_QUALITY','TEST','ACTOR_TEST','INTEGRATION')
    and s.approval_status='APPROVED' and s.generation_status='GENERATED'
    and not exists (
      select 1 from framework_development_job_event e
      where e.job_id=j.job_id and e.event_type='GENERATED_DIMENSION_V6_RETRY'
    )
), released as (
  update framework_development_job j
  set job_status='RETRY',approval_status='APPROVED',
      attempt_count=greatest(0,j.max_attempts-1),worker_id=null,
      lease_token=null,lease_until=null,last_error=null,updated_at=current_timestamp
  from candidate c where j.job_id=c.job_id returning j.job_id,c.job_status
), logged as (
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'GENERATED_DIMENSION_V6_RETRY',job_status,'RETRY','project-auto-completion',
         jsonb_build_object('reason','exact generated step dimension validates backend-only API, persistence, and integration contracts')
  from released returning 1
)
select count(*) from released;")"

retried="$((retried+spec_approval_waiting+approved_generator_retried+generated_dimension_retried))"
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
dispatcher_failed=0
if [[ "$executable" -gt 0 ]]; then
  ROOT_DIR="$ROOT_DIR" MAX_PARALLEL_WORKERS="$MAX_PARALLEL_WORKERS" \
    PGDATABASE="$DB" PGUSER="$DB_USER" PGPASSWORD="${PGPASSWORD:-local-trust}" \
    POSTGRES_POD="$leader" PGHOST="127.0.0.1" K8S_NAMESPACE="$NAMESPACE" \
    PROJECT_WORK_RUNNER="$PROJECT_WORK_RUNNER" bash "$ROOT_DIR/ops/scripts/run-process-development-dispatcher.sh" || dispatcher_failed=1
fi
screen_generation_result='{"status":"NOT_INSTALLED"}'
if [[ "$(psqlq -c "select (to_regprocedure('framework_incremental_screen_generation_snapshot(integer,character varying)') is not null)::integer;")" == "1" ]]; then
  set +e
  screen_generation_result="$(ROOT_DIR="$ROOT_DIR" PGDATABASE="$DB" PGUSER="$DB_USER" \
    PGPASSWORD="${PGPASSWORD:-local-trust}" POSTGRES_POD="$leader" K8S_NAMESPACE="$NAMESPACE" \
    SCREEN_RUNTIME_OUT="${SCREEN_RUNTIME_OUT:-$ROOT_DIR/var/runtime/screen-generation}" \
    bash "$ROOT_DIR/ops/scripts/generate-incremental-screen-runtime.sh" "$ROOT_DIR" 2>&1)"
  screen_generation_rc=$?
  set -e
  if (( screen_generation_rc != 0 )); then
    dispatcher_failed=1
    screen_generation_result="$(jq -cn --arg error "$screen_generation_result" '{status:"FAILED",error:$error}')"
  fi
fi
completed="$(psqlq -c "with done as (update framework_process_definition p set process_status='DEVELOPMENT_READY',updated_at=current_timestamp from framework_process_delivery_priority_queue q where q.process_code=p.process_code and q.next_action='COMPLETE' and p.process_status<>'DEVELOPMENT_READY' returning 1) select count(*) from done;")"
blocked="$(psqlq -c "select count(*) from framework_process_delivery_priority_queue where delivery_priority='BLOCKER';")"
remaining="$(psqlq -c "select count(*) from framework_process_delivery_priority_queue where next_action<>'COMPLETE';")"
status="PROGRESSING"; [[ "$remaining" == "0" ]] && status="COMPLETED"; [[ "$blocked" -gt 0 || ( "$remaining" -gt 0 && "$executable" == "0" ) || "$dispatcher_failed" -gt 0 ]] && status="ATTENTION_REQUIRED"
psqlq -c "update framework_project_completion_run set run_status='$status',selected_process_count=$selected,executable_job_count=$executable,retried_job_count=$retried,completed_process_count=$completed,blocked_process_count=$blocked,result_json='{\"remainingProcesses\":$remaining,\"dispatcherFailed\":$dispatcher_failed}',completed_at=current_timestamp where run_id='$run_id';" >/dev/null
echo "[project-auto-completion] $status selected=$selected executable=$executable retried=$retried incompleteSpecDemoted=$incomplete_spec_demoted specApprovalWaiting=$spec_approval_waiting approvedGeneratorRetried=$approved_generator_retried generatedDimensionRetried=$generated_dimension_retried designEvidenceAdopted=$design_evidence_adopted notApplicableCompleted=$not_applicable_completed contractJobsApproved=$contract_jobs_approved exhaustedPlannedRetried=$exhausted_planned_retried adopted=$server_adopted completed=$completed blocked=$blocked remaining=$remaining dispatcherFailed=$dispatcher_failed contractCompletion=$contract_completion_result screenGeneration=$(jq -c '{status:(.status//"GENERATED"),requested:(.requested//0),generated:(.generated//0),unchanged:(.unchanged//0),elapsedMillis:(.elapsedMillis//0)}' <<<"$screen_generation_result")"
