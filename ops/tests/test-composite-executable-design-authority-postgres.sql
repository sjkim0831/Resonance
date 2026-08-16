\set ON_ERROR_STOP on
BEGIN;

\ir ../../apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260728170000__create_integrated_design_document_registry.sql

CREATE TABLE framework_professional_screen_contract(
  contract_id bigint PRIMARY KEY,process_code text NOT NULL,step_code text NOT NULL,
  route_path text NOT NULL,audience text NOT NULL,actor_code text NOT NULL,
  business_purpose text NOT NULL,entry_condition text NOT NULL,exit_condition text NOT NULL,
  kpi_contract text NOT NULL,section_contract text NOT NULL,field_contract text NOT NULL,
  command_contract text NOT NULL,state_contract text NOT NULL,api_contract text NOT NULL,
  data_contract text NOT NULL,evidence_contract text NOT NULL,responsive_contract text NOT NULL,
  accessibility_contract text NOT NULL,security_contract text NOT NULL,permission_codes jsonb NOT NULL,
  api_verified boolean NOT NULL,database_verified boolean NOT NULL,authority_verified boolean NOT NULL,
  responsive_verified boolean NOT NULL,accessibility_verified boolean NOT NULL,
  exception_states_verified boolean NOT NULL,audit_evidence_ref text NOT NULL,updated_by text NOT NULL
);
CREATE TABLE framework_screen_blueprint(
  blueprint_id bigint PRIMARY KEY,process_code text NOT NULL,step_code text NOT NULL,
  audience text NOT NULL,route_path text NOT NULL,actor_code text NOT NULL,
  validation_status text NOT NULL,transition_status text NOT NULL,source_reference text NOT NULL,
  implementation_strategy text NOT NULL,specification_json text NOT NULL
);
CREATE TABLE framework_development_job(job_id bigint PRIMARY KEY);
CREATE TABLE framework_process_definition(
  process_code text PRIMARY KEY,domain_code text NOT NULL,owner_actor_code text NOT NULL,
  process_version text NOT NULL
);
CREATE TABLE framework_process_step(
  process_code text NOT NULL,step_code text NOT NULL,step_order integer NOT NULL,
  actor_code text NOT NULL,command_code text NOT NULL,from_state text NOT NULL,to_state text NOT NULL,
  completion_rule text NOT NULL,requires_notification boolean NOT NULL,input_contract text NOT NULL,
  output_contract text NOT NULL,requires_user_page boolean NOT NULL,
  requires_admin_page boolean NOT NULL,user_path text,admin_path text,
  escalation_actor_code text,segregation_actor_codes text NOT NULL DEFAULT '',
  PRIMARY KEY(process_code,step_code)
);
CREATE TABLE framework_step_execution_spec(
  process_code text NOT NULL,step_code text NOT NULL,PRIMARY KEY(process_code,step_code));
CREATE TABLE framework_step_schema_set(
  process_code text NOT NULL,step_code text NOT NULL,PRIMARY KEY(process_code,step_code));
CREATE TABLE framework_permission_requirement_v1(
  process_code text NOT NULL,step_code text NOT NULL,permission_code text NOT NULL,
  scope_type text NOT NULL);
CREATE TABLE framework_permission_grant_v1(
  actor_code text NOT NULL,permission_code text NOT NULL,scope_type text NOT NULL,
  effect text NOT NULL);
CREATE TABLE framework_screen_resource(
  screen_resource_id bigint PRIMARY KEY,route_key text NOT NULL,layout_type text NOT NULL);
CREATE TABLE framework_process_step_screen_binding(
  process_code text NOT NULL,step_code text NOT NULL,screen_resource_id bigint NOT NULL,
  actor_code text NOT NULL,audience text NOT NULL,binding_status text NOT NULL);
CREATE TABLE comtnthemedefinition(theme_id text PRIMARY KEY,use_at char(1),is_active char(1));
CREATE TABLE ui_section_registry(section_id text PRIMARY KEY,active_yn char(1));
CREATE TABLE ui_component_registry(
  component_id text PRIMARY KEY,component_type text NOT NULL,active_yn char(1));
CREATE TABLE framework_process_execution(execution_id uuid PRIMARY KEY);
CREATE TABLE framework_process_execution_event(event_id bigint PRIMARY KEY);
CREATE TABLE framework_actor_definition(actor_code text PRIMARY KEY,use_at char(1) NOT NULL);
CREATE TABLE framework_account_actor_assignment(
  assignment_id bigint PRIMARY KEY,tenant_id text NOT NULL,project_id text NOT NULL,
  account_id text NOT NULL,actor_code text NOT NULL,assignment_status text NOT NULL,
  valid_from date,valid_until date);
CREATE TABLE framework_project_actor_assignment(
  project_id text NOT NULL,actor_code text NOT NULL,user_id text NOT NULL,active_yn char(1) NOT NULL);
CREATE TABLE comtnemplyrinfo(
  emplyr_id text PRIMARY KEY,esntl_id text NOT NULL,emplyr_sttus_code text NOT NULL);
CREATE TABLE comtnentrprsmber(
  entrprs_mber_id text PRIMARY KEY,esntl_id text NOT NULL,entrprs_mber_sttus text NOT NULL);
CREATE TABLE comtnemplyrscrtyestbs(scrty_dtrmn_trget_id text NOT NULL,author_code text NOT NULL);

CREATE OR REPLACE FUNCTION framework_try_jsonb(source text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN RETURN source::jsonb; EXCEPTION WHEN others THEN RETURN NULL; END $$;
CREATE OR REPLACE FUNCTION framework_try_jsonb(source text,fallback jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN RETURN source::jsonb; EXCEPTION WHEN others THEN RETURN fallback; END $$;

-- The production installer is owned by V20260816134500.  This isolated
-- migration fixture supplies the same trigger-shape contract so V154000 can
-- prove that every newly introduced process/project table is fenced.
CREATE OR REPLACE FUNCTION framework_guard_project_runtime_write_fence()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION framework_install_project_runtime_write_fences()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE table_row record; installed integer:=0;
BEGIN
  FOR table_row IN
    SELECT relation.oid,namespace.nspname,relation.relname
      FROM pg_class relation JOIN pg_namespace namespace
        ON namespace.oid=relation.relnamespace
     WHERE namespace.nspname=current_schema()
       AND relation.relkind IN('r','p') AND NOT relation.relispartition
       AND relation.relname LIKE 'integrated_design\_%' ESCAPE '\'
       AND EXISTS(SELECT 1 FROM pg_attribute attribute
          WHERE attribute.attrelid=relation.oid
            AND attribute.attname IN('project_id','process_code')
            AND attribute.attnum>0 AND NOT attribute.attisdropped)
     ORDER BY relation.relname COLLATE "C",relation.oid
  LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_trigger trigger_row
       WHERE trigger_row.tgrelid=table_row.oid
         AND trigger_row.tgname='trg_project_runtime_write_fence'
         AND NOT trigger_row.tgisinternal) THEN
      EXECUTE format('create trigger trg_project_runtime_write_fence '
        'before insert or update on %I.%I for each row '
        'execute function framework_guard_project_runtime_write_fence()',
        table_row.nspname,table_row.relname);
      installed:=installed+1;
    END IF;
  END LOOP;
  RETURN installed;
END $$;

INSERT INTO framework_process_definition VALUES('PROC','WORK','ACTOR','1.0.0');
INSERT INTO framework_process_step VALUES(
  'PROC','STEP',1,'ACTOR','SAVE','DRAFT','DONE','record saved',false,
  '{"name":"string"}','{"id":"integer"}',true,true,'/work','/work',NULL,'');
INSERT INTO framework_screen_resource VALUES(1,'/work','KRDS_WORKSPACE');
INSERT INTO framework_screen_resource VALUES(2,'/work/other','KRDS_WORKSPACE');
INSERT INTO framework_process_step_screen_binding VALUES
  ('PROC','STEP',1,'ACTOR','USER','ACTIVE'),('PROC','STEP',1,'ACTOR','ADMIN','ACTIVE'),
  ('PROC','STEP',2,'ACTOR','USER','ACTIVE');
INSERT INTO comtnthemedefinition VALUES('KRDS_GOV_DEFAULT','Y','Y');
INSERT INTO ui_section_registry VALUES('MAIN','Y');
INSERT INTO ui_component_registry VALUES('JSON_FORM','JSON_FORM','Y');

INSERT INTO framework_professional_screen_contract VALUES
(101,'PROC','STEP','/work','USER','ACTOR','Complete the governed work safely',
 'A valid draft exists','The persisted record and identifier are returned',
 '[{"kpiCode":"DONE","description":"Completed"}]',
 '[{"sectionId":"MAIN","componentCodes":["JSON_FORM"]}]',
 '[{"fieldCode":"name","direction":"INPUT","dataSource":"ITEM"},{"fieldCode":"id","direction":"OUTPUT","dataSource":"ITEM"}]',
 '[{"commandCode":"SAVE","actorCode":"ACTOR","primary":true}]',
 '[{"fromState":"DRAFT","commandCode":"SAVE","toState":"DONE"}]',
 '[{"method":"POST","path":"/api/actual/items","commandCode":"SAVE","requestFields":["name"],"responseFields":["id"],"permissionCodes":["PERM_SAVE"]}]',
 '[{"entity":"ITEM","fields":["name","id"]}]',
 '[{"evidenceType":"E2E","reference":"evidence://save"}]','360 768 1280','KRDS WCAG AA',
 'server actor scope','["PERM_SAVE"]',true,true,true,true,true,true,'audit://save','LIVE_CONTRACT_BACKFILL'),
(102,'PROC','STEP','/work','ADMIN','ACTOR','Complete the governed work safely',
 'A valid draft exists','The persisted record and identifier are returned',
 '[{"kpiCode":"DONE","description":"Completed"}]',
 '[{"sectionId":"MAIN","componentCodes":["JSON_FORM"]}]',
 '[{"fieldCode":"name","direction":"INPUT","dataSource":"ITEM"},{"fieldCode":"id","direction":"OUTPUT","dataSource":"ITEM"}]',
 '[{"commandCode":"SAVE","actorCode":"ACTOR","primary":true}]',
 '[{"fromState":"DRAFT","commandCode":"SAVE","toState":"DONE"}]',
 '[{"method":"POST","path":"/api/actual/items","commandCode":"SAVE","requestFields":["name"],"responseFields":["id"],"permissionCodes":["PERM_SAVE"]}]',
 '[{"entity":"ITEM","fields":["name","id"]}]',
 '[{"evidenceType":"E2E","reference":"evidence://save"}]','360 768 1280','KRDS WCAG AA',
 'server actor scope','["PERM_SAVE"]',true,true,true,true,true,true,'audit://save','LIVE_CONTRACT_BACKFILL'),
(103,'PROC','STEP','/work/other','USER','ACTOR','Complete the governed work safely',
 'A valid draft exists','The persisted record and identifier are returned',
 '[{"kpiCode":"DONE","description":"Completed"}]',
 '[{"sectionId":"MAIN","componentCodes":["JSON_FORM"]}]',
 '[{"fieldCode":"name","direction":"INPUT","dataSource":"ITEM"},{"fieldCode":"id","direction":"OUTPUT","dataSource":"ITEM"}]',
 '[{"commandCode":"SAVE","actorCode":"ACTOR","primary":true}]',
 '[{"fromState":"DRAFT","commandCode":"SAVE","toState":"DONE"}]',
 '[{"method":"POST","path":"/api/actual/other","commandCode":"SAVE","requestFields":["name"],"responseFields":["id"],"permissionCodes":["PERM_SAVE"]}]',
 '[{"entity":"ITEM","fields":["name","id"]}]',
 '[{"evidenceType":"E2E","reference":"evidence://save"}]','360 768 1280','KRDS WCAG AA',
 'server actor scope','["PERM_SAVE"]',true,true,true,true,true,true,'audit://save','LIVE_CONTRACT_BACKFILL');

INSERT INTO framework_screen_blueprint VALUES
(201,'PROC','STEP','USER','/work','ACTOR','VALID','GENERATED','',
 'GENERATED_RUNTIME','{"layout":"KRDS_WORKSPACE","theme":"KRDS_GOV_DEFAULT","assetBindings":[{"assetType":"THEME","assetCode":"KRDS_GOV_DEFAULT"},{"assetType":"SECTION","assetCode":"MAIN"},{"assetType":"COMPONENT","assetCode":"JSON_FORM"}]}'),
(202,'PROC','STEP','ADMIN','/work','ACTOR','VALID','GENERATED','',
 'ADOPT_EXISTING','{"layout":"KRDS_WORKSPACE","theme":"KRDS_GOV_DEFAULT","assetBindings":[{"assetType":"THEME","assetCode":"KRDS_GOV_DEFAULT"},{"assetType":"SECTION","assetCode":"MAIN"},{"assetType":"COMPONENT","assetCode":"JSON_FORM"}]}');
INSERT INTO framework_screen_blueprint VALUES
(204,'PROC','STEP','USER','/work/other','ACTOR','VALID','GENERATED','',
 'GENERATED_RUNTIME','{"layout":"KRDS_WORKSPACE","theme":"KRDS_GOV_DEFAULT","assetBindings":[{"assetType":"THEME","assetCode":"KRDS_GOV_DEFAULT"},{"assetType":"SECTION","assetCode":"MAIN"},{"assetType":"COMPONENT","assetCode":"JSON_FORM"}]}');

DO $$
DECLARE kind text;
BEGIN
  FOREACH kind IN ARRAY ARRAY['REQUIREMENT','ACTOR_RACI','AUTHORITY','PROCESS','STATE','NAVIGATION',
    'ACTIVE_UI','DESIGN_ASSET','FIELD_DICTIONARY','DATA_HANDOFF','DATABASE','API','BUSINESS_RULE',
    'VALIDATION','NOTIFICATION','TEST','TASK_EVIDENCE','RELEASE_AUDIT'] LOOP
    INSERT INTO integrated_design_document(
      process_code,step_code,route_path,document_type,title,content,status,updated_by)
    VALUES('PROC','STEP','/work',kind,kind,'legacy-'||kind,'READY','legacy-owner');
    INSERT INTO integrated_design_document(
      process_code,step_code,route_path,document_type,title,content,status,updated_by)
    VALUES('PROC','STEP','/work/other',kind,kind,'legacy-other-'||kind,'READY','legacy-owner');
  END LOOP;
END $$;

\ir ../../apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260816154000__compile_composite_executable_design_authority.sql

DO $$
BEGIN
  IF (SELECT count(*) FROM integrated_design_document WHERE audience='' AND active_yn='N')<>36
     OR (SELECT count(*) FROM integrated_design_document WHERE audience IN('USER','ADMIN')
          AND status='DRAFT' AND updated_by='COMPOSITE_MIGRATION_REQUIRED'
          AND content LIKE 'legacy-%')<>54
     OR (SELECT count(*) FROM integrated_design_authority)<>0
     OR (SELECT count(*) FROM framework_development_job)<>0 THEN
    RAISE EXCEPTION 'legacy rows were trusted, rewritten, or published';
  END IF;
END $$;

SELECT * FROM refresh_integrated_design_axis_documents('PROC',true);
DO $$
BEGIN
  IF (SELECT count(*) FROM integrated_design_document WHERE audience IN('USER','ADMIN')
        AND status='IN_REVIEW' AND content::jsonb->>'schemaVersion'=
          'carbonet.integrated-design-axis/v1')<>54 THEN
    RAISE EXCEPTION 'exact 3x18 axis projection missing';
  END IF;
  IF EXISTS(SELECT 1 FROM integrated_design_document WHERE content LIKE '%/api/generated/%'
      OR content LIKE '%COMPONENT\_%' ESCAPE '\' OR content LIKE '%SECTION\_%' ESCAPE '\') THEN
    RAISE EXCEPTION 'fabricated placeholder escaped into templates';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM integrated_design_document WHERE document_type='API'
      AND content LIKE '%/api/actual/items%') THEN
    RAISE EXCEPTION 'actual endpoint was not preserved';
  END IF;
END $$;

DO $$
DECLARE before_spec text;before_xmin text;after_xmin text;
BEGIN
  SELECT specification_json,xmin::text INTO before_spec,before_xmin
    FROM framework_screen_blueprint WHERE blueprint_id=202;
  PERFORM * FROM refresh_integrated_design_axis_documents('PROC',true);
  SELECT xmin::text INTO after_xmin FROM framework_screen_blueprint WHERE blueprint_id=202;
  IF before_spec<>(SELECT specification_json FROM framework_screen_blueprint WHERE blueprint_id=202)
      OR before_xmin<>after_xmin THEN
    RAISE EXCEPTION 'ADOPT blueprint bytes/xmin changed';
  END IF;
END $$;

INSERT INTO framework_development_job VALUES(301);
INSERT INTO integrated_design_authority(
 process_code,step_code,route_path,audience,contract_id,selected_blueprint_id,ownership_strategy,
 document_set_hash,authority_hash,composite_json,source_hash,design_set_hash,design_catalog_hash,
 endpoint_catalog_hash,package_binding_hash,job_id,activation_policy,updated_by)
SELECT 'PROC','STEP',route_path,audience,contract_id,blueprint_id,
       CASE WHEN audience='ADMIN' THEN 'PRESERVE_ADOPT' ELSE 'EXACT_SINGLE' END,
       repeat('1',64),repeat(CASE WHEN audience='USER' THEN '2' ELSE '3' END,64),
       jsonb_build_object('schema','carbonet.composite-executable-design-authority/v1',
         'activationPolicy','SOURCE_IMMEDIATE_V1','axes',
         (SELECT jsonb_agg(value) FROM generate_series(1,18) value)),
       repeat('4',64),repeat('5',64),repeat('6',64),repeat('7',64),repeat('8',64),301,
       'SOURCE_IMMEDIATE_V1','test'
  FROM (VALUES('USER','/work',101::bigint,201::bigint),
              ('ADMIN','/work',102::bigint,202::bigint),
              ('USER','/work/other',103::bigint,204::bigint))
       source(audience,route_path,contract_id,blueprint_id);

DO $$
BEGIN
  IF (SELECT count(*) FROM integrated_design_authority)<>3
      OR (SELECT count(distinct job_id) FROM integrated_design_authority)<>1
      OR (SELECT count(distinct source_hash) FROM integrated_design_authority)<>1
      OR (SELECT count(distinct design_set_hash) FROM integrated_design_authority)<>1
      OR (SELECT count(distinct design_catalog_hash) FROM integrated_design_authority)<>1
      OR (SELECT count(distinct endpoint_catalog_hash) FROM integrated_design_authority)<>1 THEN
    RAISE EXCEPTION '3-screen authorities are not bound to one final package head';
  END IF;
END $$;

INSERT INTO integrated_design_scope_binding(
 authority_id,authority_revision,scope_type,project_id,design_version,contract_sha256,
 process_code,step_code,route_path,audience,document_set_hash,authority_hash,provenance_hash,bound_by)
SELECT authority_id,authority_revision,'PROJECT','PROJECT_A',1,repeat('a',64),
       process_code,step_code,route_path,audience,document_set_hash,authority_hash,
       repeat(substr(authority_hash,1,1),64),'test'
  FROM integrated_design_authority;

DO $$
DECLARE affected integer;target bigint;
BEGIN
  SELECT authority_id INTO target FROM integrated_design_authority WHERE audience='USER' AND route_path='/work';
  INSERT INTO integrated_design_scope_binding(
    authority_id,authority_revision,scope_type,project_id,design_version,contract_sha256,
    process_code,step_code,route_path,audience,document_set_hash,authority_hash,provenance_hash,bound_by)
  SELECT authority_id,authority_revision,'PROJECT','PROJECT_A',1,repeat('a',64),
         process_code,step_code,route_path,audience,document_set_hash,authority_hash,
         repeat(substr(authority_hash,1,1),64),'retry'
    FROM integrated_design_authority WHERE authority_id=target
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>0 THEN RAISE EXCEPTION 'same project release retry wrote a binding'; END IF;
  BEGIN
    INSERT INTO integrated_design_scope_binding(
      authority_id,authority_revision,scope_type,project_id,design_version,contract_sha256,
      process_code,step_code,route_path,audience,document_set_hash,authority_hash,provenance_hash,bound_by)
    SELECT authority_id,authority_revision,'PROJECT','PROJECT_A',1,repeat('f',64),
           process_code,step_code,route_path,audience,document_set_hash,authority_hash,
           repeat('f',64),'forged'
      FROM integrated_design_authority WHERE authority_id=target;
    RAISE EXCEPTION 'forged release provenance was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;

DO $$
DECLARE target bigint;old_xmin text;new_xmin text;affected integer;
BEGIN
  SELECT authority_id INTO target FROM integrated_design_authority WHERE audience='USER';
  UPDATE integrated_design_authority SET source_hash=repeat('9',64) WHERE authority_id=target;
  IF (SELECT authority_revision FROM integrated_design_authority WHERE authority_id=target)<>2
      OR (SELECT count(*) FROM integrated_design_authority_version WHERE authority_id=target
           AND source_hash=repeat('4',64))<>1 THEN
    RAISE EXCEPTION 'binding-only authority revision/archive missing';
  END IF;
  INSERT INTO integrated_design_scope_binding(
    authority_id,authority_revision,scope_type,project_id,design_version,contract_sha256,
    process_code,step_code,route_path,audience,document_set_hash,authority_hash,provenance_hash,bound_by)
  SELECT authority_id,authority_revision,'PROJECT','PROJECT_A',2,repeat('b',64),
         process_code,step_code,route_path,audience,document_set_hash,authority_hash,repeat('c',64),'test'
    FROM integrated_design_authority WHERE authority_id=target;
  IF (SELECT count(*) FROM integrated_design_scope_binding WHERE authority_id=target
       AND authority_revision IN(1,2))<>2 THEN
    RAISE EXCEPTION 'authority revision provenance history missing';
  END IF;
  SELECT xmin::text INTO old_xmin FROM integrated_design_authority WHERE authority_id=target;
  UPDATE integrated_design_authority SET source_hash=repeat('9',64) WHERE authority_id=target;
  GET DIAGNOSTICS affected=ROW_COUNT;
  SELECT xmin::text INTO new_xmin FROM integrated_design_authority WHERE authority_id=target;
  IF affected<>0 OR old_xmin<>new_xmin
      OR (SELECT authority_revision FROM integrated_design_authority WHERE authority_id=target)<>2 THEN
    RAISE EXCEPTION 'authority semantic no-op wrote a tuple';
  END IF;
END $$;

DO $$
DECLARE ambiguity bigint;
BEGIN
  INSERT INTO framework_screen_blueprint VALUES(203,'PROC','STEP','USER','/work','ACTOR',
    'VALID','GENERATED','','GENERATED_RUNTIME',
    '{"layout":"KRDS_WORKSPACE","theme":"KRDS_GOV_DEFAULT","assetBindings":[]}');
  SELECT ambiguous_count INTO ambiguity FROM refresh_integrated_design_axis_documents('PROC',true);
  IF ambiguity<>1 THEN RAISE EXCEPTION 'ambiguous blueprint was auto-selected'; END IF;
END $$;

-- Bounded IN_APP delivery: exact active tenant/project relay fanout, replay
-- write-zero, unsupported network channels, retry/dead-letter, and lease reclaim.
INSERT INTO framework_actor_definition VALUES('ACTOR','Y');
INSERT INTO comtnemplyrinfo VALUES('user-a','essential-a','P');
INSERT INTO comtnentrprsmber VALUES('user-b','essential-b','A');
INSERT INTO comtnemplyrscrtyestbs VALUES('essential-a','ROLE_USER'),('essential-b','ROLE_USER');
INSERT INTO framework_account_actor_assignment VALUES
 (1,'TENANT_A','PROJECT_A','user-a','ACTOR','ACTIVE',current_date-1,current_date+1),
 (2,'TENANT_A','*','user-b','ACTOR','ACTIVE',current_date-1,current_date+1);
INSERT INTO framework_project_actor_assignment VALUES('PROJECT_A','ACTOR','user-a','Y');
INSERT INTO integrated_design_notification_template VALUES(
 'SAVED_TEMPLATE','Work saved','The work was saved.','Y','test',current_timestamp);
INSERT INTO framework_process_execution VALUES
 ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000003'),('00000000-0000-0000-0000-000000000004');
INSERT INTO framework_process_execution_event VALUES(1),(2),(3),(4);
INSERT INTO integrated_design_notification_outbox(
 authority_id,authority_revision,authority_hash,execution_id,event_id,tenant_id,project_id,
 process_code,step_code,command_code,event_code,channel,recipient_actor_code,template_code,payload_hash)
SELECT authority_id,authority_revision,authority_hash,
 '00000000-0000-0000-0000-000000000001'::uuid,1,'TENANT_A','PROJECT_A',
 process_code,step_code,'SAVE','SAVED','IN_APP','ACTOR','SAVED_TEMPLATE',repeat('d',64)
 FROM integrated_design_authority WHERE audience='ADMIN';
SELECT * FROM deliver_integrated_design_notifications(25);
DO $$
DECLARE before_xmin text;after_xmin text;
BEGIN
  IF (SELECT delivery_status FROM integrated_design_notification_outbox WHERE event_id=1)<>'DELIVERED'
      OR (SELECT count(*) FROM integrated_design_notification_inbox WHERE notification_id=(
        SELECT notification_id FROM integrated_design_notification_outbox WHERE event_id=1))<>2 THEN
    RAISE EXCEPTION 'active relay recipient fanout was not delivered exactly';
  END IF;
  SELECT xmin::text INTO before_xmin FROM integrated_design_notification_outbox WHERE event_id=1;
  PERFORM * FROM deliver_integrated_design_notifications(25);
  SELECT xmin::text INTO after_xmin FROM integrated_design_notification_outbox WHERE event_id=1;
  IF before_xmin<>after_xmin THEN RAISE EXCEPTION 'delivered replay rewrote outbox'; END IF;
END $$;

INSERT INTO integrated_design_notification_outbox(
 authority_id,authority_revision,authority_hash,execution_id,event_id,tenant_id,project_id,
 process_code,step_code,command_code,event_code,channel,recipient_actor_code,template_code,payload_hash)
SELECT authority_id,authority_revision,authority_hash,
 '00000000-0000-0000-0000-000000000002'::uuid,2,'TENANT_A','PROJECT_A',
 process_code,step_code,'SAVE','EMAIL_EVENT','EMAIL','ACTOR','SAVED_TEMPLATE',repeat('e',64)
 FROM integrated_design_authority WHERE audience='ADMIN';
SELECT * FROM deliver_integrated_design_notifications(25);
DO $$ BEGIN
  IF (SELECT delivery_status FROM integrated_design_notification_outbox WHERE event_id=2)<>'UNSUPPORTED'
      OR (SELECT delivery_receipt->>'networkAttemptCount'
            FROM integrated_design_notification_outbox WHERE event_id=2)<>'0' THEN
    RAISE EXCEPTION 'unsupported channel attempted delivery';
  END IF;
END $$;

INSERT INTO integrated_design_notification_outbox(
 authority_id,authority_revision,authority_hash,execution_id,event_id,tenant_id,project_id,
 process_code,step_code,command_code,event_code,channel,recipient_actor_code,template_code,payload_hash)
SELECT authority_id,authority_revision,authority_hash,
 '00000000-0000-0000-0000-000000000003'::uuid,3,'TENANT_A','PROJECT_A',
 process_code,step_code,'SAVE','MISSING_TEMPLATE','IN_APP','ACTOR','NOT_REGISTERED',repeat('f',64)
 FROM integrated_design_authority WHERE audience='ADMIN';
SELECT * FROM deliver_integrated_design_notifications(25);
UPDATE integrated_design_notification_outbox SET next_attempt_at=current_timestamp WHERE event_id=3;
SELECT * FROM deliver_integrated_design_notifications(25);
UPDATE integrated_design_notification_outbox SET next_attempt_at=current_timestamp WHERE event_id=3;
SELECT * FROM deliver_integrated_design_notifications(25);
DO $$ BEGIN
  IF (SELECT delivery_status FROM integrated_design_notification_outbox WHERE event_id=3)<>'DEAD_LETTERED'
      OR (SELECT attempt_count FROM integrated_design_notification_outbox WHERE event_id=3)<>3 THEN
    RAISE EXCEPTION 'template/retry dead letter contract failed';
  END IF;
END $$;

INSERT INTO integrated_design_notification_outbox(
 authority_id,authority_revision,authority_hash,execution_id,event_id,tenant_id,project_id,
 process_code,step_code,command_code,event_code,channel,recipient_actor_code,template_code,payload_hash,
 delivery_status,lease_token,lease_until)
SELECT authority_id,authority_revision,authority_hash,
 '00000000-0000-0000-0000-000000000004'::uuid,4,'TENANT_A','PROJECT_A',
 process_code,step_code,'SAVE','RECLAIMED','IN_APP','ACTOR','SAVED_TEMPLATE',repeat('a',64),
 'DELIVERING',gen_random_uuid(),current_timestamp-interval '1 second'
 FROM integrated_design_authority WHERE audience='ADMIN';
SELECT * FROM deliver_integrated_design_notifications(25);
DO $$ BEGIN
  IF (SELECT delivery_status FROM integrated_design_notification_outbox WHERE event_id=4)<>'DELIVERED'
      THEN RAISE EXCEPTION 'expired delivery lease was not reclaimed'; END IF;
END $$;

-- One canonical screen may expose N commands, but the PROCESS/FRONTEND
-- command set and API operation set must remain an exact multiset contract.
-- The fixture compiler rebinds canonicalText/designHash on every mutation so
-- each negative case proves the command/endpoint gate rather than a stale-hash
-- shortcut.  Every rejected mutation runs in an exception subtransaction and
-- therefore also proves rollback to the two-command authority.
INSERT INTO framework_process_definition VALUES('NOP','WORK','ACTOR','1.0.0');
INSERT INTO framework_process_step VALUES(
  'NOP','EXECUTE',1,'ACTOR','SAVE','DRAFT','DONE','all commands complete',false,
  '{"name":"string","amount":"number"}','{"id":"integer","status":"string"}',
  true,false,'/nop',NULL,NULL,'');
INSERT INTO framework_professional_screen_contract VALUES
(901,'NOP','EXECUTE','/nop','USER','ACTOR','Execute both governed commands',
 'A valid draft exists','Both command results are available',
 '[{"kpiCode":"DONE","description":"Completed"}]',
 '[{"sectionId":"MAIN","componentCodes":["JSON_FORM"]}]',
 '[{"fieldCode":"name","label":"Name","direction":"INPUT","dataSource":"ITEM","dataType":"STRING","required":true,"componentCode":"JSON_FORM"},{"fieldCode":"amount","label":"Amount","direction":"INPUT","dataSource":"ITEM","dataType":"NUMBER","required":true,"componentCode":"JSON_FORM"},{"fieldCode":"id","label":"ID","direction":"OUTPUT","dataSource":"ITEM","dataType":"INTEGER","required":false,"componentCode":"JSON_FORM"},{"fieldCode":"status","label":"Status","direction":"OUTPUT","dataSource":"ITEM","dataType":"STRING","required":false,"componentCode":"JSON_FORM"}]',
 '[{"commandCode":"SAVE","actorCode":"ACTOR","primary":true},{"commandCode":"SUBMIT","actorCode":"ACTOR","primary":false}]',
 '[{"fromState":"DRAFT","commandCode":"SAVE","toState":"SAVED"},{"fromState":"SAVED","commandCode":"SUBMIT","toState":"DONE"}]',
 '[{"method":"POST","path":"/api/nop/{executionId}/save","commandCode":"SAVE","requestFields":["name"],"responseFields":["id"],"permissionCodes":["PERM_SAVE"]},{"method":"POST","path":"/api/nop/{executionId}/submit","commandCode":"SUBMIT","requestFields":["amount"],"responseFields":["status"],"permissionCodes":["PERM_SUBMIT"]}]',
 '[{"entity":"ITEM","fields":["name","amount","id","status"]}]',
 '[{"evidenceType":"E2E","reference":"evidence://multi-command"}]',
 '360 768 1280','KRDS WCAG AA','server actor scope',
 '["PERM_SAVE","PERM_SUBMIT"]',true,true,true,true,true,true,
 'audit://multi-command','test');

CREATE TABLE framework_test_composite_canonical(canonical jsonb NOT NULL);
INSERT INTO framework_test_composite_canonical VALUES($json$
{
  "identity":{"screenKey":"NOP|EXECUTE|USER|/nop","blueprintCode":"NOP_WORK",
    "processCode":"NOP","stepCode":"EXECUTE","audience":"USER","routePath":"/nop",
    "pageId":"NOP_WORK","actorCode":"ACTOR"},
  "process":{"processName":"N operation process"},
  "step":{"commandCode":"SAVE"},
  "lanes":{
    "FRONTEND":{"routePath":"/nop","fields":[
      {"fieldCode":"name","label":"Name","direction":"INPUT","dataSource":"ITEM","dataType":"STRING","required":true,"componentCode":"JSON_FORM"},
      {"fieldCode":"amount","label":"Amount","direction":"INPUT","dataSource":"ITEM","dataType":"NUMBER","required":true,"componentCode":"JSON_FORM"},
      {"fieldCode":"id","label":"ID","direction":"OUTPUT","dataSource":"ITEM","dataType":"INTEGER","required":false,"componentCode":"JSON_FORM"},
      {"fieldCode":"status","label":"Status","direction":"OUTPUT","dataSource":"ITEM","dataType":"STRING","required":false,"componentCode":"JSON_FORM"}],
      "actions":[
        {"commandCode":"SAVE","actorCode":"ACTOR","primary":true},
        {"commandCode":"SUBMIT","actorCode":"ACTOR","primary":false}]},
    "API":[
      {"commandCode":"SAVE","method":"POST","path":"/api/nop/{executionId}/save","permissionCodes":["PERM_SAVE"],"requestFields":["name"],"responseFields":["id"]},
      {"commandCode":"SUBMIT","method":"POST","path":"/api/nop/{executionId}/submit","permissionCodes":["PERM_SUBMIT"],"requestFields":["amount"],"responseFields":["status"]}],
    "DATABASE":[]
  }
}
$json$::jsonb);

CREATE OR REPLACE FUNCTION framework_source_canonical_design_catalog(
  requested_limit integer,requested_process varchar)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE canonical jsonb;design_hash text;screen jsonb;
BEGIN
  IF requested_limit<1 OR requested_process<>'NOP' THEN
    RAISE EXCEPTION 'test catalog scope invalid' USING ERRCODE='22023';
  END IF;
  SELECT fixture.canonical INTO STRICT canonical
    FROM framework_test_composite_canonical fixture;
  design_hash:=encode(sha256(convert_to(canonical::text,'UTF8')),'hex');
  screen:=jsonb_build_object(
    'screenKey',canonical#>>'{identity,screenKey}',
    'processCode',canonical#>>'{identity,processCode}',
    'stepCode',canonical#>>'{identity,stepCode}',
    'audience',canonical#>>'{identity,audience}',
    'routePath',canonical#>>'{identity,routePath}',
    'designHash',design_hash,'canonicalText',canonical::text,
    'canonicalDesign',canonical);
  RETURN jsonb_build_object('schema','carbonet.canonical-design/v1',
    'catalogHash',encode(sha256(convert_to(screen::text,'UTF8')),'hex'),
    'screenCount',1,'screens',jsonb_build_array(screen));
END
$$;

CREATE OR REPLACE FUNCTION framework_canonical_design_catalog(requested_limit integer)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT framework_source_canonical_design_catalog(requested_limit,'NOP')
$$;

DO $$
DECLARE readiness jsonb;catalog jsonb;tuples jsonb;canonical jsonb;
BEGIN
  readiness:=framework_source_canonical_endpoint_readiness(100,'NOP');
  IF readiness->>'status'<>'COMPLETE'
     OR readiness->>'schema'<>'carbonet.canonical-endpoint-readiness/v2'
     OR (readiness->>'canonicalScreenCount')::integer<>1
     OR (readiness->>'operationCount')::integer<>2
     OR (readiness->>'sourceReadyCount')::integer<>1
     OR (readiness->>'blockerCount')::integer<>0 THEN
    RAISE EXCEPTION 'two-command canonical endpoint readiness failed: %',readiness;
  END IF;
  catalog:=framework_source_canonical_endpoint_catalog(100,'NOP');
  SELECT jsonb_agg(jsonb_build_array(operation->>'processCode',operation->>'stepCode',
           operation->>'commandCode',operation->>'method',operation->>'path')
           ORDER BY operation->>'commandCode') INTO tuples
    FROM jsonb_array_elements(catalog#>'{endpoints,0,endpointContract,operations}') operation;
  IF jsonb_array_length(catalog->'endpoints')<>1
     OR jsonb_array_length(catalog#>'{endpoints,0,endpointContract,operations}')<>2
     OR tuples<>jsonb_build_array(
       jsonb_build_array('NOP','EXECUTE','SAVE','POST','/api/nop/{executionId}/save'),
       jsonb_build_array('NOP','EXECUTE','SUBMIT','POST','/api/nop/{executionId}/submit')) THEN
    RAISE EXCEPTION 'one-screen N-operation endpoint tuples are not exact: %',catalog;
  END IF;
  SELECT fixture.canonical INTO canonical FROM framework_test_composite_canonical fixture;
  IF catalog#>>'{endpoints,0,canonicalText}' IS DISTINCT FROM canonical::text
     OR catalog#>>'{endpoints,0,designHash}' IS DISTINCT FROM
        encode(sha256(convert_to(canonical::text,'UTF8')),'hex') THEN
    RAISE EXCEPTION 'canonical provenance bytes changed during endpoint projection';
  END IF;
END $$;

DO $$ DECLARE baseline jsonb;readiness jsonb;
BEGIN
  SELECT canonical INTO baseline FROM framework_test_composite_canonical;
  BEGIN
    UPDATE framework_test_composite_canonical
       SET canonical=canonical#-'{lanes,API,1}';
    readiness:=framework_source_canonical_endpoint_readiness(100,'NOP');
    IF readiness->>'status'<>'PARTIAL' THEN
      RAISE EXCEPTION 'missing operation reached COMPLETE';
    END IF;
    PERFORM framework_source_canonical_endpoint_catalog(100,'NOP');
    RAISE EXCEPTION 'missing operation was published';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL;
  END;
  IF (SELECT canonical FROM framework_test_composite_canonical)<>baseline THEN
    RAISE EXCEPTION 'missing-operation mutant did not roll back';
  END IF;

  BEGIN
    UPDATE framework_test_composite_canonical SET canonical=jsonb_set(
      canonical,'{lanes,API,1,commandCode}','"SAVE"'::jsonb);
    readiness:=framework_source_canonical_endpoint_readiness(100,'NOP');
    IF readiness->>'status'<>'PARTIAL' THEN
      RAISE EXCEPTION 'duplicate operation reached COMPLETE';
    END IF;
    PERFORM framework_source_canonical_endpoint_catalog(100,'NOP');
    RAISE EXCEPTION 'duplicate operation was published';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL;
  END;
  IF (SELECT canonical FROM framework_test_composite_canonical)<>baseline THEN
    RAISE EXCEPTION 'duplicate-operation mutant did not roll back';
  END IF;

  BEGIN
    UPDATE framework_test_composite_canonical SET canonical=jsonb_set(
      canonical,'{lanes,API,1,commandCode}','"OTHER"'::jsonb);
    readiness:=framework_source_canonical_endpoint_readiness(100,'NOP');
    IF readiness->>'status'<>'PARTIAL' THEN
      RAISE EXCEPTION 'undeclared operation reached COMPLETE';
    END IF;
    PERFORM framework_source_canonical_endpoint_catalog(100,'NOP');
    RAISE EXCEPTION 'undeclared operation was published';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL;
  END;
  IF (SELECT canonical FROM framework_test_composite_canonical)<>baseline THEN
    RAISE EXCEPTION 'undeclared-operation mutant did not roll back';
  END IF;

  BEGIN
    UPDATE framework_test_composite_canonical SET canonical=jsonb_set(
      canonical,'{lanes,API,1,path}','"/api/nop/{executionId}/save"'::jsonb);
    readiness:=framework_source_canonical_endpoint_readiness(100,'NOP');
    IF readiness->>'status'<>'PARTIAL'
       OR (readiness->>'globalCollisionCount')::integer<>2 THEN
      RAISE EXCEPTION 'route collision was not counted exactly: %',readiness;
    END IF;
    PERFORM framework_source_canonical_endpoint_catalog(100,'NOP');
    RAISE EXCEPTION 'route collision was published';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL;
  END;
  IF (SELECT canonical FROM framework_test_composite_canonical)<>baseline THEN
    RAISE EXCEPTION 'route-collision mutant did not roll back';
  END IF;
END $$;

\echo COMPOSITE_ENDPOINT_N_OPERATION_POSTGRES_PASS screens=1 operations=2 exactTuples=2 mutants=4 rollbacks=4

ROLLBACK;
