-- A candidate evidence row proves a validation unit, but it does not by itself
-- prove whether the deployment attempt was abandoned or atomically promoted.
-- Persist one identity-bound lifecycle row per candidate so crash recovery can
-- distinguish STAGED, PROMOTED and ABORTED without inferring from files.

CREATE TABLE IF NOT EXISTS framework_postdeploy_release_attempt (
  candidate_id varchar(160) PRIMARY KEY,
  source_commit varchar(40) NOT NULL,
  attempt_status varchar(16) NOT NULL DEFAULT 'STAGED',
  runtime_identity_hash varchar(64),
  promotion_id bigint UNIQUE,
  terminal_reason varchar(160),
  staged_at timestamptz NOT NULL DEFAULT current_timestamp,
  terminal_at timestamptz,
  CONSTRAINT uq_postdeploy_attempt_identity UNIQUE(candidate_id,source_commit),
  CONSTRAINT ck_postdeploy_attempt_candidate CHECK (candidate_id ~ '^[A-Za-z0-9._:-]{12,160}$'),
  CONSTRAINT ck_postdeploy_attempt_commit CHECK (source_commit ~ '^[0-9a-f]{40}$'),
  CONSTRAINT ck_postdeploy_attempt_status CHECK (attempt_status IN ('STAGED','PROMOTED','ABORTED')),
  CONSTRAINT ck_postdeploy_attempt_runtime_hash CHECK (
    runtime_identity_hash IS NULL OR runtime_identity_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT ck_postdeploy_attempt_state_shape CHECK (
    (attempt_status='STAGED' AND runtime_identity_hash IS NULL AND promotion_id IS NULL
       AND terminal_reason IS NULL AND terminal_at IS NULL)
    OR
    (attempt_status='PROMOTED' AND runtime_identity_hash IS NOT NULL AND promotion_id IS NOT NULL
       AND terminal_reason='PROMOTION_COMMITTED' AND terminal_at IS NOT NULL)
    OR
    (attempt_status='ABORTED' AND promotion_id IS NULL
       AND terminal_reason ~ '^[A-Z0-9_:-]{3,160}$' AND terminal_at IS NOT NULL)
  )
);

-- A production upgraded from V20260812023000 can already contain immutable
-- candidate rows.  Canonical promotions become PROMOTED; every older orphan is
-- terminally ABORTED instead of being mistaken for a resumable live attempt.
INSERT INTO framework_postdeploy_release_attempt(
  candidate_id,source_commit,attempt_status,runtime_identity_hash,promotion_id,
  terminal_reason,staged_at,terminal_at
)
SELECT candidate.candidate_id,min(candidate.source_commit),
       CASE WHEN promotion.promotion_id IS NULL THEN 'ABORTED' ELSE 'PROMOTED' END,
       promotion.runtime_identity_hash,promotion.promotion_id,
       CASE WHEN promotion.promotion_id IS NULL
            THEN 'MIGRATION_BACKFILL_UNPROMOTED' ELSE 'PROMOTION_COMMITTED' END,
       min(candidate.staged_at),
       coalesce(promotion.promoted_at,current_timestamp)
FROM framework_postdeploy_evidence_candidate candidate
LEFT JOIN framework_postdeploy_evidence_promotion promotion
  ON promotion.candidate_id=candidate.candidate_id
 AND promotion.source_commit=candidate.source_commit
GROUP BY candidate.candidate_id,promotion.promotion_id,promotion.runtime_identity_hash,promotion.promoted_at
ON CONFLICT (candidate_id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='fk_postdeploy_candidate_attempt_identity'
      AND conrelid='framework_postdeploy_evidence_candidate'::regclass
  ) THEN
    ALTER TABLE framework_postdeploy_evidence_candidate
      ADD CONSTRAINT fk_postdeploy_candidate_attempt_identity
      FOREIGN KEY(candidate_id,source_commit)
      REFERENCES framework_postdeploy_release_attempt(candidate_id,source_commit)
      NOT VALID;
    ALTER TABLE framework_postdeploy_evidence_candidate
      VALIDATE CONSTRAINT fk_postdeploy_candidate_attempt_identity;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION framework_guard_postdeploy_release_attempt_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'postdeploy release attempt is immutable and cannot be deleted'
      USING ERRCODE='55000';
  END IF;
  IF OLD.candidate_id<>NEW.candidate_id OR OLD.source_commit<>NEW.source_commit
     OR OLD.staged_at<>NEW.staged_at THEN
    RAISE EXCEPTION 'postdeploy release attempt identity is immutable'
      USING ERRCODE='55000';
  END IF;
  IF OLD.attempt_status<>'STAGED'
     OR NEW.attempt_status NOT IN ('PROMOTED','ABORTED') THEN
    RAISE EXCEPTION 'postdeploy release attempt permits exactly one STAGED terminal transition'
      USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_postdeploy_release_attempt_immutable
  ON framework_postdeploy_release_attempt;
CREATE TRIGGER trg_postdeploy_release_attempt_immutable
  BEFORE UPDATE OR DELETE ON framework_postdeploy_release_attempt
  FOR EACH ROW EXECUTE FUNCTION framework_guard_postdeploy_release_attempt_mutation();

CREATE OR REPLACE FUNCTION framework_stage_postdeploy_release_attempt(
  p_candidate_id varchar,
  p_source_commit varchar
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE attempt framework_postdeploy_release_attempt%ROWTYPE;
BEGIN
  IF p_candidate_id IS NULL OR p_candidate_id !~ '^[A-Za-z0-9._:-]{12,160}$' THEN
    RAISE EXCEPTION 'postdeploy attempt candidate id is blank or invalid' USING ERRCODE='22023';
  END IF;
  IF p_source_commit IS NULL OR p_source_commit !~ '^[0-9a-f]{40}$' THEN
    RAISE EXCEPTION 'postdeploy attempt source commit is blank or invalid' USING ERRCODE='22023';
  END IF;

  INSERT INTO framework_postdeploy_release_attempt(candidate_id,source_commit)
  VALUES (p_candidate_id,p_source_commit)
  ON CONFLICT (candidate_id) DO NOTHING;

  SELECT * INTO attempt FROM framework_postdeploy_release_attempt
   WHERE candidate_id=p_candidate_id FOR UPDATE;
  IF NOT FOUND OR attempt.source_commit<>p_source_commit THEN
    RAISE EXCEPTION 'postdeploy attempt candidate/source identity collision'
      USING ERRCODE='23505';
  END IF;
  IF attempt.attempt_status<>'STAGED' THEN
    RAISE EXCEPTION 'postdeploy attempt is terminal status=% candidate=%',attempt.attempt_status,p_candidate_id
      USING ERRCODE='55000';
  END IF;
  RETURN jsonb_build_object(
    'status','STAGED','candidateId',attempt.candidate_id,
    'sourceCommit',attempt.source_commit,'stagedAt',attempt.staged_at
  );
END
$$;

CREATE OR REPLACE FUNCTION framework_abort_postdeploy_release_attempt(
  p_candidate_id varchar,
  p_source_commit varchar,
  p_runtime_identity_hash varchar,
  p_reason varchar
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE attempt framework_postdeploy_release_attempt%ROWTYPE; changed integer:=0;
BEGIN
  IF p_candidate_id IS NULL OR p_candidate_id !~ '^[A-Za-z0-9._:-]{12,160}$'
     OR p_source_commit IS NULL OR p_source_commit !~ '^[0-9a-f]{40}$'
     OR (p_runtime_identity_hash IS NOT NULL AND p_runtime_identity_hash !~ '^[0-9a-f]{64}$')
     OR p_reason IS NULL OR p_reason !~ '^[A-Z0-9_:-]{3,160}$' THEN
    RAISE EXCEPTION 'postdeploy abort identity or reason is invalid' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('postdeploy-evidence-promotion:'||p_source_commit));
  IF EXISTS (SELECT 1 FROM framework_postdeploy_evidence_promotion WHERE source_commit=p_source_commit) THEN
    RAISE EXCEPTION 'cannot abort a source commit with authoritative promotion'
      USING ERRCODE='55000';
  END IF;
  UPDATE framework_postdeploy_release_attempt
     SET attempt_status='ABORTED',runtime_identity_hash=p_runtime_identity_hash,
         terminal_reason=p_reason,terminal_at=current_timestamp
   WHERE candidate_id=p_candidate_id AND source_commit=p_source_commit
     AND attempt_status='STAGED';
  GET DIAGNOSTICS changed=ROW_COUNT;
  SELECT * INTO attempt FROM framework_postdeploy_release_attempt
   WHERE candidate_id=p_candidate_id FOR UPDATE;
  IF changed=0 AND (
       NOT FOUND OR attempt.source_commit<>p_source_commit OR attempt.attempt_status<>'ABORTED'
       OR attempt.runtime_identity_hash IS DISTINCT FROM p_runtime_identity_hash
       OR attempt.terminal_reason<>p_reason
     ) THEN
    RAISE EXCEPTION 'postdeploy attempt abort exact CAS failed candidate=%',p_candidate_id
      USING ERRCODE='40001';
  END IF;
  RETURN jsonb_build_object(
    'status','ABORTED','candidateId',attempt.candidate_id,'sourceCommit',attempt.source_commit,
    'runtimeIdentityHash',attempt.runtime_identity_hash,'reason',attempt.terminal_reason
  );
END
$$;

-- Preserve the fully validated V20260812023000 implementation as an internal
-- implementation.  The public wrapper below binds its atomic promotion to the
-- durable attempt state in the same PostgreSQL transaction.
DO $$
BEGIN
  IF to_regprocedure('framework_promote_postdeploy_evidence_candidate_v1(character varying,character varying,character varying)') IS NULL THEN
    ALTER FUNCTION framework_promote_postdeploy_evidence_candidate(varchar,varchar,varchar)
      RENAME TO framework_promote_postdeploy_evidence_candidate_v1;
  END IF;
END
$$;

-- The renamed implementation is an internal primitive. PostgreSQL grants
-- EXECUTE on new functions to PUBLIC by default; leaving that grant in place
-- would let an application role bypass the attempt lifecycle wrapper.
REVOKE ALL ON FUNCTION framework_promote_postdeploy_evidence_candidate_v1(varchar,varchar,varchar) FROM PUBLIC;
DO $$
DECLARE grantee_role name;
BEGIN
  FOR grantee_role IN
    SELECT pg_get_userbyid(acl.grantee)
    FROM pg_proc proc
    CROSS JOIN LATERAL aclexplode(coalesce(proc.proacl,acldefault('f',proc.proowner))) acl
    WHERE proc.oid='framework_promote_postdeploy_evidence_candidate_v1(varchar,varchar,varchar)'::regprocedure
      AND acl.grantee<>0 AND acl.grantee<>proc.proowner AND acl.privilege_type='EXECUTE'
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION framework_promote_postdeploy_evidence_candidate_v1(varchar,varchar,varchar) FROM %I',
      grantee_role
    );
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION framework_promote_postdeploy_evidence_candidate(
  p_candidate_id varchar,
  p_source_commit varchar,
  p_runtime_identity_hash varchar
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  attempt framework_postdeploy_release_attempt%ROWTYPE;
  promotion framework_postdeploy_evidence_promotion%ROWTYPE;
  result jsonb;
  canonical_candidate varchar;
  changed integer:=0;
BEGIN
  IF p_candidate_id IS NULL OR p_candidate_id !~ '^[A-Za-z0-9._:-]{12,160}$'
     OR p_source_commit IS NULL OR p_source_commit !~ '^[0-9a-f]{40}$'
     OR p_runtime_identity_hash IS NULL OR p_runtime_identity_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'postdeploy promotion attempt identity is invalid' USING ERRCODE='22023';
  END IF;

  -- All terminal writers serialize on the source before touching an attempt
  -- row.  The v1 promoter reacquires this transaction lock re-entrantly, so
  -- promote and abort can never invert row/advisory lock order.
  PERFORM pg_advisory_xact_lock(hashtext('postdeploy-evidence-promotion:'||p_source_commit));

  SELECT * INTO attempt FROM framework_postdeploy_release_attempt
   WHERE candidate_id=p_candidate_id FOR UPDATE;
  IF NOT FOUND OR attempt.source_commit<>p_source_commit THEN
    RAISE EXCEPTION 'postdeploy promotion has no exact staged attempt'
      USING ERRCODE='55000';
  END IF;
  IF attempt.attempt_status='ABORTED'
     AND attempt.terminal_reason<>'RECONCILED_TO_EXISTING_SOURCE_PROMOTION' THEN
    RAISE EXCEPTION 'aborted postdeploy attempt cannot be promoted'
      USING ERRCODE='55000';
  END IF;

  result:=framework_promote_postdeploy_evidence_candidate_v1(
    p_candidate_id,p_source_commit,p_runtime_identity_hash);
  IF result->>'status' NOT IN ('PROMOTED','ALREADY_PROMOTED') THEN
    RAISE EXCEPTION 'postdeploy implementation returned an unknown promotion status';
  END IF;
  canonical_candidate:=result->>'candidateId';
  SELECT * INTO promotion FROM framework_postdeploy_evidence_promotion
   WHERE source_commit=p_source_commit FOR SHARE;
  IF NOT FOUND OR promotion.candidate_id<>canonical_candidate
     OR promotion.runtime_identity_hash<>p_runtime_identity_hash THEN
    RAISE EXCEPTION 'promotion row/result/runtime identity divergence';
  END IF;

  IF canonical_candidate=p_candidate_id THEN
    UPDATE framework_postdeploy_release_attempt
       SET attempt_status='PROMOTED',runtime_identity_hash=p_runtime_identity_hash,
           promotion_id=promotion.promotion_id,terminal_reason='PROMOTION_COMMITTED',
           terminal_at=current_timestamp
     WHERE candidate_id=p_candidate_id AND source_commit=p_source_commit
       AND attempt_status='STAGED';
    GET DIAGNOSTICS changed=ROW_COUNT;
    SELECT * INTO attempt FROM framework_postdeploy_release_attempt
     WHERE candidate_id=p_candidate_id FOR UPDATE;
    IF changed=0 AND (
         attempt.attempt_status<>'PROMOTED'
         OR attempt.runtime_identity_hash<>p_runtime_identity_hash
         OR attempt.promotion_id<>promotion.promotion_id
       ) THEN
      RAISE EXCEPTION 'postdeploy attempt promotion exact CAS failed candidate=%',p_candidate_id
        USING ERRCODE='40001';
    END IF;
  ELSE
    UPDATE framework_postdeploy_release_attempt
       SET attempt_status='ABORTED',runtime_identity_hash=p_runtime_identity_hash,
           terminal_reason='RECONCILED_TO_EXISTING_SOURCE_PROMOTION',terminal_at=current_timestamp
     WHERE candidate_id=p_candidate_id AND source_commit=p_source_commit
       AND attempt_status='STAGED';
    GET DIAGNOSTICS changed=ROW_COUNT;
    SELECT * INTO attempt FROM framework_postdeploy_release_attempt
     WHERE candidate_id=p_candidate_id FOR UPDATE;
    IF changed=0 AND (
         attempt.attempt_status<>'ABORTED'
         OR attempt.runtime_identity_hash<>p_runtime_identity_hash
         OR attempt.terminal_reason<>'RECONCILED_TO_EXISTING_SOURCE_PROMOTION'
       ) THEN
      RAISE EXCEPTION 'postdeploy retry reconciliation exact CAS failed candidate=%',p_candidate_id
        USING ERRCODE='40001';
    END IF;
  END IF;

  RETURN result || jsonb_build_object(
    'requestedAttemptStatus',attempt.attempt_status,
    'requestedAttemptCandidateId',attempt.candidate_id
  );
END
$$;

COMMENT ON TABLE framework_postdeploy_release_attempt IS
  'Durable immutable identity and exact-CAS lifecycle for each postdeploy validation attempt.';
COMMENT ON FUNCTION framework_stage_postdeploy_release_attempt(varchar,varchar) IS
  'Idempotently creates only an exact STAGED candidate/source attempt.';
COMMENT ON FUNCTION framework_abort_postdeploy_release_attempt(varchar,varchar,varchar,varchar) IS
  'Exact-CAS STAGED to ABORTED transition, rejected after any source promotion.';
COMMENT ON FUNCTION framework_promote_postdeploy_evidence_candidate(varchar,varchar,varchar) IS
  'Atomic evidence promotion plus exact-CAS STAGED to PROMOTED lifecycle binding.';
