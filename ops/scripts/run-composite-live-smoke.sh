#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MANIFEST="$ROOT/ops/runtime-metadata/composite-live-smoke-runner.json"
RUNNER="$ROOT/ops/scripts/resonance-composite-live-smoke-e2e.mjs"
STATE_ROOT="${CARBONET_COMPOSITE_LIVE_SMOKE_STATE_ROOT:-$ROOT/var/test-evidence/composite-live-smoke}"
LOCK_FILE="${CARBONET_COMPOSITE_LIVE_SMOKE_LOCK:-/tmp/resonance-composite-live-smoke.lock}"
source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"

safe_error(){ printf '%s' "$1" | tr '[:lower:]' '[:upper:]' | tr -cd 'A-Z0-9_' | cut -c1-100; }
hash_text(){ printf '%s' "$1" | sha256sum | awk '{print $1}'; }
[[ -f "$MANIFEST" && -f "$RUNNER" ]] || { echo '[composite-live-smoke] runner files missing' >&2; exit 2; }
credentials="${CARBONET_COMPOSITE_RELAY_ACCOUNTS_JSON:-{}}"
jq -e 'type=="object" and length>0 and all(to_entries[];
  (.key|test("^[A-Z0-9_:-]{2,120}$")) and (.value|type=="string" and test("^[A-Za-z0-9_-]{2,100}$")))' \
  <<<"$credentials" >/dev/null || { echo '[composite-live-smoke] relay account map unavailable' >&2; exit 2; }
[[ -n "${CARBONET_ACTOR_TEST_PASSWORD:-}" && -n "${RESONANCE_OPS_TOKEN:-}" ]] || {
  echo '[composite-live-smoke] secret environment unavailable' >&2; exit 2;
}
mkdir -p "$STATE_ROOT"
exec 9>"$LOCK_FILE"; flock -n 9 || { echo '[composite-live-smoke] another runner owns the lease'; exit 0; }
carbonet_postgres_query_init

lease_seconds="$(jq -er '.retry.leaseSeconds|numbers' "$MANIFEST")"
lease_token="$(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen)"
error_hash="$(hash_text STALE_LEASE_EXPIRED)"
carbonet_postgres_query "begin;
update integrated_design_live_smoke_dispatch
   set status='RETRY_WAIT',lease_token=null,lease_until=null,
       next_attempt_at=clock_timestamp(),last_error_code='STALE_LEASE_EXPIRED',
       last_error_hash='$error_hash'
 where status='RUNNING' and lease_until<clock_timestamp();
update integrated_design_live_smoke_dispatch dispatch
   set status='SUPERSEDED',lease_token=null,lease_until=null,
       completed_at=coalesce(completed_at,clock_timestamp()),
       last_error_code='AUTHORITY_REVISION_SUPERSEDED',
       last_error_hash=framework_composite_live_smoke_hash(jsonb_build_object(
         'oldRevisionSetHash',dispatch.authority_revision_set_hash,
         'newRevisionSetHash',framework_composite_authority_revision_set_hash(dispatch.job_id)))
 where status<>'SUPERSEDED' and authority_revision_set_hash<>
       framework_composite_authority_revision_set_hash(job_id);
with candidate as (
  select dispatch_id from integrated_design_live_smoke_dispatch
   where status in('QUEUED','RETRY_WAIT') and attempt_count<3
     and next_attempt_at<=clock_timestamp()
     and authority_revision_set_hash=framework_composite_authority_revision_set_hash(job_id)
   order by next_attempt_at,dispatch_id for update skip locked limit 1
), claimed as (
  update integrated_design_live_smoke_dispatch dispatch
     set status='RUNNING',attempt_count=attempt_count+1,lease_token='$lease_token'::uuid,
         lease_until=clock_timestamp()+interval '$lease_seconds seconds',
         started_at=coalesce(started_at,clock_timestamp()),last_error_code=null,last_error_hash=null
    from candidate where dispatch.dispatch_id=candidate.dispatch_id
  returning dispatch.dispatch_id
)
select coalesce(max(dispatch_id),0) from claimed;
commit;" >"$STATE_ROOT/.claim"
dispatch_id="$(grep -E '^[0-9]+$' "$STATE_ROOT/.claim" | tail -n1 || true)"
rm -f "$STATE_ROOT/.claim"
[[ "$dispatch_id" =~ ^[1-9][0-9]*$ ]] || { echo '[composite-live-smoke] due=0'; exit 0; }

credential_values=""
while IFS= read -r account; do
  [[ -z "$credential_values" ]] || credential_values+=","
  credential_values+="('$account')"
done < <(jq -r '[.[]]|unique|sort[]' <<<"$credentials")
plan_file="$(mktemp "$STATE_ROOT/.plan-${dispatch_id}.XXXXXX.json")"
cleanup(){ rm -f "$plan_file"; }
trap cleanup EXIT
plan="$(carbonet_postgres_query "with credential(account_id) as (values $credential_values),
dispatch as (
 select dispatch.*,framework_try_jsonb(job.result_json)->>'commit' result_commit
 from integrated_design_live_smoke_dispatch dispatch
 join framework_development_job job on job.job_id=dispatch.job_id
 where dispatch.dispatch_id=$dispatch_id and dispatch.status='RUNNING'
   and dispatch.lease_token='$lease_token'::uuid
), authorities as (
 select authority.*,dispatch.project_id,target.direct_identity,
        (authority.composite_json#>>'{executableDesign,PROCESS,stepOrder}')::integer step_order
 from integrated_design_authority authority join dispatch on dispatch.job_id=authority.job_id
 join framework_composite_design_target_identity target
   on target.process_code=authority.process_code and target.step_code=authority.step_code
  and target.route_path=authority.route_path and target.audience=authority.audience
), authority_actors as (
 select distinct authority.authority_id,authority.project_id,
        command->>'actorCode' actor_code
 from authorities authority cross join lateral jsonb_array_elements(
   authority.composite_json#>'{executableDesign,PROCESS,commands}') command
), positive_scope as (
 select distinct
         actor.authority_id,actor.actor_code,assignment.tenant_id,
         project_actor.project_id
 from authority_actors actor cross join credential
 join framework_account_actor_assignment assignment
   on lower(assignment.account_id)=lower(credential.account_id)
  and assignment.actor_code=actor.actor_code and assignment.assignment_status='ACTIVE'
  and assignment.valid_from<=current_date
  and (assignment.valid_until is null or assignment.valid_until>=current_date)
 join framework_project_actor_assignment project_actor
   on project_actor.actor_code=actor.actor_code
  and lower(project_actor.user_id)=lower(credential.account_id)
  and project_actor.active_yn='Y'
  and (assignment.project_id='*' or assignment.project_id=project_actor.project_id)
  and (actor.project_id='*' or actor.project_id=project_actor.project_id)
), eligibility as (
 select scope.authority_id,scope.actor_code,scope.tenant_id,scope.project_id,
        credential.account_id,
   (select count(*) from framework_account_actor_assignment assignment
     join framework_actor_definition definition on definition.actor_code=assignment.actor_code and definition.use_at='Y'
    where lower(assignment.account_id)=lower(credential.account_id)
      and assignment.tenant_id=scope.tenant_id and assignment.actor_code=scope.actor_code
      and (assignment.project_id='*' or assignment.project_id=scope.project_id)
      and exists(
        select 1 from framework_project_actor_assignment project_actor
         where project_actor.project_id=scope.project_id and project_actor.actor_code=scope.actor_code
           and lower(project_actor.user_id)=lower(credential.account_id) and project_actor.active_yn='Y')
      and assignment.assignment_status='ACTIVE' and assignment.valid_from<=current_date
      and (assignment.valid_until is null or assignment.valid_until>=current_date))::integer assignment_count
 from positive_scope scope cross join credential
)
select jsonb_build_object('schema','carbonet.composite-live-smoke-plan/v1',
 'dispatchId',dispatch.dispatch_id,'jobId',dispatch.job_id,'processCode',dispatch.process_code,
 'projectId',dispatch.project_id,'authorityRevisionSetHash',dispatch.authority_revision_set_hash,
 'artifactManifestHash',dispatch.artifact_manifest_hash,
 'expectedEvidenceCount',dispatch.expected_evidence_count,'observedAt',dispatch.started_at,
 'resultCommit',dispatch.result_commit,
 'authorities',(select jsonb_agg(jsonb_build_object('authorityId',authority_id,
    'authorityRevision',authority_revision,'processCode',process_code,'stepCode',step_code,
    'stepOrder',step_order,'directIdentity',direct_identity,
    'routePath',route_path,'audience',audience,'sourceHash',source_hash,
   'authorityHash',authority_hash,'projectId',project_id,'composite',composite_json)
   order by step_code collate \"C\",route_path collate \"C\",audience collate \"C\") from authorities),
 'activeAccounts',(select coalesce(jsonb_agg(account_id order by account_id),'[]'::jsonb) from credential
   where exists(select 1 from comtnemplyrinfo account join comtnemplyrscrtyestbs security
      on security.scrty_dtrmn_trget_id=account.esntl_id and nullif(btrim(security.author_code),'') is not null
     where lower(account.emplyr_id)=lower(credential.account_id) and account.emplyr_sttus_code in('P','A'))
      or exists(select 1 from comtnentrprsmber account join comtnemplyrscrtyestbs security
      on security.scrty_dtrmn_trget_id=account.esntl_id and nullif(btrim(security.author_code),'') is not null
     where lower(account.entrprs_mber_id)=lower(credential.account_id) and account.entrprs_mber_sttus in('P','A'))),
 'eligibleAssignments',(select coalesce(jsonb_agg(jsonb_build_object('authorityId',authority_id,
   'actorCode',actor_code,'tenantId',tenant_id,'projectId',project_id,'accountId',account_id,
   'assignmentCount',assignment_count) order by authority_id,actor_code,tenant_id,project_id,account_id),'[]'::jsonb) from eligibility),
 'existingEvidenceKeys',(select coalesce(jsonb_agg(evidence.authority_id||'|'||evidence.authority_revision||'|'||
   evidence.command_code||'|'||evidence.scenario_code||'|'||evidence.status_case||'|'||evidence.lane
   order by evidence.authority_id,evidence.command_code,evidence.scenario_code,evidence.status_case,evidence.lane),'[]'::jsonb)
   from integrated_design_live_smoke_evidence evidence join authorities authority
     on authority.authority_id=evidence.authority_id and authority.authority_revision=evidence.authority_revision
    and authority.source_hash=evidence.source_hash and authority.authority_hash=evidence.authority_hash
   where evidence.job_id=dispatch.job_id),
 'existingScenarioContexts',(select coalesce(jsonb_agg(jsonb_build_object(
    'authorityId',evidence.authority_id,'scenarioCode',evidence.scenario_code,
    'statusCase',evidence.status_case,'executionId',evidence.lane_evidence->>'executionId',
    'idempotencyKey',evidence.lane_evidence->>'idempotencyKey',
    'observedHttpStatus',(evidence.lane_evidence->>'observedHttpStatus')::integer,
   'output',evidence.output_json) order by evidence.authority_id,evidence.scenario_code),'[]'::jsonb)
   from integrated_design_live_smoke_evidence evidence join authorities authority
     on authority.authority_id=evidence.authority_id
    and authority.authority_revision=evidence.authority_revision
    and authority.source_hash=evidence.source_hash and authority.authority_hash=evidence.authority_hash
   where evidence.job_id=dispatch.job_id and evidence.lane='API')) from dispatch;")"
jq -e '.schema=="carbonet.composite-live-smoke-plan/v1"' <<<"$plan" >/dev/null || {
  runner_code=LIVE_SMOKE_PLAN_INVALID; runner_hash="$(hash_text "$dispatch_id|plan")"; result='';
}
if [[ -z "${runner_code:-}" ]]; then
  printf '%s\n' "$plan" >"$plan_file"; chmod 600 "$plan_file"
  result_commit="$(jq -r .resultCommit <<<"$plan")"
  deployed_commit="$(tr -d '[:space:]' <"${CARBONET_DEPLOY_SUCCESS_MARKER:-/opt/resonance-data/deploy/carbonet-main-success.commit}" 2>/dev/null || true)"
  if [[ ! "$result_commit" =~ ^[0-9a-f]{40}$ || ! "$deployed_commit" =~ ^[0-9a-f]{40}$ ]] \
    || ! git -C "$ROOT" merge-base --is-ancestor "$result_commit" "$deployed_commit" 2>/dev/null; then
    runner_code=POSTDEPLOY_COMMIT_NOT_CURRENT; runner_hash="$(hash_text "$result_commit|$deployed_commit")"; result=''
  else
    set +e
    result="$(CARBONET_COMPOSITE_LIVE_SMOKE_PLAN="$plan_file" RESONANCE_ROOT="$ROOT" \
      timeout --signal=TERM --kill-after=10s "$(jq -r .timeouts.jobSeconds "$MANIFEST")s" node "$RUNNER" 2>"$STATE_ROOT/.error-$dispatch_id")"
    runner_status=$?
    set -e
    if (( runner_status != 0 )); then
      error_json="$(tail -n1 "$STATE_ROOT/.error-$dispatch_id" 2>/dev/null || true)"; rm -f "$STATE_ROOT/.error-$dispatch_id"
      runner_code="$(safe_error "$(jq -r '.code // "LIVE_SMOKE_RUNNER_FAILED"' <<<"$error_json" 2>/dev/null || echo LIVE_SMOKE_RUNNER_FAILED)")"
      runner_hash="$(jq -r '.errorHash // empty' <<<"$error_json" 2>/dev/null || true)"
      [[ "$runner_hash" =~ ^[0-9a-f]{64}$ ]] || runner_hash="$(hash_text "$runner_status|$runner_code")"
    fi
  fi
fi

if [[ -z "${runner_code:-}" ]]; then
  evidence_set_hash="$(jq -er '.evidenceSetHash|select(test("^[0-9a-f]{64}$"))' <<<"$result")"
  directory_hash="$(jq -er '.evidenceDirectoryHash|select(test("^[0-9a-f]{64}$"))' <<<"$result")"
  expected="$(jq -er .expectedEvidenceCount <<<"$result")"
  final="$(carbonet_postgres_query "begin;
with counted as (select count(*)::integer evidence_count from integrated_design_live_smoke_evidence evidence
 join integrated_design_authority authority on authority.authority_id=evidence.authority_id
  and authority.job_id=evidence.job_id and authority.authority_revision=evidence.authority_revision
  and authority.source_hash=evidence.source_hash and authority.authority_hash=evidence.authority_hash
 where evidence.job_id=(select job_id from integrated_design_live_smoke_dispatch where dispatch_id=$dispatch_id)),
finished as (update integrated_design_live_smoke_dispatch dispatch
 set status='EVIDENCE_SUBMITTED',submitted_evidence_count=counted.evidence_count,
     lease_token=null,lease_until=null,evidence_summary=jsonb_build_object(
       'runnerSchema','carbonet.composite-live-smoke-runner/v1','evidenceSetHash','$evidence_set_hash',
       'evidenceDirectoryHash','$directory_hash')
 from counted where dispatch.dispatch_id=$dispatch_id and dispatch.status='RUNNING'
  and dispatch.lease_token='$lease_token'::uuid and counted.evidence_count=$expected
  and counted.evidence_count=dispatch.expected_evidence_count
  and dispatch.authority_revision_set_hash=framework_composite_authority_revision_set_hash(dispatch.job_id)
 returning dispatch.*), receipt_update as (update integrated_design_autocompletion_receipt receipt
 set receipt_json=receipt.receipt_json||jsonb_build_object('liveSmokeDispatchId',finished.dispatch_id,
   'liveSmokeDispatchStatus','EVIDENCE_SUBMITTED','liveSmokeEvidenceCount',finished.submitted_evidence_count),
   updated_at=clock_timestamp() from finished where receipt.job_id=finished.job_id
   and receipt.process_code=finished.process_code returning receipt.process_code)
select jsonb_build_object('dispatchWrites',(select count(*) from finished),
 'receiptWrites',(select count(*) from receipt_update)); commit;")"
  [[ "$(jq -r '.dispatchWrites,.receiptWrites' <<<"$final" | paste -sd: -)" == 1:1 ]] || {
    echo '[composite-live-smoke] final CAS lost; current design remains TEST_PENDING' >&2; exit 4;
  }
  echo "[composite-live-smoke] EVIDENCE_SUBMITTED dispatch=$dispatch_id evidence=$expected"
  exit 0
fi

attempt="$(jq -r '.attemptCount // 3' <<<"$(carbonet_postgres_query "select jsonb_build_object('attemptCount',attempt_count) from integrated_design_live_smoke_dispatch where dispatch_id=$dispatch_id")")"
if (( attempt >= 3 )); then next_status=DEAD_LETTER; completed_sql='clock_timestamp()'; next_sql='clock_timestamp()';
else next_status=RETRY_WAIT; completed_sql=null; backoff="$(jq -r ".retry.backoffSeconds[$((attempt-1))] // 30" "$MANIFEST")"; next_sql="clock_timestamp()+interval '$backoff seconds'"; fi
failure="$(carbonet_postgres_query "begin; with failed as (update integrated_design_live_smoke_dispatch dispatch
 set status='$next_status',lease_token=null,lease_until=null,next_attempt_at=$next_sql,
   completed_at=$completed_sql,last_error_code='$runner_code',last_error_hash='$runner_hash'
 where dispatch_id=$dispatch_id and status='RUNNING' and lease_token='$lease_token'::uuid
  and authority_revision_set_hash=framework_composite_authority_revision_set_hash(job_id)
 returning *) update integrated_design_autocompletion_receipt receipt
 set receipt_json=receipt.receipt_json||jsonb_build_object('liveSmokeDispatchId',failed.dispatch_id,
   'liveSmokeDispatchStatus',failed.status,'liveSmokeLastErrorCode',failed.last_error_code,
   'liveSmokeLastErrorHash',failed.last_error_hash),updated_at=clock_timestamp()
 from failed where receipt.job_id=failed.job_id and receipt.process_code=failed.process_code
 returning receipt.process_code)
select jsonb_build_object('dispatchWrites',(select count(*) from failed),
 'receiptWrites',(select count(*) from receipt_update)); commit;")"
[[ "$(jq -r '.dispatchWrites,.receiptWrites' <<<"$failure" | paste -sd: -)" == 1:1 ]] || {
  echo '[composite-live-smoke] failure CAS lost; current design remains TEST_PENDING' >&2; exit 4;
}
echo "[composite-live-smoke] $next_status dispatch=$dispatch_id attempt=$attempt code=$runner_code"
[[ "$next_status" == RETRY_WAIT ]] || exit 3
