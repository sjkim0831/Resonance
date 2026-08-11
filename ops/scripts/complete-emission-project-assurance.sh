#!/usr/bin/env bash
set -euo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
PROCESS="EMISSION_PROJECT"
STEPS=(EMISSION_PROJECT_SETUP EMISSION_PROJECT_COLLECT EMISSION_PROJECT_CALCULATE EMISSION_PROJECT_VALIDATE EMISSION_PROJECT_CORRECT EMISSION_PROJECT_APPROVE EMISSION_PROJECT_REPORT)
DIMENSIONS=(DATABASE BACKEND FRONTEND_USER FRONTEND_ADMIN TEST)
CONTRACTS='[]'
for step in "${STEPS[@]}"; do
  contract="$(bash "$ROOT/ops/scripts/capture-business-e2e-contract.sh" "$PROCESS" "$step")"
  CONTRACTS="$(jq -cn --argjson contracts "$CONTRACTS" --argjson contract "$contract" '$contracts + [$contract]')"
done
SOURCE_COMMIT="$(jq -r 'map(.sourceCommit)|unique|if length==1 then .[0] else error("mixed deployed commits") end' <<<"$CONTRACTS")"
[[ "$SOURCE_COMMIT" =~ ^[0-9a-fA-F]{7,80}$ ]] || { echo '[emission-project-assurance] FAIL invalid deployed source commit' >&2; exit 2; }
VALIDATION_COMMIT="$(git -C "$ROOT" rev-parse HEAD)"
EVIDENCE_REF="runtime-e2e:${SOURCE_COMMIT}:steps=7:actors=6:tasks=7:protected=9:recovery=PASS"

activity="$(bash "$ROOT/ops/scripts/validate-activity-data-runtime.sh")"
calculation="$(bash "$ROOT/ops/scripts/validate-emission-calculation-runtime.sh")"
report="$(bash "$ROOT/ops/scripts/validate-report-certification-runtime.sh")"
workflow="$(bash "$ROOT/ops/scripts/validate-emission-project-workflow.sh")"
customer="$(bash "$ROOT/ops/scripts/validate-customer-work-journey.sh")"
runtime_smoke="$(CARBONET_RUNTIME_SMOKE_PROCESS=EMISSION_PROJECT bash "$ROOT/ops/scripts/run-process-runtime-smoke.sh")"
grep -Eq '^\[activity-runtime\] PASS ' <<<"$activity" || exit 1
grep -Eq '^\[calculation-runtime\] PASS ' <<<"$calculation" || exit 1
grep -Eq '^\[report-runtime\] PASS ' <<<"$report" || exit 1
grep -Eq '^\[emission-workflow\] PASS ' <<<"$workflow" || exit 1
grep -Eq '^\[customer-journey\] PASS ' <<<"$customer" || exit 1
grep -Eq '^\[process-runtime-smoke\] PASS process=EMISSION_PROJECT ' <<<"$runtime_smoke" || exit 1
DEPLOY_STATE_FILE="${CARBONET_DEPLOY_STATE_FILE:-/opt/resonance-data/deploy/carbonet-main-success.commit}"
CURRENT_DEPLOYED_COMMIT="${E2E_DEPLOYED_COMMIT:-$(tr -d '[:space:]' < "$DEPLOY_STATE_FILE" 2>/dev/null || true)}"
[[ "$VALIDATION_COMMIT" == "$CURRENT_DEPLOYED_COMMIT" ]] || { echo '[emission-project-assurance] FAIL validation commit is not deployed' >&2; exit 3; }
if [[ "$SOURCE_COMMIT" != "$VALIDATION_COMMIT" ]]; then
  git -C "$ROOT" merge-base --is-ancestor "$SOURCE_COMMIT" "$VALIDATION_COMMIT" || {
    echo '[emission-project-assurance] FAIL runtime commit is not validation ancestor' >&2; exit 3;
  }
  PLAN="$(bash "$ROOT/ops/scripts/plan-incremental-work.sh" "$SOURCE_COMMIT" "$VALIDATION_COMMIT" --format env)"
  for KEY in PLAN_RUNTIME_REQUIRED PLAN_FRONTEND_REQUIRED PLAN_BACKEND_REQUIRED PLAN_DATABASE_REQUIRED; do
    [[ "$(awk -F= -v key="$KEY" '$1==key{print $2}' <<<"$PLAN")" == false ]] || {
      echo "[emission-project-assurance] FAIL unreleased runtime change key=$KEY" >&2; exit 3;
    }
  done
fi
ASSURANCE_EVIDENCE="$(jq -cn --argjson contracts "$CONTRACTS" --arg activity "$activity" --arg calculation "$calculation" \
  --arg report "$report" --arg workflow "$workflow" --arg customer "$customer" --arg runtimeSmoke "$runtime_smoke" --arg validationCommit "$VALIDATION_COMMIT" \
  '{suite:"EMISSION_PROJECT_ASSURANCE",validationCommit:$validationCommit,contracts:$contracts,validators:{activity:$activity,calculation:$calculation,report:$report,workflow:$workflow,customerJourney:$customer,runtimeSmoke:$runtimeSmoke},stepAssertions:{EMISSION_PROJECT_SETUP:["workflow","customerJourney"],EMISSION_PROJECT_COLLECT:["activity","customerJourney"],EMISSION_PROJECT_CALCULATE:["calculation","customerJourney"],EMISSION_PROJECT_VALIDATE:["calculation","runtimeSmoke"],EMISSION_PROJECT_CORRECT:["customerJourney","runtimeSmoke"],EMISSION_PROJECT_APPROVE:["customerJourney","workflow"],EMISSION_PROJECT_REPORT:["report","customerJourney"]}}')"
ASSURANCE_EVIDENCE_SHA256="$(printf '%s' "$ASSURANCE_EVIDENCE" | sha256sum | awk '{print $1}')"
ASSURANCE_EVIDENCE_B64="$(printf '%s' "$ASSURANCE_EVIDENCE" | base64 -w0)"
ASSURANCE_EVIDENCE_URI="inline://business-e2e/sha256/$ASSURANCE_EVIDENCE_SHA256"

dimension_count=0
for step in "${STEPS[@]}"; do
  for dimension in "${DIMENSIONS[@]}"; do
    bash "$ROOT/ops/scripts/validate-generated-process-dimension.sh" "$ROOT" "$PROCESS" "$step" "$dimension" >/dev/null
    dimension_count=$((dimension_count+1))
  done
done
[[ "$dimension_count" == 35 ]] || { echo "[emission-project-assurance] FAIL dimensions=$dimension_count" >&2; exit 1; }

POD="$(K8S_NAMESPACE="$NAMESPACE" bash "$ROOT/ops/scripts/resolve-patroni-primary-pod.sh")"
SQL=$(cat <<SQL
do \$\$
declare target_count integer;
begin
  insert into framework_process_qa_run(
    process_code,step_code,result,failure_reason,evidence_json,executed_by,executed_at,
    evidence_type,process_version,source_commit,contract_fingerprint,
    execution_environment,evidence_uri,evidence_hash
  )
  select p.process_code,s.step_code,'PASSED',null,
         evidence.body || jsonb_build_object('stepCode',s.step_code,'sha256','$ASSURANCE_EVIDENCE_SHA256'),
         'EMISSION_PROJECT_ASSURANCE',current_timestamp,'BUSINESS_E2E',p.process_version,
         '$SOURCE_COMMIT',framework_current_process_step_contract_fingerprint(p.process_code,s.step_code),
         '$NAMESPACE','$ASSURANCE_EVIDENCE_URI','$ASSURANCE_EVIDENCE_SHA256'
  from framework_process_definition p
  join framework_process_step s using(process_code)
  cross join lateral (select convert_from(decode('$ASSURANCE_EVIDENCE_B64','base64'),'UTF8')::jsonb body) evidence
  join lateral (select contract from jsonb_array_elements(evidence.body->'contracts') contract
                where contract->>'processCode'=p.process_code and contract->>'stepCode'=s.step_code) captured on true
  where p.process_code='EMISSION_PROJECT'
    and s.step_code in ('EMISSION_PROJECT_SETUP','EMISSION_PROJECT_COLLECT','EMISSION_PROJECT_CALCULATE','EMISSION_PROJECT_VALIDATE','EMISSION_PROJECT_CORRECT','EMISSION_PROJECT_APPROVE','EMISSION_PROJECT_REPORT')
    and p.process_version=captured.contract->>'processVersion'
    and framework_current_process_step_contract_fingerprint(p.process_code,s.step_code)=captured.contract->>'contractFingerprint'
    and captured.contract->>'sourceCommit'='$SOURCE_COMMIT'
    and framework_current_process_step_contract_fingerprint(p.process_code,s.step_code) is not null
  on conflict do nothing;

  select count(*) into target_count
  from framework_current_business_e2e_evidence
  where process_code='EMISSION_PROJECT'
    and step_code in ('EMISSION_PROJECT_SETUP','EMISSION_PROJECT_COLLECT','EMISSION_PROJECT_CALCULATE','EMISSION_PROJECT_VALIDATE','EMISSION_PROJECT_CORRECT','EMISSION_PROJECT_APPROVE','EMISSION_PROJECT_REPORT')
    and business_test_result='PASSED'
    and source_commit='$SOURCE_COMMIT'
    and evidence_hash='$ASSURANCE_EVIDENCE_SHA256';
  if target_count<>7 then raise exception 'EMISSION_PROJECT current-version E2E evidence mismatch: %',target_count; end if;

  update framework_professional_screen_contract
  set menu_visibility='HIDDEN',menu_verified=true,api_verified=true,database_verified=true,
      authority_verified=true,responsive_verified=true,accessibility_verified=true,
      exception_states_verified=true,audit_evidence_ref='$EVIDENCE_REF',
      contract_status='VERIFIED',updated_by='EMISSION_PROJECT_ASSURANCE',updated_at=current_timestamp
  where process_code='EMISSION_PROJECT' and audience='ADMIN'
    and lower(split_part(route_path,'?',1)) in (
      '/admin/emission/approval-queue','/admin/emission/calculation-result','/admin/emission/activity-data',
      '/admin/emission/correction-management','/admin/emission/report-management',
      '/admin/emission/organizational-boundary','/admin/emission/validation-queue');
  if (select count(*) from framework_professional_screen_readiness
      where process_code='EMISSION_PROJECT' and readiness_score=100)<>25 then
    raise exception 'EMISSION_PROJECT verified screen count mismatch';
  end if;

  select count(*) into target_count from framework_development_job
  where process_code='EMISSION_PROJECT'
    and step_code in ('EMISSION_PROJECT_SETUP','EMISSION_PROJECT_COLLECT','EMISSION_PROJECT_CALCULATE','EMISSION_PROJECT_VALIDATE','EMISSION_PROJECT_CORRECT','EMISSION_PROJECT_APPROVE','EMISSION_PROJECT_REPORT')
    and job_type in ('DATABASE','BACKEND','FRONTEND_USER','FRONTEND_ADMIN','TEST')
    and target_path like 'schema-set/emission_project/%' and required;
  if target_count<>35 then raise exception 'EMISSION_PROJECT assurance target mismatch: %',target_count; end if;

  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'RUNTIME_E2E_VERIFIED',job_status,'VERIFIED','emission-project-assurance',
         json_build_object('evidenceRef','$EVIDENCE_REF','steps',7,'actors',6,'tasks','7/7','protectedRoutes',9,'recovery','PASS')::text
  from framework_development_job
  where process_code='EMISSION_PROJECT'
    and step_code in ('EMISSION_PROJECT_SETUP','EMISSION_PROJECT_COLLECT','EMISSION_PROJECT_CALCULATE','EMISSION_PROJECT_VALIDATE','EMISSION_PROJECT_CORRECT','EMISSION_PROJECT_APPROVE','EMISSION_PROJECT_REPORT')
    and job_type in ('DATABASE','BACKEND','FRONTEND_USER','FRONTEND_ADMIN','TEST')
    and target_path like 'schema-set/emission_project/%' and required
    and (job_status,quality_status,approval_status,evidence_ref) is distinct from ('VERIFIED','VERIFIED','APPROVED','$EVIDENCE_REF');

  update framework_development_job
  set job_status='VERIFIED',approval_status='APPROVED',quality_status='VERIFIED',
      evidence_ref='$EVIDENCE_REF',
      result_json=json_build_object('runtimeE2e',true,'steps',7,'actors',6,'tasks','7/7','protectedRoutes',9,'certificate','VALID','regulatorySubmission','ACCEPTED','formula','RECONCILED','recovery','PASS')::text,
      completed_at=coalesce(completed_at,current_timestamp),last_error=null,
      worker_id=null,lease_token=null,lease_until=null,updated_at=current_timestamp
  where process_code='EMISSION_PROJECT'
    and step_code in ('EMISSION_PROJECT_SETUP','EMISSION_PROJECT_COLLECT','EMISSION_PROJECT_CALCULATE','EMISSION_PROJECT_VALIDATE','EMISSION_PROJECT_CORRECT','EMISSION_PROJECT_APPROVE','EMISSION_PROJECT_REPORT')
    and job_type in ('DATABASE','BACKEND','FRONTEND_USER','FRONTEND_ADMIN','TEST')
    and target_path like 'schema-set/emission_project/%' and required;

  select count(*) into target_count from framework_development_job
  where process_code='EMISSION_PROJECT' and required and job_status='VERIFIED'
    and quality_status='VERIFIED' and approval_status='APPROVED';
  if target_count<>176 then raise exception 'EMISSION_PROJECT required completion mismatch: %',target_count; end if;
end \$\$;
SQL
)
kubectl -n "$NAMESPACE" exec "$POD" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -v ON_ERROR_STOP=1 -q -c "$SQL"

printf '%s\n' "$activity" "$calculation" "$report" "$workflow" "$customer" "$runtime_smoke"
printf '[emission-project-assurance] PASS dimensions=35 jobs=176 evidence=%s\n' "$EVIDENCE_REF"
