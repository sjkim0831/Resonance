-- Stage A (expand/bridge): add a physical, rollback-compatible evidence count.
-- Contract bindings and assurance remain unchanged until the separate stage B.
SET lock_timeout='5s';
SET statement_timeout='30s';

DO $$
DECLARE
  evidence_type text;
  evidence_nullable text;
  existing_count integer;
BEGIN
  IF to_regclass('public.framework_process_work_draft') IS NULL THEN
    RAISE EXCEPTION 'framework_process_work_draft is missing';
  END IF;

  SELECT data_type,is_nullable
    INTO evidence_type,evidence_nullable
    FROM information_schema.columns
   WHERE table_schema='public'
     AND table_name='framework_process_work_draft'
     AND column_name='evidence_json';
  IF evidence_type IS DISTINCT FROM 'jsonb' OR evidence_nullable IS DISTINCT FROM 'NO' THEN
    RAISE EXCEPTION
      'framework_process_work_draft.evidence_json contract drifted: type=% nullable=%',
      evidence_type,evidence_nullable;
  END IF;

  SELECT count(*) INTO existing_count
    FROM information_schema.columns
   WHERE table_schema='public'
     AND table_name='framework_process_work_draft'
     AND column_name='evidence_count';
  IF existing_count<>0 THEN
    RAISE EXCEPTION 'framework_process_work_draft.evidence_count already exists';
  END IF;
END $$;

ALTER TABLE public.framework_process_work_draft
  ADD COLUMN evidence_count integer
  GENERATED ALWAYS AS (
    CASE WHEN (jsonb_typeof(evidence_json->'documentId')='string'
                 AND btrim(evidence_json->>'documentId', E' \t\n\r\f\v')<>'')
           OR (jsonb_typeof(evidence_json->'sourceUrl')='string'
                 AND btrim(evidence_json->>'sourceUrl', E' \t\n\r\f\v')<>'')
           OR (jsonb_typeof(evidence_json->'checksum')='string'
                 AND btrim(evidence_json->>'checksum', E' \t\n\r\f\v')<>'')
         THEN 1 ELSE 0 END
  ) STORED;

COMMENT ON COLUMN public.framework_process_work_draft.evidence_count IS
  'Generated 0/1 count for the single evidence object exposed as draft.evidenceCount; only official nonblank string properties qualify.';

DO $$
DECLARE
  generated_kind text;
  invalid_count integer;
BEGIN
  SELECT attgenerated INTO generated_kind
    FROM pg_attribute
   WHERE attrelid='public.framework_process_work_draft'::regclass
     AND attname='evidence_count'
     AND NOT attisdropped;
  SELECT count(*) INTO invalid_count
    FROM public.framework_process_work_draft
   WHERE evidence_count IS NULL OR evidence_count NOT IN(0,1);
  IF generated_kind IS DISTINCT FROM 's' OR invalid_count<>0 THEN
    RAISE EXCEPTION
      'work draft evidence_count postcondition failed: generated=% invalidRows=%',
      generated_kind,invalid_count;
  END IF;
END $$;

RESET statement_timeout;
RESET lock_timeout;
