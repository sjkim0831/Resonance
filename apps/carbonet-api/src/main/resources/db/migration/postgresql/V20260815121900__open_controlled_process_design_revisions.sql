-- Retire the legacy per-step MD5 writer.  source_hash now identifies the
-- process-wide canonical generation head and is synchronized by the direct
-- generation coordinator after all executable contracts are refreshed.
DROP TRIGGER IF EXISTS trg_zzz_framework_refresh_step_execution_source_hash
  ON public.framework_step_execution_spec;

-- Seed the internal capability once. Runtime imports and the recovery loop are
-- read-only with respect to this singleton so independent process imports do
-- not serialize on a global work-type row.
INSERT INTO public.framework_business_work_type(
  work_type_code,work_type_name,work_type_name_en,description,sort_order,use_at
)
VALUES(
  'REQUIREMENT_AUTOMATION','요구분석 자동 개발','Requirement Automation',
  '요구분석서에서 검증된 실행 설계와 개발 작업',5,'N'
)
ON CONFLICT(work_type_code) DO UPDATE SET
  work_type_name=excluded.work_type_name,
  work_type_name_en=excluded.work_type_name_en,
  description=excluded.description,
  sort_order=excluded.sort_order,
  use_at='N',
  updated_at=current_timestamp;

-- Presentation order allocation is deliberately sequence-backed.  The old
-- max(workflow_order)+10 writer held one global advisory lock for the whole
-- requirement import and serialized otherwise independent processes.
CREATE SEQUENCE IF NOT EXISTS public.framework_business_workflow_order_seq
  AS integer INCREMENT BY 10 MINVALUE 10 START WITH 10;
DO $$
DECLARE next_order integer;
BEGIN
  SELECT greatest(coalesce(max(workflow_order),0)+10,10)
    INTO next_order FROM public.framework_business_process_sequence;
  PERFORM setval('public.framework_business_workflow_order_seq'::regclass,
    next_order,false);
END
$$;

CREATE OR REPLACE FUNCTION public.framework_allocate_requirement_process_sequence(
  requested_process text
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE allocated_order integer;
BEGIN
  IF requested_process IS NULL OR requested_process<>btrim(requested_process)
     OR requested_process!~'^[A-Z][A-Z0-9_:-]{1,79}$' THEN
    RAISE EXCEPTION 'invalid requirement process sequence identity'
      USING ERRCODE='22023';
  END IF;
  INSERT INTO public.framework_business_process_sequence(
    work_type_code,process_code,workflow_order,workflow_phase,process_role,
    prerequisite_process_codes,next_process_code,sequence_status)
  VALUES('DATA_GOVERNANCE',requested_process,
    nextval('public.framework_business_workflow_order_seq'),
    'REQUIREMENT_DELIVERY','ENTRY','','','ACTIVE')
  ON CONFLICT(process_code) DO UPDATE SET
    work_type_code='DATA_GOVERNANCE',
    workflow_order=CASE
      WHEN public.framework_business_process_sequence.work_type_code='DATA_GOVERNANCE'
        THEN public.framework_business_process_sequence.workflow_order
      ELSE excluded.workflow_order END,
    workflow_phase=excluded.workflow_phase,process_role=excluded.process_role,
    prerequisite_process_codes=excluded.prerequisite_process_codes,
    next_process_code=excluded.next_process_code,
    sequence_status=excluded.sequence_status,updated_at=current_timestamp
  RETURNING workflow_order INTO allocated_order;
  RETURN allocated_order;
END
$$;

CREATE TABLE IF NOT EXISTS public.framework_process_design_revision_lease(
  backend_pid integer NOT NULL,
  transaction_id bigint NOT NULL,
  process_code varchar(80) NOT NULL,
  requested_actor varchar(100) NOT NULL,
  opened_at timestamp NOT NULL DEFAULT current_timestamp,
  PRIMARY KEY(backend_pid,transaction_id,process_code)
);
REVOKE ALL ON TABLE public.framework_process_design_revision_lease FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.framework_process_structure_hash(
  requested_process text
)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT encode(sha256(convert_to(jsonb_build_object(
    'process',to_jsonb(process)-'process_version'-'definition_locked'-
      'definition_lock_reason'-'created_at'-'updated_at',
    'steps',coalesce((
      SELECT jsonb_agg(to_jsonb(step)-'step_id'-'created_at'-'updated_at'
        ORDER BY step.step_order,step.step_code COLLATE "C")
        FROM public.framework_process_step step
       WHERE step.process_code=process.process_code),'[]'::jsonb))::text,'UTF8')),'hex')
    FROM public.framework_process_definition process
   WHERE process.process_code=requested_process
$$;

-- A controlled revision is transaction-local and process-scoped.  The
-- original guards remain fail-closed for every caller that did not enter the
-- narrow begin/finalize workflow.
CREATE OR REPLACE FUNCTION public.framework_guard_locked_process_definition()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE revision_allowed boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.framework_process_design_revision_lease lease
     WHERE lease.backend_pid=pg_backend_pid()
       AND lease.transaction_id=txid_current()
       AND lease.process_code=OLD.process_code)
    INTO revision_allowed;
  IF TG_OP='DELETE' AND OLD.definition_locked
     AND NOT revision_allowed THEN
    RAISE EXCEPTION 'Implemented process % is read-only',OLD.process_code
      USING ERRCODE='55000';
  END IF;
  IF TG_OP='UPDATE' AND OLD.definition_locked
     AND NOT revision_allowed AND (
       NEW.process_code IS DISTINCT FROM OLD.process_code OR
       NEW.process_name IS DISTINCT FROM OLD.process_name OR
       NEW.domain_code IS DISTINCT FROM OLD.domain_code OR
       NEW.process_version IS DISTINCT FROM OLD.process_version OR
       NEW.goal IS DISTINCT FROM OLD.goal OR
       NEW.start_condition IS DISTINCT FROM OLD.start_condition OR
       NEW.completion_condition IS DISTINCT FROM OLD.completion_condition OR
       NEW.definition_locked IS DISTINCT FROM OLD.definition_locked OR
       NEW.definition_lock_reason IS DISTINCT FROM OLD.definition_lock_reason) THEN
    RAISE EXCEPTION 'Implemented process % structure is read-only',OLD.process_code
      USING ERRCODE='55000';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.framework_guard_locked_process_step()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE target_process_code text;
DECLARE target_locked boolean;
DECLARE revision_allowed boolean;
BEGIN
  target_process_code:=CASE WHEN TG_OP='DELETE'
    THEN OLD.process_code ELSE NEW.process_code END;
  SELECT definition_locked INTO target_locked
    FROM public.framework_process_definition
   WHERE process_code=target_process_code;
  SELECT EXISTS(
    SELECT 1 FROM public.framework_process_design_revision_lease lease
     WHERE lease.backend_pid=pg_backend_pid()
       AND lease.transaction_id=txid_current()
       AND lease.process_code=target_process_code)
    INTO revision_allowed;
  IF coalesce(target_locked,false)
     AND NOT revision_allowed THEN
    RAISE EXCEPTION 'Implemented process % steps are read-only',target_process_code
      USING ERRCODE='55000';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.framework_guard_locked_simulation_case()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE target_process_code text;
DECLARE target_locked boolean;
DECLARE revision_allowed boolean;
BEGIN
  target_process_code:=CASE WHEN TG_OP='DELETE'
    THEN OLD.process_code ELSE NEW.process_code END;
  SELECT definition_locked INTO target_locked
    FROM public.framework_process_definition
   WHERE process_code=target_process_code;
  SELECT EXISTS(
    SELECT 1 FROM public.framework_process_design_revision_lease lease
     WHERE lease.backend_pid=pg_backend_pid()
       AND lease.transaction_id=txid_current()
       AND lease.process_code=target_process_code)
    INTO revision_allowed;
  IF NOT coalesce(target_locked,false)
     OR revision_allowed THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP IN('INSERT','DELETE') OR (
       NEW.case_code IS DISTINCT FROM OLD.case_code OR
       NEW.process_code IS DISTINCT FROM OLD.process_code OR
       NEW.case_name IS DISTINCT FROM OLD.case_name OR
       NEW.case_type IS DISTINCT FROM OLD.case_type OR
       NEW.preconditions IS DISTINCT FROM OLD.preconditions OR
       NEW.steps_json IS DISTINCT FROM OLD.steps_json OR
       NEW.assertions_json IS DISTINCT FROM OLD.assertions_json) THEN
    RAISE EXCEPTION 'Implemented process % simulation contract is read-only',
      target_process_code USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.framework_begin_process_design_revision(
  requested_process text,
  revision_actor text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE process_row record;
DECLARE baseline_hash text;
BEGIN
  IF requested_process IS NULL OR requested_process<>btrim(requested_process)
     OR requested_process!~'^[A-Z][A-Z0-9_:-]{1,79}$'
     OR revision_actor IS NULL OR revision_actor<>btrim(revision_actor)
     OR btrim(revision_actor)='' OR length(revision_actor)>100 THEN
    RAISE EXCEPTION 'invalid controlled design revision identity'
      USING ERRCODE='22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'CANONICAL_PROCESS_PUBLICATION_V1:'||upper(btrim(requested_process)),0));
  SELECT process_code,process_version,definition_locked,definition_lock_reason
    INTO process_row
    FROM public.framework_process_definition
   WHERE process_code=requested_process
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('processCode',requested_process,'exists',false,
      'revisionOpened',false);
  END IF;
  IF process_row.definition_lock_reason LIKE 'DESIGN_REVISION_V1:%' THEN
    baseline_hash:=split_part(process_row.definition_lock_reason,':',2);
  ELSE
    baseline_hash:=public.framework_process_structure_hash(requested_process);
  END IF;
  IF baseline_hash!~'^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'controlled design revision baseline is invalid: %',
      requested_process USING ERRCODE='22023';
  END IF;
  DELETE FROM public.framework_process_design_revision_lease lease
   WHERE lease.backend_pid=pg_backend_pid()
     AND lease.transaction_id<>txid_current();
  INSERT INTO public.framework_process_design_revision_lease(
    backend_pid,transaction_id,process_code,requested_actor)
  VALUES(pg_backend_pid(),txid_current(),requested_process,revision_actor)
  ON CONFLICT(backend_pid,transaction_id,process_code) DO UPDATE
    SET requested_actor=excluded.requested_actor,opened_at=current_timestamp;
  UPDATE public.framework_process_definition
     SET definition_locked=false,
         definition_lock_reason='DESIGN_REVISION_V1:'||baseline_hash,
         updated_at=current_timestamp
   WHERE process_code=requested_process;
  RETURN jsonb_build_object('processCode',requested_process,'exists',true,
    'revisionOpened',true,'wasLocked',process_row.definition_locked,
    'processVersion',process_row.process_version,'baselineHash',baseline_hash,
    'openedBy',revision_actor);
END
$$;

CREATE OR REPLACE FUNCTION public.framework_finalize_process_design_revision(
  requested_process text,
  revision_actor text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE process_row record;
DECLARE baseline_hash text;
DECLARE current_hash text;
DECLARE next_version text;
DECLARE defined_count integer;
DECLARE exact_count integer;
BEGIN
  IF requested_process IS NULL OR requested_process<>btrim(requested_process)
     OR requested_process!~'^[A-Z][A-Z0-9_:-]{1,79}$'
     OR revision_actor IS NULL OR revision_actor<>btrim(revision_actor)
     OR btrim(revision_actor)='' OR length(revision_actor)>100 THEN
    RAISE EXCEPTION 'invalid controlled design finalization identity'
      USING ERRCODE='22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'CANONICAL_PROCESS_PUBLICATION_V1:'||upper(btrim(requested_process)),0));
  IF NOT EXISTS(
    SELECT 1 FROM public.framework_process_design_revision_lease lease
     WHERE lease.backend_pid=pg_backend_pid()
       AND lease.transaction_id=txid_current()
       AND lease.process_code=requested_process
       AND lease.requested_actor=revision_actor
  ) THEN
    RAISE EXCEPTION 'controlled process design revision lease is required: %',
      requested_process USING ERRCODE='42501';
  END IF;
  SELECT process_code,process_version,definition_lock_reason
    INTO process_row
    FROM public.framework_process_definition
   WHERE process_code=requested_process
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'process design finalization identity not found: %',
      requested_process USING ERRCODE='P0002';
  END IF;
  SELECT count(*)::integer INTO defined_count
    FROM public.framework_process_step WHERE process_code=requested_process;
  SELECT count(*)::integer INTO exact_count
    FROM public.framework_step_execution_spec
   WHERE process_code=requested_process
     AND design_status='DESIGN_COMPLETE'
     AND blocker_codes='[]'::jsonb;
  IF defined_count=0 OR exact_count<>defined_count THEN
    RAISE EXCEPTION 'process design revision is incomplete: % / % / %',
      requested_process,defined_count,exact_count USING ERRCODE='55000';
  END IF;
  baseline_hash:=CASE
    WHEN process_row.definition_lock_reason LIKE 'DESIGN_REVISION_V1:%'
      THEN split_part(process_row.definition_lock_reason,':',2)
    ELSE public.framework_process_structure_hash(requested_process) END;
  current_hash:=public.framework_process_structure_hash(requested_process);
  IF baseline_hash!~'^[0-9a-f]{64}$' OR current_hash!~'^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'process design revision hash is invalid: %',requested_process
      USING ERRCODE='22023';
  END IF;
  next_version:=process_row.process_version;
  IF current_hash<>baseline_hash THEN
    IF process_row.process_version~'^[0-9]+[.][0-9]+[.][0-9]+$' THEN
      next_version:=split_part(process_row.process_version,'.',1)||'.'||
        split_part(process_row.process_version,'.',2)||'.'||
        ((split_part(process_row.process_version,'.',3)::integer)+1)::text;
    ELSE
      RAISE EXCEPTION 'process version is not semantic: % / %',
        requested_process,process_row.process_version USING ERRCODE='22023';
    END IF;
  END IF;
  UPDATE public.framework_process_definition
     SET process_version=next_version,definition_locked=true,
         definition_lock_reason='CONTROLLED_DESIGN_REVISION_APPROVED',
         updated_at=current_timestamp
   WHERE process_code=requested_process;
  DELETE FROM public.framework_process_design_revision_lease lease
   WHERE lease.backend_pid=pg_backend_pid()
     AND lease.transaction_id=txid_current()
     AND lease.process_code=requested_process;
  RETURN jsonb_build_object('processCode',requested_process,'finalized',true,
    'changed',current_hash<>baseline_hash,'processVersion',next_version,
    'finalizedBy',revision_actor);
END
$$;

CREATE OR REPLACE FUNCTION public.framework_close_process_design_revision(
  requested_process text,
  revision_actor text
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE removed_count integer;
BEGIN
  IF requested_process IS NULL OR requested_process<>btrim(requested_process)
     OR requested_process!~'^[A-Z][A-Z0-9_:-]{1,79}$'
     OR revision_actor IS NULL OR revision_actor<>btrim(revision_actor)
     OR btrim(revision_actor)='' OR length(revision_actor)>100 THEN
    RAISE EXCEPTION 'invalid controlled design revision close identity'
      USING ERRCODE='22023';
  END IF;
  DELETE FROM public.framework_process_design_revision_lease lease
   WHERE lease.backend_pid=pg_backend_pid()
     AND lease.transaction_id=txid_current()
     AND lease.process_code=requested_process
     AND lease.requested_actor=revision_actor;
  GET DIAGNOSTICS removed_count=ROW_COUNT;
  RETURN removed_count=1;
END
$$;

REVOKE ALL ON FUNCTION public.framework_process_structure_hash(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_begin_process_design_revision(text,text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_finalize_process_design_revision(text,text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_close_process_design_revision(text,text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.framework_allocate_requirement_process_sequence(text)
  FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='carbonet_app') THEN
    GRANT EXECUTE ON FUNCTION public.framework_begin_process_design_revision(text,text)
      TO carbonet_app;
    GRANT EXECUTE ON FUNCTION public.framework_finalize_process_design_revision(text,text)
      TO carbonet_app;
    GRANT EXECUTE ON FUNCTION public.framework_close_process_design_revision(text,text)
      TO carbonet_app;
    GRANT EXECUTE ON FUNCTION public.framework_allocate_requirement_process_sequence(text)
      TO carbonet_app;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM pg_trigger
     WHERE tgrelid='public.framework_step_execution_spec'::regclass
       AND tgname='trg_zzz_framework_refresh_step_execution_source_hash'
       AND NOT tgisinternal
  ) OR has_function_privilege('public',
       'public.framework_begin_process_design_revision(text,text)','EXECUTE')
     OR has_function_privilege('public',
       'public.framework_finalize_process_design_revision(text,text)','EXECUTE')
     OR has_function_privilege('public',
       'public.framework_close_process_design_revision(text,text)','EXECUTE')
     OR has_function_privilege('public',
       'public.framework_allocate_requirement_process_sequence(text)','EXECUTE')
     OR has_table_privilege('public',
       'public.framework_process_design_revision_lease','SELECT') THEN
    RAISE EXCEPTION 'controlled process design revision postcondition failed'
      USING ERRCODE='42501';
  END IF;
END
$$;
