BEGIN;

DO $$
DECLARE
    project_a varchar(40) := 'TENANT-ISO-A';
    project_b varchar(40) := 'TENANT-ISO-B';
    visible_count integer;
BEGIN
    INSERT INTO emission_project_registry
      (project_id, tenant_id, project_name, site_name, calculation_period,
       scope_name, owner_name, current_step, project_status)
    VALUES
      (project_a, 'TENANT-A', '격리 검증 A', 'A 사업장', '2026', 'Scope 1', 'tester-a', '생성', '진행'),
      (project_b, 'TENANT-B', '격리 검증 B', 'B 사업장', '2026', 'Scope 1', 'tester-b', '생성', '진행');

    SELECT count(*) INTO visible_count
      FROM emission_project_registry
     WHERE tenant_id = 'TENANT-A';
    IF visible_count <> 1 THEN
        RAISE EXCEPTION 'TENANT-A project scope failed: %', visible_count;
    END IF;

    IF EXISTS (
        SELECT 1 FROM emission_project_registry
         WHERE project_id = project_b AND tenant_id = 'TENANT-A'
    ) THEN
        RAISE EXCEPTION 'cross tenant project access detected';
    END IF;
END $$;

ROLLBACK;
