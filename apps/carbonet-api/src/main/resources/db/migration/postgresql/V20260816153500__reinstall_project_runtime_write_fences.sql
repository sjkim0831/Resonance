-- Re-run the idempotent fence installer after composite-design tables are
-- present.  This migration intentionally contains no alternate policy: the
-- V20260816134500 contract remains the single authority for write fencing.
DO $$
BEGIN
  IF to_regprocedure('framework_install_project_runtime_write_fences()') IS NULL THEN
    RAISE EXCEPTION 'project runtime write-fence installer is missing'
      USING ERRCODE='55000';
  END IF;
  PERFORM framework_install_project_runtime_write_fences();
END
$$;
