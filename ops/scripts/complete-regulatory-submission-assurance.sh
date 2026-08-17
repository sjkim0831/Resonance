#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"; PROCESS=REGULATORY_SUBMISSION
STEP=REGULATORY_SUBMISSION_S1
DEPLOY_LOCK_FILE="${CARBONET_DEPLOY_LOCK_FILE:-/tmp/carbonet-auto-deploy.lock}"
DEPLOY_LOCK_WAIT_SECONDS="${REGULATORY_SUBMISSION_DEPLOY_LOCK_WAIT_SECONDS:-30}"
DEPLOY_STATE_FILE="${CARBONET_DEPLOY_STATE_FILE:-/opt/resonance-data/deploy/carbonet-main-success.commit}"
[[ "$DEPLOY_LOCK_WAIT_SECONDS" =~ ^[0-9]+$ ]] || exit 2

# Keep the deployed identity immutable for the complete baseline/validation/
# final-capture/atomic-completion interval. auto-deploy takes this lock
# exclusively, while assurance consumers share it with one another.
exec 8>"$DEPLOY_LOCK_FILE"
flock -s -w "$DEPLOY_LOCK_WAIT_SECONDS" 8 || {
  echo '[regulatory-submission-assurance] deployment is in progress' >&2
  exit 75
}

VALIDATION_COMMIT="$(git -C "$ROOT" rev-parse HEAD)"; [[ "$(tr -d '[:space:]' <"$DEPLOY_STATE_FILE")" == "$VALIDATION_COMMIT" ]] || exit 3
RUNTIME_CONTRACT="$(bash "$ROOT/ops/scripts/capture-business-e2e-contract.sh" "$PROCESS" "$STEP")"
BASELINE_CONTRACT="$RUNTIME_CONTRACT"
BASELINE_SOURCE_COMMIT="$(jq -er '.sourceCommit|select(test("^[0-9a-f]{40}$"))' <<<"$BASELINE_CONTRACT")"
BASELINE_RUNTIME_IDENTITY_HASH="$(jq -er '.runtimeIdentityHash|select(test("^[0-9a-f]{64}$"))' <<<"$BASELINE_CONTRACT")"
BASELINE_POD_TEMPLATE_SHA256="$(jq -er '.podTemplateSha256|select(test("^[0-9a-f]{64}$"))' <<<"$BASELINE_CONTRACT")"
BASELINE_CONTRACT_FINGERPRINT="$(jq -er '.contractFingerprint|select(test("^[0-9a-f]{32,128}$"))' <<<"$BASELINE_CONTRACT")"
BASELINE_PROCESS_VERSION="$(jq -er '.processVersion|select(test("^[A-Za-z0-9._-]+$"))' <<<"$BASELINE_CONTRACT")"
[[ "$BASELINE_SOURCE_COMMIT" == "$VALIDATION_COMMIT" ]] || exit 3

WORKFLOW="$(bash "$ROOT/ops/scripts/validate-regulatory-submission-workflow.sh")"; grep -q 'tables=2 steps=4 contracts=8 menus=2' <<<"$WORKFLOW" || exit 1
RELAY="$(bash "$ROOT/ops/tests/run-regulatory-submission-business-e2e.sh")"; RELAY_JSON="$(tail -n 1 <<<"$RELAY")"; jq -e '.status=="PROMOTED" and .processCode=="REGULATORY_SUBMISSION" and .steps==4 and .cleanup==true' <<<"$RELAY_JSON" >/dev/null
ADMIN="$(bash "$ROOT/ops/scripts/resonance-regulatory-admin-e2e.sh")"; jq -e '.status=="PASS" and .desktop==1 and .mobile==1 and .accessibility==1 and .authority==1' <<<"$ADMIN" >/dev/null
CUSTOMER="$(bash "$ROOT/ops/scripts/validate-customer-work-journey.sh")"; grep -Eq '^\[customer-journey\] PASS .*regulatory=accepted ' <<<"$CUSTOMER" || exit 1
FINAL_CONTRACT="$(bash "$ROOT/ops/scripts/capture-business-e2e-contract.sh" "$PROCESS" "$STEP")"
FINAL_SOURCE_COMMIT="$(jq -er '.sourceCommit|select(test("^[0-9a-f]{40}$"))' <<<"$FINAL_CONTRACT")"
FINAL_RUNTIME_IDENTITY_HASH="$(jq -er '.runtimeIdentityHash|select(test("^[0-9a-f]{64}$"))' <<<"$FINAL_CONTRACT")"
FINAL_POD_TEMPLATE_SHA256="$(jq -er '.podTemplateSha256|select(test("^[0-9a-f]{64}$"))' <<<"$FINAL_CONTRACT")"
FINAL_CONTRACT_FINGERPRINT="$(jq -er '.contractFingerprint|select(test("^[0-9a-f]{32,128}$"))' <<<"$FINAL_CONTRACT")"
FINAL_PROCESS_VERSION="$(jq -er '.processVersion|select(test("^[A-Za-z0-9._-]+$"))' <<<"$FINAL_CONTRACT")"
RELAY_SOURCE_COMMIT="$(jq -er '.sourceCommit|select(test("^[0-9a-f]{40}$"))' <<<"$RELAY_JSON")"
[[ "$FINAL_SOURCE_COMMIT" == "$BASELINE_SOURCE_COMMIT" \
   && "$FINAL_RUNTIME_IDENTITY_HASH" == "$BASELINE_RUNTIME_IDENTITY_HASH" \
   && "$FINAL_POD_TEMPLATE_SHA256" == "$BASELINE_POD_TEMPLATE_SHA256" \
   && "$FINAL_CONTRACT_FINGERPRINT" == "$BASELINE_CONTRACT_FINGERPRINT" \
   && "$FINAL_PROCESS_VERSION" == "$BASELINE_PROCESS_VERSION" \
   && "$RELAY_SOURCE_COMMIT" == "$BASELINE_SOURCE_COMMIT" ]] || {
  echo '[regulatory-submission-assurance] exact runtime/contract identity changed during validation' >&2
  exit 3
}
SOURCE_COMMIT="$BASELINE_SOURCE_COMMIT"
RUNTIME_IDENTITY_HASH="$BASELINE_RUNTIME_IDENTITY_HASH"
POD_TEMPLATE_SHA256="$BASELINE_POD_TEMPLATE_SHA256"
CONTRACT_FINGERPRINT="$BASELINE_CONTRACT_FINGERPRINT"
PROCESS_VERSION="$BASELINE_PROCESS_VERSION"
EVIDENCE="$(jq -cn --arg workflow "$WORKFLOW" --argjson admin "$ADMIN" --arg customer "$CUSTOMER" \
  --argjson relay "$RELAY_JSON" --arg runtimeIdentityHash "$RUNTIME_IDENTITY_HASH" \
  --arg podTemplateSha256 "$POD_TEMPLATE_SHA256" --arg contractFingerprint "$CONTRACT_FINGERPRINT" \
  --arg processVersion "$PROCESS_VERSION" \
  '{suite:"REGULATORY_SUBMISSION_ASSURANCE",workflow:$workflow,relay:$relay,admin:$admin,customer:$customer,runtimeIdentityHash:$runtimeIdentityHash,podTemplateSha256:$podTemplateSha256,contractFingerprint:$contractFingerprint,processVersion:$processVersion}')"
SHA="$(printf '%s' "$EVIDENCE"|sha256sum|awk '{print $1}')"; B64="$(printf '%s' "$EVIDENCE"|base64 -w0)"
source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"; carbonet_postgres_query_init
carbonet_postgres_query "DO \$\$ DECLARE jobs integer; tests integer; runtime_source_commit text; runtime_identity_hash_value text; runtime_pod_template_sha256 text; current_contract_fingerprint text; current_process_version text; BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('$PROCESS:ASSURANCE'));
 SELECT source_commit,framework_runtime_release_identity_hash(runtime),pod_template_sha256
 INTO STRICT runtime_source_commit,runtime_identity_hash_value,runtime_pod_template_sha256
 FROM framework_runtime_release_state runtime WHERE release_key='CARBONET_RUNTIME' AND health_status='UP' FOR SHARE;
 PERFORM 1 FROM framework_process_definition p WHERE p.process_code='$PROCESS' FOR SHARE OF p;
 PERFORM 1 FROM framework_process_step s WHERE s.process_code='$PROCESS' AND s.step_code='$STEP' FOR SHARE OF s;
 PERFORM 1 FROM framework_step_execution_spec spec WHERE spec.process_code='$PROCESS' AND spec.step_code='$STEP' FOR SHARE OF spec;
 PERFORM 1 FROM framework_process_flow_edge edge WHERE edge.process_code='$PROCESS' AND edge.use_at='Y' AND (edge.from_step_code='$STEP' OR edge.to_step_code='$STEP') FOR SHARE OF edge;
 PERFORM 1 FROM framework_process_data_handoff handoff WHERE (handoff.process_code='$PROCESS' AND handoff.from_step_code='$STEP') OR (handoff.to_process_code='$PROCESS' AND handoff.to_step_code='$STEP') FOR SHARE OF handoff;
 PERFORM 1 FROM framework_process_dependency dependency WHERE dependency.use_at='Y' AND ((dependency.parent_process_code='$PROCESS' AND dependency.parent_step_code='$STEP') OR dependency.child_process_code='$PROCESS') FOR SHARE OF dependency;
 SELECT p.process_version,framework_current_process_step_contract_fingerprint(p.process_code,'$STEP')
 INTO STRICT current_process_version,current_contract_fingerprint
 FROM framework_process_definition p WHERE p.process_code='$PROCESS';
 IF runtime_source_commit<>'$SOURCE_COMMIT'
    OR runtime_identity_hash_value IS DISTINCT FROM '$RUNTIME_IDENTITY_HASH'
    OR runtime_pod_template_sha256 IS DISTINCT FROM '$POD_TEMPLATE_SHA256'
    OR current_contract_fingerprint IS DISTINCT FROM '$CONTRACT_FINGERPRINT'
    OR current_process_version IS DISTINCT FROM '$PROCESS_VERSION' THEN
   RAISE EXCEPTION 'regulatory runtime/contract identity changed before atomic completion';
 END IF;
 INSERT INTO framework_simulation_run(case_code,process_version,result,failure_reason,evidence_json,executed_by,source_commit,execution_environment,evidence_hash)
 SELECT c.case_code,p.process_version,'PASSED',NULL,convert_from(decode('$B64','base64'),'UTF8'),'REGULATORY_SUBMISSION_ASSURANCE','$SOURCE_COMMIT','carbonet-prod','$SHA' FROM framework_simulation_case c JOIN framework_process_definition p USING(process_code) WHERE c.process_code='$PROCESS' AND c.case_status='APPROVED' AND c.automated ON CONFLICT DO NOTHING;
 UPDATE framework_development_job SET job_status='VERIFIED',approval_status='APPROVED',quality_status='VERIFIED',evidence_ref='inline://business-e2e/sha256/$SHA',last_error=NULL,completed_at=coalesce(completed_at,current_timestamp),updated_at=current_timestamp WHERE process_code='$PROCESS' AND required;
 UPDATE framework_process_artifact SET delivery_status='VERIFIED',evidence_ref='inline://business-e2e/sha256/$SHA',updated_at=current_timestamp WHERE process_code='$PROCESS';
 UPDATE framework_process_definition SET process_status='ACTIVE',definition_locked=true,updated_at=current_timestamp WHERE process_code='$PROCESS';
 SELECT count(*) INTO jobs FROM framework_development_job WHERE process_code='$PROCESS' AND required AND job_status='VERIFIED' AND quality_status='VERIFIED' AND approval_status='APPROVED';
 SELECT count(DISTINCT c.case_type) INTO tests FROM framework_simulation_case c WHERE c.process_code='$PROCESS' AND c.case_status='APPROVED' AND c.automated AND EXISTS(SELECT 1 FROM framework_simulation_run r WHERE r.case_code=c.case_code AND r.result='PASSED' AND r.source_commit=runtime_source_commit AND r.evidence_json::jsonb->>'runtimeIdentityHash'=runtime_identity_hash_value AND r.evidence_json::jsonb->>'podTemplateSha256'=runtime_pod_template_sha256 AND r.evidence_json::jsonb->>'contractFingerprint'=current_contract_fingerprint);
 IF jobs<>58 OR tests<3 THEN RAISE EXCEPTION 'regulatory closing mismatch jobs=% tests=%',jobs,tests; END IF; END \$\$;" >/dev/null
printf '%s\n%s\n' "$WORKFLOW" "$CUSTOMER"; printf '[regulatory-submission-assurance] PASS current=4/4 jobs=58/58 approvedTestTypes=3 admin=desktop+mobile sha256=%s\n' "$SHA"
