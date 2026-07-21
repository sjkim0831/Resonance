DO $$
DECLARE
    conflict_count integer;
BEGIN
    SELECT count(*) INTO conflict_count
      FROM framework_registered_source_route_conflict;

    IF conflict_count <> 0 THEN
        RAISE EXCEPTION 'registered source routes overridden by generated runtime: %', conflict_count;
    END IF;
END;
$$;
