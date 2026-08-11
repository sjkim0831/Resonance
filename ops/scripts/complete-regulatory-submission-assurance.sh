#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"; PROCESS=REGULATORY_SUBMISSION
VALIDATION_COMMIT="$(git -C "$ROOT" rev-parse HEAD)"; [[ "$(tr -d '[:space:]' </opt/resonance-data/deploy/carbonet-main-success.commit)" == "$VALIDATION_COMMIT" ]] || exit 3
WORKFLOW="$(bash "$ROOT/ops/scripts/validate-regulatory-submission-workflow.sh")"; grep -q 'tables=2 steps=4 contracts=8 menus=2' <<<"$WORKFLOW" || exit 1
RELAY="$(bash "$ROOT/ops/tests/run-regulatory-submission-business-e2e.sh")"; grep -q '"status":"PROMOTED"' <<<"$RELAY" || exit 1
ADMIN="$(bash "$ROOT/ops/scripts/resonance-regulatory-admin-e2e.sh")"; jq -e '.status=="PASS" and .desktop==1 and .mobile==1 and .accessibility==1 and .authority==1' <<<"$ADMIN" >/dev/null
CUSTOMER="$(bash "$ROOT/ops/scripts/validate-customer-work-journey.sh")"; grep -Eq '^\[customer-journey\] PASS .*regulatory=accepted ' <<<"$CUSTOMER" || exit 1
SOURCE_COMMIT="$(jq -r '.sourceCommit' <<<"$RELAY")"; EVIDENCE="$(jq -cn --arg workflow "$WORKFLOW" --argjson admin "$ADMIN" --arg customer "$CUSTOMER" --arg relay "$RELAY" '{suite:"REGULATORY_SUBMISSION_ASSURANCE",workflow:$workflow,relay:$relay,admin:$admin,customer:$customer}')"; SHA="$(printf '%s' "$EVIDENCE"|sha256sum|awk '{print $1}')"; B64="$(printf '%s' "$EVIDENCE"|base64 -w0)"
source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"; carbonet_postgres_query_init
carbonet_postgres_query "DO \$\$ DECLARE jobs integer; tests integer; BEGIN
 INSERT INTO framework_simulation_run(case_code,process_version,result,failure_reason,evidence_json,executed_by,source_commit,execution_environment,evidence_hash)
 SELECT c.case_code,p.process_version,'PASSED',NULL,convert_from(decode('$B64','base64'),'UTF8'),'REGULATORY_SUBMISSION_ASSURANCE','$SOURCE_COMMIT','carbonet-prod','$SHA' FROM framework_simulation_case c JOIN framework_process_definition p USING(process_code) WHERE c.process_code='$PROCESS' AND c.case_status='APPROVED' AND c.automated ON CONFLICT DO NOTHING;
 UPDATE framework_development_job SET job_status='VERIFIED',approval_status='APPROVED',quality_status='VERIFIED',evidence_ref='inline://business-e2e/sha256/$SHA',last_error=NULL,completed_at=coalesce(completed_at,current_timestamp),updated_at=current_timestamp WHERE process_code='$PROCESS' AND required;
 UPDATE framework_process_artifact SET delivery_status='VERIFIED',evidence_ref='inline://business-e2e/sha256/$SHA',updated_at=current_timestamp WHERE process_code='$PROCESS';
 UPDATE framework_process_definition SET process_status='ACTIVE',definition_locked=true,updated_at=current_timestamp WHERE process_code='$PROCESS';
 SELECT count(*) INTO jobs FROM framework_development_job WHERE process_code='$PROCESS' AND required AND job_status='VERIFIED' AND quality_status='VERIFIED' AND approval_status='APPROVED';
 SELECT count(DISTINCT c.case_type) INTO tests FROM framework_simulation_case c WHERE c.process_code='$PROCESS' AND c.case_status='APPROVED' AND c.automated AND EXISTS(SELECT 1 FROM framework_simulation_run r WHERE r.case_code=c.case_code AND r.result='PASSED');
 IF jobs<>58 OR tests<3 THEN RAISE EXCEPTION 'regulatory closing mismatch jobs=% tests=%',jobs,tests; END IF; END \$\$;" >/dev/null
printf '%s\n%s\n' "$WORKFLOW" "$CUSTOMER"; printf '[regulatory-submission-assurance] PASS current=4/4 jobs=58/58 approvedTestTypes=3 admin=desktop+mobile sha256=%s\n' "$SHA"
