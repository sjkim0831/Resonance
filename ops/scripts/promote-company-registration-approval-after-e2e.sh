#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NS="${K8S_NAMESPACE:-carbonet-prod}"
EVIDENCE="$(cat)"
jq -e '.status=="PASS" and .promotionEligible==true and .processCode=="COMPANY_REGISTRATION_APPROVAL" and .stepCount==4 and .caseCount==5 and .actualContractCount==8 and .plannedContractCount==8 and .plannedActiveCount==0 and .actualActiveCount==8 and .happy==1 and .auth==1 and .exception==1 and .isolation==1 and .recovery==1 and .database==1 and .audit==1 and .cleanup==1 and .responsive==1 and .accessibility==1 and .performanceSampleCount>=20 and .performanceP95Ms>0 and .performanceP95Ms<=500 and (.routes|length)==4' <<<"$EVIDENCE" >/dev/null
SOURCE="$(jq -r '.sourceCommit' <<<"$EVIDENCE")"
DEPLOYED="$(kubectl -n "$NS" get deploy carbonet-runtime -o jsonpath='{.metadata.annotations.resonance\.ai/target-commit}')"
[[ "$SOURCE" =~ ^[0-9a-f]{40}$ && "$SOURCE" == "$DEPLOYED" ]] || { echo 'registration evidence is not from the deployed commit' >&2; exit 3; }
POD="$(K8S_NAMESPACE="$NS" bash "$ROOT/ops/scripts/resolve-patroni-primary-pod.sh")"
SHA="$(printf '%s' "$EVIDENCE" | sha256sum | awk '{print $1}')"
kubectl -n "$NS" exec -i "$POD" -c patroni -- psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d carbonet -X -q -o /dev/null -v source="$SOURCE" -v sha="$SHA" <<'SQL'
BEGIN;
UPDATE framework_simulation_case SET case_status='APPROVED',automated=true,expected_duration_minutes=5,
 required_evidence='CANONICAL_ONBOARDING,MEMBER_APPROVAL,USER_ADMIN_ROUTES,DATABASE_REREAD,AUDIT,RESPONSIVE,ACCESSIBILITY,CLEANUP',updated_at=current_timestamp
WHERE process_code='COMPANY_REGISTRATION_APPROVAL' AND case_type IN ('HAPPY_PATH','EXCEPTION','AUTHORITY','ISOLATION','RECOVERY');
INSERT INTO framework_simulation_run(case_code,process_version,result,failure_reason,evidence_json,executed_by,source_commit,execution_environment,evidence_hash)
SELECT c.case_code,p.process_version,'PASSED',NULL,
 jsonb_build_object('evidenceSha256',:'sha','evidenceType','COMPOSED_COMPANY_REGISTRATION_APPROVAL_E2E','canonicalProcess','COMPANY_ONBOARDING','steps',4,'actualContracts',8,'plannedContracts',8,'plannedExecutable',false)::text,
 'COMPANY_REGISTRATION_APPROVAL_E2E_PROMOTER',:'source','carbonet-prod',md5(c.case_code||':'||:'sha')
FROM framework_simulation_case c JOIN framework_process_definition p USING(process_code)
WHERE c.process_code='COMPANY_REGISTRATION_APPROVAL' AND c.case_status='APPROVED'
 AND NOT EXISTS(select 1 from framework_simulation_run r where r.case_code=c.case_code and r.result='PASSED' and r.source_commit=:'source' and r.evidence_hash=md5(c.case_code||':'||:'sha'));

UPDATE framework_professional_screen_contract c SET
 api_verified=true,database_verified=true,authority_verified=true,responsive_verified=true,accessibility_verified=true,exception_states_verified=true,
 audit_evidence_ref=concat('qa-run:sha256:',:'sha'),contract_status='VERIFIED',updated_by='COMPANY_REGISTRATION_APPROVAL_E2E_PROMOTER',updated_at=current_timestamp
FROM framework_process_step s
WHERE c.process_code='COMPANY_REGISTRATION_APPROVAL' AND s.process_code=c.process_code AND s.step_code=c.step_code
 AND ((c.audience='USER' AND lower(split_part(c.route_path,'?',1))=lower(split_part(s.user_path,'?',1)))
   OR (c.audience='ADMIN' AND lower(split_part(c.route_path,'?',1))=lower(split_part(s.admin_path,'?',1))));

UPDATE framework_step_execution_spec SET approval_status='APPROVED',blocker_codes='[]'::jsonb,
 approved_by='COMPANY_REGISTRATION_APPROVAL_E2E_PROMOTER',approved_at=coalesce(approved_at,current_timestamp),updated_at=current_timestamp
WHERE process_code='COMPANY_REGISTRATION_APPROVAL';
UPDATE framework_process_definition SET process_status='DEVELOPMENT_READY',lifecycle_status='VALIDATED',automation_mode='ORCHESTRATOR',
 definition_locked=true,definition_lock_reason='Canonical COMPANY_ONBOARDING and MEMBER_APPROVAL BUSINESS_E2E composition',last_reviewed_at=current_timestamp,updated_at=current_timestamp
WHERE process_code='COMPANY_REGISTRATION_APPROVAL';

DO $$ DECLARE actual_verified int; planned_verified int; cases_passed int; planned_active int;
BEGIN
 SELECT count(*) INTO actual_verified FROM framework_professional_screen_contract c JOIN framework_process_step s ON s.process_code=c.process_code AND s.step_code=c.step_code
 WHERE c.process_code='COMPANY_REGISTRATION_APPROVAL' AND c.contract_status='VERIFIED'
 AND ((c.audience='USER' AND lower(split_part(c.route_path,'?',1))=lower(split_part(s.user_path,'?',1))) OR (c.audience='ADMIN' AND lower(split_part(c.route_path,'?',1))=lower(split_part(s.admin_path,'?',1))));
 SELECT count(*) INTO planned_verified FROM framework_professional_screen_contract WHERE process_code='COMPANY_REGISTRATION_APPROVAL' AND contract_status='VERIFIED' AND (route_path like '/planned/%' or route_path like '/admin/planned/%');
 SELECT count(*) INTO cases_passed FROM framework_simulation_case c WHERE c.process_code='COMPANY_REGISTRATION_APPROVAL' AND EXISTS(select 1 from framework_simulation_run r where r.case_code=c.case_code and r.result='PASSED');
 SELECT count(*) INTO planned_active FROM framework_process_step_screen_binding b JOIN framework_screen_resource r USING(screen_resource_id) WHERE b.process_code='COMPANY_REGISTRATION_APPROVAL' AND b.binding_status='ACTIVE' AND (r.route_key like '/planned/%' or r.route_key like '/admin/planned/%');
 IF actual_verified<>8 OR planned_verified<>0 OR cases_passed<>5 OR planned_active<>0 THEN RAISE EXCEPTION 'registration promotion mismatch actual=% plannedVerified=% cases=% plannedActive=%',actual_verified,planned_verified,cases_passed,planned_active; END IF;
END $$;
COMMIT;
SQL
printf '{"status":"PROMOTED","processCode":"COMPANY_REGISTRATION_APPROVAL","cases":5,"actualContracts":8,"plannedContracts":8,"evidenceSha256":"%s"}\n' "$SHA"
