ALTER TABLE emission_project_registry
    ADD COLUMN IF NOT EXISTS tenant_id varchar(100);

UPDATE emission_project_registry p
SET tenant_id = coalesce(
    (SELECT nullif(s.tenant_id, '')
       FROM emission_activity_submission s
      WHERE s.project_id = p.project_id
      ORDER BY s.created_at
      LIMIT 1),
    (SELECT nullif(a.tenant_id, '')
       FROM framework_account_actor_assignment a
      WHERE a.project_id = p.project_id
        AND a.assignment_status = 'ACTIVE'
      ORDER BY a.assignment_id
      LIMIT 1),
    'DEFAULT')
WHERE tenant_id IS NULL OR tenant_id = '';

ALTER TABLE emission_project_registry
    ALTER COLUMN tenant_id SET DEFAULT 'DEFAULT',
    ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_emission_project_registry_tenant
    ON emission_project_registry(tenant_id, project_status, due_date);

CREATE UNIQUE INDEX IF NOT EXISTS uq_emission_project_tenant_name
    ON emission_project_registry(tenant_id, lower(trim(project_name)));

COMMENT ON COLUMN emission_project_registry.tenant_id IS
    '인증 컨텍스트의 기관 식별자. 모든 프로젝트 하위 데이터 접근 범위의 기준';
