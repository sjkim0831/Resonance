#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PROCESS=ACCOUNT_LOCK_RECOVERY
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
DEPLOY_MARKER="${CARBONET_DEPLOY_SUCCESS_MARKER:-/opt/resonance-data/deploy/carbonet-main-success.commit}"
RUNTIME_RELEASE_KEY="${CARBONET_RUNTIME_RELEASE_KEY:-CARBONET_RUNTIME}"

# A provider is configured only when its value is a nonempty HTTP(S) URL with
# a concrete host. This narrow mode lets the static contract test exercise the
# exact production validator without touching Kubernetes or PostgreSQL.
valid_delivery_url() {
  [[ "$1" =~ ^https?://([A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?|\[[0-9A-Fa-f:.]+\])(:[0-9]{1,5})?(/[^[:space:]]*)?$ ]]
}
if [[ "${ACCOUNT_RECOVERY_ASSURANCE_VALIDATE_URL_ONLY:-false}" == true ]]; then
  valid_delivery_url "${ACCOUNT_RECOVERY_DELIVERY_URL:-}"
  exit $?
fi

source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init

validation_commit="$(git -C "$ROOT" rev-parse HEAD)"
marker_commit="$(tr -d '[:space:]' <"$DEPLOY_MARKER" 2>/dev/null || true)"
[[ "$marker_commit" =~ ^[0-9a-f]{40}$ ]] || marker_commit=0000000000000000000000000000000000000000

# The executable gate itself and every runtime-bearing account recovery source
# must come from HEAD. Generated metadata outside these paths does not block it.
source_checkout_current=true
for relative_path in \
  ops/scripts/audit-account-lock-recovery-assurance.sh \
  ops/scripts/complete-account-lock-recovery-assurance.sh; do
  if ! git -C "$ROOT" cat-file -e "HEAD:$relative_path" 2>/dev/null \
    || ! cmp -s <(git -C "$ROOT" show "HEAD:$relative_path") "$ROOT/$relative_path"; then
    source_checkout_current=false
  fi
done
relevant_paths=(
  apps/carbonet-api/src/main/resources/db/migration/postgresql
  modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/auth
  projects/carbonet-frontend/source/src/features/public-entry/PublicEntryPages.tsx
  ops/scripts/audit-account-lock-recovery-assurance.sh
  ops/scripts/complete-account-lock-recovery-assurance.sh
)
if ! git -C "$ROOT" diff --quiet HEAD -- "${relevant_paths[@]}" \
  || [[ -n "$(git -C "$ROOT" status --porcelain --untracked-files=all -- "${relevant_paths[@]}")" ]]; then
  source_checkout_current=false
fi

# Inspect booleans only. Provider locations and tokens are never printed. A
# property-name substring or an empty value is not a configured provider.
delivery_provider_configured=false
delivery_url="$(kubectl -n "$NAMESPACE" exec deploy/carbonet-runtime -c carbonet-runtime -- \
  sh -c 'printf %s "${ACCOUNT_RECOVERY_DELIVERY_URL:-}"' 2>/dev/null || true)"
if valid_delivery_url "$delivery_url"; then
  delivery_provider_configured=true
fi

if [[ "$delivery_provider_configured" == false ]]; then
  jvm_options="$(kubectl -n "$NAMESPACE" exec deploy/carbonet-runtime -c carbonet-runtime -- \
    sh -c 'printf "%s %s" "${JAVA_TOOL_OPTIONS:-}" "${JAVA_OPTS:-}"' 2>/dev/null || true)"
  if [[ "$jvm_options" =~ (^|[[:space:]])-Daccount\.recovery\.delivery\.url=([^[:space:]]+) ]] \
    && valid_delivery_url "${BASH_REMATCH[2]}"; then
    delivery_provider_configured=true
  fi
fi

if [[ "$delivery_provider_configured" == false ]]; then
  spring_application_json="$(kubectl -n "$NAMESPACE" exec deploy/carbonet-runtime -c carbonet-runtime -- \
    sh -c 'printf %s "${SPRING_APPLICATION_JSON:-}"' 2>/dev/null || true)"
  spring_delivery_url="$(jq -er '
    .account.recovery.delivery.url
      // .accountRecovery.delivery.url
      // .["account.recovery.delivery.url"]
      // empty
    | select(type=="string")
  ' <<<"$spring_application_json" 2>/dev/null || true)"
  if valid_delivery_url "$spring_delivery_url"; then
    delivery_provider_configured=true
  fi
fi
unset delivery_url jvm_options spring_application_json spring_delivery_url

development_code_enabled=false
if kubectl -n "$NAMESPACE" exec deploy/carbonet-runtime -c carbonet-runtime -- sh -c '
  case "${ACCOUNT_RECOVERY_DEVELOPMENT_CODE_ENABLED:-false}" in
    true|TRUE|1|yes|YES|on|ON) exit 0 ;;
  esac
  case "${JAVA_TOOL_OPTIONS:-} ${JAVA_OPTS:-}" in
    *account.recovery.development-code-enabled=true*|*account.recovery.development-code-enabled=1*) exit 0 ;;
  esac
  case "${SPRING_APPLICATION_JSON:-}" in
    *development-code-enabled*true*|*developmentCodeEnabled*true*) exit 0 ;;
    *) exit 1 ;;
  esac
' >/dev/null 2>&1; then
  development_code_enabled=true
fi

deployment_json="$(kubectl -n "$NAMESPACE" get deployment carbonet-runtime -o json)"
pods_json="$(kubectl -n "$NAMESPACE" get pods -l app=carbonet-runtime -o json)"

db_report="$(carbonet_postgres_query "WITH
process_summary AS (
  SELECT count(*) AS definition_count,
         count(*) FILTER (WHERE process_version='3.0.0') AS version_count,
         max(process_version) AS process_version,
         max(process_status) AS process_status,
         coalesce(bool_and(definition_locked),false) AS definition_locked
  FROM framework_process_definition WHERE process_code='$PROCESS'
), runtime_summary AS (
  SELECT source_commit,deployment_namespace,deployment_name,deployment_uid,
         deployment_generation,observed_generation,desired_replicas,image_ref,image_id,health_status
  FROM framework_runtime_release_state WHERE release_key='$RUNTIME_RELEASE_KEY'
), step_summary AS (
  SELECT count(*) AS total,
         count(*) FILTER (WHERE actor_code='MEMBER_USER' AND requires_user_page
           AND NOT requires_admin_page AND admin_path IS NULL
           AND user_path=CASE step_code
             WHEN 'ACCOUNT_LOCK_RECOVERY_S1' THEN '/signin/findPassword'
             WHEN 'ACCOUNT_LOCK_RECOVERY_S2' THEN '/signin/findPassword'
             WHEN 'ACCOUNT_LOCK_RECOVERY_S3' THEN '/signin/findPassword'
             WHEN 'ACCOUNT_LOCK_RECOVERY_S4' THEN '/signin/findPassword/result'
           END
           AND command_code=CASE step_code
             WHEN 'ACCOUNT_LOCK_RECOVERY_S1' THEN 'REQUEST_RECOVERY'
             WHEN 'ACCOUNT_LOCK_RECOVERY_S2' THEN 'VERIFY_RECOVERY_CHALLENGE'
             WHEN 'ACCOUNT_LOCK_RECOVERY_S3' THEN 'COMPLETE_ACCOUNT_RECOVERY'
             WHEN 'ACCOUNT_LOCK_RECOVERY_S4' THEN 'NAVIGATE_TO_LOGIN'
           END) AS aligned
  FROM framework_process_step WHERE process_code='$PROCESS'
), contract_summary AS (
  SELECT count(*) AS total,
         count(*) FILTER (WHERE c.contract_status='VERIFIED'
           AND c.menu_verified AND c.api_verified AND c.database_verified AND c.authority_verified
           AND c.responsive_verified AND c.accessibility_verified AND c.exception_states_verified
           AND EXISTS (
             SELECT 1 FROM framework_current_business_e2e_evidence e
             WHERE e.process_code=c.process_code AND e.step_code=c.step_code
               AND e.business_test_result='PASSED' AND e.current_version
               AND e.source_commit=(SELECT source_commit FROM runtime_summary)
               AND e.evidence_process_version=(SELECT process_version FROM process_summary)
               AND c.audit_evidence_ref='qa-run:sha256:'||e.evidence_hash
           )) AS implementation_ready
  FROM framework_professional_screen_contract c
  WHERE c.process_code='$PROCESS' AND c.audience='USER'
    AND c.route_path=CASE c.step_code
      WHEN 'ACCOUNT_LOCK_RECOVERY_S1' THEN '/signin/findPassword'
      WHEN 'ACCOUNT_LOCK_RECOVERY_S2' THEN '/signin/findPassword'
      WHEN 'ACCOUNT_LOCK_RECOVERY_S3' THEN '/signin/findPassword'
      WHEN 'ACCOUNT_LOCK_RECOVERY_S4' THEN '/signin/findPassword/result'
    END
), job_summary AS (
  SELECT count(*) AS total,
         count(*) FILTER (WHERE job_status IN ('COMPLETED','VERIFIED')
           AND approval_status='APPROVED' AND quality_status IN ('PASSED','VERIFIED')
           AND specification_json::jsonb->>'contractVersion'=
             '$PROCESS:'||(SELECT process_version FROM process_summary)
           AND evidence_ref LIKE 'qa-run:'||j.process_code||':'||
             (SELECT process_version FROM process_summary)||':'||
             (SELECT source_commit FROM runtime_summary)||':sha256:%'
           AND array_length(string_to_array(evidence_ref,':'),1)=6
           AND split_part(evidence_ref,':',5)='sha256'
           AND length(split_part(evidence_ref,':',6))=64
           AND translate(split_part(evidence_ref,':',6),'0123456789abcdef','')=''
           AND EXISTS (SELECT 1 FROM framework_current_business_e2e_evidence e
                       WHERE e.process_code=j.process_code AND e.step_code=j.step_code
                         AND e.business_test_result='PASSED' AND e.current_version
                         AND e.source_commit=(SELECT source_commit FROM runtime_summary)
                         AND e.evidence_process_version=(SELECT process_version FROM process_summary)
                         AND length(e.evidence_hash)=64
                         AND translate(e.evidence_hash,'0123456789abcdef','')=''
                         AND j.evidence_ref='qa-run:'||j.process_code||':'||
                           e.evidence_process_version||':'||e.source_commit||':sha256:'||e.evidence_hash)
           AND EXISTS (SELECT 1 FROM framework_development_job_gate_result g
                       WHERE g.job_id=j.job_id AND g.result='PASSED'
                         AND g.evidence_ref=j.evidence_ref
                         AND g.evidence_ref LIKE 'qa-run:'||j.process_code||':'||
                           (SELECT process_version FROM process_summary)||':'||
                           (SELECT source_commit FROM runtime_summary)||':sha256:%'
                         AND array_length(string_to_array(g.evidence_ref,':'),1)=6
                         AND split_part(g.evidence_ref,':',5)='sha256'
                         AND length(split_part(g.evidence_ref,':',6))=64
                         AND translate(split_part(g.evidence_ref,':',6),'0123456789abcdef','')='')) AS promotable,
         count(*) FILTER (WHERE job_status='VERIFIED' AND approval_status='APPROVED'
           AND quality_status='VERIFIED'
           AND evidence_ref LIKE 'qa-run:'||j.process_code||':'||
             (SELECT process_version FROM process_summary)||':'||
             (SELECT source_commit FROM runtime_summary)||':sha256:%'
           AND EXISTS (SELECT 1 FROM framework_current_business_e2e_evidence e
                       WHERE e.process_code=j.process_code AND e.step_code=j.step_code
                         AND e.business_test_result='PASSED' AND e.current_version
                         AND e.source_commit=(SELECT source_commit FROM runtime_summary)
                         AND e.evidence_process_version=(SELECT process_version FROM process_summary)
                         AND j.evidence_ref='qa-run:'||j.process_code||':'||
                           e.evidence_process_version||':'||e.source_commit||':sha256:'||e.evidence_hash)
           AND EXISTS (SELECT 1 FROM framework_development_job_gate_result g
                       WHERE g.job_id=j.job_id AND g.result='PASSED'
                         AND g.evidence_ref=j.evidence_ref
                         AND g.evidence_ref LIKE 'qa-run:'||j.process_code||':'||
                           (SELECT process_version FROM process_summary)||':'||
                           (SELECT source_commit FROM runtime_summary)||':sha256:%')) AS verified
  FROM framework_development_job j WHERE process_code='$PROCESS' AND required
), artifact_summary AS (
  SELECT count(*) FILTER (WHERE required) AS total,
         count(*) FILTER (WHERE required AND artifact_type='PAGE'
           AND owner_actor_code='MEMBER_USER'
           AND target_path=CASE step_code
             WHEN 'ACCOUNT_LOCK_RECOVERY_S1' THEN '/signin/findPassword'
             WHEN 'ACCOUNT_LOCK_RECOVERY_S2' THEN '/signin/findPassword'
             WHEN 'ACCOUNT_LOCK_RECOVERY_S3' THEN '/signin/findPassword'
             WHEN 'ACCOUNT_LOCK_RECOVERY_S4' THEN '/signin/findPassword/result' END
           AND contract_ref='process://ACCOUNT_LOCK_RECOVERY/'||
             (SELECT process_version FROM process_summary)||'/'||step_code) AS aligned,
         count(*) FILTER (WHERE required AND artifact_type='PAGE'
           AND owner_actor_code='MEMBER_USER'
           AND target_path=CASE step_code
             WHEN 'ACCOUNT_LOCK_RECOVERY_S1' THEN '/signin/findPassword'
             WHEN 'ACCOUNT_LOCK_RECOVERY_S2' THEN '/signin/findPassword'
             WHEN 'ACCOUNT_LOCK_RECOVERY_S3' THEN '/signin/findPassword'
             WHEN 'ACCOUNT_LOCK_RECOVERY_S4' THEN '/signin/findPassword/result' END
           AND contract_ref='process://ACCOUNT_LOCK_RECOVERY/'||
             (SELECT process_version FROM process_summary)||'/'||step_code
           AND delivery_status IN ('COMPLETED','VERIFIED')
           AND evidence_ref LIKE 'qa-run:'||process_code||':'||
             (SELECT process_version FROM process_summary)||':'||
             (SELECT source_commit FROM runtime_summary)||':sha256:%'
           AND array_length(string_to_array(evidence_ref,':'),1)=6
           AND split_part(evidence_ref,':',5)='sha256'
           AND length(split_part(evidence_ref,':',6))=64
           AND translate(split_part(evidence_ref,':',6),'0123456789abcdef','')=''
           AND EXISTS (SELECT 1 FROM framework_current_business_e2e_evidence e
                       WHERE e.process_code=framework_process_artifact.process_code
                         AND e.step_code=framework_process_artifact.step_code
                         AND e.business_test_result='PASSED' AND e.current_version
                         AND e.source_commit=(SELECT source_commit FROM runtime_summary)
                         AND e.evidence_process_version=(SELECT process_version FROM process_summary)
                         AND length(e.evidence_hash)=64
                         AND translate(e.evidence_hash,'0123456789abcdef','')=''
                         AND framework_process_artifact.evidence_ref='qa-run:'||
                           framework_process_artifact.process_code||':'||e.evidence_process_version||':'||
                           e.source_commit||':sha256:'||e.evidence_hash)) AS promotable,
         count(*) FILTER (WHERE required AND artifact_type='PAGE'
           AND owner_actor_code='MEMBER_USER'
           AND target_path=CASE step_code
             WHEN 'ACCOUNT_LOCK_RECOVERY_S1' THEN '/signin/findPassword'
             WHEN 'ACCOUNT_LOCK_RECOVERY_S2' THEN '/signin/findPassword'
             WHEN 'ACCOUNT_LOCK_RECOVERY_S3' THEN '/signin/findPassword'
             WHEN 'ACCOUNT_LOCK_RECOVERY_S4' THEN '/signin/findPassword/result' END
           AND contract_ref='process://ACCOUNT_LOCK_RECOVERY/'||
             (SELECT process_version FROM process_summary)||'/'||step_code
           AND delivery_status='VERIFIED'
           AND evidence_ref LIKE 'qa-run:'||process_code||':'||
             (SELECT process_version FROM process_summary)||':'||
             (SELECT source_commit FROM runtime_summary)||':sha256:%'
           AND array_length(string_to_array(evidence_ref,':'),1)=6
           AND split_part(evidence_ref,':',5)='sha256'
           AND length(split_part(evidence_ref,':',6))=64
           AND translate(split_part(evidence_ref,':',6),'0123456789abcdef','')=''
           AND EXISTS (SELECT 1 FROM framework_current_business_e2e_evidence e
                       WHERE e.process_code=framework_process_artifact.process_code
                         AND e.step_code=framework_process_artifact.step_code
                         AND e.business_test_result='PASSED' AND e.current_version
                         AND e.source_commit=(SELECT source_commit FROM runtime_summary)
                         AND e.evidence_process_version=(SELECT process_version FROM process_summary)
                         AND length(e.evidence_hash)=64
                         AND translate(e.evidence_hash,'0123456789abcdef','')=''
                         AND framework_process_artifact.evidence_ref='qa-run:'||
                           framework_process_artifact.process_code||':'||e.evidence_process_version||':'||
                           e.source_commit||':sha256:'||e.evidence_hash)) AS verified
  FROM framework_process_artifact WHERE process_code='$PROCESS'
), e2e_summary AS (
  SELECT count(DISTINCT step_code) FILTER (WHERE business_test_result='PASSED'
    AND current_version AND source_commit=(SELECT source_commit FROM runtime_summary)
    AND evidence_process_version=(SELECT process_version FROM process_summary)
    AND coalesce(evidence_hash,'')<>'') AS passed_steps
  FROM framework_current_business_e2e_evidence WHERE process_code='$PROCESS'
), test_summary AS (
  SELECT count(*) FILTER (WHERE case_status='APPROVED') AS approved_cases,
         count(*) FILTER (WHERE case_status='APPROVED' AND automated
           AND EXISTS (SELECT 1 FROM framework_simulation_run r
                       WHERE r.case_code=c.case_code AND r.result='PASSED'
                         AND r.source_commit=(SELECT source_commit FROM runtime_summary)
                         AND r.process_version=(SELECT process_version FROM process_summary)
                         AND coalesce(r.evidence_hash,'')<>'')) AS passed_cases,
         count(DISTINCT case_type) FILTER (WHERE case_status='APPROVED') AS approved_types,
         count(DISTINCT case_type) FILTER (WHERE case_status='APPROVED' AND automated
           AND EXISTS (SELECT 1 FROM framework_simulation_run r
                       WHERE r.case_code=c.case_code AND r.result='PASSED'
                         AND r.source_commit=(SELECT source_commit FROM runtime_summary)
                         AND r.process_version=(SELECT process_version FROM process_summary)
                         AND coalesce(r.evidence_hash,'')<>'')) AS passed_types
  FROM framework_simulation_case c WHERE process_code='$PROCESS'
)
SELECT jsonb_build_object(
  'runtime',(SELECT to_jsonb(r) FROM runtime_summary r),
  'process',jsonb_build_object(
    'definitionCount',p.definition_count,
    'versionCount',p.version_count,
    'processVersion',p.process_version,
    'processStatus',p.process_status,
    'definitionLocked',p.definition_locked),
  'steps',jsonb_build_object('total',s.total,'aligned',s.aligned),
  'contracts',jsonb_build_object('total',c.total,'implementationReady',c.implementation_ready),
  'jobs',jsonb_build_object('total',j.total,'promotable',j.promotable,'verified',j.verified),
  'artifacts',jsonb_build_object('total',a.total,'aligned',a.aligned,
    'promotable',a.promotable,'verified',a.verified),
  'businessE2e',jsonb_build_object('passedSteps',e.passed_steps,'requiredSteps',4),
  'tests',jsonb_build_object('approvedCases',t.approved_cases,'passedCases',t.passed_cases,
    'approvedTypes',t.approved_types,'passedTypes',t.passed_types,'minimumCases',8,'minimumTypes',5)
)
FROM process_summary p CROSS JOIN step_summary s CROSS JOIN contract_summary c CROSS JOIN job_summary j
CROSS JOIN artifact_summary a CROSS JOIN e2e_summary e CROSS JOIN test_summary t;")"

runtime_commit="$(jq -r '.runtime.source_commit // ""' <<<"$db_report")"
runtime_gap_safe=false
if [[ "$runtime_commit" =~ ^[0-9a-f]{40}$ ]] \
  && git -C "$ROOT" merge-base --is-ancestor "$runtime_commit" "$validation_commit"; then
  if [[ "$runtime_commit" == "$validation_commit" ]]; then
    runtime_gap_safe=true
  else
    eval "$(bash "$ROOT/ops/scripts/plan-incremental-work.sh" "$runtime_commit" "$validation_commit" --format env)"
    if [[ "$PLAN_RUNTIME_REQUIRED" == false && "$PLAN_FRONTEND_REQUIRED" == false \
      && "$PLAN_BACKEND_REQUIRED" == false && "$PLAN_DATABASE_REQUIRED" == false ]]; then
      runtime_gap_safe=true
    fi
  fi
fi

runtime_identity_current="$(jq -nr \
  --argjson deployment "$deployment_json" \
  --argjson pods "$pods_json" \
  --argjson runtime "$(jq '.runtime // {}' <<<"$db_report")" '
  ((($deployment.metadata.annotations["resonance.ai/target-commit"] // "") == ($runtime.source_commit // ""))
  and (($deployment.metadata.namespace // "") == ($runtime.deployment_namespace // ""))
  and (($deployment.metadata.name // "") == ($runtime.deployment_name // ""))
  and (($deployment.metadata.uid // "") == ($runtime.deployment_uid // ""))
  and (($deployment.metadata.generation // 0) == ($runtime.deployment_generation // -1))
  and (($deployment.status.observedGeneration // 0) == ($runtime.observed_generation // -1))
  and (($deployment.spec.replicas // 0) == ($runtime.desired_replicas // -1))
  and (($deployment.status.updatedReplicas // 0) == ($runtime.desired_replicas // -1))
  and (($deployment.status.readyReplicas // 0) == ($runtime.desired_replicas // -1))
  and (($deployment.status.availableReplicas // 0) == ($runtime.desired_replicas // -1))
  and (([$deployment.spec.template.spec.containers[] | select(.name=="carbonet-runtime") | .image] | first // "") == ($runtime.image_ref // ""))
  and (($pods.items | length) == ($runtime.desired_replicas // -1))
  and ([$pods.items[] | .status.containerStatuses[]? | select(.name=="carbonet-runtime")]
       | length == ($runtime.desired_replicas // -1))
  and (all($pods.items[] | .status.containerStatuses[]? | select(.name=="carbonet-runtime");
       .ready==true and .imageID==($runtime.image_id // "")))
  and (($runtime.health_status // "") == "UP"))
')"

deployed_current=false
if [[ "$source_checkout_current" == true && "$marker_commit" == "$validation_commit" \
  && "$runtime_gap_safe" == true && "$runtime_identity_current" == true ]]; then
  deployed_current=true
fi

report="$(jq -cn \
  --arg processCode "$PROCESS" \
  --arg validationCommit "$validation_commit" \
  --arg deployedCommit "$runtime_commit" \
  --arg markerCommit "$marker_commit" \
  --argjson deployedCurrent "$deployed_current" \
  --argjson sourceCheckoutCurrent "$source_checkout_current" \
  --argjson runtimeIdentityCurrent "$runtime_identity_current" \
  --argjson developmentCodeEnabled "$development_code_enabled" \
  --argjson deliveryProviderConfigured "$delivery_provider_configured" \
  --argjson db "$db_report" '
  {
    processCode:$processCode,
    validationCommit:$validationCommit,
    deployedCommit:$deployedCommit,
    markerCommit:$markerCommit,
    deployedCurrent:$deployedCurrent,
    sourceCheckoutCurrent:$sourceCheckoutCurrent,
    runtimeIdentityCurrent:$runtimeIdentityCurrent,
    partialEvidence:($db|del(.runtime)),
    externalBlockers:([
      (if $developmentCodeEnabled then {code:"DEVELOPMENT_CODE_ENABLED",scope:"SECURITY",message:"Development recovery codes are enabled."} else empty end),
      (if $deliveryProviderConfigured then empty else {code:"OTP_DELIVERY_PROVIDER_UNCONFIGURED",scope:"EXTERNAL_INTEGRATION",message:"Production OTP delivery provider is not configured."} end)
    ])
  }
  | .internalGaps = ([
      (if .sourceCheckoutCurrent then empty else {code:"DIRTY_OR_UNTRACKED_ASSURANCE_SOURCE"} end),
      (if .runtimeIdentityCurrent then empty else {code:"RUNTIME_RELEASE_IDENTITY_MISMATCH"} end),
      (if .deployedCurrent then empty else {code:"STALE_OR_UNDEPLOYED_SOURCE",actual:.validationCommit,expected:.deployedCommit,marker:.markerCommit} end),
      (if .partialEvidence.process.definitionCount==1
          and .partialEvidence.process.versionCount==1
          and .partialEvidence.process.processVersion=="3.0.0"
          and .partialEvidence.process.definitionLocked==true
          and (.partialEvidence.process.processStatus=="IN_DEVELOPMENT"
            or .partialEvidence.process.processStatus=="ACTIVE")
        then empty
        else {code:"PROCESS_ASSURANCE_STATUS_INVALID",actual:.partialEvidence.process,
          expected:{definitionCount:1,versionCount:1,processVersion:"3.0.0",
            definitionLocked:true,processStatus:["IN_DEVELOPMENT","ACTIVE"]}}
        end),
      (if .partialEvidence.steps.total==4 and .partialEvidence.steps.aligned==4 then empty else {code:"SELF_SERVICE_STEP_CONTRACT_INCOMPLETE",actual:.partialEvidence.steps.aligned,expected:4} end),
      (if .partialEvidence.contracts.total==4 and .partialEvidence.contracts.implementationReady==4 then empty else {code:"SCREEN_IMPLEMENTATION_EVIDENCE_INCOMPLETE",actual:.partialEvidence.contracts.implementationReady,expected:4,total:.partialEvidence.contracts.total} end),
      (if .partialEvidence.businessE2e.passedSteps==4 then empty else {code:"FOUR_STEP_BUSINESS_E2E_INCOMPLETE",actual:.partialEvidence.businessE2e.passedSteps,expected:4} end),
      (if .partialEvidence.tests.approvedCases>=8 and .partialEvidence.tests.passedCases==.partialEvidence.tests.approvedCases then empty else {code:"APPROVED_TEST_CASES_INCOMPLETE",actual:.partialEvidence.tests.passedCases,expected:.partialEvidence.tests.approvedCases,minimum:8} end),
      (if .partialEvidence.tests.approvedTypes>=5 and .partialEvidence.tests.passedTypes==.partialEvidence.tests.approvedTypes then empty else {code:"APPROVED_TEST_TYPES_INCOMPLETE",actual:.partialEvidence.tests.passedTypes,expected:.partialEvidence.tests.approvedTypes,minimum:5} end),
      (if .partialEvidence.jobs.total==43
          and (if .partialEvidence.process.processStatus=="ACTIVE"
            then .partialEvidence.jobs.verified==43
            else .partialEvidence.jobs.promotable==43 end)
        then empty
        else {code:"JOB_GATE_EVIDENCE_INCOMPLETE",
          actual:(if .partialEvidence.process.processStatus=="ACTIVE" then .partialEvidence.jobs.verified else .partialEvidence.jobs.promotable end),
          expected:43,total:.partialEvidence.jobs.total,processStatus:.partialEvidence.process.processStatus}
        end),
      (if .partialEvidence.artifacts.total==4 and .partialEvidence.artifacts.aligned==4
          and (if .partialEvidence.process.processStatus=="ACTIVE"
            then .partialEvidence.artifacts.verified==4
            else .partialEvidence.artifacts.promotable==4 end)
        then empty
        else {code:"ARTIFACT_EVIDENCE_INCOMPLETE",
          actual:(if .partialEvidence.process.processStatus=="ACTIVE" then .partialEvidence.artifacts.verified else .partialEvidence.artifacts.promotable end),
          aligned:.partialEvidence.artifacts.aligned,expected:4,total:.partialEvidence.artifacts.total,
          processStatus:.partialEvidence.process.processStatus}
        end)
    ])
  | .assuranceReady = (.deployedCurrent and (.externalBlockers|length)==0 and (.internalGaps|length)==0)
')"

jq . <<<"$report"
[[ "$(jq -r '.assuranceReady' <<<"$report")" == true ]]
