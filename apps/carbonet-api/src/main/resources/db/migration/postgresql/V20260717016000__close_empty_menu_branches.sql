DO $$
DECLARE
  affected integer;
BEGIN
  LOOP
    UPDATE comtnmenuinfo m SET expsr_at='N',last_updt_pnttm=current_timestamp
    WHERE m.use_at='Y' AND coalesce(m.expsr_at,'Y')='Y'
      AND btrim(coalesce(m.menu_url,'')) IN ('','#')
      AND NOT EXISTS (
        SELECT 1 FROM comtnmenuinfo child
        WHERE child.menu_code LIKE m.menu_code||'%'
          AND length(child.menu_code)>length(m.menu_code)
          AND child.use_at='Y' AND coalesce(child.expsr_at,'Y')='Y'
      );
    GET DIAGNOSTICS affected = ROW_COUNT;
    EXIT WHEN affected = 0;
  END LOOP;
END $$;
