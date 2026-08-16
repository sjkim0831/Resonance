\set ON_ERROR_STOP on

CREATE ROLE carbonet_app NOLOGIN;

CREATE TABLE comtnemplyrinfo(
  esntl_id varchar(80) PRIMARY KEY,
  emplyr_id varchar(120) NOT NULL UNIQUE,
  emplyr_sttus_code varchar(8) NOT NULL
);
CREATE TABLE comtnentrprsmber(
  esntl_id varchar(80) PRIMARY KEY,
  entrprs_mber_id varchar(120) NOT NULL UNIQUE,
  entrprs_mber_sttus varchar(8) NOT NULL
);
CREATE TABLE comtnemplyrscrtyestbs(
  scrty_dtrmn_trget_id varchar(80) NOT NULL,
  author_code varchar(80) NOT NULL,
  PRIMARY KEY(scrty_dtrmn_trget_id,author_code)
);

-- This is the minimum pre-upgrade catalog shared by the real V134500 purge
-- installer and the real V154000 composite compiler.  It intentionally does
-- not model any table introduced by V154000.
CREATE TABLE framework_process_definition(
  process_code varchar(80) PRIMARY KEY,
  process_name varchar(160) NOT NULL,
  domain_code varchar(60) NOT NULL,
  owner_actor_code varchar(120) NOT NULL,
  process_version varchar(20) NOT NULL,
  goal text NOT NULL,
  start_condition text NOT NULL,
  completion_condition text NOT NULL,
  process_status varchar(30) NOT NULL,
  lifecycle_status varchar(30) NOT NULL,
  parent_process_code varchar(80),
  definition_locked boolean NOT NULL DEFAULT false,
  definition_lock_reason text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE framework_process_design_revision_lease(
  backend_pid integer NOT NULL,
  transaction_id bigint NOT NULL,
  process_code varchar(80) NOT NULL,
  requested_actor varchar(100) NOT NULL,
  opened_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY(backend_pid,transaction_id,process_code)
);
CREATE TABLE framework_process_step(
  step_id bigserial PRIMARY KEY,
  process_code varchar(80) NOT NULL
    REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
  step_code varchar(80) NOT NULL,
  step_order integer NOT NULL,
  actor_code varchar(120) NOT NULL,
  step_name varchar(160) NOT NULL,
  command_code varchar(120) NOT NULL,
  from_state varchar(120) NOT NULL,
  to_state varchar(120) NOT NULL,
  completion_rule text NOT NULL,
  decision_rule text NOT NULL,
  requires_notification boolean NOT NULL,
  input_contract text NOT NULL,
  output_contract text NOT NULL,
  requires_user_page boolean NOT NULL,
  requires_admin_page boolean NOT NULL,
  user_path text,
  admin_path text,
  escalation_actor_code text,
  segregation_actor_codes text NOT NULL DEFAULT '',
  UNIQUE(process_code,step_code)
);
CREATE TABLE framework_simulation_case(
  case_code varchar(100) PRIMARY KEY,
  process_code varchar(80) NOT NULL
    REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
  case_name varchar(180) NOT NULL,
  case_type varchar(30) NOT NULL,
  preconditions text NOT NULL,
  steps_json text NOT NULL,
  assertions_json text NOT NULL
);
CREATE TABLE framework_step_execution_spec(
  process_code varchar(80) NOT NULL,
  step_code varchar(80) NOT NULL,
  PRIMARY KEY(process_code,step_code)
);
CREATE TABLE framework_step_schema_set(
  process_code varchar(80) NOT NULL,
  step_code varchar(80) NOT NULL,
  PRIMARY KEY(process_code,step_code)
);
CREATE TABLE framework_permission_requirement_v1(
  process_code varchar(80) NOT NULL,
  step_code varchar(80) NOT NULL,
  permission_code text NOT NULL,
  scope_type text NOT NULL
);
CREATE TABLE framework_permission_grant_v1(
  actor_code text NOT NULL,
  permission_code text NOT NULL,
  scope_type text NOT NULL,
  effect text NOT NULL
);

CREATE TABLE framework_professional_screen_contract(
  contract_id bigserial PRIMARY KEY,
  process_code text NOT NULL,
  step_code text NOT NULL,
  route_path text NOT NULL,
  audience text NOT NULL,
  actor_code text NOT NULL,
  business_purpose text NOT NULL,
  entry_condition text NOT NULL,
  exit_condition text NOT NULL,
  kpi_contract text NOT NULL,
  section_contract text NOT NULL,
  field_contract text NOT NULL,
  command_contract text NOT NULL,
  state_contract text NOT NULL,
  api_contract text NOT NULL,
  data_contract text NOT NULL,
  evidence_contract text NOT NULL,
  responsive_contract text NOT NULL,
  accessibility_contract text NOT NULL,
  security_contract text NOT NULL,
  permission_codes jsonb NOT NULL,
  api_verified boolean NOT NULL,
  database_verified boolean NOT NULL,
  authority_verified boolean NOT NULL,
  responsive_verified boolean NOT NULL,
  accessibility_verified boolean NOT NULL,
  exception_states_verified boolean NOT NULL,
  audit_evidence_ref text NOT NULL,
  updated_by text NOT NULL
);
CREATE TABLE framework_screen_resource(
  screen_resource_id bigserial PRIMARY KEY,
  route_key text NOT NULL,
  layout_type text NOT NULL
);
CREATE TABLE framework_process_step_screen_binding(
  process_code text NOT NULL,
  step_code text NOT NULL,
  screen_resource_id bigint NOT NULL,
  actor_code text NOT NULL,
  audience text NOT NULL,
  binding_status text NOT NULL
);
CREATE TABLE comtnthemedefinition(
  theme_id text PRIMARY KEY,
  use_at char(1),
  is_active char(1)
);
CREATE TABLE ui_section_registry(section_id text PRIMARY KEY,active_yn char(1));
CREATE TABLE ui_component_registry(
  component_id text PRIMARY KEY,
  component_type text NOT NULL,
  active_yn char(1)
);

CREATE TABLE framework_screen_blueprint(
  blueprint_id bigserial PRIMARY KEY,
  process_code varchar(80) NOT NULL
    REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
  step_code varchar(80) NOT NULL,
  audience text NOT NULL,
  route_path text NOT NULL,
  actor_code text NOT NULL,
  validation_status text NOT NULL,
  transition_status text NOT NULL,
  source_reference text NOT NULL,
  implementation_strategy text NOT NULL,
  specification_json text NOT NULL,
  created_by varchar(100) NOT NULL,
  FOREIGN KEY(process_code,step_code)
    REFERENCES framework_process_step(process_code,step_code) ON DELETE CASCADE
);
CREATE TABLE framework_screen_generation_state(
  blueprint_id bigint PRIMARY KEY
    REFERENCES framework_screen_blueprint(blueprint_id) ON DELETE CASCADE,
  ownership_mode varchar(16) NOT NULL,
  design_hash varchar(64) NOT NULL DEFAULT repeat('1',64),
  generated_hash varchar(64),
  sync_status varchar(16) NOT NULL DEFAULT 'DIRTY',
  generated_at timestamp,
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE framework_screen_feature_binding(
  process_code varchar(80) NOT NULL,
  step_code varchar(80) NOT NULL,
  feature_code varchar(80) NOT NULL,
  PRIMARY KEY(process_code,step_code,feature_code),
  FOREIGN KEY(process_code,step_code)
    REFERENCES framework_process_step(process_code,step_code) ON DELETE CASCADE
);

CREATE TABLE framework_actor_process_design_release(
  project_id varchar(64) NOT NULL,
  design_version integer NOT NULL,
  contract_sha256 char(64) NOT NULL,
  contract_payload jsonb NOT NULL,
  source_system varchar(32) NOT NULL DEFAULT 'BACKSTAGE',
  release_status varchar(32) NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  generation_result jsonb,
  PRIMARY KEY(project_id,design_version)
);
CREATE TABLE framework_process_execution(
  execution_id uuid PRIMARY KEY,
  project_id varchar(100) NOT NULL,
  process_code varchar(80) NOT NULL
    REFERENCES framework_process_definition(process_code),
  current_step_code varchar(80) NOT NULL,
  FOREIGN KEY(process_code,current_step_code)
    REFERENCES framework_process_step(process_code,step_code)
);
CREATE TABLE framework_process_execution_event(
  event_id bigserial PRIMARY KEY,
  execution_id uuid NOT NULL
    REFERENCES framework_process_execution(execution_id) ON DELETE CASCADE,
  result_json jsonb NOT NULL
);
CREATE TABLE framework_process_work_draft(
  draft_id uuid PRIMARY KEY,
  project_id varchar(100) NOT NULL,
  process_code varchar(80) NOT NULL,
  step_code varchar(80) NOT NULL,
  payload_json jsonb NOT NULL,
  evidence_json jsonb NOT NULL,
  FOREIGN KEY(process_code,step_code)
    REFERENCES framework_process_step(process_code,step_code)
);
CREATE TABLE framework_account_actor_assignment(
  assignment_id bigserial PRIMARY KEY,
  tenant_id varchar(100) NOT NULL DEFAULT 'TENANT_TEST',
  project_id varchar(100) NOT NULL,
  account_id varchar(100) NOT NULL,
  actor_code varchar(120) NOT NULL,
  assignment_status varchar(30) NOT NULL DEFAULT 'ACTIVE',
  valid_from date,
  valid_until date
);
CREATE TABLE framework_project_actor_assignment(
  project_id varchar(100) NOT NULL,
  actor_code varchar(120) NOT NULL,
  user_id varchar(100) NOT NULL,
  active_yn char(1) NOT NULL DEFAULT 'Y',
  PRIMARY KEY(project_id,actor_code,user_id)
);
CREATE TABLE framework_development_job(
  job_id bigserial PRIMARY KEY,
  process_code varchar(80) NOT NULL
    REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
  step_code varchar(80),
  created_by varchar(100) NOT NULL,
  job_status varchar(30) NOT NULL DEFAULT 'PLANNED',
  FOREIGN KEY(process_code,step_code)
    REFERENCES framework_process_step(process_code,step_code) ON DELETE CASCADE
);
CREATE TABLE framework_development_job_event(
  event_id bigserial PRIMARY KEY,
  job_id bigint NOT NULL
    REFERENCES framework_development_job(job_id) ON DELETE CASCADE
);

CREATE TABLE framework_source_artifact(
  source_artifact_id bigserial PRIMARY KEY,
  source_path text NOT NULL UNIQUE,
  ownership_mode varchar(16) NOT NULL,
  metadata_json jsonb NOT NULL
);
CREATE TABLE framework_source_artifact_version(
  source_artifact_id bigint NOT NULL
    REFERENCES framework_source_artifact(source_artifact_id) ON DELETE CASCADE,
  revision integer NOT NULL,
  PRIMARY KEY(source_artifact_id,revision)
);
CREATE TABLE framework_source_materialization_state(
  source_artifact_id bigint PRIMARY KEY
    REFERENCES framework_source_artifact(source_artifact_id) ON DELETE CASCADE,
  source_hash varchar(64) NOT NULL DEFAULT repeat('2',64),
  materialized_hash varchar(64),
  sync_status varchar(16) NOT NULL,
  materialized_at timestamp,
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE framework_runtime_resource(
  resource_id bigserial PRIMARY KEY,
  resource_kind varchar(24) NOT NULL,
  resource_key varchar(600) NOT NULL,
  scope_code varchar(80) NOT NULL DEFAULT 'GLOBAL',
  contract_json jsonb NOT NULL,
  UNIQUE(resource_kind,resource_key,scope_code)
);
CREATE TABLE framework_runtime_generation_state(
  resource_id bigint PRIMARY KEY
    REFERENCES framework_runtime_resource(resource_id) ON DELETE CASCADE,
  source_hash varchar(64) NOT NULL DEFAULT repeat('3',64),
  generated_hash varchar(64),
  sync_status varchar(16) NOT NULL,
  generated_at timestamp,
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE framework_api_endpoint_registry(
  endpoint_key varchar(240) PRIMARY KEY,
  http_method varchar(10) NOT NULL,
  route_path varchar(300) NOT NULL,
  implementation_ref text NOT NULL
);

CREATE TABLE framework_actor_definition(
  actor_code text PRIMARY KEY,
  use_at char(1) NOT NULL
);

CREATE OR REPLACE FUNCTION framework_try_jsonb(source text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN RETURN source::jsonb; EXCEPTION WHEN others THEN RETURN NULL; END $$;
CREATE OR REPLACE FUNCTION framework_try_jsonb(source text,fallback jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN RETURN source::jsonb; EXCEPTION WHEN others THEN RETURN fallback; END $$;

INSERT INTO comtnemplyrinfo(esntl_id,emplyr_id,emplyr_sttus_code)
VALUES('ADMIN-COMPOSITE','runtime.composite.admin','A');
INSERT INTO comtnemplyrscrtyestbs(scrty_dtrmn_trget_id,author_code)
VALUES('ADMIN-COMPOSITE','ROLE_SYSTEM_ADMIN');
