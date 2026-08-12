#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260812023000__stage_and_atomically_promote_postdeploy_evidence.sql"
SCOPE_AUDIT_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260812033000__harden_scope_access_audit_append_only.sql"
LIFECYCLE_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260812080000__bind_postdeploy_attempt_lifecycle.sql"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DATABASE="${POSTGRES_DB:-carbonet}"
DATABASE_USER="${POSTGRES_ADMIN_USER:-postgres}"
CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
SOURCE_COMMIT="${POSTDEPLOY_CANDIDATE_TEST_COMMIT:-$(git -C "$ROOT" rev-parse HEAD)}"
[[ "$SOURCE_COMMIT" =~ ^[0-9a-f]{40}$ ]]
[[ -s "$MIGRATION" && -s "$SCOPE_AUDIT_MIGRATION" && -s "$LIFECYCLE_MIGRATION" ]]
leader="${RESONANCE_POSTGRES_LEADER_POD:-$(K8S_NAMESPACE="$NAMESPACE" bash "$ROOT/ops/scripts/resolve-patroni-primary-pod.sh")}"
[[ -n "$leader" ]]

{
printf '%s\n' "BEGIN;" "SET LOCAL lock_timeout='5s';" "SET LOCAL statement_timeout='120s';"
cat "$MIGRATION"
cat "$SCOPE_AUDIT_MIGRATION"
cat "$LIFECYCLE_MIGRATION"
cat <<'SQL'
SELECT set_config('resonance.postdeploy_test_commit',:'source_commit',false);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc proc
    CROSS JOIN LATERAL aclexplode(coalesce(proc.proacl,acldefault('f',proc.proowner))) acl
    WHERE proc.oid='framework_promote_postdeploy_evidence_candidate_v1(varchar,varchar,varchar)'::regprocedure
      AND acl.privilege_type='EXECUTE' AND acl.grantee<>proc.proowner
  ) THEN
    RAISE EXCEPTION 'internal v1 promoter remains executable outside its owner';
  END IF;
END
$$;

INSERT INTO framework_runtime_release_state(
  release_key,source_commit,deployment_namespace,deployment_name,deployment_uid,
  deployment_generation,observed_generation,desired_replicas,image_ref,image_id,
  health_status,recorded_by
) VALUES (
  'CARBONET_RUNTIME',:'source_commit','carbonet-prod','carbonet-runtime','candidate-test',
  1,1,1,'candidate-test','sha256:'||repeat('0',64),'UP','CANDIDATE_PROMOTION_TEST'
)
ON CONFLICT (release_key) DO UPDATE SET
  source_commit=excluded.source_commit,deployment_namespace=excluded.deployment_namespace,
  deployment_name=excluded.deployment_name,deployment_uid=excluded.deployment_uid,
  deployment_generation=excluded.deployment_generation,observed_generation=excluded.observed_generation,
  desired_replicas=excluded.desired_replicas,image_ref=excluded.image_ref,image_id=excluded.image_id,
  health_status=excluded.health_status,recorded_by=excluded.recorded_by,recorded_at=current_timestamp;

CREATE OR REPLACE FUNCTION pg_temp.postdeploy_runtime_identity_hash() RETURNS text
LANGUAGE sql AS $$
SELECT encode(sha256(convert_to(concat_ws('|',
  source_commit,deployment_namespace,deployment_name,deployment_uid,
  deployment_generation,observed_generation,desired_replicas,
  image_ref,image_id,health_status
),'UTF8')),'hex')
FROM framework_runtime_release_state
WHERE release_key='CARBONET_RUNTIME'
$$;

CREATE OR REPLACE FUNCTION pg_temp.postdeploy_current_digest() RETURNS text
LANGUAGE sql AS $$
SELECT encode(sha256(convert_to(concat_ws('|',
  coalesce((SELECT jsonb_agg(jsonb_build_array(job_id,job_status,approval_status,quality_status,evidence_ref,updated_at)
                    ORDER BY job_id)::text FROM framework_development_job
            WHERE process_code IN ('ACTIVITY_DATA','CUSTOMER_WORK_COORDINATION','EMISSION_CALCULATION','GOVERNANCE_CHANGE','ORGANIZATIONAL_BOUNDARY','REPORT_CERTIFICATION')),''),
  coalesce((SELECT jsonb_agg(jsonb_build_array(artifact_id,delivery_status,evidence_ref,updated_at)
                    ORDER BY artifact_id)::text FROM framework_process_artifact
            WHERE process_code IN ('ACTIVITY_DATA','CUSTOMER_WORK_COORDINATION','EMISSION_CALCULATION','GOVERNANCE_CHANGE','ORGANIZATIONAL_BOUNDARY','REPORT_CERTIFICATION')),''),
  coalesce((SELECT jsonb_agg(jsonb_build_array(process_code,definition_locked,process_status,updated_at)
                    ORDER BY process_code)::text FROM framework_process_definition
            WHERE process_code IN ('GOVERNANCE_CHANGE','ORGANIZATIONAL_BOUNDARY')),''),
  (SELECT count(*)::text FROM framework_customer_journey_validation_run),
  (SELECT count(*)::text FROM framework_activity_runtime_validation_run),
  (SELECT count(*)::text FROM framework_organizational_boundary_runtime_validation_run),
  (SELECT count(*)::text FROM framework_simulation_run),
  (SELECT count(*)::text FROM framework_postdeploy_evidence_promotion)
),'UTF8')),'hex')
$$;

CREATE TEMP TABLE postdeploy_units(unit_code text,process_code text,evidence_kind text);
INSERT INTO postdeploy_units VALUES
 ('ACTIVITY_DATA_RUNTIME','ACTIVITY_DATA','RUNTIME'),
 ('ACTIVITY_DATA_STATIC','ACTIVITY_DATA','STATIC'),
 ('ACTOR_ACCOUNT_CUSTOMER_JOURNEY','CUSTOMER_WORK_COORDINATION','RUNTIME'),
 ('CUSTOMER_WORK_COORDINATION_RUNTIME','CUSTOMER_WORK_COORDINATION','RUNTIME'),
 ('EMISSION_CALCULATION_RUNTIME','EMISSION_CALCULATION','RUNTIME'),
 ('EMISSION_CALCULATION_STATIC','EMISSION_CALCULATION','STATIC'),
 ('GOVERNANCE_CHANGE_RUNTIME','GOVERNANCE_CHANGE','RUNTIME'),
 ('OPERATIONAL_USAGE_LEDGER_GATE','__RELEASE__','RELEASE_GATE'),
 ('ORGANIZATIONAL_BOUNDARY_RUNTIME','ORGANIZATIONAL_BOUNDARY','RUNTIME'),
 ('REPORT_CERTIFICATION_RUNTIME','REPORT_CERTIFICATION','RUNTIME'),
 ('REPORT_CERTIFICATION_STATIC','REPORT_CERTIFICATION','STATIC'),
 ('SCREEN_CONTRACT_RUNTIME_SAVE_PREVIEW','__RELEASE__','RELEASE_GATE');

SELECT framework_stage_postdeploy_release_attempt(candidate_id,current_setting('resonance.postdeploy_test_commit'))
FROM (VALUES
  ('candidate-test-split-a'),('candidate-test-split-b'),('candidate-test-complete'),
  ('candidate-test-retry-complete'),('candidate-test-reduced-hash')
) attempt(candidate_id);

-- Candidate audit evidence is bound to the V330 authoritative row. Explicit
-- ids avoid advancing the non-transactional production sequence in this
-- rollback-only contract test.
INSERT INTO framework_scope_access_audit(
  audit_id,account_id,tenant_id,project_id,decision_code,reason_code,
  action_code,resource_type,created_at
) VALUES
 (9000000000000000101,'qadata26','TENANT-CANDIDATE','PRJ-CANDIDATE-DENIED','DENIED',
  'PROJECT_TENANT_SCOPE_DENIED','PROJECT_PARTICIPANT_READ','EMISSION_PROJECT',timestamp '2026-08-12 02:30:00.000001'),
 (9000000000000000102,'qacalc26','TENANT-CANDIDATE','PRJ-CANDIDATE-TEST','DENIED',
  'ACTOR_NOT_AUTHORIZED:APPROVER|VERIFIER','REGULATORY_SUBMISSION_TRANSITION','REGULATORY_SUBMISSION',timestamp '2026-08-12 02:30:00.000002');

CREATE OR REPLACE FUNCTION pg_temp.postdeploy_unit_evidence(
  p_unit text,p_process text,p_kind text,p_variant integer,p_reduced_hash boolean
) RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
SELECT jsonb_build_object(
    'status','PASS','unitCode',p_unit,'processCode',p_process,'evidenceKind',p_kind,
    'sourceCommit',current_setting('resonance.postdeploy_test_commit'),
    'projectId','PRJ-CANDIDATE-TEST',
    'runtimeEvidence',CASE
      WHEN p_unit='GOVERNANCE_CHANGE_RUNTIME' THEN format('/tmp/candidate-%s-governance.json',p_variant)
      WHEN p_unit='ORGANIZATIONAL_BOUNDARY_RUNTIME' THEN format('/tmp/candidate-%s-boundary.json',p_variant)
      ELSE format('/tmp/candidate-%s.json',p_variant)
    END,
    'runtimeEvidenceHash',repeat(CASE WHEN p_variant=1 THEN '1' ELSE '2' END,64),
    'actorCount',6,'taskCount',7,
    'authenticatedApiCount',1,'protectedApiCount',1,'pageCount',1,'p95Millis',p_variant,'readyReplicas',1,
    'freshRuntimeAssertions',true,
    'runtimeCaseTypes',jsonb_build_array('HAPPY_PATH','AUTHORITY','ISOLATION','RECOVERY','EXCEPTION')
  ) || CASE p_unit
    WHEN 'ACTOR_ACCOUNT_CUSTOMER_JOURNEY' THEN jsonb_build_object(
      'mutableBusinessWrites',0,'mutableBusinessHashBefore',repeat('a',64),'mutableBusinessHashAfter',repeat('a',64),
      'securityAuditAppendDelta',2,'scopeAuditIdDelta',1,'actorAuditIdDelta',1,
      'securityAuditTypes',jsonb_build_array('PROJECT_SCOPE_DENIED','ACTOR_ROLE_DENIED'),
      'draftMutation','SKIPPED_CANDIDATE_READ_ONLY','authTokenBaseline',0,'authTokenAfter',0,
      'authTokenCleanupVerified',true,
      'securityAuditEvidence',(
        SELECT jsonb_agg(jsonb_build_object(
          'schemaVersion',audit.schema_version,'auditId',audit.audit_id,
          'rowHash',CASE WHEN p_reduced_hash THEN encode(sha256(convert_to(concat_ws('|',
            audit.audit_id,lower(audit.account_id),audit.tenant_id,audit.project_id,
            audit.decision_code,audit.reason_code),'UTF8')),'hex') ELSE audit.row_hash END,
          'accountId',audit.account_id,'tenantId',audit.tenant_id,'projectId',audit.project_id,
          'decisionCode',audit.decision_code,'reasonCode',audit.reason_code,
          'actionCode',audit.action_code,'resourceType',audit.resource_type,'outcomeCode',audit.outcome_code
        ) ORDER BY audit.audit_id)
        FROM framework_scope_access_audit audit
        WHERE audit.audit_id IN (9000000000000000101,9000000000000000102)
      )
    )
    WHEN 'SCREEN_CONTRACT_RUNTIME_SAVE_PREVIEW' THEN jsonb_build_object(
      'previewCount',3,'rolledBack',true,'canonicalStateUnchanged',true,'databaseCurrentWrites',0,
      'databaseStateHashBefore',repeat('3',64),'databaseStateHashAfter',repeat('3',64),
      'contractHashBefore',repeat('4',64),'contractHashAfter',repeat('4',64),
      'runtimeHashBefore',repeat('5',64),'runtimeHashAfter',repeat('5',64)
    )
    WHEN 'OPERATIONAL_USAGE_LEDGER_GATE' THEN jsonb_build_object(
      'allowedRole','SYSTEM_ADMIN_FAMILY','anonymousDenied',2,'ordinaryDenied',7,'browserViewports',2,
      'persistentFixtures',0,'reviewCreateReloadIdempotencyCleanup',true,'totalSteps',572,'pages',3,'durationSeconds',1
    )
    ELSE '{}'::jsonb
  END
$$;

-- Two incomplete attempt ids prove that rows from concurrent/retried attempts
-- can never be combined into one promotable 12-unit candidate.
INSERT INTO framework_postdeploy_evidence_candidate(
  candidate_id,unit_code,process_code,evidence_kind,source_commit,evidence_json,evidence_hash
)
SELECT 'candidate-test-split-a',unit_code,process_code,evidence_kind,current_setting('resonance.postdeploy_test_commit'),
       jsonb_build_object('status','PASS','unitCode',unit_code,'processCode',process_code,
         'evidenceKind',evidence_kind,'sourceCommit',current_setting('resonance.postdeploy_test_commit'),
         'projectId','PRJ-CANDIDATE-TEST','runtimeEvidence','/tmp/candidate-test.json',
         'authenticatedApiCount',1,'protectedApiCount',1,'pageCount',1,'p95Millis',1,'readyReplicas',1),''
FROM postdeploy_units ORDER BY unit_code LIMIT 6;
INSERT INTO framework_postdeploy_evidence_candidate(
  candidate_id,unit_code,process_code,evidence_kind,source_commit,evidence_json,evidence_hash
)
SELECT 'candidate-test-split-b',unit_code,process_code,evidence_kind,current_setting('resonance.postdeploy_test_commit'),
       jsonb_build_object('status','PASS','unitCode',unit_code,'processCode',process_code,
         'evidenceKind',evidence_kind,'sourceCommit',current_setting('resonance.postdeploy_test_commit'),
         'projectId','PRJ-CANDIDATE-TEST','runtimeEvidence','/tmp/candidate-test.json',
         'authenticatedApiCount',1,'protectedApiCount',1,'pageCount',1,'p95Millis',1,'readyReplicas',1),''
FROM postdeploy_units ORDER BY unit_code OFFSET 6;

CREATE TEMP TABLE failed_before AS SELECT pg_temp.postdeploy_current_digest() digest;
DO $$
DECLARE rejected boolean:=false;
BEGIN
  BEGIN
    PERFORM framework_promote_postdeploy_evidence_candidate(
      'candidate-test-split-a',current_setting('resonance.postdeploy_test_commit'),
      pg_temp.postdeploy_runtime_identity_hash());
  EXCEPTION WHEN OTHERS THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'incomplete candidate unexpectedly promoted'; END IF;
  rejected:=false;
  BEGIN
    PERFORM framework_promote_postdeploy_evidence_candidate(
      'candidate-test-split-b',current_setting('resonance.postdeploy_test_commit'),
      pg_temp.postdeploy_runtime_identity_hash());
  EXCEPTION WHEN OTHERS THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'second incomplete candidate unexpectedly promoted'; END IF;
END
$$;
DO $$
BEGIN
  IF (SELECT digest FROM failed_before)<>pg_temp.postdeploy_current_digest() THEN
    RAISE EXCEPTION 'failed candidate changed current evidence';
  END IF;
END
$$;

-- A complete attempt promotes exactly 12 units and 6 processes.  Every
-- business row written below remains inside this transaction and is rolled
-- back at the end of the executable PostgreSQL contract test.
INSERT INTO framework_postdeploy_evidence_candidate(
  candidate_id,unit_code,process_code,evidence_kind,source_commit,evidence_json,evidence_hash
)
SELECT 'candidate-test-complete',unit_code,process_code,evidence_kind,current_setting('resonance.postdeploy_test_commit'),
       pg_temp.postdeploy_unit_evidence(unit_code,process_code,evidence_kind,1,false),''
FROM postdeploy_units;

-- A second complete attempt for the same source commit must remain a valid
-- immutable candidate, but it must reconcile to the first promotion rather
-- than appending a second set of current validation/simulation evidence.
INSERT INTO framework_postdeploy_evidence_candidate(
  candidate_id,unit_code,process_code,evidence_kind,source_commit,evidence_json,evidence_hash
)
SELECT 'candidate-test-retry-complete',unit_code,process_code,evidence_kind,current_setting('resonance.postdeploy_test_commit'),
       pg_temp.postdeploy_unit_evidence(unit_code,process_code,evidence_kind,2,false),''
FROM postdeploy_units;

-- Mutation proof: a 64-character hash recomputed from the old reduced six
-- fields looks plausible but is not the database-authored V330 row_hash.
INSERT INTO framework_postdeploy_evidence_candidate(
  candidate_id,unit_code,process_code,evidence_kind,source_commit,evidence_json,evidence_hash
)
SELECT 'candidate-test-reduced-hash',unit_code,process_code,evidence_kind,current_setting('resonance.postdeploy_test_commit'),
       pg_temp.postdeploy_unit_evidence(unit_code,process_code,evidence_kind,3,true),''
FROM postdeploy_units;

DO $$
DECLARE rejected boolean:=false; rejection_message text:=''; before_digest text:=pg_temp.postdeploy_current_digest();
BEGIN
  BEGIN
    PERFORM framework_promote_postdeploy_evidence_candidate(
      'candidate-test-reduced-hash',current_setting('resonance.postdeploy_test_commit'),
      pg_temp.postdeploy_runtime_identity_hash());
  EXCEPTION WHEN OTHERS THEN
    rejected:=true;
    rejection_message:=SQLERRM;
  END;
  IF NOT rejected OR position('actor-account security audit row/hash no longer matches candidate evidence' in rejection_message)=0 THEN
    RAISE EXCEPTION 'reduced/stale row hash mutation was not rejected by authoritative DB comparison: %',rejection_message;
  END IF;
  IF before_digest<>pg_temp.postdeploy_current_digest() THEN
    RAISE EXCEPTION 'reduced row hash rejection changed current evidence';
  END IF;
END
$$;

DO $$
DECLARE rejected boolean:=false; before_digest text:=pg_temp.postdeploy_current_digest();
BEGIN
  BEGIN
    PERFORM framework_promote_postdeploy_evidence_candidate(
      'candidate-test-complete',current_setting('resonance.postdeploy_test_commit'),repeat('f',64));
  EXCEPTION WHEN OTHERS THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'mismatched runtime identity hash was accepted'; END IF;
  IF before_digest<>pg_temp.postdeploy_current_digest() THEN
    RAISE EXCEPTION 'runtime identity rejection changed current evidence';
  END IF;
END
$$;

CREATE TEMP TABLE evidence_counts_before AS
SELECT
 (SELECT count(*) FROM framework_customer_journey_validation_run) customer_count,
 (SELECT count(*) FROM framework_activity_runtime_validation_run) activity_count,
 (SELECT count(*) FROM framework_organizational_boundary_runtime_validation_run) boundary_count,
 (SELECT count(*) FROM framework_simulation_run) simulation_count,
 (SELECT count(*) FROM framework_postdeploy_evidence_promotion) promotion_count;

CREATE TEMP TABLE promotion_result AS
SELECT framework_promote_postdeploy_evidence_candidate(
  'candidate-test-complete',current_setting('resonance.postdeploy_test_commit'),
  pg_temp.postdeploy_runtime_identity_hash()) result;

DO $$
DECLARE before_row evidence_counts_before%ROWTYPE; promoted jsonb;
BEGIN
  SELECT * INTO before_row FROM evidence_counts_before;
  SELECT result INTO promoted FROM promotion_result;
  IF promoted->>'status'<>'PROMOTED' OR (promoted->>'processCount')::integer<>6
     OR (promoted->>'unitCount')::integer<>12
     OR (promoted->>'promotedDefinitionCount')::integer<>2
     OR (promoted->>'appendedValidationCount')::integer<>3
     OR (promoted->>'appendedSimulationCount')::integer<>0 THEN
    RAISE EXCEPTION 'exact promotion result mismatch: %',promoted;
  END IF;
  IF (SELECT count(*) FROM framework_customer_journey_validation_run)<>before_row.customer_count+1
     OR (SELECT count(*) FROM framework_activity_runtime_validation_run)<>before_row.activity_count+1
     OR (SELECT count(*) FROM framework_organizational_boundary_runtime_validation_run)<>before_row.boundary_count+1
     OR (SELECT count(*) FROM framework_simulation_run)<>before_row.simulation_count
     OR (SELECT count(*) FROM framework_postdeploy_evidence_promotion)<>before_row.promotion_count+1 THEN
    RAISE EXCEPTION 'promotion append cardinality mismatch';
  END IF;
END
$$;

CREATE TEMP TABLE promoted_once_digest AS SELECT pg_temp.postdeploy_current_digest() digest;

DO $$
DECLARE canonical framework_postdeploy_release_attempt%ROWTYPE;
BEGIN
  SELECT * INTO canonical FROM framework_postdeploy_release_attempt
   WHERE candidate_id='candidate-test-complete';
  IF canonical.attempt_status<>'PROMOTED'
     OR canonical.runtime_identity_hash<>pg_temp.postdeploy_runtime_identity_hash()
     OR canonical.promotion_id IS NULL OR canonical.terminal_reason<>'PROMOTION_COMMITTED' THEN
    RAISE EXCEPTION 'canonical attempt lifecycle was not atomically promoted';
  END IF;
END
$$;

-- The same candidate and a different attempt id for the same commit are both
-- idempotent.  The canonical first candidate remains authoritative and no
-- second validation, simulation, event, or promotion row can be appended.
DO $$
DECLARE replay jsonb; retry_replay jsonb; stale_rejected boolean:=false;
        stale_runtime_rejected boolean:=false;
BEGIN
  replay:=framework_promote_postdeploy_evidence_candidate(
    'candidate-test-complete',current_setting('resonance.postdeploy_test_commit'),
    pg_temp.postdeploy_runtime_identity_hash());
  IF replay->>'status'<>'ALREADY_PROMOTED' THEN RAISE EXCEPTION 'promotion replay is not idempotent'; END IF;
  retry_replay:=framework_promote_postdeploy_evidence_candidate(
    'candidate-test-retry-complete',current_setting('resonance.postdeploy_test_commit'),
    pg_temp.postdeploy_runtime_identity_hash());
  IF retry_replay->>'status'<>'ALREADY_PROMOTED'
     OR retry_replay->>'candidateId'<>'candidate-test-complete'
     OR retry_replay->>'requestedCandidateId'<>'candidate-test-retry-complete' THEN
    RAISE EXCEPTION 'different candidate retry did not reconcile to canonical promotion: %',retry_replay;
  END IF;
  IF (SELECT attempt_status FROM framework_postdeploy_release_attempt
      WHERE candidate_id='candidate-test-retry-complete')<>'ABORTED'
     OR (SELECT terminal_reason FROM framework_postdeploy_release_attempt
         WHERE candidate_id='candidate-test-retry-complete')<>'RECONCILED_TO_EXISTING_SOURCE_PROMOTION' THEN
    RAISE EXCEPTION 'same-source retry attempt was not terminally reconciled';
  END IF;
  IF (SELECT digest FROM promoted_once_digest)<>pg_temp.postdeploy_current_digest() THEN
    RAISE EXCEPTION 'same-commit retry appended duplicate current evidence';
  END IF;
  BEGIN
    PERFORM framework_promote_postdeploy_evidence_candidate(
      'candidate-test-retry-complete',current_setting('resonance.postdeploy_test_commit'),repeat('e',64));
  EXCEPTION WHEN OTHERS THEN stale_runtime_rejected:=true;
  END;
  IF NOT stale_runtime_rejected THEN
    RAISE EXCEPTION 'existing promotion bypassed current runtime identity verification';
  END IF;
  BEGIN
    PERFORM framework_promote_postdeploy_evidence_candidate(
      'candidate-test-complete',repeat('1',40),pg_temp.postdeploy_runtime_identity_hash());
  EXCEPTION WHEN OTHERS THEN stale_rejected:=true;
  END;
  IF NOT stale_rejected THEN RAISE EXCEPTION 'stale commit replay was accepted'; END IF;
END
$$;

DO $$
DECLARE aborted jsonb; replay jsonb; rejected boolean:=false;
BEGIN
  PERFORM framework_stage_postdeploy_release_attempt('candidate-test-abort-cas',repeat('9',40));
  aborted:=framework_abort_postdeploy_release_attempt(
    'candidate-test-abort-cas',repeat('9',40),NULL,'VALIDATION_FAILED');
  replay:=framework_abort_postdeploy_release_attempt(
    'candidate-test-abort-cas',repeat('9',40),NULL,'VALIDATION_FAILED');
  IF aborted->>'status'<>'ABORTED' OR replay<>aborted THEN
    RAISE EXCEPTION 'attempt abort exact replay mismatch';
  END IF;
  BEGIN
    PERFORM framework_abort_postdeploy_release_attempt(
      'candidate-test-abort-cas',repeat('9',40),NULL,'OTHER_FAILURE');
  EXCEPTION WHEN OTHERS THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'divergent abort CAS unexpectedly succeeded'; END IF;
  rejected:=false;
  BEGIN
    UPDATE framework_postdeploy_release_attempt SET terminal_reason='MUTATED'
    WHERE candidate_id='candidate-test-complete';
  EXCEPTION WHEN OTHERS THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'terminal attempt mutation unexpectedly succeeded'; END IF;
END
$$;

ROLLBACK;
\echo POSTDEPLOY_CANDIDATE_POSTGRES_PASS units=12 processes=6 failedCandidates=3 reducedRowHashRejected=1 currentMutation=rollback-only simulationsFabricated=0 staleRejected=1 retryDifferentCandidate=1 runtimeIdentityBound=1 lifecycleCAS=STAGED_PROMOTED_ABORTED internalV1Execute=ownerOnly
SQL
} | kubectl -n "$NAMESPACE" exec -i "$leader" -c "$CONTAINER" -- \
  psql -h 127.0.0.1 -U "$DATABASE_USER" -d "$DATABASE" -X -v ON_ERROR_STOP=1 \
    -v source_commit="$SOURCE_COMMIT"
