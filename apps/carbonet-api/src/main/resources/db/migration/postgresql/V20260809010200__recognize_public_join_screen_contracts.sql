DO $align_public_screen_assurance$
DECLARE
  view_sql text;
  old_signature text := 'c.audience::text = ''USER''::text';
  new_signature text := '(c.audience::text = ''USER''::text OR (c.audience::text = ''PUBLIC''::text AND lower(split_part(s.user_path::text, ''?''::text, 1)) LIKE ''/join/%''::text))';
BEGIN
  SELECT pg_get_viewdef('framework_process_design_assurance_matrix'::regclass,true)
    INTO view_sql;
  IF strpos(view_sql,old_signature)=0 THEN
    RAISE EXCEPTION 'DESIGN_ASSURANCE_USER_AUDIENCE_SIGNATURE_CHANGED';
  END IF;
  view_sql := replace(view_sql,old_signature,new_signature);
  EXECUTE 'CREATE OR REPLACE VIEW framework_process_design_assurance_matrix AS '||view_sql;
END
$align_public_screen_assurance$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM framework_process_design_assurance_matrix
    WHERE process_code='COMPANY_REAPPLICATION_PUBLIC'
      AND missing_user_screen_contract_count<>0
  ) THEN
    RAISE EXCEPTION 'public join screen contract is not recognized by design assurance';
  END IF;
END $$;
