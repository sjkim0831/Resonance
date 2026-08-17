#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PROCESS=ACCOUNT_LOCK_RECOVERY
AUDIT_SCRIPT="$ROOT/ops/scripts/audit-account-lock-recovery-assurance.sh"
DEPLOY_LOCK_FILE="${CARBONET_DEPLOY_LOCK_FILE:-/tmp/carbonet-auto-deploy.lock}"
RUNTIME_RELEASE_KEY="${CARBONET_RUNTIME_RELEASE_KEY:-CARBONET_RUNTIME}"

# Prevent deployment identity from changing between evidence capture, database
# promotion, and the post-promotion check.
exec 8>"$DEPLOY_LOCK_FILE"
flock -s -w 30 8 || {
  jq -cn '{status:"BLOCKED",reason:"DEPLOYMENT_IN_PROGRESS"}'
  exit 75
}

# The audit intentionally returns non-zero while evidence is partial. Capture
# its JSON, then stop before any database mutation.
set +e
audit_report="$(bash "$AUDIT_SCRIPT")"
audit_status=$?
set -e
[[ $audit_status -eq 0 ]] || {
  jq -c '{status:"BLOCKED",processCode,partialEvidence,externalBlockers,internalGaps}' <<<"$audit_report"
  exit 4
}
jq -e '.assuranceReady==true
  and .partialEvidence.process.definitionCount==1
  and .partialEvidence.process.versionCount==1
  and .partialEvidence.process.processVersion=="3.0.0"
  and .partialEvidence.process.processStatus=="IN_DEVELOPMENT"
  and .partialEvidence.process.definitionLocked==true
  and .partialEvidence.contracts.total==4
  and .partialEvidence.contracts.implementationReady==4
  and .partialEvidence.businessE2e.passedSteps==4
  and .partialEvidence.tests.approvedCases>=8
  and .partialEvidence.tests.passedCases==.partialEvidence.tests.approvedCases
  and .partialEvidence.tests.approvedTypes>=5
  and .partialEvidence.tests.passedTypes==.partialEvidence.tests.approvedTypes
  and .partialEvidence.jobs.total==43 and .partialEvidence.jobs.promotable==43
  and .partialEvidence.artifacts.total==4
  and .partialEvidence.artifacts.aligned==4
  and .partialEvidence.artifacts.promotable==4' \
  <<<"$audit_report" >/dev/null

source_commit="$(jq -er '.deployedCommit|select(test("^[0-9a-f]{40}$"))' <<<"$audit_report")"
runtime_identity_hash="$(jq -er '.runtimeIdentityHash|select(test("^[0-9a-f]{64}$"))' <<<"$audit_report")"
evidence_sha="$(printf '%s' "$audit_report" | sha256sum | awk '{print $1}')"
source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init

# Recheck every condition under one advisory-locked transaction. This promoter
# never creates test runs, never promotes PLANNED work, and preserves the
# original job and artifact evidence references.
carbonet_postgres_query "BEGIN ISOLATION LEVEL SERIALIZABLE;
DO \$\$
DECLARE
  process_version_value text; process_status_value text; definition_locked_value boolean;
  definition_count integer; version_count integer; runtime_source_commit text;
  runtime_identity_hash_value text; runtime_pod_template_sha256 text;
  step_count integer; aligned_steps integer; contract_count integer; implementation_contracts integer;
  actual_steps integer; approved_cases integer; passed_cases integer;
  approved_types integer; passed_types integer;
  job_count integer; promotable_jobs integer;
  artifact_count integer; aligned_artifacts integer; promotable_artifacts integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('$PROCESS:ASSURANCE'));

  SELECT count(*),count(*) FILTER (WHERE process_version='3.0.0')
  INTO definition_count,version_count
  FROM framework_process_definition WHERE process_code='$PROCESS';
  IF definition_count<>1 OR version_count<>1 THEN
    RAISE EXCEPTION 'account recovery definition/version mismatch definitions=% version3=%',definition_count,version_count;
  END IF;
  SELECT process_version,process_status,definition_locked
  INTO STRICT process_version_value,process_status_value,definition_locked_value
  FROM framework_process_definition
  WHERE process_code='$PROCESS' AND process_version='3.0.0' FOR UPDATE;
  IF process_status_value<>'IN_DEVELOPMENT' OR NOT definition_locked_value THEN
    RAISE EXCEPTION 'account recovery pre-promotion status mismatch status=% locked=%',process_status_value,definition_locked_value;
  END IF;
  SELECT source_commit,framework_runtime_release_identity_hash(runtime),pod_template_sha256
  INTO STRICT runtime_source_commit,runtime_identity_hash_value,runtime_pod_template_sha256
  FROM framework_runtime_release_state runtime WHERE release_key='$RUNTIME_RELEASE_KEY' FOR SHARE;
  IF runtime_source_commit<>'$source_commit' OR runtime_identity_hash_value IS DISTINCT FROM '$runtime_identity_hash' THEN
    RAISE EXCEPTION 'account recovery runtime identity changed expected=%/% actual=%/%',
      '$source_commit','$runtime_identity_hash',runtime_source_commit,runtime_identity_hash_value;
  END IF;

  PERFORM 1 FROM framework_development_job WHERE process_code='$PROCESS' AND required FOR UPDATE;
  PERFORM 1 FROM framework_process_artifact WHERE process_code='$PROCESS' AND required FOR UPDATE;
  PERFORM 1 FROM framework_professional_screen_contract WHERE process_code='$PROCESS' FOR SHARE;
  PERFORM 1 FROM framework_simulation_case WHERE process_code='$PROCESS' FOR SHARE;

  -- Lock the immutable base evidence rows, not the convenience view. The
  -- SERIALIZABLE transaction also protects the selected predicates from
  -- concurrent phantom inserts while promotion is decided.
  PERFORM q.qa_run_id FROM framework_process_qa_run q
  WHERE q.process_code='$PROCESS' AND q.evidence_type='BUSINESS_E2E'
    AND q.process_version=process_version_value
    AND q.source_commit='$source_commit'
  FOR SHARE OF q;
  PERFORM r.run_id FROM framework_simulation_run r
  JOIN framework_simulation_case c ON c.case_code=r.case_code
  WHERE c.process_code='$PROCESS' AND r.process_version=process_version_value
    AND r.source_commit='$source_commit'
    AND r.evidence_json::jsonb->>'runtimeIdentityHash'=runtime_identity_hash_value
    AND r.evidence_json::jsonb->>'podTemplateSha256'=runtime_pod_template_sha256
  FOR SHARE OF r;
  PERFORM g.result_id FROM framework_development_job_gate_result g
  JOIN framework_development_job j ON j.job_id=g.job_id
  WHERE j.process_code='$PROCESS' AND j.required
  FOR SHARE OF g;

  SELECT count(*),count(*) FILTER (WHERE actor_code='MEMBER_USER' AND requires_user_page
    AND NOT requires_admin_page AND admin_path IS NULL
    AND user_path=CASE step_code
      WHEN 'ACCOUNT_LOCK_RECOVERY_S1' THEN '/signin/findPassword'
      WHEN 'ACCOUNT_LOCK_RECOVERY_S2' THEN '/signin/findPassword'
      WHEN 'ACCOUNT_LOCK_RECOVERY_S3' THEN '/signin/findPassword'
      WHEN 'ACCOUNT_LOCK_RECOVERY_S4' THEN '/signin/findPassword/result' END
    AND command_code=CASE step_code
      WHEN 'ACCOUNT_LOCK_RECOVERY_S1' THEN 'REQUEST_RECOVERY'
      WHEN 'ACCOUNT_LOCK_RECOVERY_S2' THEN 'VERIFY_RECOVERY_CHALLENGE'
      WHEN 'ACCOUNT_LOCK_RECOVERY_S3' THEN 'COMPLETE_ACCOUNT_RECOVERY'
      WHEN 'ACCOUNT_LOCK_RECOVERY_S4' THEN 'NAVIGATE_TO_LOGIN' END)
  INTO step_count,aligned_steps FROM framework_process_step WHERE process_code='$PROCESS';

  SELECT count(*),count(*) FILTER (WHERE c.contract_status='VERIFIED'
    AND c.menu_verified AND c.api_verified AND c.database_verified AND c.authority_verified
    AND c.responsive_verified AND c.accessibility_verified AND c.exception_states_verified
    AND EXISTS (SELECT 1 FROM framework_current_business_e2e_evidence e
      WHERE e.process_code=c.process_code AND e.step_code=c.step_code
        AND e.business_test_result='PASSED' AND e.current_version
        AND e.source_commit='$source_commit' AND e.evidence_process_version=process_version_value
        AND c.audit_evidence_ref='qa-run:sha256:'||e.evidence_hash))
  INTO contract_count,implementation_contracts
  FROM framework_professional_screen_contract c
  WHERE c.process_code='$PROCESS' AND c.audience='USER'
    AND c.route_path=CASE c.step_code
      WHEN 'ACCOUNT_LOCK_RECOVERY_S1' THEN '/signin/findPassword'
      WHEN 'ACCOUNT_LOCK_RECOVERY_S2' THEN '/signin/findPassword'
      WHEN 'ACCOUNT_LOCK_RECOVERY_S3' THEN '/signin/findPassword'
      WHEN 'ACCOUNT_LOCK_RECOVERY_S4' THEN '/signin/findPassword/result' END;

  SELECT count(DISTINCT step_code) INTO actual_steps
  FROM framework_current_business_e2e_evidence
  WHERE process_code='$PROCESS' AND business_test_result='PASSED' AND current_version
    AND source_commit='$source_commit' AND evidence_process_version=process_version_value
    AND coalesce(evidence_hash,'')<>'';

  SELECT count(*) FILTER (WHERE case_status='APPROVED'),
    count(*) FILTER (WHERE case_status='APPROVED' AND automated
      AND EXISTS (SELECT 1 FROM framework_simulation_run r WHERE r.case_code=c.case_code
        AND r.result='PASSED' AND r.source_commit='$source_commit'
        AND r.process_version=process_version_value
        AND r.evidence_json::jsonb->>'runtimeIdentityHash'=runtime_identity_hash_value
        AND r.evidence_json::jsonb->>'podTemplateSha256'=runtime_pod_template_sha256
        AND coalesce(r.evidence_hash,'')<>'')),
    count(DISTINCT case_type) FILTER (WHERE case_status='APPROVED'),
    count(DISTINCT case_type) FILTER (WHERE case_status='APPROVED' AND automated
      AND EXISTS (SELECT 1 FROM framework_simulation_run r WHERE r.case_code=c.case_code
        AND r.result='PASSED' AND r.source_commit='$source_commit'
        AND r.process_version=process_version_value
        AND r.evidence_json::jsonb->>'runtimeIdentityHash'=runtime_identity_hash_value
        AND r.evidence_json::jsonb->>'podTemplateSha256'=runtime_pod_template_sha256
        AND coalesce(r.evidence_hash,'')<>''))
  INTO approved_cases,passed_cases,approved_types,passed_types
  FROM framework_simulation_case c WHERE process_code='$PROCESS';

  SELECT count(*),count(*) FILTER (WHERE job_status IN ('COMPLETED','VERIFIED')
    AND approval_status='APPROVED' AND quality_status IN ('PASSED','VERIFIED')
    AND specification_json::jsonb->>'contractVersion'='$PROCESS:'||process_version_value
    AND evidence_ref LIKE 'qa-run:'||j.process_code||':'||process_version_value||':'||
      runtime_source_commit||':sha256:%'
    AND array_length(string_to_array(evidence_ref,':'),1)=6
    AND split_part(evidence_ref,':',5)='sha256'
    AND length(split_part(evidence_ref,':',6))=64
    AND translate(split_part(evidence_ref,':',6),'0123456789abcdef','')=''
    AND EXISTS (SELECT 1 FROM framework_current_business_e2e_evidence e
      WHERE e.process_code=j.process_code AND e.step_code=j.step_code
        AND e.business_test_result='PASSED' AND e.current_version
        AND e.source_commit=runtime_source_commit
        AND e.evidence_process_version=process_version_value
        AND length(e.evidence_hash)=64
        AND translate(e.evidence_hash,'0123456789abcdef','')=''
        AND j.evidence_ref='qa-run:'||j.process_code||':'||e.evidence_process_version||':'||
          e.source_commit||':sha256:'||e.evidence_hash)
    AND EXISTS (SELECT 1 FROM framework_development_job_gate_result g
                WHERE g.job_id=j.job_id AND g.result='PASSED'
                  AND g.evidence_ref=j.evidence_ref
                  AND g.evidence_ref LIKE 'qa-run:'||j.process_code||':'||process_version_value||':'||
                    runtime_source_commit||':sha256:%'
                  AND array_length(string_to_array(g.evidence_ref,':'),1)=6
                  AND split_part(g.evidence_ref,':',5)='sha256'
                  AND length(split_part(g.evidence_ref,':',6))=64
                  AND translate(split_part(g.evidence_ref,':',6),'0123456789abcdef','')=''))
  INTO job_count,promotable_jobs FROM framework_development_job j
  WHERE process_code='$PROCESS' AND required;

  SELECT count(*) FILTER (WHERE required),
    count(*) FILTER (WHERE required AND artifact_type='PAGE'
      AND owner_actor_code='MEMBER_USER'
      AND target_path=CASE step_code
        WHEN 'ACCOUNT_LOCK_RECOVERY_S1' THEN '/signin/findPassword'
        WHEN 'ACCOUNT_LOCK_RECOVERY_S2' THEN '/signin/findPassword'
        WHEN 'ACCOUNT_LOCK_RECOVERY_S3' THEN '/signin/findPassword'
        WHEN 'ACCOUNT_LOCK_RECOVERY_S4' THEN '/signin/findPassword/result' END
      AND contract_ref='process://ACCOUNT_LOCK_RECOVERY/'||process_version_value||'/'||step_code),
    count(*) FILTER (WHERE required AND artifact_type='PAGE'
      AND owner_actor_code='MEMBER_USER'
      AND target_path=CASE step_code
        WHEN 'ACCOUNT_LOCK_RECOVERY_S1' THEN '/signin/findPassword'
        WHEN 'ACCOUNT_LOCK_RECOVERY_S2' THEN '/signin/findPassword'
        WHEN 'ACCOUNT_LOCK_RECOVERY_S3' THEN '/signin/findPassword'
        WHEN 'ACCOUNT_LOCK_RECOVERY_S4' THEN '/signin/findPassword/result' END
      AND contract_ref='process://ACCOUNT_LOCK_RECOVERY/'||process_version_value||'/'||step_code
      AND delivery_status IN ('COMPLETED','VERIFIED')
      AND evidence_ref LIKE 'qa-run:'||process_code||':'||process_version_value||':'||
        runtime_source_commit||':sha256:%'
      AND array_length(string_to_array(evidence_ref,':'),1)=6
      AND split_part(evidence_ref,':',5)='sha256'
      AND length(split_part(evidence_ref,':',6))=64
      AND translate(split_part(evidence_ref,':',6),'0123456789abcdef','')=''
      AND EXISTS (SELECT 1 FROM framework_current_business_e2e_evidence e
        WHERE e.process_code=framework_process_artifact.process_code
          AND e.step_code=framework_process_artifact.step_code
          AND e.business_test_result='PASSED' AND e.current_version
          AND e.source_commit=runtime_source_commit
          AND e.evidence_process_version=process_version_value
          AND length(e.evidence_hash)=64
          AND translate(e.evidence_hash,'0123456789abcdef','')=''
          AND framework_process_artifact.evidence_ref='qa-run:'||
            framework_process_artifact.process_code||':'||e.evidence_process_version||':'||
            e.source_commit||':sha256:'||e.evidence_hash))
  INTO artifact_count,aligned_artifacts,promotable_artifacts
  FROM framework_process_artifact WHERE process_code='$PROCESS';

  IF step_count<>4 OR aligned_steps<>4 THEN
    RAISE EXCEPTION 'account recovery step contract incomplete total=% aligned=%',step_count,aligned_steps;
  END IF;
  IF contract_count<>4 OR implementation_contracts<>4 THEN
    RAISE EXCEPTION 'account recovery screen evidence incomplete total=% ready=%',contract_count,implementation_contracts;
  END IF;
  IF actual_steps<>4 THEN RAISE EXCEPTION 'account recovery business E2E incomplete actual=% expected=4',actual_steps; END IF;
  IF approved_cases<8 OR passed_cases<>approved_cases THEN
    RAISE EXCEPTION 'account recovery test cases incomplete passed=% approved=% minimum=8',passed_cases,approved_cases;
  END IF;
  IF approved_types<5 OR passed_types<>approved_types THEN
    RAISE EXCEPTION 'account recovery test types incomplete passed=% approved=% minimum=5',passed_types,approved_types;
  END IF;
  IF job_count<>43 OR promotable_jobs<>43 THEN
    RAISE EXCEPTION 'account recovery job evidence incomplete promotable=% total=% expected=43',promotable_jobs,job_count;
  END IF;
  IF artifact_count<>4 OR aligned_artifacts<>4 OR promotable_artifacts<>4 THEN
    RAISE EXCEPTION 'account recovery artifact evidence incomplete promotable=% aligned=% total=% expected=4',promotable_artifacts,aligned_artifacts,artifact_count;
  END IF;

  INSERT INTO framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  SELECT job_id,'ASSURANCE_VERIFIED',job_status,'VERIFIED','ACCOUNT_RECOVERY_ASSURANCE',
    '{\"sourceCommit\":\"$source_commit\",\"evidenceHash\":\"$evidence_sha\"}'
  FROM framework_development_job
  WHERE process_code='$PROCESS' AND required AND job_status='COMPLETED';

  UPDATE framework_development_job j
  SET job_status='VERIFIED',quality_status='VERIFIED',
      completed_at=coalesce(completed_at,current_timestamp),last_error=NULL,updated_at=current_timestamp
  WHERE process_code='$PROCESS' AND required AND job_status='COMPLETED'
    AND approval_status='APPROVED' AND quality_status='PASSED'
    AND evidence_ref LIKE 'qa-run:'||j.process_code||':'||process_version_value||':'||
      runtime_source_commit||':sha256:%'
    AND EXISTS (SELECT 1 FROM framework_current_business_e2e_evidence e
      WHERE e.process_code=j.process_code AND e.step_code=j.step_code
        AND e.business_test_result='PASSED' AND e.current_version
        AND e.source_commit=runtime_source_commit
        AND e.evidence_process_version=process_version_value
        AND j.evidence_ref='qa-run:'||j.process_code||':'||e.evidence_process_version||':'||
          e.source_commit||':sha256:'||e.evidence_hash)
    AND EXISTS (SELECT 1 FROM framework_development_job_gate_result g
                WHERE g.job_id=j.job_id AND g.result='PASSED'
                  AND g.evidence_ref=j.evidence_ref
                  AND g.evidence_ref LIKE 'qa-run:'||j.process_code||':'||process_version_value||':'||
                    runtime_source_commit||':sha256:%');

  UPDATE framework_process_artifact
  SET delivery_status='VERIFIED',updated_at=current_timestamp
  WHERE process_code='$PROCESS' AND required AND delivery_status='COMPLETED'
    AND evidence_ref LIKE 'qa-run:'||process_code||':'||process_version_value||':'||
      runtime_source_commit||':sha256:%'
    AND EXISTS (SELECT 1 FROM framework_current_business_e2e_evidence e
      WHERE e.process_code=framework_process_artifact.process_code
        AND e.step_code=framework_process_artifact.step_code
        AND e.business_test_result='PASSED' AND e.current_version
        AND e.source_commit=runtime_source_commit
        AND e.evidence_process_version=process_version_value
        AND framework_process_artifact.evidence_ref='qa-run:'||
          framework_process_artifact.process_code||':'||e.evidence_process_version||':'||
          e.source_commit||':sha256:'||e.evidence_hash);

  UPDATE framework_process_definition
  SET process_status='ACTIVE',definition_locked=true,updated_at=current_timestamp
  WHERE process_code='$PROCESS' AND process_version='3.0.0'
    AND process_status='IN_DEVELOPMENT' AND definition_locked;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account recovery process status promotion did not update exactly one eligible definition';
  END IF;

  IF (SELECT count(*) FROM framework_process_definition WHERE process_code='$PROCESS')<>1
      OR (SELECT count(*) FROM framework_process_definition
          WHERE process_code='$PROCESS' AND process_version='3.0.0'
            AND process_status='ACTIVE' AND definition_locked)<>1 THEN
    RAISE EXCEPTION 'account recovery post-promotion status mismatch';
  END IF;

  IF (SELECT count(*) FROM framework_development_job WHERE process_code='$PROCESS' AND required
      AND job_status='VERIFIED' AND approval_status='APPROVED' AND quality_status='VERIFIED')<>43 THEN
    RAISE EXCEPTION 'account recovery atomic promotion did not verify 43 jobs';
  END IF;
  IF (SELECT count(*) FROM framework_process_artifact WHERE process_code='$PROCESS' AND required
      AND delivery_status='VERIFIED')<>4 THEN
    RAISE EXCEPTION 'account recovery atomic promotion did not verify 4 artifacts';
  END IF;
END \$\$;
COMMIT;" >/dev/null

# The deploy lock is still held. A second full audit proves provider, release
# identity, case evidence, and persistent promotion state did not drift.
post_report="$(bash "$AUDIT_SCRIPT")"
jq -e --arg runtimeIdentityHash "$runtime_identity_hash" '.assuranceReady==true
  and .runtimeIdentityHash==$runtimeIdentityHash
  and .partialEvidence.jobs.verified==43
  and .partialEvidence.artifacts.verified==4
  and .partialEvidence.process.definitionCount==1
  and .partialEvidence.process.versionCount==1
  and .partialEvidence.process.processVersion=="3.0.0"
  and .partialEvidence.process.processStatus=="ACTIVE"
  and .partialEvidence.process.definitionLocked==true' <<<"$post_report" >/dev/null

jq -cn --arg processCode "$PROCESS" --arg sourceCommit "$source_commit" \
  --arg runtimeIdentityHash "$runtime_identity_hash" --arg evidenceHash "$evidence_sha" \
  '{status:"PROMOTED",processCode:$processCode,jobs:"43/43",steps:"4/4",sourceCommit:$sourceCommit,runtimeIdentityHash:$runtimeIdentityHash,evidenceHash:$evidenceHash}'
