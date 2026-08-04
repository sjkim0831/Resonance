CREATE TABLE IF NOT EXISTS framework_screen_contract_version (
  version_id bigserial PRIMARY KEY,
  contract_id bigint NOT NULL REFERENCES framework_professional_screen_contract(contract_id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  contract_json jsonb NOT NULL,
  contract_hash varchar(64) NOT NULL,
  version_status varchar(20) NOT NULL DEFAULT 'PUBLISHED'
    CHECK (version_status IN ('DRAFT','PUBLISHED','RETIRED')),
  created_by varchar(100) NOT NULL DEFAULT 'SYSTEM',
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  published_at timestamp,
  UNIQUE(contract_id,version_no),
  UNIQUE(contract_id,contract_hash)
);

CREATE TABLE IF NOT EXISTS framework_screen_contract_binding (
  screen_key varchar(160) PRIMARY KEY,
  contract_id bigint NOT NULL REFERENCES framework_professional_screen_contract(contract_id) ON DELETE CASCADE,
  route_path varchar(400) NOT NULL,
  active_version_id bigint REFERENCES framework_screen_contract_version(version_id),
  previous_version_id bigint REFERENCES framework_screen_contract_version(version_id),
  cache_epoch bigint NOT NULL DEFAULT 1,
  updated_by varchar(100) NOT NULL DEFAULT 'SYSTEM',
  updated_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_screen_contract_binding_route
  ON framework_screen_contract_binding(lower(split_part(route_path,'?',1)));

CREATE TABLE IF NOT EXISTS framework_screen_contract_event (
  event_id bigserial PRIMARY KEY,
  screen_key varchar(160) NOT NULL REFERENCES framework_screen_contract_binding(screen_key) ON DELETE CASCADE,
  event_type varchar(20) NOT NULL CHECK (event_type IN ('PUBLISH','ROLLBACK','RECOVER')),
  from_version_id bigint,
  to_version_id bigint NOT NULL,
  actor_id varchar(100) NOT NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT current_timestamp
);

WITH source_contract AS (
  SELECT c.contract_id,
         jsonb_build_object(
           'schemaVersion','1.0',
           'screen',jsonb_build_object(
             'screenKey',upper(c.process_code||'__'||c.step_code||'__'||c.audience),
             'name',c.screen_name,'route',lower(split_part(c.route_path,'?',1)),
             'audience',c.audience),
           'data',jsonb_build_object(
             'fields',framework_try_jsonb(c.field_contract),
             'contract',framework_try_jsonb(c.data_contract)),
           'ui',jsonb_build_object(
             'sections',framework_try_jsonb(c.section_contract),
             'responsive',c.responsive_contract,
             'accessibility',c.accessibility_contract),
           'action',jsonb_build_object(
             'commands',framework_try_jsonb(c.command_contract),
             'apis',framework_try_jsonb(c.api_contract)),
           'process',jsonb_build_object(
             'processCode',c.process_code,'stepCode',c.step_code,
             'entryCondition',c.entry_condition,'exitCondition',c.exit_condition,
             'states',framework_try_jsonb(c.state_contract)),
           'permission',jsonb_build_object(
             'actorCode',c.actor_code,'audience',c.audience,
             'security',c.security_contract),
           'test',jsonb_build_object(
             'evidence',framework_try_jsonb(c.evidence_contract),
             'apiVerified',c.api_verified,'databaseVerified',c.database_verified,
             'authorityVerified',c.authority_verified,
             'responsiveVerified',c.responsive_verified,
             'accessibilityVerified',c.accessibility_verified,
             'exceptionStatesVerified',c.exception_states_verified),
           'operations',jsonb_build_object(
             'contractStatus',c.contract_status,'auditEvidenceRef',c.audit_evidence_ref,
             'updatedAt',c.updated_at)
         ) AS payload
    FROM framework_professional_screen_contract c
), inserted AS (
  INSERT INTO framework_screen_contract_version(
    contract_id,version_no,contract_json,contract_hash,version_status,created_by,published_at)
  SELECT contract_id,1,payload,md5(payload::text),'PUBLISHED','SYSTEM',current_timestamp
    FROM source_contract
  ON CONFLICT(contract_id,version_no) DO NOTHING
  RETURNING version_id
)
INSERT INTO framework_screen_contract_binding(
  screen_key,contract_id,route_path,active_version_id,updated_by)
SELECT upper(c.process_code||'__'||c.step_code||'__'||c.audience),c.contract_id,
       lower(split_part(c.route_path,'?',1)),v.version_id,'SYSTEM'
  FROM framework_professional_screen_contract c
  JOIN framework_screen_contract_version v ON v.contract_id=c.contract_id AND v.version_no=1
ON CONFLICT(screen_key) DO UPDATE SET
  contract_id=excluded.contract_id,
  route_path=excluded.route_path,
  active_version_id=coalesce(framework_screen_contract_binding.active_version_id,excluded.active_version_id),
  updated_at=current_timestamp;

INSERT INTO framework_screen_contract_binding(
  screen_key,contract_id,route_path,active_version_id,updated_by)
SELECT 'EMISSION_PROJECT_CREATE_V1',c.contract_id,lower(split_part(c.route_path,'?',1)),v.version_id,'SYSTEM'
  FROM framework_professional_screen_contract c
  JOIN framework_screen_contract_version v ON v.contract_id=c.contract_id AND v.version_no=1
 WHERE c.process_code='EMISSION_PROJECT'
   AND c.step_code='EMISSION_PROJECT_SETUP'
   AND c.audience='USER'
   AND lower(split_part(c.route_path,'?',1))='/emission/project/create'
 ORDER BY c.contract_id
 LIMIT 1
ON CONFLICT(screen_key) DO UPDATE SET
  contract_id=excluded.contract_id,
  route_path=excluded.route_path,
  active_version_id=coalesce(framework_screen_contract_binding.active_version_id,excluded.active_version_id),
  updated_at=current_timestamp;

