-- One mutable queue row represents the current canonical generation revision.
-- Historical/noncanonical FULL_STACK_GENERATION jobs keep their existing keys.

DO $$
DECLARE duplicate_group record;
BEGIN
  SELECT process_code,step_code,count(*) job_count
    INTO duplicate_group
    FROM framework_development_job
   WHERE job_type='FULL_STACK_GENERATION'
     AND job_group_code=process_code||'_CANONICAL_PUBLICATION'
   GROUP BY process_code,step_code
  HAVING count(*)>1
   ORDER BY process_code,step_code
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'duplicate canonical generation jobs: % / % / %',
      duplicate_group.process_code,duplicate_group.step_code,
      duplicate_group.job_count USING ERRCODE='23505';
  END IF;
END
$$;

CREATE UNIQUE INDEX uq_framework_development_job_canonical_group
  ON framework_development_job(process_code,step_code)
  WHERE job_type='FULL_STACK_GENERATION'
    AND job_group_code=process_code||'_CANONICAL_PUBLICATION';

DO $$
BEGIN
  IF NOT EXISTS(
    SELECT 1
      FROM pg_index index_contract
     WHERE index_contract.indexrelid=to_regclass(
             'uq_framework_development_job_canonical_group')
       AND index_contract.indisunique
       AND index_contract.indisvalid
  ) THEN
    RAISE EXCEPTION 'canonical generation job unique index is not valid'
      USING ERRCODE='55000';
  END IF;
END
$$;
