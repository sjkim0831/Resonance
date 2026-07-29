CREATE TABLE IF NOT EXISTS framework_scope_access_audit (
    audit_id bigserial PRIMARY KEY,
    account_id varchar(100) NOT NULL,
    tenant_id varchar(100) NOT NULL,
    project_id varchar(100) NOT NULL,
    decision_code varchar(20) NOT NULL,
    reason_code varchar(200) NOT NULL,
    created_at timestamp NOT NULL DEFAULT current_timestamp,
    CONSTRAINT chk_scope_access_audit_decision
        CHECK (decision_code IN ('ALLOWED', 'DENIED'))
);

CREATE INDEX IF NOT EXISTS idx_scope_access_audit_account_time
    ON framework_scope_access_audit(account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scope_access_audit_project_time
    ON framework_scope_access_audit(tenant_id, project_id, created_at DESC);

COMMENT ON TABLE framework_scope_access_audit IS
    'Fail-closed tenant, project and data scope authorization decisions';

UPDATE framework_process_artifact
   SET delivery_status = 'IMPLEMENTED',
       acceptance_criteria =
           'Keycloak account scope and actor capability are intersected; list, direct URL, task, file and report APIs fail closed with 403 and denial audit evidence',
       evidence_ref =
           'EmissionProjectRegistryService.assertProjectParticipant+validate-actor-account-customer-journey',
       updated_at = current_timestamp
 WHERE process_code = 'EMISSION_PROJECT'
   AND artifact_code IN ('EP-AUTH', 'EP-TEST-SECURITY');
