ALTER TABLE framework_identity_actor_assignment_link
    ADD COLUMN IF NOT EXISTS tenant_id varchar(100);

ALTER TABLE framework_identity_actor_assignment_link
    ADD COLUMN IF NOT EXISTS project_id varchar(100);

UPDATE framework_identity_actor_assignment_link link
   SET tenant_id = assignment.tenant_id,
       project_id = assignment.project_id
  FROM framework_account_actor_assignment assignment
 WHERE assignment.assignment_id = link.assignment_id
   AND (link.tenant_id IS NULL OR link.project_id IS NULL);

UPDATE framework_identity_actor_assignment_link
   SET tenant_id = coalesce(tenant_id, 'DEFAULT'),
       project_id = coalesce(project_id, '*');

ALTER TABLE framework_identity_actor_assignment_link
    ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE framework_identity_actor_assignment_link
    ALTER COLUMN project_id SET NOT NULL;

DO $migration$
DECLARE
    primary_key_name text;
BEGIN
    SELECT constraint_name
      INTO primary_key_name
      FROM information_schema.table_constraints
     WHERE table_schema = current_schema()
       AND table_name = 'framework_identity_actor_assignment_link'
       AND constraint_type = 'PRIMARY KEY';

    IF primary_key_name IS NOT NULL THEN
        EXECUTE format(
            'ALTER TABLE framework_identity_actor_assignment_link DROP CONSTRAINT %I',
            primary_key_name
        );
    END IF;
END
$migration$;

ALTER TABLE framework_identity_actor_assignment_link
    ADD PRIMARY KEY(account_id, group_name, actor_code, tenant_id, project_id);

CREATE INDEX IF NOT EXISTS idx_identity_assignment_link_scope
    ON framework_identity_actor_assignment_link(
        account_id, tenant_id, project_id, active_yn
    );

COMMENT ON COLUMN framework_identity_actor_assignment_link.tenant_id IS
    'Keycloak account attribute based tenant boundary';

COMMENT ON COLUMN framework_identity_actor_assignment_link.project_id IS
    'Keycloak account attribute based project boundary';
