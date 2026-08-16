-- Bind all eighteen workbench documents to one immutable content hash and one
-- mutable process publication.  Draft axes remain independently versioned;
-- only the application compiler may publish a complete 18/18 authority.

ALTER TABLE integrated_design_document
  ADD COLUMN audience varchar(20) NOT NULL DEFAULT '';

-- Compile only canonical direct pages plus explicitly ACTIVE auxiliary screen
-- bindings.  Historical/unbound professional contracts stay byte-for-byte
-- preserved and never inflate process coverage or autocompletion work.
CREATE OR REPLACE VIEW framework_composite_design_target_identity AS
WITH raw_target AS (
  SELECT step.process_code,step.step_code,
         lower(split_part(step.user_path,'?',1)) route_path,'USER'::text audience,
         true direct_identity,false active_binding,null::text binding_actor_code
    FROM framework_process_step step
   WHERE step.requires_user_page AND nullif(btrim(step.user_path),'') IS NOT NULL
  UNION ALL
  SELECT step.process_code,step.step_code,
         lower(split_part(step.admin_path,'?',1)),'ADMIN'::text,true,false,null::text
    FROM framework_process_step step
   WHERE step.requires_admin_page AND nullif(btrim(step.admin_path),'') IS NOT NULL
  UNION ALL
  SELECT binding.process_code,binding.step_code,
         lower(split_part(resource.route_key,'?',1)),upper(binding.audience),false,true,
         binding.actor_code
    FROM framework_process_step_screen_binding binding
    JOIN framework_screen_resource resource
      ON resource.screen_resource_id=binding.screen_resource_id
   WHERE binding.binding_status='ACTIVE' AND upper(binding.audience) IN('USER','ADMIN')
), target AS (
  SELECT process_code,step_code,route_path,audience,
         bool_or(direct_identity) direct_identity,bool_or(active_binding) active_binding,
         count(*) filter(where active_binding)::integer binding_count,
         count(distinct binding_actor_code) filter(where binding_actor_code is not null)::integer
           binding_actor_count,
         min(binding_actor_code) filter(where binding_actor_code is not null) binding_actor_code
    FROM raw_target GROUP BY process_code,step_code,route_path,audience
), contracts AS (
  SELECT process_code,step_code,lower(split_part(route_path,'?',1)) route_path,
         upper(audience) audience,count(*)::integer contract_count,min(contract_id) contract_id,
         count(distinct actor_code)::integer contract_actor_count,min(actor_code) contract_actor_code
    FROM framework_professional_screen_contract
   GROUP BY process_code,step_code,lower(split_part(route_path,'?',1)),upper(audience)
)
SELECT target.process_code,target.step_code,target.route_path,target.audience,
       target.direct_identity,target.active_binding,
       target.binding_count,target.binding_actor_count,target.binding_actor_code,
       CASE WHEN coalesce(contracts.contract_count,0)=1 THEN contracts.contract_id END contract_id,
       coalesce(contracts.contract_count,0) contract_count,
       coalesce(contracts.contract_actor_count,0) contract_actor_count,
       contracts.contract_actor_code
  FROM target LEFT JOIN contracts
    ON contracts.process_code=target.process_code
   AND contracts.step_code=target.step_code
   AND contracts.route_path=target.route_path
   AND contracts.audience=target.audience;

DO $$
DECLARE constraint_name name;
BEGIN
  SELECT constraint_row.conname INTO constraint_name
    FROM pg_constraint constraint_row
   WHERE constraint_row.conrelid='integrated_design_document'::regclass
     AND constraint_row.contype='u'
     AND pg_get_constraintdef(constraint_row.oid) LIKE
       'UNIQUE (process_code, step_code, route_path, document_type)%';
  IF constraint_name IS NULL THEN
    RAISE EXCEPTION 'legacy integrated design document identity constraint is missing';
  END IF;
  EXECUTE format('ALTER TABLE integrated_design_document DROP CONSTRAINT %I',constraint_name);
END
$$;

-- A legacy row could have represented both audiences. Preserve its exact bytes
-- by cloning once per professional audience before retiring the ambiguous head.
INSERT INTO integrated_design_document(
  process_code,step_code,route_path,audience,document_type,title,content,status,
  revision,active_yn,updated_by,updated_at)
SELECT legacy.process_code,legacy.step_code,legacy.route_path,source.audience,
       legacy.document_type,legacy.title,legacy.content,
       CASE WHEN legacy.status IN('READY','APPROVED','VERIFIED') THEN 'DRAFT'
            ELSE legacy.status END,
       legacy.revision,legacy.active_yn,
       CASE WHEN legacy.status IN('READY','APPROVED','VERIFIED')
            THEN 'COMPOSITE_MIGRATION_REQUIRED' ELSE legacy.updated_by END,
       legacy.updated_at
  FROM integrated_design_document legacy
  JOIN (
    SELECT DISTINCT process_code,step_code,lower(split_part(route_path,'?',1)) route_path,
           upper(audience) audience
      FROM framework_composite_design_target_identity
  ) source ON source.process_code=legacy.process_code
          AND source.step_code=legacy.step_code
          AND source.route_path=lower(split_part(legacy.route_path,'?',1))
 WHERE legacy.audience='';

UPDATE integrated_design_document legacy SET active_yn='N'
 WHERE legacy.audience='' AND EXISTS(
   SELECT 1 FROM framework_composite_design_target_identity contract
    WHERE contract.process_code=legacy.process_code
      AND contract.step_code=legacy.step_code
      AND contract.route_path=
          lower(split_part(legacy.route_path,'?',1)));

ALTER TABLE integrated_design_document
  ADD CONSTRAINT uq_integrated_design_document_audience
  UNIQUE(process_code,step_code,route_path,audience,document_type),
  ADD CONSTRAINT ck_integrated_design_document_audience
  CHECK(audience IN('','USER','ADMIN'));

CREATE TABLE integrated_design_authority (
  authority_id bigserial PRIMARY KEY,
  process_code varchar(100) NOT NULL,
  step_code varchar(100) NOT NULL,
  route_path varchar(500) NOT NULL,
  audience varchar(20) NOT NULL CHECK(audience IN ('USER','ADMIN')),
  contract_id bigint NOT NULL REFERENCES framework_professional_screen_contract(contract_id),
  selected_blueprint_id bigint NOT NULL REFERENCES framework_screen_blueprint(blueprint_id),
  ownership_strategy varchar(40) NOT NULL CHECK(ownership_strategy IN(
    'EXACT_SINGLE','EXPLICIT_CONTRACT_LINK','PRESERVE_ADOPT','MANUAL_EXPLICIT')),
  authority_revision bigint NOT NULL DEFAULT 1 CHECK(authority_revision>0),
  document_set_hash varchar(64) NOT NULL CHECK(document_set_hash~'^[0-9a-f]{64}$'),
  authority_hash varchar(64) NOT NULL CHECK(authority_hash~'^[0-9a-f]{64}$'),
  composite_json jsonb NOT NULL CHECK(
    jsonb_typeof(composite_json)='object'
    AND composite_json->>'schema'='carbonet.composite-executable-design-authority/v1'
    AND composite_json->>'activationPolicy'='SOURCE_IMMEDIATE_V1'
    AND jsonb_typeof(composite_json->'axes')='array'
    AND jsonb_array_length(composite_json->'axes')=18),
  source_hash varchar(64) NOT NULL CHECK(source_hash~'^[0-9a-f]{64}$'),
  design_set_hash varchar(64) NOT NULL CHECK(design_set_hash~'^[0-9a-f]{64}$'),
  design_catalog_hash varchar(64) NOT NULL CHECK(design_catalog_hash~'^[0-9a-f]{64}$'),
  endpoint_catalog_hash varchar(64) NOT NULL CHECK(endpoint_catalog_hash~'^[0-9a-f]{64}$'),
  package_binding_hash varchar(64) NOT NULL CHECK(package_binding_hash~'^[0-9a-f]{64}$'),
  job_id bigint NOT NULL REFERENCES framework_development_job(job_id),
  activation_policy varchar(40) NOT NULL CHECK(activation_policy='SOURCE_IMMEDIATE_V1'),
  updated_by varchar(100) NOT NULL,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(process_code,step_code,route_path,audience),
  UNIQUE(authority_id,authority_revision),
  CHECK(route_path=lower(split_part(route_path,'?',1)) AND route_path~'^/'),
  CHECK(process_code=btrim(process_code) AND process_code~'^[A-Z][A-Z0-9_:-]{1,79}$'),
  CHECK(step_code=btrim(step_code) AND step_code~'^[A-Z][A-Z0-9_:-]{1,99}$')
);

CREATE TABLE integrated_design_authority_version (
  authority_id bigint NOT NULL REFERENCES integrated_design_authority(authority_id) ON DELETE CASCADE,
  authority_revision bigint NOT NULL,
  document_set_hash varchar(64) NOT NULL,
  authority_hash varchar(64) NOT NULL,
  composite_json jsonb NOT NULL,
  source_hash varchar(64) NOT NULL,
  design_set_hash varchar(64) NOT NULL,
  design_catalog_hash varchar(64) NOT NULL,
  endpoint_catalog_hash varchar(64) NOT NULL,
  package_binding_hash varchar(64) NOT NULL,
  job_id bigint NOT NULL,
  archived_by varchar(100) NOT NULL,
  archived_at timestamp NOT NULL DEFAULT current_timestamp,
  PRIMARY KEY(authority_id,authority_revision)
);

CREATE OR REPLACE FUNCTION archive_integrated_design_authority()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.document_set_hash IS DISTINCT FROM NEW.document_set_hash
     OR OLD.authority_hash IS DISTINCT FROM NEW.authority_hash
     OR OLD.composite_json IS DISTINCT FROM NEW.composite_json
     OR OLD.contract_id IS DISTINCT FROM NEW.contract_id
     OR OLD.selected_blueprint_id IS DISTINCT FROM NEW.selected_blueprint_id
     OR OLD.ownership_strategy IS DISTINCT FROM NEW.ownership_strategy
     OR OLD.source_hash IS DISTINCT FROM NEW.source_hash
     OR OLD.design_set_hash IS DISTINCT FROM NEW.design_set_hash
     OR OLD.design_catalog_hash IS DISTINCT FROM NEW.design_catalog_hash
     OR OLD.endpoint_catalog_hash IS DISTINCT FROM NEW.endpoint_catalog_hash
     OR OLD.package_binding_hash IS DISTINCT FROM NEW.package_binding_hash
     OR OLD.job_id IS DISTINCT FROM NEW.job_id THEN
    INSERT INTO integrated_design_authority_version(
      authority_id,authority_revision,document_set_hash,authority_hash,composite_json,
      source_hash,design_set_hash,design_catalog_hash,endpoint_catalog_hash,
      package_binding_hash,job_id,archived_by)
    VALUES(OLD.authority_id,OLD.authority_revision,OLD.document_set_hash,
      OLD.authority_hash,OLD.composite_json,OLD.source_hash,OLD.design_set_hash,
      OLD.design_catalog_hash,OLD.endpoint_catalog_hash,OLD.package_binding_hash,
      OLD.job_id,coalesce(NEW.updated_by,'SYSTEM'))
    ON CONFLICT DO NOTHING;
    NEW.authority_revision:=OLD.authority_revision+1;
    NEW.updated_at:=current_timestamp;
  ELSE
    RETURN NULL;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER trg_archive_integrated_design_authority
BEFORE UPDATE ON integrated_design_authority
FOR EACH ROW EXECUTE FUNCTION archive_integrated_design_authority();

CREATE INDEX ix_integrated_design_authority_hash
  ON integrated_design_authority(authority_hash,document_set_hash);

CREATE TABLE integrated_design_scope_binding (
  binding_id bigserial PRIMARY KEY,
  authority_id bigint NOT NULL REFERENCES integrated_design_authority(authority_id) ON DELETE RESTRICT,
  authority_revision bigint NOT NULL CHECK(authority_revision>0),
  scope_type varchar(10) NOT NULL CHECK(scope_type IN('GLOBAL','PROJECT')),
  project_id varchar(64),
  design_version integer,
  contract_sha256 varchar(64),
  process_code varchar(100) NOT NULL,
  step_code varchar(100) NOT NULL,
  route_path varchar(500) NOT NULL,
  audience varchar(20) NOT NULL CHECK(audience IN('USER','ADMIN')),
  document_set_hash varchar(64) NOT NULL CHECK(document_set_hash~'^[0-9a-f]{64}$'),
  authority_hash varchar(64) NOT NULL CHECK(authority_hash~'^[0-9a-f]{64}$'),
  provenance_hash varchar(64) NOT NULL CHECK(provenance_hash~'^[0-9a-f]{64}$'),
  bound_by varchar(100) NOT NULL,
  bound_at timestamp NOT NULL DEFAULT current_timestamp,
  CHECK((scope_type='GLOBAL' AND project_id IS NULL AND design_version IS NULL
          AND contract_sha256 IS NULL)
     OR (scope_type='PROJECT' AND project_id~'^[A-Z][A-Z0-9_-]{2,63}$'
          AND design_version>0 AND contract_sha256~'^[0-9a-f]{64}$')),
  CHECK(route_path=lower(split_part(route_path,'?',1)) AND route_path~'^/')
);

CREATE UNIQUE INDEX uq_integrated_design_scope_binding_release
  ON integrated_design_scope_binding(
    scope_type,project_id,design_version,authority_id,authority_revision) NULLS NOT DISTINCT;
CREATE INDEX ix_integrated_design_scope_binding_project
  ON integrated_design_scope_binding(project_id,design_version,contract_sha256);
CREATE INDEX ix_integrated_design_scope_binding_identity
  ON integrated_design_scope_binding(process_code,step_code,route_path,audience,bound_at);

CREATE TABLE integrated_design_notification_template (
  template_code varchar(120) PRIMARY KEY,
  title_template varchar(300) NOT NULL CHECK(btrim(title_template)<>''),
  message_template varchar(1000) NOT NULL CHECK(btrim(message_template)<>''),
  active_yn char(1) NOT NULL DEFAULT 'Y' CHECK(active_yn IN('Y','N')),
  updated_by varchar(100) NOT NULL,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  CHECK(template_code=btrim(template_code) AND template_code~'^[A-Z][A-Z0-9_:-]{1,119}$')
);

-- Runtime notifications are emitted transactionally with the process event.
-- Only IN_APP is executable in v1. EMAIL/WEBHOOK are retained as explicit
-- terminal UNSUPPORTED evidence and never cause a network call.
CREATE TABLE integrated_design_notification_outbox (
  notification_id bigserial PRIMARY KEY,
  authority_id bigint NOT NULL REFERENCES integrated_design_authority(authority_id) ON DELETE RESTRICT,
  authority_revision bigint NOT NULL CHECK(authority_revision>0),
  authority_hash varchar(64) NOT NULL CHECK(authority_hash~'^[0-9a-f]{64}$'),
  execution_id uuid NOT NULL REFERENCES framework_process_execution(execution_id) ON DELETE RESTRICT,
  event_id bigint NOT NULL REFERENCES framework_process_execution_event(event_id) ON DELETE RESTRICT,
  tenant_id varchar(100) NOT NULL,
  project_id varchar(100) NOT NULL,
  process_code varchar(100) NOT NULL,
  step_code varchar(100) NOT NULL,
  command_code varchar(120) NOT NULL,
  event_code varchar(120) NOT NULL,
  channel varchar(20) NOT NULL CHECK(channel IN('IN_APP','EMAIL','WEBHOOK')),
  recipient_actor_code varchar(120) NOT NULL,
  template_code varchar(120) NOT NULL,
  payload_hash varchar(64) NOT NULL CHECK(payload_hash~'^[0-9a-f]{64}$'),
  delivery_status varchar(20) NOT NULL DEFAULT 'QUEUED' CHECK(delivery_status IN(
    'QUEUED','DELIVERING','RETRY_WAIT','DELIVERED','DEAD_LETTERED',
    'UNSUPPORTED','CANCELLED')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK(max_attempts BETWEEN 1 AND 5),
  lease_token uuid,
  lease_until timestamp,
  next_attempt_at timestamp NOT NULL DEFAULT current_timestamp,
  last_error varchar(1000),
  delivery_receipt jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivered_at timestamp,
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(event_id,event_code,channel,recipient_actor_code)
);
CREATE INDEX ix_integrated_design_notification_delivery
  ON integrated_design_notification_outbox(delivery_status,next_attempt_at,notification_id);
CREATE INDEX ix_integrated_design_notification_project
  ON integrated_design_notification_outbox(project_id,process_code,step_code,event_id);

CREATE TABLE integrated_design_notification_inbox (
  inbox_id bigserial PRIMARY KEY,
  notification_id bigint NOT NULL REFERENCES integrated_design_notification_outbox(notification_id)
    ON DELETE RESTRICT,
  tenant_id varchar(100) NOT NULL,
  project_id varchar(100) NOT NULL,
  account_id varchar(100) NOT NULL,
  actor_code varchar(120) NOT NULL,
  payload_hash varchar(64) NOT NULL CHECK(payload_hash~'^[0-9a-f]{64}$'),
  title varchar(300) NOT NULL,
  message_text varchar(1000) NOT NULL,
  target_url varchar(500) NOT NULL,
  read_at timestamp,
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(notification_id,account_id)
);
CREATE INDEX ix_integrated_design_notification_inbox_account
  ON integrated_design_notification_inbox(tenant_id,lower(account_id),read_at,created_at DESC);

CREATE OR REPLACE FUNCTION deliver_integrated_design_notifications(p_limit integer DEFAULT 25)
RETURNS TABLE(picked_count integer,delivered_count integer,retried_count integer,
              dead_letter_count integer)
LANGUAGE plpgsql AS $$
DECLARE
  item integrated_design_notification_outbox%ROWTYPE;
  recipient_count integer;
BEGIN
  picked_count:=0;delivered_count:=0;retried_count:=0;dead_letter_count:=0;
  FOR item IN
    SELECT outbox.* FROM integrated_design_notification_outbox outbox
     WHERE (outbox.delivery_status IN('QUEUED','RETRY_WAIT')
              AND outbox.next_attempt_at<=current_timestamp)
        OR (outbox.delivery_status='DELIVERING' AND outbox.lease_until<current_timestamp)
     ORDER BY outbox.next_attempt_at,outbox.notification_id
     FOR UPDATE SKIP LOCKED LIMIT greatest(1,least(coalesce(p_limit,25),100))
  LOOP
    picked_count:=picked_count+1;
    UPDATE integrated_design_notification_outbox SET delivery_status='DELIVERING',
           lease_token=gen_random_uuid(),lease_until=current_timestamp+interval '2 minutes'
     WHERE notification_id=item.notification_id
       AND (delivery_status IN('QUEUED','RETRY_WAIT')
         OR (delivery_status='DELIVERING' AND lease_until<current_timestamp));
    SELECT * INTO item FROM integrated_design_notification_outbox
     WHERE notification_id=item.notification_id;
    BEGIN
      IF item.channel<>'IN_APP' THEN
        UPDATE integrated_design_notification_outbox SET delivery_status='UNSUPPORTED',
               attempt_count=attempt_count+1,lease_token=NULL,lease_until=NULL,
               last_error='UNSUPPORTED_NOTIFICATION_CHANNEL',
               delivery_receipt=jsonb_build_object('networkAttemptCount',0,'terminal',true)
         WHERE notification_id=item.notification_id AND lease_token=item.lease_token;
        dead_letter_count:=dead_letter_count+1;
        CONTINUE;
      END IF;
      INSERT INTO integrated_design_notification_inbox(
        notification_id,tenant_id,project_id,account_id,actor_code,payload_hash,title,
        message_text,target_url)
      SELECT DISTINCT item.notification_id,item.tenant_id,item.project_id,
             ready.account_id,item.recipient_actor_code,item.payload_hash,
             template.title_template,template.message_template,authority.route_path
        FROM integrated_design_authority authority
        JOIN integrated_design_notification_template template
          ON template.template_code=item.template_code AND template.active_yn='Y'
        CROSS JOIN LATERAL (
          SELECT assignment.account_id
            FROM framework_account_actor_assignment assignment
            JOIN framework_actor_definition actor
              ON actor.actor_code=assignment.actor_code AND actor.use_at='Y'
            JOIN comtnemplyrinfo account
              ON lower(account.emplyr_id)=lower(assignment.account_id)
             AND account.emplyr_sttus_code IN('P','A')
            JOIN comtnemplyrscrtyestbs security
              ON security.scrty_dtrmn_trget_id=account.esntl_id
             AND nullif(btrim(security.author_code),'') IS NOT NULL
           WHERE assignment.actor_code=item.recipient_actor_code
             AND assignment.tenant_id=item.tenant_id
             AND assignment.assignment_status='ACTIVE'
             AND (assignment.valid_from IS NULL OR assignment.valid_from<=current_date)
             AND (assignment.valid_until IS NULL OR assignment.valid_until>=current_date)
             AND (assignment.project_id='*' OR (
               assignment.project_id=item.project_id AND EXISTS(
                 SELECT 1 FROM framework_project_actor_assignment project_assignment
                  WHERE project_assignment.project_id=item.project_id
                    AND project_assignment.actor_code=assignment.actor_code
                    AND lower(project_assignment.user_id)=lower(assignment.account_id)
                    AND project_assignment.active_yn='Y')))
          UNION
          SELECT assignment.account_id
            FROM framework_account_actor_assignment assignment
            JOIN framework_actor_definition actor
              ON actor.actor_code=assignment.actor_code AND actor.use_at='Y'
            JOIN comtnentrprsmber account
              ON lower(account.entrprs_mber_id)=lower(assignment.account_id)
             AND account.entrprs_mber_sttus IN('P','A')
            JOIN comtnemplyrscrtyestbs security
              ON security.scrty_dtrmn_trget_id=account.esntl_id
             AND nullif(btrim(security.author_code),'') IS NOT NULL
           WHERE assignment.actor_code=item.recipient_actor_code
             AND assignment.tenant_id=item.tenant_id
             AND assignment.assignment_status='ACTIVE'
             AND (assignment.valid_from IS NULL OR assignment.valid_from<=current_date)
             AND (assignment.valid_until IS NULL OR assignment.valid_until>=current_date)
             AND (assignment.project_id='*' OR (
               assignment.project_id=item.project_id AND EXISTS(
                 SELECT 1 FROM framework_project_actor_assignment project_assignment
                  WHERE project_assignment.project_id=item.project_id
                    AND project_assignment.actor_code=assignment.actor_code
                    AND lower(project_assignment.user_id)=lower(assignment.account_id)
                    AND project_assignment.active_yn='Y')))
        ) ready
       WHERE authority.authority_id=item.authority_id
         AND (authority.authority_revision=item.authority_revision
           AND authority.authority_hash=item.authority_hash OR EXISTS(
             SELECT 1 FROM integrated_design_authority_version version
              WHERE version.authority_id=item.authority_id
                AND version.authority_revision=item.authority_revision
                AND version.authority_hash=item.authority_hash))
      ON CONFLICT(notification_id,account_id) DO NOTHING;
      SELECT count(*)::integer INTO recipient_count
        FROM integrated_design_notification_inbox inbox
       WHERE inbox.notification_id=item.notification_id;
      IF recipient_count<1 THEN RAISE EXCEPTION 'ACTIVE_RELAY_RECIPIENT_REQUIRED'; END IF;
      UPDATE integrated_design_notification_outbox SET delivery_status='DELIVERED',
             attempt_count=attempt_count+1,delivered_at=current_timestamp,last_error=NULL,
             lease_token=NULL,lease_until=NULL,
             delivery_receipt=jsonb_build_object('recipientCount',recipient_count,
               'networkAttemptCount',0,'deliveredAt',current_timestamp)
       WHERE notification_id=item.notification_id AND lease_token=item.lease_token;
      delivered_count:=delivered_count+1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE integrated_design_notification_outbox SET
             attempt_count=attempt_count+1,
             delivery_status=CASE WHEN attempt_count+1>=max_attempts
                                  THEN 'DEAD_LETTERED' ELSE 'RETRY_WAIT' END,
             next_attempt_at=current_timestamp+
               make_interval(secs=>least(3600,30*(1<<least(attempt_count,6)))),
             last_error=left(SQLSTATE||':'||SQLERRM,1000),lease_token=NULL,lease_until=NULL,
             delivery_receipt=jsonb_build_object('networkAttemptCount',0,
               'terminal',attempt_count+1>=max_attempts)
       WHERE notification_id=item.notification_id AND lease_token=item.lease_token;
      IF item.attempt_count+1>=item.max_attempts THEN
        dead_letter_count:=dead_letter_count+1;
      ELSE retried_count:=retried_count+1; END IF;
    END;
  END LOOP;
  RETURN NEXT;
END
$$;

CREATE OR REPLACE FUNCTION framework_composite_dependency_fingerprint(
  p_process_code varchar)
RETURNS varchar
LANGUAGE sql STABLE AS $$
WITH actor_codes(actor_code) AS (
  SELECT owner_actor_code FROM framework_process_definition WHERE process_code=p_process_code
  UNION SELECT actor_code FROM framework_process_step WHERE process_code=p_process_code
  UNION SELECT escalation_actor_code FROM framework_process_step
    WHERE process_code=p_process_code AND nullif(btrim(escalation_actor_code),'') IS NOT NULL
  UNION SELECT btrim(value) FROM framework_process_step step
    CROSS JOIN LATERAL regexp_split_to_table(
      coalesce(step.segregation_actor_codes,''),E'\\s*,\\s*') value
    WHERE step.process_code=p_process_code AND nullif(btrim(value),'') IS NOT NULL
  UNION SELECT actor_code FROM framework_professional_screen_contract
    WHERE process_code=p_process_code
  UNION SELECT actor_code FROM framework_process_step_screen_binding
    WHERE process_code=p_process_code AND binding_status='ACTIVE'
), database_tables(table_name) AS (
  SELECT change->>'tableName'
    FROM integrated_design_document document
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(
      framework_try_jsonb(document.content)#>'{payload,schemaChanges}')='array'
      THEN framework_try_jsonb(document.content)#>'{payload,schemaChanges}'
      ELSE '[]'::jsonb END) change
   WHERE document.process_code=p_process_code AND document.document_type='DATABASE'
     AND change->>'tableName' IS NOT NULL
  UNION
  SELECT column_value#>>'{references,table}'
    FROM integrated_design_document document
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(
      framework_try_jsonb(document.content)#>'{payload,schemaChanges}')='array'
      THEN framework_try_jsonb(document.content)#>'{payload,schemaChanges}'
      ELSE '[]'::jsonb END) change
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(change->'columns')='array'
      THEN change->'columns' ELSE '[]'::jsonb END) column_value
   WHERE document.process_code=p_process_code AND document.document_type='DATABASE'
     AND column_value#>>'{references,table}' IS NOT NULL
), material(kind,identity,payload) AS (
  SELECT 'CLOCK_DATE','CURRENT_DATE',to_jsonb(current_date)::text
  UNION ALL SELECT 'PROCESS',process.process_code,to_jsonb(process)::text
    FROM framework_process_definition process WHERE process.process_code=p_process_code
  UNION ALL SELECT 'STEP',step.step_code,to_jsonb(step)::text
    FROM framework_process_step step WHERE step.process_code=p_process_code
  UNION ALL SELECT 'TARGET',target.step_code||E'\x1f'||target.route_path||E'\x1f'||target.audience,
    to_jsonb(target)::text FROM framework_composite_design_target_identity target
    WHERE target.process_code=p_process_code
  UNION ALL SELECT 'CONTRACT',contract.contract_id::text,to_jsonb(contract)::text
    FROM framework_professional_screen_contract contract WHERE contract.process_code=p_process_code
  UNION ALL SELECT 'BLUEPRINT',blueprint.blueprint_id::text,to_jsonb(blueprint)::text
    FROM framework_screen_blueprint blueprint WHERE blueprint.process_code=p_process_code
  UNION ALL SELECT 'SCREEN_RESOURCE',resource.screen_resource_id::text,to_jsonb(resource)::text
    FROM framework_screen_resource resource WHERE EXISTS(
      SELECT 1 FROM framework_composite_design_target_identity target
       WHERE target.process_code=p_process_code
         AND target.route_path=lower(split_part(resource.route_key,'?',1)))
  UNION ALL SELECT 'DOCUMENT',document.document_id::text,to_jsonb(document)::text
    FROM integrated_design_document document WHERE document.process_code=p_process_code
  -- Physical generation changes these two fields after SOURCE compilation. They are
  -- evidence outputs, not source dependencies, and must not invalidate their own receipt.
  UNION ALL SELECT 'EXECUTION_SPEC',spec.step_code,
    (to_jsonb(spec)-'generation_status'-'updated_at')::text
    FROM framework_step_execution_spec spec WHERE spec.process_code=p_process_code
  UNION ALL SELECT 'STEP_SCHEMA',schema.step_code,to_jsonb(schema)::text
    FROM framework_step_schema_set schema WHERE schema.process_code=p_process_code
  UNION ALL SELECT 'AUTHORITY',authority.authority_id::text,to_jsonb(authority)::text
    FROM integrated_design_authority authority WHERE authority.process_code=p_process_code
  UNION ALL SELECT 'SCOPE',binding.binding_id::text,to_jsonb(binding)::text
    FROM integrated_design_scope_binding binding WHERE binding.process_code=p_process_code
  UNION ALL SELECT 'REQUIREMENT',requirement.step_code||E'\x1f'||
    requirement.permission_code||E'\x1f'||requirement.scope_type,to_jsonb(requirement)::text
    FROM framework_permission_requirement_v1 requirement WHERE requirement.process_code=p_process_code
  UNION ALL SELECT 'ACTOR',actor.actor_code,to_jsonb(actor)::text
    FROM framework_actor_definition actor JOIN actor_codes USING(actor_code)
  UNION ALL SELECT 'ASSIGNMENT',assignment.assignment_id::text,to_jsonb(assignment)::text
    FROM framework_account_actor_assignment assignment JOIN actor_codes USING(actor_code)
  UNION ALL SELECT 'GRANT',grant_row.actor_code||E'\x1f'||grant_row.permission_code||E'\x1f'||
    grant_row.scope_type||E'\x1f'||grant_row.effect,to_jsonb(grant_row)::text
    FROM framework_permission_grant_v1 grant_row JOIN actor_codes USING(actor_code)
  UNION ALL SELECT 'PROJECT_ASSIGNMENT',assignment.project_id||E'\x1f'||assignment.actor_code||
    E'\x1f'||lower(assignment.user_id),to_jsonb(assignment)::text
    FROM framework_project_actor_assignment assignment JOIN actor_codes USING(actor_code)
  UNION ALL SELECT 'EMPLOYEE',employee.emplyr_id,to_jsonb(employee)::text
    FROM comtnemplyrinfo employee WHERE EXISTS(
      SELECT 1 FROM framework_account_actor_assignment assignment JOIN actor_codes USING(actor_code)
       WHERE lower(assignment.account_id)=lower(employee.emplyr_id))
  UNION ALL SELECT 'MEMBER',member.entrprs_mber_id,to_jsonb(member)::text
    FROM comtnentrprsmber member WHERE EXISTS(
      SELECT 1 FROM framework_account_actor_assignment assignment JOIN actor_codes USING(actor_code)
       WHERE lower(assignment.account_id)=lower(member.entrprs_mber_id))
  UNION ALL SELECT 'SECURITY',security.scrty_dtrmn_trget_id,to_jsonb(security)::text
    FROM comtnemplyrscrtyestbs security WHERE EXISTS(
      SELECT 1 FROM framework_account_actor_assignment assignment JOIN actor_codes USING(actor_code)
      LEFT JOIN comtnemplyrinfo employee
        ON lower(employee.emplyr_id)=lower(assignment.account_id)
      LEFT JOIN comtnentrprsmber member
        ON lower(member.entrprs_mber_id)=lower(assignment.account_id)
       WHERE security.scrty_dtrmn_trget_id=coalesce(employee.esntl_id,member.esntl_id))
  UNION ALL SELECT 'NOTIFICATION_TEMPLATE',template.template_code,to_jsonb(template)::text
    FROM integrated_design_notification_template template
  UNION ALL SELECT 'THEME',theme.theme_id,to_jsonb(theme)::text FROM comtnthemedefinition theme
  UNION ALL SELECT 'SECTION',section.section_id,to_jsonb(section)::text FROM ui_section_registry section
  UNION ALL SELECT 'COMPONENT',component.component_id,to_jsonb(component)::text
    FROM ui_component_registry component
  UNION ALL SELECT 'DB_RELATION',relation.relname,
    jsonb_build_object('relkind',relation.relkind,'comment',obj_description(relation.oid,'pg_class'))::text
    FROM pg_class relation JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
    JOIN database_tables target ON target.table_name=relation.relname
   WHERE namespace.nspname=current_schema()
  UNION ALL SELECT 'DB_COLUMN',relation.relname||E'\x1f'||attribute.attnum,
    jsonb_build_object('name',attribute.attname,
      'type',format_type(attribute.atttypid,attribute.atttypmod),
      'notNull',attribute.attnotnull,
      'default',pg_get_expr(default_value.adbin,default_value.adrelid))::text
    FROM pg_class relation JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
    JOIN database_tables target ON target.table_name=relation.relname
    JOIN pg_attribute attribute ON attribute.attrelid=relation.oid
      AND attribute.attnum>0 AND NOT attribute.attisdropped
    LEFT JOIN pg_attrdef default_value ON default_value.adrelid=relation.oid
      AND default_value.adnum=attribute.attnum
   WHERE namespace.nspname=current_schema()
  UNION ALL SELECT 'DB_INDEX',relation.relname||E'\x1f'||index_class.relname,
    jsonb_build_object('definition',pg_get_indexdef(index.indexrelid),
      'primary',index.indisprimary,'unique',index.indisunique)::text
    FROM pg_class relation JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
    JOIN database_tables target ON target.table_name=relation.relname
    JOIN pg_index index ON index.indrelid=relation.oid
    JOIN pg_class index_class ON index_class.oid=index.indexrelid
   WHERE namespace.nspname=current_schema()
  UNION ALL SELECT 'DB_CONSTRAINT',relation.relname||E'\x1f'||constraint_row.conname,
    jsonb_build_object('type',constraint_row.contype,
      'definition',pg_get_constraintdef(constraint_row.oid,true))::text
    FROM pg_class relation JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
    JOIN database_tables target ON target.table_name=relation.relname
    JOIN pg_constraint constraint_row ON constraint_row.conrelid=relation.oid
   WHERE namespace.nspname=current_schema()
)
SELECT encode(sha256(convert_to(coalesce(string_agg(
  kind||E'\x1f'||identity||E'\x1f'||payload,E'\n'
  ORDER BY kind COLLATE "C",identity COLLATE "C",payload COLLATE "C"),''),'UTF8')),'hex')
  FROM material
$$;

CREATE TABLE integrated_design_autocompletion_receipt (
  process_code varchar(100) PRIMARY KEY,
  completion_status varchar(60) NOT NULL CHECK(completion_status IN(
    'PENDING','RUNNING','SOURCE_APPLIED_GENERATION_QUEUED',
    'SOURCE_APPLIED_UNCHANGED','SOURCE_APPLIED_PHYSICAL_QUEUED',
    'PHYSICAL_GENERATED_VERIFIED','PHYSICAL_FAILED','BLOCKED')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
  lease_token uuid,
  lease_until timestamp,
  screen_count integer NOT NULL DEFAULT 0 CHECK(screen_count>=0),
  document_count integer NOT NULL DEFAULT 0 CHECK(document_count>=0),
  authority_count integer NOT NULL DEFAULT 0 CHECK(authority_count>=0),
  job_id bigint,
  blocker_code varchar(1000),
  receipt_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  dependency_fingerprint varchar(64) NOT NULL
    CHECK(dependency_fingerprint~'^[0-9a-f]{64}$'),
  started_at timestamp,
  completed_at timestamp,
  duration_ms bigint CHECK(duration_ms IS NULL OR duration_ms>=0),
  updated_at timestamp NOT NULL DEFAULT current_timestamp
);
CREATE INDEX ix_integrated_design_autocompletion_work
  ON integrated_design_autocompletion_receipt(completion_status,lease_until,process_code);
INSERT INTO integrated_design_autocompletion_receipt(
  process_code,completion_status,dependency_fingerprint,receipt_json)
SELECT DISTINCT contract.process_code,'PENDING',
       framework_composite_dependency_fingerprint(contract.process_code),
       jsonb_build_object('requestedScope',jsonb_build_object(
         'scopeType','GLOBAL','source','MIGRATION_GLOBAL_TARGET'))
  FROM framework_composite_design_target_identity contract
ON CONFLICT(process_code) DO NOTHING;

-- Upgrade only machine-owned workbench material.  Approved, verified, and
-- manually edited documents are preserved byte-for-byte and must be explicitly
-- adopted into the executable schema by their owner.
CREATE OR REPLACE FUNCTION refresh_integrated_design_axis_documents(
  p_process_code varchar DEFAULT NULL,
  p_replace_legacy boolean DEFAULT false
) RETURNS TABLE(updated_count bigint,protected_count bigint,ambiguous_count bigint)
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated bigint:=0;
  v_protected bigint:=0;
  v_ambiguous bigint:=0;
BEGIN
  WITH contexts AS MATERIALIZED (
    SELECT contract.contract_id,contract.process_code,contract.step_code,
           lower(split_part(contract.route_path,'?',1)) route_path,
           upper(contract.audience) audience,contract.actor_code,
           contract.business_purpose,contract.entry_condition,contract.exit_condition,
           framework_try_jsonb(contract.kpi_contract) kpis,
           framework_try_jsonb(contract.section_contract) sections,
           framework_try_jsonb(contract.field_contract) fields,
           framework_try_jsonb(contract.command_contract) commands,
           framework_try_jsonb(contract.state_contract) states,
           framework_try_jsonb(contract.api_contract) operations,
           CASE WHEN jsonb_typeof(framework_try_jsonb(contract.data_contract))='object'
             THEN coalesce(framework_try_jsonb(contract.data_contract)->'entities','[]'::jsonb)
             WHEN jsonb_typeof(framework_try_jsonb(contract.data_contract))='array'
             THEN framework_try_jsonb(contract.data_contract) ELSE '[]'::jsonb END entities,
           coalesce(framework_try_jsonb(contract.data_contract)->>'migrationMode',
             'REVIEW_REQUIRED') database_migration_mode,
           coalesce(framework_try_jsonb(contract.data_contract)->>'schemaFingerprint','')
             database_schema_fingerprint,
           coalesce(framework_try_jsonb(contract.data_contract)->'schemaChanges','[]'::jsonb)
             database_schema_changes,
           coalesce((select jsonb_agg(item order by ordinality)
             from jsonb_array_elements(CASE WHEN jsonb_typeof(
               framework_try_jsonb(contract.evidence_contract))='array'
               THEN framework_try_jsonb(contract.evidence_contract) ELSE '[]'::jsonb END)
               with ordinality source(item,ordinality)
            where coalesce(item->>'markerType','')<>'COMPOSITE_EXECUTABLE_DESIGN_AUTHORITY'),
             '[]'::jsonb) evidence,
           contract.responsive_contract,contract.accessibility_contract,
           contract.security_contract,contract.permission_codes,
           contract.api_verified,contract.database_verified,contract.authority_verified,
           contract.responsive_verified,contract.accessibility_verified,
           contract.exception_states_verified,contract.audit_evidence_ref,
           process.domain_code work_type_code,coalesce(process.owner_actor_code,step.actor_code) owner_actor_code,
           step.step_order,primary_contract.command_code,
           transition_contract.from_state,transition_contract.to_state,
           step.completion_rule,step.requires_notification,
           coalesce((select jsonb_object_agg(
               coalesce(field->>'fieldCode',field->>'code'),
               lower(coalesce(field->>'dataType',field->>'type')) order by ordinality)
             from jsonb_array_elements(case when jsonb_typeof(
               framework_try_jsonb(contract.field_contract))='array'
               then framework_try_jsonb(contract.field_contract) else '[]'::jsonb end)
               with ordinality item(field,ordinality)
            where upper(coalesce(field->>'direction',''))<>'OUTPUT'),'{}'::jsonb) step_inputs,
           coalesce((select jsonb_object_agg(
               coalesce(field->>'fieldCode',field->>'code'),
               lower(coalesce(field->>'dataType',field->>'type')) order by ordinality)
             from jsonb_array_elements(case when jsonb_typeof(
               framework_try_jsonb(contract.field_contract))='array'
               then framework_try_jsonb(contract.field_contract) else '[]'::jsonb end)
               with ordinality item(field,ordinality)
            where upper(coalesce(field->>'direction',''))<>'INPUT'),'{}'::jsonb) step_outputs,
            blueprint.blueprint_id,blueprint.implementation_strategy,
            coalesce(nullif(framework_try_jsonb(blueprint.specification_json)->>'layout',''),
              (select min(resource.layout_type) from framework_screen_resource resource
                where resource.route_key=lower(split_part(contract.route_path,'?',1))
                having count(distinct resource.layout_type)=1)) layout_code,
            nullif(framework_try_jsonb(blueprint.specification_json)->>'theme','') theme_code,
           coalesce(framework_try_jsonb(blueprint.specification_json)->'assetBindings','[]'::jsonb)
             asset_bindings,
           CASE WHEN candidate_count=1 AND blueprint.implementation_strategy='ADOPT_EXISTING'
                  THEN 'PRESERVE_ADOPT'
                WHEN candidate_count=1 THEN 'EXACT_SINGLE'
                ELSE 'EXPLICIT_CONTRACT_LINK' END ownership_strategy
      FROM framework_professional_screen_contract contract
      JOIN framework_composite_design_target_identity target
        ON target.contract_id=contract.contract_id
      JOIN framework_process_definition process
        ON process.process_code=contract.process_code
      JOIN framework_process_step step
        ON step.process_code=contract.process_code
       AND step.step_code=contract.step_code
      LEFT JOIN LATERAL (
        SELECT min(command->>'commandCode') command_code
          FROM jsonb_array_elements(case when jsonb_typeof(
            framework_try_jsonb(contract.command_contract))='array'
            then framework_try_jsonb(contract.command_contract) else '[]'::jsonb end) command
         WHERE command->>'primary'='true'
        HAVING count(*)=1
      ) primary_contract ON true
      LEFT JOIN LATERAL (
        SELECT min(state->>'fromState') from_state,min(state->>'toState') to_state
          FROM jsonb_array_elements(case when jsonb_typeof(
            framework_try_jsonb(contract.state_contract))='array'
            then framework_try_jsonb(contract.state_contract) else '[]'::jsonb end) state
         WHERE state->>'commandCode'=primary_contract.command_code
        HAVING count(*)=1
      ) transition_contract ON true
      JOIN LATERAL (
        SELECT candidate.*,
               count(*) OVER() candidate_count,
               count(*) FILTER(WHERE candidate.transition_status='CONTRACT_LINKED'
                 AND lower(btrim(coalesce(candidate.source_reference,''))) IN(
                   'professional_screen_contract:'||contract.contract_id,
                   'framework_professional_screen_contract:'||contract.contract_id)) OVER()
                 explicit_count
          FROM framework_screen_blueprint candidate
         WHERE candidate.process_code=contract.process_code
           AND candidate.step_code=contract.step_code
           AND upper(candidate.audience)=upper(contract.audience)
           AND lower(split_part(candidate.route_path,'?',1))=
               lower(split_part(contract.route_path,'?',1))
           AND candidate.validation_status='VALID'
      ) blueprint ON blueprint.candidate_count=1 OR blueprint.explicit_count=1
        AND blueprint.transition_status='CONTRACT_LINKED'
        AND lower(btrim(coalesce(blueprint.source_reference,''))) IN(
          'professional_screen_contract:'||contract.contract_id,
          'framework_professional_screen_contract:'||contract.contract_id)
     WHERE p_process_code IS NULL OR contract.process_code=p_process_code
  ), documents(document_type,title) AS (
    VALUES ('REQUIREMENT','업무·요구사항'),('ACTOR_RACI','액터·RACI'),
      ('AUTHORITY','권한·데이터 범위'),('PROCESS','프로세스·분기'),
      ('STATE','상태 전이'),('NAVIGATION','화면 흐름·라우팅'),
      ('ACTIVE_UI','액티브 UI·레이아웃'),('DESIGN_ASSET','테마·섹션·컴포넌트'),
      ('FIELD_DICTIONARY','필드·데이터 사전'),('DATA_HANDOFF','입출력·데이터 연계'),
      ('DATABASE','DB·스키마'),('API','API·이벤트'),
      ('BUSINESS_RULE','업무 규칙·계산식'),('VALIDATION','검증·오류·예외'),
      ('NOTIFICATION','알림·기한·에스컬레이션'),('TEST','테스트 시나리오·기대값'),
      ('TASK_EVIDENCE','개발 태스크·산출물·증적'),('RELEASE_AUDIT','배포·감사·복구')
  ), projected AS MATERIALIZED (
    SELECT context.*,document.document_type,document.title,
      jsonb_build_object(
        'schemaVersion','carbonet.integrated-design-axis/v1',
        'documentType',document.document_type,'axisVersion','1.0.0',
        'identity',jsonb_build_object(
          'contractId',context.contract_id,'processCode',context.process_code,
          'stepCode',context.step_code,'routePath',context.route_path,
          'audience',context.audience,'selectedBlueprintId',context.blueprint_id,
          'ownershipStrategy',context.ownership_strategy,
          'ownershipJustification','LIVE_CONTRACT_BACKFILL exact canonical ownership'),
        'payload',CASE document.document_type
          WHEN 'REQUIREMENT' THEN jsonb_build_object(
            'workTypeCode',work_type_code,'businessPurpose',business_purpose,
            'entryCondition',entry_condition,'exitCondition',exit_condition,
            'kpis',kpis)
          WHEN 'ACTOR_RACI' THEN jsonb_build_object(
            'actorCode',actor_code,'ownerActorCode',owner_actor_code,
            'responsibleActorCodes',jsonb_build_array(actor_code),
            'accountBindingMode','RUNTIME_AUTHORITY','relayTestRequired',false)
          WHEN 'AUTHORITY' THEN jsonb_build_object(
            'permissionCodes',permission_codes,'securityContract',security_contract,
            'serverEnforced',authority_verified)
          WHEN 'PROCESS' THEN jsonb_build_object(
            'stepOrder',step_order,'commandCode',command_code,'fromState',from_state,
            'toState',to_state,'completionRule',completion_rule,
            'commands',commands)
          WHEN 'STATE' THEN jsonb_build_object('states',states)
          WHEN 'NAVIGATION' THEN jsonb_build_object(
            'routePath',route_path,'audience',audience,'nextRoutes','[]'::jsonb)
          WHEN 'ACTIVE_UI' THEN jsonb_build_object(
            'sectionOrder',coalesce((select jsonb_agg(
              section->>'sectionId' order by ordinality)
              from jsonb_array_elements(CASE WHEN jsonb_typeof(sections)='array'
                THEN sections ELSE '[]'::jsonb END) with ordinality item(section,ordinality)),'[]'::jsonb),
            'responsiveContract',responsive_contract,
            'accessibilityContract',accessibility_contract,
            'responsiveVerified',responsive_verified,
            'accessibilityVerified',accessibility_verified)
          WHEN 'DESIGN_ASSET' THEN jsonb_build_object(
            'layout',layout_code,'theme',theme_code,
            'sections',sections,'assetBindings',asset_bindings,
            'adoptMutationPolicy',CASE WHEN implementation_strategy='ADOPT_EXISTING'
              THEN 'PRESERVE' ELSE 'NOT_APPLICABLE' END)
          WHEN 'FIELD_DICTIONARY' THEN jsonb_build_object('fields',coalesce((
            select jsonb_agg(jsonb_build_object(
              'fieldCode',coalesce(field->>'fieldCode',field->>'code'),
              'label',coalesce(field->>'label',field->>'fieldLabel'),
              'direction',field->>'direction','dataSource',field->>'dataSource',
              'dataType',upper(coalesce(field->>'dataType',field->>'type')),
              'required',case when jsonb_typeof(field->'required')='boolean'
                then (field->>'required')::boolean else null end,
              'componentCode',field->>'componentCode') order by ordinality)
              from jsonb_array_elements(case when jsonb_typeof(fields)='array'
                then fields else '[]'::jsonb end) with ordinality item(field,ordinality)
          ),'[]'::jsonb))
          WHEN 'DATA_HANDOFF' THEN jsonb_build_object(
            'inputs',coalesce((select jsonb_agg(jsonb_build_object(
              'fieldCode',key,'contractPath',key) order by key) from jsonb_each(step_inputs)),'[]'::jsonb),
            'outputs',coalesce((select jsonb_agg(jsonb_build_object(
              'fieldCode',key,'contractPath',key) order by key) from jsonb_each(step_outputs)),'[]'::jsonb))
          WHEN 'DATABASE' THEN jsonb_build_object('entities',entities,'verified',database_verified,
            'migrationMode',database_migration_mode,
            'schemaFingerprint',database_schema_fingerprint,
            'schemaChanges',database_schema_changes)
          WHEN 'API' THEN jsonb_build_object('operations',operations,'verified',api_verified)
          -- Only executable predicates and scenarios that are exactly derivable
          -- from each screen contract are generated. Missing notification
          -- delivery metadata deliberately remains an IN_REVIEW blocker.
          WHEN 'BUSINESS_RULE' THEN jsonb_build_object('rules',coalesce((select jsonb_agg(
            jsonb_build_object('ruleCode',upper(regexp_replace(state->>'commandCode',
                '[^A-Za-z0-9]+','_','g'))||'_STATE_GUARD',
              'commandCode',state->>'commandCode','fieldCode','CURRENT_STATE',
              'operator','EQ','expectedValue',state->>'fromState',
              'errorCode','INVALID_PROCESS_STATE') order by state->>'commandCode')
            from jsonb_array_elements(case when jsonb_typeof(states)='array'
              then states else '[]'::jsonb end) state),'[]'::jsonb))
          WHEN 'VALIDATION' THEN jsonb_build_object('rules',coalesce((select jsonb_agg(
            jsonb_build_object('ruleCode',upper(regexp_replace(operation->>'commandCode',
                '[^A-Za-z0-9]+','_','g'))||'_'||
                upper(regexp_replace(field_code,'[^A-Za-z0-9]+','_','g'))||'_REQUIRED',
              'commandCode',operation->>'commandCode','fieldCode',field_code,
              'operator','REQUIRED','expectedValue','PRESENT',
              'errorCode','REQUIRED_FIELD_MISSING')
              order by operation->>'commandCode',field_code)
            from jsonb_array_elements(case when jsonb_typeof(operations)='array'
              then operations else '[]'::jsonb end) operation
            cross join lateral jsonb_array_elements_text(case when
              jsonb_typeof(operation->'requestFields')='array'
              then operation->'requestFields' else '[]'::jsonb end) field_code),'[]'::jsonb),
            'exceptionStatesVerified',exception_states_verified)
          WHEN 'NOTIFICATION' THEN jsonb_build_object('events','[]'::jsonb)
          WHEN 'TEST' THEN jsonb_build_object('scenarios',coalesce((select jsonb_agg(
            jsonb_build_object('scenarioCode','HAPPY_PATH_'||upper(regexp_replace(
                operation->>'commandCode','[^A-Za-z0-9]+','_','g')),
              'commandCode',operation->>'commandCode',
              'inputValues',coalesce((select jsonb_object_agg(field_code,
                  '__DESIGN_REQUIRED__' order by field_code)
                from jsonb_array_elements_text(case when
                  jsonb_typeof(operation->'requestFields')='array'
                  then operation->'requestFields' else '[]'::jsonb end) field_code),'{}'::jsonb),
              'expectedOutputFields',case when jsonb_typeof(operation->'responseFields')='array'
                then operation->'responseFields' else '[]'::jsonb end,
              'expectedStatus','SUCCESS','assertionCodes',jsonb_build_array(
                'STATUS_MATCH','OUTPUT_FIELDS_MATCH')) order by operation->>'commandCode')
            from jsonb_array_elements(case when jsonb_typeof(operations)='array'
              then operations else '[]'::jsonb end) operation),'[]'::jsonb))
          WHEN 'TASK_EVIDENCE' THEN jsonb_build_object('evidence',evidence)
          WHEN 'RELEASE_AUDIT' THEN jsonb_build_object(
            'auditEvidenceRef',nullif(audit_evidence_ref,''),
            'rollbackPolicy',jsonb_build_object('mode','TRANSACTION_ROLLBACK',
              'preserveManual',true,'preserveAdopt',true))
        END)::text content
      FROM contexts context CROSS JOIN documents document
  )
  INSERT INTO integrated_design_document(
    process_code,step_code,route_path,audience,document_type,title,content,status,updated_by)
  SELECT process_code,step_code,route_path,audience,document_type,title,content,
         'IN_REVIEW','LIVE_CONTRACT_BACKFILL'
    FROM projected
  ON CONFLICT(process_code,step_code,route_path,audience,document_type) DO UPDATE
    SET title=excluded.title,content=excluded.content,status='IN_REVIEW',
        updated_by='LIVE_CONTRACT_BACKFILL'
  WHERE (integrated_design_document.updated_by='LIVE_CONTRACT_BACKFILL'
       OR (p_replace_legacy
           AND integrated_design_document.updated_by='COMPOSITE_MIGRATION_REQUIRED'))
    AND integrated_design_document.status IN('DRAFT','IN_REVIEW','READY')
    AND integrated_design_document.content IS DISTINCT FROM excluded.content;
  GET DIAGNOSTICS v_updated=ROW_COUNT;

  SELECT count(*) INTO v_protected FROM integrated_design_document document
   JOIN framework_composite_design_target_identity target
     ON target.process_code=document.process_code AND target.step_code=document.step_code
    AND target.route_path=document.route_path AND target.audience=document.audience
   WHERE (p_process_code IS NULL OR document.process_code=p_process_code)
     AND (document.updated_by<>'LIVE_CONTRACT_BACKFILL'
       OR document.status IN('APPROVED','VERIFIED'));
  SELECT count(*) INTO v_ambiguous FROM (
    SELECT contract.contract_id
      FROM framework_professional_screen_contract contract
      JOIN framework_composite_design_target_identity target
        ON target.contract_id=contract.contract_id
      JOIN framework_screen_blueprint blueprint
        ON blueprint.process_code=contract.process_code
       AND blueprint.step_code=contract.step_code
       AND upper(blueprint.audience)=upper(contract.audience)
       AND lower(split_part(blueprint.route_path,'?',1))=lower(split_part(contract.route_path,'?',1))
       AND blueprint.validation_status='VALID'
     WHERE p_process_code IS NULL OR contract.process_code=p_process_code
     GROUP BY contract.contract_id
    HAVING count(*)>1 AND count(*) FILTER(WHERE blueprint.transition_status='CONTRACT_LINKED'
      AND lower(btrim(coalesce(blueprint.source_reference,''))) IN(
        'professional_screen_contract:'||contract.contract_id,
        'framework_professional_screen_contract:'||contract.contract_id))<>1
  ) unresolved;
  RETURN QUERY SELECT v_updated,v_protected,v_ambiguous;
END
$$;

COMMENT ON FUNCTION refresh_integrated_design_axis_documents(varchar,boolean) IS
'Regenerates machine-owned 18-axis JSON contracts; preserves manual/approved work and reports unresolved blueprint ownership';

-- Compile every screen command into one physical endpoint operation while
-- preserving the original canonical screen text/design hash.  The composite
-- API shape is intentionally small; this adapter is the only projection into
-- the existing PROCESS_COMMAND_ADAPTER runtime contract.
CREATE OR REPLACE FUNCTION framework_composite_endpoint_diagnostic(
  screen jsonb,api jsonb)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE STRICT SECURITY INVOKER
SET search_path=pg_catalog,public AS $$
DECLARE
  canonical jsonb;
  identity jsonb;
  step_contract jsonb;
  frontend jsonb;
  actions jsonb;
  fields jsonb;
  properties jsonb;
  required_fields jsonb;
  operation_id text;
  path_value text;
  matched_request_count integer;
  matched_response_count integer;
BEGIN
  IF jsonb_typeof(screen) IS DISTINCT FROM 'object'
     OR jsonb_typeof(api) IS DISTINCT FROM 'object' THEN
    RETURN jsonb_build_object('reason','COMPOSITE_API_SHAPE_INVALID');
  END IF;
  canonical:=screen->'canonicalDesign';
  IF jsonb_typeof(canonical) IS DISTINCT FROM 'object'
     OR screen->>'canonicalText' IS NULL
     OR NOT coalesce(screen->>'designHash'~'^[0-9a-f]{64}$',false)
     OR screen->>'canonicalText' IS DISTINCT FROM canonical::text
     OR encode(sha256(convert_to(screen->>'canonicalText','UTF8')),'hex')
          IS DISTINCT FROM screen->>'designHash' THEN
    RETURN jsonb_build_object('reason','COMPOSITE_CANONICAL_PROVENANCE_INVALID');
  END IF;
  identity:=canonical->'identity';
  IF jsonb_typeof(identity) IS DISTINCT FROM 'object'
     OR NOT coalesce(identity->>'processCode'~'^[A-Z][A-Z0-9_]{1,79}$',false)
     OR NOT coalesce(identity->>'stepCode'~'^[A-Z][A-Z0-9_]{1,79}$',false)
     OR NOT coalesce(identity->>'actorCode'~'^[A-Z][A-Z0-9_]{1,79}$',false)
     OR identity->>'audience' NOT IN('USER','ADMIN')
     OR identity->>'screenKey' IS DISTINCT FROM screen->>'screenKey'
     OR identity->>'processCode' IS DISTINCT FROM screen->>'processCode'
     OR identity->>'stepCode' IS DISTINCT FROM screen->>'stepCode'
     OR identity->>'audience' IS DISTINCT FROM screen->>'audience'
     OR identity->>'routePath' IS DISTINCT FROM screen->>'routePath'
     OR identity->>'screenKey' IS DISTINCT FROM
       (identity->>'processCode')||'|'||(identity->>'stepCode')||'|'||
       (identity->>'audience')||'|'||(identity->>'routePath') THEN
    RETURN jsonb_build_object('reason','COMPOSITE_CANONICAL_IDENTITY_INVALID');
  END IF;
  step_contract:=canonical->'step';
  frontend:=canonical#>'{lanes,FRONTEND}';
  actions:=frontend->'actions';
  fields:=frontend->'fields';
  IF jsonb_typeof(step_contract) IS DISTINCT FROM 'object'
     OR NOT coalesce(step_contract->>'commandCode'~'^[A-Z][A-Z0-9_]{1,79}$',false)
     OR jsonb_typeof(frontend) IS DISTINCT FROM 'object'
     OR jsonb_typeof(actions) IS DISTINCT FROM 'array'
     OR jsonb_array_length(actions)=0
     OR jsonb_typeof(fields) IS DISTINCT FROM 'array'
     OR jsonb_typeof(canonical#>'{lanes,API}') IS DISTINCT FROM 'array' THEN
    RETURN jsonb_build_object('reason','COMPOSITE_CANONICAL_COMMAND_SOURCE_INVALID');
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(actions) action
             WHERE jsonb_typeof(action) IS DISTINCT FROM 'object'
                OR NOT coalesce(action->>'commandCode'~'^[A-Z][A-Z0-9_]{1,79}$',false)
                OR action->>'actorCode' IS DISTINCT FROM identity->>'actorCode'
                OR jsonb_typeof(action->'primary') IS DISTINCT FROM 'boolean')
     OR (SELECT count(*) FROM jsonb_array_elements(actions) action
          WHERE action->'primary'='true'::jsonb)<>1
     OR (SELECT action->>'commandCode' FROM jsonb_array_elements(actions) action
          WHERE action->'primary'='true'::jsonb) IS DISTINCT FROM step_contract->>'commandCode'
     OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(api) key)
          <>ARRAY['commandCode','method','path','permissionCodes','requestFields','responseFields']
     OR api->>'method'<>'POST'
     OR api->>'commandCode'!~'^[A-Z][A-Z0-9_]{1,79}$'
     OR jsonb_typeof(api->'requestFields')<>'array'
     OR jsonb_typeof(api->'responseFields')<>'array'
     OR jsonb_typeof(api->'permissionCodes')<>'array' THEN
    RETURN jsonb_build_object('reason','COMPOSITE_API_SHAPE_INVALID');
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(fields) field
             WHERE jsonb_typeof(field) IS DISTINCT FROM 'object'
                OR NOT coalesce(field->>'fieldCode'~'^[A-Za-z][A-Za-z0-9_]{0,79}$',false)
                OR field->>'fieldCode' IN('actorCode','idempotencyKey','projectId','tenantId',
                  'executionId','processCode','stepCode','commandCode','requestJson','resultJson',
                  'requireDraft','routePath','audience')
                OR field->>'direction' NOT IN('INPUT','OUTPUT','BOTH')
                OR field->>'dataType' NOT IN(
                  'STRING','INTEGER','NUMBER','BOOLEAN','DATE','DATETIME','OBJECT','ARRAY')
                OR jsonb_typeof(field->'required') IS DISTINCT FROM 'boolean')
     OR (SELECT count(*) FROM jsonb_array_elements(fields))<>
        (SELECT count(distinct field->>'fieldCode') FROM jsonb_array_elements(fields) field)
     OR EXISTS(SELECT 1 FROM jsonb_array_elements(api->'permissionCodes') permission
             WHERE jsonb_typeof(permission) IS DISTINCT FROM 'string'
                   OR NOT coalesce((permission#>>'{}')~'^[A-Z][A-Z0-9_:.-]{1,119}$',false))
     OR (SELECT count(*) FROM jsonb_array_elements(api->'permissionCodes'))<>
        (SELECT count(distinct permission#>>'{}')
           FROM jsonb_array_elements(api->'permissionCodes') permission) THEN
    RETURN jsonb_build_object('reason','COMPOSITE_API_FIELD_OR_PERMISSION_INVALID');
  END IF;
  path_value:=api->>'path';
  IF path_value IS NULL OR path_value!~'^/[A-Za-z0-9_{}./-]+$'
     OR path_value='/' OR right(path_value,1)='/' OR strpos(path_value,'//')>0
     OR path_value~'[?#\\]' OR path_value~'(^|/)\.{1,2}(/|$)'
     OR (length(path_value)-length(replace(path_value,'{executionId}','')))
          /length('{executionId}')<>1
     OR regexp_replace(path_value,'\{executionId\}','','g')~'[{}]' THEN
    RETURN jsonb_build_object('reason','COMPOSITE_API_PATH_INVALID');
  END IF;
  SELECT count(*) FILTER(WHERE api->'requestFields' ? (field->>'fieldCode')
                           AND field->>'direction'<>'OUTPUT'),
         count(*) FILTER(WHERE api->'responseFields' ? (field->>'fieldCode')
                           AND field->>'direction'<>'INPUT')
    INTO matched_request_count,matched_response_count
    FROM jsonb_array_elements(fields) field;
  IF matched_request_count<>jsonb_array_length(api->'requestFields')
     OR matched_response_count<>jsonb_array_length(api->'responseFields') THEN
    RETURN jsonb_build_object('reason','COMPOSITE_API_FIELD_NOT_EXACT');
  END IF;
  SELECT jsonb_build_object(
           'actorCode',jsonb_build_object('type','string'),
           'idempotencyKey',jsonb_build_object('type','string'),
           'projectId',jsonb_build_object('type','string'),
           'tenantId',jsonb_build_object('type','string'))||coalesce(jsonb_object_agg(
             field->>'fieldCode',jsonb_build_object('type',CASE field->>'dataType'
               WHEN 'INTEGER' THEN 'integer' WHEN 'NUMBER' THEN 'number'
               WHEN 'BOOLEAN' THEN 'boolean' WHEN 'OBJECT' THEN 'object'
               WHEN 'ARRAY' THEN 'array' ELSE 'string' END)
             ORDER BY field->>'fieldCode'),'{}'::jsonb),
         jsonb_build_array('actorCode','idempotencyKey','projectId','tenantId')||
           coalesce(jsonb_agg(to_jsonb(field->>'fieldCode') ORDER BY field->>'fieldCode')
             FILTER(WHERE field->'required'='true'::jsonb),'[]'::jsonb)
    INTO properties,required_fields
    FROM jsonb_array_elements(fields) field
   WHERE api->'requestFields' ? (field->>'fieldCode');
  operation_id:='op'||substr(encode(sha256(convert_to(
    (identity->>'screenKey')||E'\x1f'||(api->>'commandCode')||E'\x1f'||path_value,
    'UTF8')),'hex'),1,40);
  RETURN jsonb_build_object(
    'reason','READY','operationId',operation_id,'artifactName',operation_id,
    'routeSignature',lower((api->>'method')||' '||path_value),
    'operation',jsonb_build_object(
      'operationId',operation_id,'implementationKind','PROCESS_COMMAND_ADAPTER',
      'method',api->>'method','path',path_value,
      'processCode',identity->>'processCode','stepCode',identity->>'stepCode',
      'commandCode',api->>'commandCode',
      'authority',jsonb_build_object('audience',identity->>'audience',
        'actorCodes',jsonb_build_array(identity->>'actorCode'),'authenticated',true,
        'tenantScoped',true,'projectScoped',true),
      'request',jsonb_build_object('contentType','application/json','schema',
        jsonb_build_object('type','object','properties',properties,'required',required_fields)),
      'response',jsonb_build_object('successStatus',200,'schema',jsonb_build_object(
        'type','object','properties',jsonb_build_object(
          'success',jsonb_build_object('type','boolean'),
          'idempotent',jsonb_build_object('type','boolean'),
          'eventId',jsonb_build_object('type','integer'),
          'toState',jsonb_build_object('type','string')),
        'required',jsonb_build_array('success','idempotent','eventId','toState')),
        'errors',jsonb_build_array(
          jsonb_build_object('status',400,'code','INVALID_REQUEST'),
          jsonb_build_object('status',401,'code','AUTHENTICATION_REQUIRED'),
          jsonb_build_object('status',403,'code','ACCESS_DENIED'),
          jsonb_build_object('status',500,'code','INTERNAL_ERROR'))),
      'persistence',jsonb_build_object('persistenceId','PROCESS_EXECUTION_AGGREGATE',
        'entity','framework_process_execution','operation','UPDATE',
        'primaryKey',jsonb_build_array('execution_id'),'tenantColumn','tenant_id',
        'projectColumn','project_id','versionColumn','execution_version','transactional',true),
      'transactionPolicy','REQUIRED','idempotencyRequired',true,
      'rollback',jsonb_build_object('strategy','TRANSACTION',
        'commandCode',api->>'commandCode')));
END
$$;

CREATE OR REPLACE FUNCTION framework_source_canonical_endpoint_readiness(
  requested_limit integer,requested_process varchar)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=pg_catalog,public AS $$
DECLARE
  design_catalog jsonb;
  target_count integer;
  screen_count integer;
  ready_screen_count integer;
  operation_count integer;
  invalid_screen_count integer;
  mismatch_count integer;
  collision_count integer;
  blocker_count integer;
BEGIN
  IF requested_limit IS NULL OR requested_limit<1 OR requested_limit>5000
     OR (requested_process IS NOT NULL
       AND requested_process!~'^[A-Z][A-Z0-9_]{1,79}$') THEN
    RAISE EXCEPTION 'canonical endpoint scope is invalid' USING ERRCODE='22023';
  END IF;
  design_catalog:=CASE WHEN requested_process IS NULL
    THEN framework_canonical_design_catalog(requested_limit)
    ELSE framework_source_canonical_design_catalog(requested_limit,requested_process) END;
  SELECT count(*) INTO target_count FROM framework_composite_design_target_identity target
   WHERE requested_process IS NULL OR target.process_code=requested_process;
  WITH screens AS MATERIALIZED (
    SELECT ordinal,screen,screen->>'screenKey' screen_key,
           screen#>'{canonicalDesign,lanes,FRONTEND,actions}' actions,
           screen#>'{canonicalDesign,lanes,API}' operations
      FROM jsonb_array_elements(design_catalog->'screens') WITH ORDINALITY row(screen,ordinal)
     WHERE requested_process IS NULL OR screen->>'processCode'=requested_process
  ), operation_rows AS MATERIALIZED (
    SELECT screens.*,operation_ordinal,api,
           framework_composite_endpoint_diagnostic(screen,api) diagnostic
      FROM screens CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(operations)='array' THEN operations ELSE '[]'::jsonb END)
        WITH ORDINALITY operation(api,operation_ordinal)
  ), screen_stats AS MATERIALIZED (
    SELECT screen.ordinal,screen.screen_key,
      CASE WHEN jsonb_typeof(screen.actions)='array'
        THEN jsonb_array_length(screen.actions) ELSE 0 END declared_count,
      (SELECT count(distinct action->>'commandCode')
         FROM jsonb_array_elements(CASE WHEN jsonb_typeof(screen.actions)='array'
           THEN screen.actions ELSE '[]'::jsonb END) action) declared_distinct,
      coalesce((SELECT array_agg(action->>'commandCode' ORDER BY action->>'commandCode')
         FROM jsonb_array_elements(CASE WHEN jsonb_typeof(screen.actions)='array'
           THEN screen.actions ELSE '[]'::jsonb END) action),ARRAY[]::text[]) declared_commands,
      count(operation_rows.api)::integer actual_count,
      count(distinct operation_rows.api->>'commandCode')::integer actual_distinct,
      coalesce(array_agg(operation_rows.api->>'commandCode'
        ORDER BY operation_rows.api->>'commandCode') FILTER(WHERE operation_rows.api IS NOT NULL),
        ARRAY[]::text[]) actual_commands,
      count(*) FILTER(WHERE operation_rows.diagnostic->>'reason'='READY')::integer ready_count
      FROM screens screen LEFT JOIN operation_rows USING(ordinal,screen_key)
     GROUP BY screen.ordinal,screen.screen_key,screen.actions
  ), ready_operations AS MATERIALIZED (
    SELECT diagnostic FROM operation_rows WHERE diagnostic->>'reason'='READY'
  ), collisions AS MATERIALIZED (
    SELECT diagnostic,
      count(*) OVER(PARTITION BY diagnostic->>'operationId') operation_duplicates,
      count(*) OVER(PARTITION BY diagnostic->>'artifactName') artifact_duplicates,
      count(*) OVER(PARTITION BY diagnostic->>'routeSignature') route_duplicates
      FROM ready_operations
  ), expected AS MATERIALIZED (
    SELECT process_code||'|'||step_code||'|'||audience||'|'||route_path screen_key
      FROM framework_composite_design_target_identity
     WHERE requested_process IS NULL OR process_code=requested_process
  ), actual AS MATERIALIZED (SELECT screen_key FROM screens), difference AS (
    (SELECT screen_key FROM expected EXCEPT ALL SELECT screen_key FROM actual)
    UNION ALL (SELECT screen_key FROM actual EXCEPT ALL SELECT screen_key FROM expected)
  )
  SELECT (SELECT count(*) FROM screens),
         (SELECT count(*) FROM screen_stats WHERE declared_count>0
           AND declared_count=declared_distinct AND actual_count=actual_distinct
           AND declared_commands=actual_commands AND ready_count=actual_count),
         (SELECT count(*) FROM operation_rows),
         (SELECT count(*) FROM screen_stats WHERE NOT(declared_count>0
           AND declared_count=declared_distinct AND actual_count=actual_distinct
           AND declared_commands=actual_commands AND ready_count=actual_count)),
         (SELECT count(*) FROM difference),
         (SELECT count(*) FROM collisions WHERE operation_duplicates>1
           OR artifact_duplicates>1 OR route_duplicates>1)
    INTO screen_count,ready_screen_count,operation_count,invalid_screen_count,
         mismatch_count,collision_count;
  blocker_count:=invalid_screen_count+mismatch_count+collision_count+
    CASE WHEN target_count=0 THEN 1 ELSE 0 END;
  RETURN jsonb_build_object('schema','carbonet.canonical-endpoint-readiness/v2',
    'authority','composite-executable-design-source','requestedProcess',requested_process,
    'totalCount',screen_count,'sourceDesignCount',target_count,
    'canonicalScreenCount',screen_count,'operationCount',operation_count,
    'designBlockerCount',mismatch_count,'sourceReadyCount',ready_screen_count,
    'globalCollisionCount',collision_count,'blockerCount',blocker_count,
    'status',CASE WHEN target_count>0 AND target_count=screen_count
      AND ready_screen_count=screen_count AND blocker_count=0 THEN 'COMPLETE' ELSE 'PARTIAL' END,
    'reasonCounts',jsonb_build_object('COMMAND_OR_OPERATION_INVALID',invalid_screen_count,
      'TARGET_IDENTITY_MISMATCH',mismatch_count,'GLOBAL_ENDPOINT_COLLISION',collision_count));
END
$$;

CREATE OR REPLACE FUNCTION framework_source_canonical_endpoint_catalog(
  requested_limit integer,requested_process varchar)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=pg_catalog,public AS $$
DECLARE
  readiness jsonb;
  design_catalog jsonb;
  endpoints jsonb;
  catalog_hash text;
BEGIN
  readiness:=framework_source_canonical_endpoint_readiness(requested_limit,requested_process);
  IF readiness->>'status'<>'COMPLETE' THEN
    RAISE EXCEPTION 'composite endpoint readiness is not COMPLETE'
      USING ERRCODE='P0002',DETAIL=readiness::text;
  END IF;
  design_catalog:=CASE WHEN requested_process IS NULL
    THEN framework_canonical_design_catalog(requested_limit)
    ELSE framework_source_canonical_design_catalog(requested_limit,requested_process) END;
  WITH screens AS MATERIALIZED (
    SELECT ordinal,screen FROM jsonb_array_elements(design_catalog->'screens')
      WITH ORDINALITY row(screen,ordinal)
     WHERE requested_process IS NULL OR screen->>'processCode'=requested_process
  ), operations AS MATERIALIZED (
    SELECT screens.ordinal,screens.screen,operation_ordinal,
           framework_composite_endpoint_diagnostic(screen,api) diagnostic
      FROM screens CROSS JOIN LATERAL jsonb_array_elements(
        screen#>'{canonicalDesign,lanes,API}') WITH ORDINALITY operation(api,operation_ordinal)
  ), grouped AS MATERIALIZED (
    SELECT ordinal,screen,jsonb_agg(diagnostic->'operation' ORDER BY operation_ordinal) operation_rows
      FROM operations GROUP BY ordinal,screen
  ), contracts AS MATERIALIZED (
    SELECT ordinal,screen,jsonb_build_object('screenKey',screen->>'screenKey',
      'routePath',screen->>'routePath','audience',screen->>'audience',
      'source',jsonb_build_object('schema','carbonet.canonical-design/v1',
        'designHash',screen->>'designHash'),'operations',operation_rows) endpoint_contract
      FROM grouped
  ), encoded AS MATERIALIZED (
    SELECT *,endpoint_contract::text endpoint_text FROM contracts
  ), hashed AS MATERIALIZED (
    SELECT *,encode(sha256(convert_to(endpoint_text,'UTF8')),'hex') endpoint_hash FROM encoded
  )
  SELECT jsonb_agg(jsonb_build_object('screenKey',screen->>'screenKey',
           'routePath',screen->>'routePath','audience',screen->>'audience',
           'designHash',screen->>'designHash','canonicalText',screen->>'canonicalText',
           'endpointHash',endpoint_hash,'endpointText',endpoint_text,
           'endpointContract',endpoint_contract) ORDER BY ordinal),
         encode(sha256(convert_to(string_agg((screen->>'screenKey')||E'\x1f'||endpoint_hash,
           E'\n' ORDER BY ordinal),'UTF8')),'hex')
    INTO endpoints,catalog_hash FROM hashed;
  RETURN jsonb_build_object('schema','carbonet.canonical-endpoint-catalog/v1',
    'catalogHash',catalog_hash,'endpoints',endpoints);
END
$$;

SELECT * FROM refresh_integrated_design_axis_documents(NULL,false);

DO $$
DECLARE
  missing_fences text;
BEGIN
  IF to_regprocedure('framework_install_project_runtime_write_fences()') IS NULL THEN
    RAISE EXCEPTION 'project runtime write-fence installer is missing'
      USING ERRCODE='55000';
  END IF;
  PERFORM framework_install_project_runtime_write_fences();

  SELECT string_agg(candidate.relname,',' ORDER BY candidate.relname COLLATE "C")
    INTO missing_fences
    FROM (
      SELECT relation.oid,relation.relname
        FROM pg_class relation
        JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
       WHERE namespace.nspname=current_schema()
         AND relation.relkind IN('r','p') AND NOT relation.relispartition
         AND relation.relname LIKE 'integrated_design\_%' ESCAPE '\'
         AND EXISTS(
           SELECT 1 FROM pg_attribute attribute
            WHERE attribute.attrelid=relation.oid
              AND attribute.attname IN('project_id','process_code')
              AND attribute.attnum>0 AND NOT attribute.attisdropped)
    ) candidate
   WHERE (SELECT count(*) FROM pg_trigger trigger_row
           WHERE trigger_row.tgrelid=candidate.oid
             AND trigger_row.tgname='trg_project_runtime_write_fence'
             AND trigger_row.tgfoid=
                 to_regprocedure('framework_guard_project_runtime_write_fence()')
             AND trigger_row.tgenabled<>'D' AND trigger_row.tgtype=23
             AND NOT trigger_row.tgisinternal)<>1;
  IF missing_fences IS NOT NULL THEN
    RAISE EXCEPTION 'integrated design write-fence coverage is incomplete: %',missing_fences
      USING ERRCODE='55000';
  END IF;
END
$$;
