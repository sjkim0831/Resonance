#!/usr/bin/env bash
set -euo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

usage() {
  echo "usage: $0 PROCESS_CODE STEP_CODE REQUIRED_CHECKS [USER|ADMIN|PUBLIC|ALL] [--validate-only]" >&2
  exit 2
}

[[ $# -ge 3 ]] || usage
PROCESS_CODE="$1"
STEP_CODE="$2"
REQUIRED_CHECKS="$3"
AUDIENCE="USER"
MODE=""
if [[ "${4:-}" == "--validate-only" ]]; then MODE="$4";
elif [[ -n "${4:-}" ]]; then AUDIENCE="$4"; MODE="${5:-}"; fi
[[ "$PROCESS_CODE" =~ ^[A-Z0-9_]+$ ]] || { echo "invalid process code" >&2; exit 2; }
[[ "$STEP_CODE" =~ ^[A-Z0-9_]+$ ]] || { echo "invalid step code" >&2; exit 2; }
[[ "$REQUIRED_CHECKS" =~ ^[A-Za-z0-9_,=]+$ ]] || { echo "invalid required checks" >&2; exit 2; }
[[ "$AUDIENCE" =~ ^(USER|ADMIN|PUBLIC|ALL)$ ]] || usage
[[ -z "$MODE" || "$MODE" == "--validate-only" ]] || usage

EVIDENCE="$(cat)"
node -e '
const evidence=JSON.parse(process.argv[1]);
const checks=process.argv[2].split(",").filter(Boolean);
const mode=process.argv[3]||"";
if(mode!=="--validate-only") {
  const mandatoryChecks=["api","database","authority","responsive","accessibility","exceptionStates","audit","recovery"];
  for(const check of mandatoryChecks) {
    if(Number(evidence[check])!==1) {
      throw new Error(`mandatory same-envelope E2E assertion failed: ${check}=1`);
    }
  }
  if(!Number.isFinite(Number(evidence.performanceP95Ms))||Number(evidence.performanceP95Ms)<=0) {
    throw new Error("mandatory same-envelope E2E assertion failed: performanceP95Ms>0");
  }
  if(!Number.isInteger(Number(evidence.performanceSampleCount))||Number(evidence.performanceSampleCount)<20) {
    throw new Error("mandatory same-envelope E2E assertion failed: performanceSampleCount>=20");
  }
}
if(!["PASS","PASSED"].includes(evidence.status)) throw new Error("E2E status must be PASS or PASSED");
for(const assertion of checks){
  const [check,rawExpected="1"]=assertion.split("=");
  const expected=Number(rawExpected);
  if(!Number.isFinite(expected)||Number(evidence[check])!==expected){
    throw new Error(`required E2E assertion failed: ${check}=${rawExpected}`);
  }
}
' "$EVIDENCE" "$REQUIRED_CHECKS" "$MODE"

EVIDENCE_SHA256="$(printf '%s' "$EVIDENCE" | sha256sum | awk '{print $1}')"
if [[ "$MODE" == "--validate-only" ]]; then
  printf '{"status":"VALID","sha256":"%s"}\n' "$EVIDENCE_SHA256"
  exit 0
fi

EVIDENCE_B64="$(printf '%s' "$EVIDENCE" | base64 -w0)"
CONTRACT="$(jq -cer --arg process "$PROCESS_CODE" --arg step "$STEP_CODE" '
  if (.contract.processCode==$process and .contract.stepCode==$step) then .contract
  else ([.contracts[]? | select(.processCode==$process and .stepCode==$step)] | if length==1 then .[0] else error("matching pre-run contract envelope is required") end)
  end
' <<<"$EVIDENCE")" || { echo 'matching pre-run contract envelope is required' >&2; exit 3; }
SOURCE_COMMIT="$(jq -r '.sourceCommit' <<<"$CONTRACT")"
PROCESS_VERSION="$(jq -r '.processVersion' <<<"$CONTRACT")"
CONTRACT_FINGERPRINT="$(jq -r '.contractFingerprint' <<<"$CONTRACT")"
[[ "$SOURCE_COMMIT" =~ ^[0-9a-fA-F]{7,80}$ && "$CONTRACT_FINGERPRINT" =~ ^[0-9a-f]{32,128}$ && -n "$PROCESS_VERSION" ]] || { echo 'invalid pre-run contract envelope' >&2; exit 3; }
DEPLOY_STATE_FILE="${CARBONET_DEPLOY_STATE_FILE:-/opt/resonance-data/deploy/carbonet-main-success.commit}"
FILE_DEPLOYED_COMMIT="$(tr -d '[:space:]' < "$DEPLOY_STATE_FILE" 2>/dev/null || true)"
if [[ -n "${E2E_DEPLOYED_COMMIT:-}" && "$E2E_DEPLOYED_COMMIT" != "$FILE_DEPLOYED_COMMIT" ]]; then
  echo 'E2E commit override differs from deployed success marker' >&2
  exit 3
fi
CURRENT_DEPLOYED_COMMIT="$FILE_DEPLOYED_COMMIT"
[[ "$SOURCE_COMMIT" == "$CURRENT_DEPLOYED_COMMIT" ]] || { echo 'deployed commit changed during E2E; refusing stale evidence' >&2; exit 3; }
EXECUTION_ENVIRONMENT="${E2E_EXECUTION_ENVIRONMENT:-carbonet-prod}"
EVIDENCE_URI="${E2E_EVIDENCE_URI:-inline://business-e2e/sha256/$EVIDENCE_SHA256}"
K8S_NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
PATRONI_POD="${PATRONI_POD:-$(K8S_NAMESPACE="$K8S_NAMESPACE" bash "$ROOT/ops/scripts/resolve-patroni-primary-pod.sh")}"

kubectl -n "$K8S_NAMESPACE" exec -i "$PATRONI_POD" -c patroni -- \
  psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d carbonet -X -q \
    -o /dev/null \
    -v process_code="$PROCESS_CODE" -v step_code="$STEP_CODE" \
    -v audience="$AUDIENCE" -v evidence_b64="$EVIDENCE_B64" -v evidence_sha256="$EVIDENCE_SHA256" \
    -v source_commit="$SOURCE_COMMIT" -v process_version="$PROCESS_VERSION" -v contract_fingerprint="$CONTRACT_FINGERPRINT" \
    -v execution_environment="$EXECUTION_ENVIRONMENT" -v evidence_uri="$EVIDENCE_URI" <<'SQL'
BEGIN;

SELECT set_config('resonance.process_code',:'process_code',true);
SELECT set_config('resonance.step_code',:'step_code',true);
SELECT set_config('resonance.audience',:'audience',true);
SELECT set_config('resonance.evidence_sha256',:'evidence_sha256',true);
SELECT set_config('resonance.source_commit',:'source_commit',true);

INSERT INTO framework_process_qa_run(
  process_code,step_code,result,failure_reason,evidence_json,executed_by,executed_at,
  evidence_type,process_version,source_commit,contract_fingerprint,
  execution_environment,evidence_uri,evidence_hash
)
SELECT :'process_code', :'step_code', 'PASSED', NULL,
  convert_from(decode(:'evidence_b64','base64'),'UTF8')::jsonb ||
    jsonb_build_object('sha256',:'evidence_sha256','promotionMode','FAIL_CLOSED'),
  'CONTRACT_E2E_PROMOTER', current_timestamp,'BUSINESS_E2E',definition.process_version,
  :'source_commit',fingerprint.contract_fingerprint,:'execution_environment',:'evidence_uri',:'evidence_sha256'
FROM framework_process_definition definition
CROSS JOIN LATERAL (
  SELECT framework_current_process_step_contract_fingerprint(:'process_code',:'step_code') contract_fingerprint
) fingerprint
WHERE definition.process_code=:'process_code'
  AND definition.process_version=:'process_version'
  AND fingerprint.contract_fingerprint=:'contract_fingerprint'
  AND fingerprint.contract_fingerprint IS NOT NULL
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM framework_current_business_e2e_evidence
    WHERE process_code=current_setting('resonance.process_code')
      AND step_code=current_setting('resonance.step_code')
      AND business_test_result='PASSED'
      AND source_commit=current_setting('resonance.source_commit')
      AND evidence_hash=current_setting('resonance.evidence_sha256')
  ) THEN
    RAISE EXCEPTION 'current-version business E2E evidence was not recorded process=% step=%',
      current_setting('resonance.process_code'),current_setting('resonance.step_code');
  END IF;
END $$;

UPDATE framework_professional_screen_contract contract
SET api_verified=coalesce((convert_from(decode(:'evidence_b64','base64'),'UTF8')::jsonb->>'api')::integer,0)=1,
    database_verified=coalesce((convert_from(decode(:'evidence_b64','base64'),'UTF8')::jsonb->>'database')::integer,0)=1,
    authority_verified=coalesce((convert_from(decode(:'evidence_b64','base64'),'UTF8')::jsonb->>'authority')::integer,0)=1,
    responsive_verified=coalesce((convert_from(decode(:'evidence_b64','base64'),'UTF8')::jsonb->>'responsive')::integer,0)=1,
    accessibility_verified=coalesce((convert_from(decode(:'evidence_b64','base64'),'UTF8')::jsonb->>'accessibility')::integer,0)=1,
    exception_states_verified=coalesce((convert_from(decode(:'evidence_b64','base64'),'UTF8')::jsonb->>'exceptionStates')::integer,0)=1,
    audit_evidence_ref=concat('qa-run:sha256:',:'evidence_sha256'),
    contract_status='VERIFIED',
    updated_by='CONTRACT_E2E_PROMOTER',
    updated_at=current_timestamp
WHERE contract.process_code=:'process_code'
  AND contract.step_code=:'step_code'
  AND (:'audience'='ALL' OR contract.audience=:'audience')
  AND EXISTS (
    SELECT 1
    FROM framework_step_execution_spec spec
    WHERE spec.process_code=contract.process_code
      AND spec.step_code=contract.step_code
      AND spec.design_status='DESIGN_COMPLETE'
      AND spec.test_contract NOT IN ('[]'::jsonb,'{}'::jsonb,'null'::jsonb)
      AND spec.screen_contract NOT IN ('[]'::jsonb,'{}'::jsonb,'null'::jsonb)
      AND spec.api_contract NOT IN ('[]'::jsonb,'{}'::jsonb,'null'::jsonb)
      AND spec.actor_contract->>'contractType'='STEP_ACTOR_AUTHORITY'
      AND length(coalesce(spec.actor_contract->>'actorCode',''))>0
      AND spec.actor_contract->>'scope' IN ('GLOBAL','TENANT','PROJECT','TENANT_PROJECT')
      AND spec.business_contract->>'contractType'='STEP_BUSINESS'
      AND length(coalesce(spec.business_contract->>'stepName',''))>0
      AND length(coalesce(spec.business_contract->>'requirement',''))>0
      AND length(coalesce(spec.business_contract->>'completionRule',''))>0
      AND spec.guide_contract->>'contractType'='STEP_GUIDE'
      AND length(coalesce(spec.guide_contract->>'title',''))>0
      AND length(coalesce(spec.guide_contract->>'purpose',''))>0
      AND length(coalesce(spec.guide_contract->>'completionCondition',''))>0
      AND spec.nonfunctional_contract->>'contractType'='STEP_NONFUNCTIONAL'
      AND jsonb_typeof(spec.nonfunctional_contract->'security')='object'
      AND jsonb_typeof(spec.nonfunctional_contract->'performance')='object'
      AND (spec.nonfunctional_contract->'performance'->>'targetP95Ms')::integer>0
      AND jsonb_typeof(spec.nonfunctional_contract->'accessibility')='object'
      AND length(coalesce(spec.nonfunctional_contract->'accessibility'->>'standard',''))>0
      AND jsonb_typeof(spec.nonfunctional_contract->'responsive')='object'
      AND jsonb_typeof(spec.nonfunctional_contract->'recovery')='object'
      AND jsonb_typeof(spec.nonfunctional_contract->'audit')='object'
      AND jsonb_typeof(spec.nonfunctional_contract->'sla')='object'
      AND coalesce((convert_from(decode(:'evidence_b64','base64'),'UTF8')::jsonb->>'performanceP95Ms')::numeric,0)>0
      AND coalesce((convert_from(decode(:'evidence_b64','base64'),'UTF8')::jsonb->>'performanceSampleCount')::integer,0)>=20
      AND coalesce((convert_from(decode(:'evidence_b64','base64'),'UTF8')::jsonb->>'performanceP95Ms')::numeric,999999)
          <=(spec.nonfunctional_contract->'performance'->>'targetP95Ms')::numeric
      AND coalesce((convert_from(decode(:'evidence_b64','base64'),'UTF8')::jsonb->>'audit')::integer,0)=1
      AND coalesce((convert_from(decode(:'evidence_b64','base64'),'UTF8')::jsonb->>'recovery')::integer,0)=1
      AND spec.transition_contract->>'contractType'='STEP_TRANSITION'
      AND length(coalesce(spec.transition_contract->>'fromState',''))>0
      AND length(coalesce(spec.transition_contract->>'toState',''))>0
      AND spec.persistence_contract->>'contractType'='STEP_PERSISTENCE'
      AND (spec.persistence_contract->'policy'<>'{}'::jsonb
        OR jsonb_array_length(coalesce(spec.persistence_contract->'mappings','[]'::jsonb))>0
        OR spec.persistence_contract->'extensions'<>'{}'::jsonb)
  )
  AND length(trim(contract.route_path))>0
  AND length(trim(contract.business_purpose))>0
  AND length(trim(contract.entry_condition))>0
  AND length(trim(contract.exit_condition))>0
  AND length(trim(contract.api_contract))>0
  AND length(trim(contract.data_contract))>0;

DO $$
DECLARE total_count integer;
DECLARE verified_count integer;
BEGIN
  SELECT count(*),count(*) FILTER (
    WHERE contract_status='VERIFIED'
      AND api_verified AND database_verified AND authority_verified
      AND responsive_verified AND accessibility_verified AND exception_states_verified
      AND audit_evidence_ref=concat('qa-run:sha256:',current_setting('resonance.evidence_sha256'))
  )
  INTO total_count,verified_count
  FROM framework_professional_screen_contract
  WHERE process_code=current_setting('resonance.process_code')
    AND step_code=current_setting('resonance.step_code')
    AND (current_setting('resonance.audience')='ALL' OR audience=current_setting('resonance.audience'));

  IF total_count=0 OR verified_count<>total_count THEN
    RAISE EXCEPTION 'contract promotion rejected process=% step=% total=% verified=%',
      current_setting('resonance.process_code'),current_setting('resonance.step_code'),
      total_count,verified_count;
  END IF;
END $$;

-- PUBLIC routes remain fail-closed at migration time.  Activate only the
-- exact route binding whose professional contract was verified by this same
-- current-commit BUSINESS_E2E transaction.
UPDATE framework_process_step_screen_binding binding
SET binding_status='ACTIVE',updated_at=current_timestamp
FROM framework_screen_resource resource,
     framework_professional_screen_contract contract
WHERE binding.screen_resource_id=resource.screen_resource_id
  AND contract.process_code=binding.process_code
  AND contract.step_code=binding.step_code
  AND contract.audience=binding.audience
  AND lower(split_part(contract.route_path,'?',1))=resource.route_key
  AND contract.contract_status='VERIFIED'
  AND contract.api_verified AND contract.database_verified AND contract.authority_verified
  AND contract.responsive_verified AND contract.accessibility_verified
  AND contract.exception_states_verified
  AND contract.audit_evidence_ref=concat('qa-run:sha256:',:'evidence_sha256')
  AND binding.process_code=:'process_code'
  AND binding.step_code=:'step_code'
  AND binding.audience='PUBLIC'
  AND :'audience' IN ('PUBLIC','ALL')
  AND binding.binding_status='DRAFT';

-- The route-policy snapshot can predate a newly designed PUBLIC process.  A
-- stale REVIEW_REQUIRED row would continue to override the exact ACTIVE
-- binding in screenContext(), so close both records in this same evidence
-- transaction.  Human-reviewed decisions are never overwritten.
INSERT INTO framework_screen_workflow_policy(
  route_key,classification,reason_code,reason_text,source,review_status,
  reviewed_by,reviewed_at,created_at,updated_at
)
SELECT DISTINCT resource.route_key,'EXECUTABLE','RUNTIME_WORKFLOW_RESOLVED',
  '현재 배포 계약의 BUSINESS_E2E를 통과한 정확한 공개 화면 바인딩이 확인되었습니다.',
  'CONTRACT_E2E_PROMOTER','AUTO_APPROVED',NULL,NULL,current_timestamp,current_timestamp
FROM framework_process_step_screen_binding binding
JOIN framework_screen_resource resource USING(screen_resource_id)
JOIN framework_professional_screen_contract contract
  ON contract.process_code=binding.process_code
 AND contract.step_code=binding.step_code
 AND contract.audience=binding.audience
 AND lower(split_part(contract.route_path,'?',1))=resource.route_key
WHERE binding.process_code=:'process_code'
  AND binding.step_code=:'step_code'
  AND binding.audience='PUBLIC'
  AND :'audience' IN ('PUBLIC','ALL')
  AND binding.binding_status='ACTIVE'
  AND contract.contract_status='VERIFIED'
  AND contract.audit_evidence_ref=concat('qa-run:sha256:',:'evidence_sha256')
ON CONFLICT(route_key) DO UPDATE SET
  classification=excluded.classification,reason_code=excluded.reason_code,
  reason_text=excluded.reason_text,source=excluded.source,
  review_status=excluded.review_status,reviewed_by=NULL,reviewed_at=NULL,
  updated_at=current_timestamp
WHERE (framework_screen_workflow_policy.classification='REVIEW_REQUIRED'
       AND framework_screen_workflow_policy.reason_code='MISSING_WORKFLOW_EVIDENCE'
       AND framework_screen_workflow_policy.review_status='PENDING')
   OR (framework_screen_workflow_policy.source='CONTRACT_E2E_PROMOTER'
       AND framework_screen_workflow_policy.review_status='AUTO_APPROVED'
       AND framework_screen_workflow_policy.reviewed_by IS NULL
       AND framework_screen_workflow_policy.reviewed_at IS NULL);

DO $$
DECLARE public_contract_count integer;
DECLARE active_exact_count integer;
DECLARE wrong_active_count integer;
DECLARE executable_policy_count integer;
BEGIN
  IF current_setting('resonance.audience') NOT IN ('PUBLIC','ALL') THEN
    RETURN;
  END IF;

  SELECT count(*) INTO public_contract_count
  FROM framework_professional_screen_contract contract
  WHERE contract.process_code=current_setting('resonance.process_code')
    AND contract.step_code=current_setting('resonance.step_code')
    AND contract.audience='PUBLIC'
    AND contract.contract_status='VERIFIED'
    AND contract.audit_evidence_ref=concat('qa-run:sha256:',current_setting('resonance.evidence_sha256'));

  SELECT count(*) INTO active_exact_count
  FROM framework_process_step_screen_binding binding
  JOIN framework_screen_resource resource USING(screen_resource_id)
  JOIN framework_professional_screen_contract contract
    ON contract.process_code=binding.process_code
   AND contract.step_code=binding.step_code
   AND contract.audience=binding.audience
   AND lower(split_part(contract.route_path,'?',1))=resource.route_key
  WHERE binding.process_code=current_setting('resonance.process_code')
    AND binding.step_code=current_setting('resonance.step_code')
    AND binding.audience='PUBLIC' AND binding.binding_status='ACTIVE'
    AND contract.contract_status='VERIFIED';

  SELECT count(*) INTO wrong_active_count
  FROM framework_process_step_screen_binding binding
  JOIN framework_screen_resource resource USING(screen_resource_id)
  WHERE binding.audience='PUBLIC' AND binding.binding_status='ACTIVE'
    AND resource.screen_resource_id IN (
      SELECT target_resource.screen_resource_id
      FROM framework_professional_screen_contract target_contract
      JOIN framework_screen_resource target_resource
        ON target_resource.route_key=lower(split_part(target_contract.route_path,'?',1))
      WHERE target_contract.process_code=current_setting('resonance.process_code')
        AND target_contract.step_code=current_setting('resonance.step_code')
        AND target_contract.audience='PUBLIC'
        AND target_contract.contract_status='VERIFIED'
        AND target_contract.audit_evidence_ref=
            concat('qa-run:sha256:',current_setting('resonance.evidence_sha256'))
    )
    AND (binding.process_code,binding.step_code)<>
        (current_setting('resonance.process_code'),current_setting('resonance.step_code'));

  SELECT count(DISTINCT policy.route_key) INTO executable_policy_count
  FROM framework_professional_screen_contract contract
  JOIN framework_screen_resource resource
    ON resource.route_key=lower(split_part(contract.route_path,'?',1))
  JOIN framework_process_step_screen_binding binding
    ON binding.process_code=contract.process_code
   AND binding.step_code=contract.step_code
   AND binding.audience=contract.audience
   AND binding.screen_resource_id=resource.screen_resource_id
  JOIN framework_screen_workflow_policy policy ON policy.route_key=resource.route_key
  WHERE contract.process_code=current_setting('resonance.process_code')
    AND contract.step_code=current_setting('resonance.step_code')
    AND contract.audience='PUBLIC'
    AND contract.contract_status='VERIFIED'
    AND contract.audit_evidence_ref=concat('qa-run:sha256:',current_setting('resonance.evidence_sha256'))
    AND binding.binding_status='ACTIVE'
    AND policy.classification='EXECUTABLE'
    AND policy.reason_code='RUNTIME_WORKFLOW_RESOLVED'
    AND policy.review_status='AUTO_APPROVED';

  IF public_contract_count>0 AND
     (active_exact_count<>public_contract_count OR wrong_active_count<>0
      OR executable_policy_count<>public_contract_count) THEN
    RAISE EXCEPTION 'PUBLIC exact binding promotion rejected process=% step=% contracts=% active=% wrong=% policies=%',
      current_setting('resonance.process_code'),current_setting('resonance.step_code'),
      public_contract_count,active_exact_count,wrong_active_count,executable_policy_count;
  END IF;
END $$;

UPDATE framework_step_execution_spec spec
SET approval_status='APPROVED',
    generation_status=CASE WHEN generation_status='GENERATED' THEN 'GENERATED' ELSE 'READY' END,
    blocker_codes='[]'::jsonb,
    approved_by='CONTRACT_E2E_PROMOTER',
    approved_at=coalesce(approved_at,current_timestamp),
    updated_at=current_timestamp
WHERE spec.process_code=:'process_code'
  AND spec.step_code=:'step_code'
  AND spec.design_status='DESIGN_COMPLETE'
  AND NOT EXISTS (
    SELECT 1 FROM framework_professional_screen_contract contract
    WHERE contract.process_code=spec.process_code
      AND contract.step_code=spec.step_code
      AND contract.contract_status<>'VERIFIED'
  );

COMMIT;
SQL

printf '{"status":"PROMOTED","processCode":"%s","stepCode":"%s","audience":"%s","sha256":"%s"}\n' \
  "$PROCESS_CODE" "$STEP_CODE" "$AUDIENCE" "$EVIDENCE_SHA256"
