-- Project delivery is metadata-first: one approved blueprint installs actors,
-- processes, executable tasks and generated screen impact as one transaction.

CREATE TABLE IF NOT EXISTS framework_project_delivery_blueprint (
  blueprint_code varchar(100) PRIMARY KEY,
  blueprint_name varchar(200) NOT NULL,
  blueprint_version varchar(30) NOT NULL,
  domain_code varchar(60) NOT NULL,
  specification jsonb NOT NULL,
  specification_hash varchar(64) GENERATED ALWAYS AS (
    md5(specification::text)||md5('PROJECT_DELIVERY_V1|'||specification::text)
  ) STORED,
  blueprint_status varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (blueprint_status IN ('DRAFT','APPROVED','RETIRED')),
  approved_by varchar(100),
  approved_at timestamp,
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE (blueprint_code,blueprint_version)
);

CREATE TABLE IF NOT EXISTS framework_project_delivery_release (
  release_id bigserial PRIMARY KEY,
  release_code varchar(100) NOT NULL UNIQUE,
  blueprint_code varchar(100) NOT NULL
    REFERENCES framework_project_delivery_blueprint(blueprint_code),
  blueprint_version varchar(30) NOT NULL,
  specification_hash varchar(64) NOT NULL,
  tenant_id varchar(100) NOT NULL,
  project_id varchar(100) NOT NULL,
  release_status varchar(20) NOT NULL
    CHECK (release_status IN ('VALIDATING','ACTIVE','SUPERSEDED','FAILED','ROLLED_BACK')),
  validation_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  generation_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_release_id bigint REFERENCES framework_project_delivery_release(release_id),
  requested_by varchar(100) NOT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  promoted_at timestamp,
  recovered_at timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_project_delivery_active_release
  ON framework_project_delivery_release(tenant_id,project_id)
  WHERE release_status='ACTIVE';

CREATE INDEX IF NOT EXISTS ix_project_delivery_release_history
  ON framework_project_delivery_release(tenant_id,project_id,created_at DESC);

CREATE OR REPLACE FUNCTION framework_validate_project_delivery_blueprint(
  requested_blueprint_code varchar
) RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
DECLARE
  spec jsonb;
  status varchar;
  actor_count integer := 0;
  process_count integer := 0;
  missing_actor_count integer := 0;
  missing_process_count integer := 0;
  process_without_step_count integer := 0;
  process_without_screen_count integer := 0;
  process_without_happy_test_count integer := 0;
  invalid_screen_count integer := 0;
  errors jsonb := '[]'::jsonb;
BEGIN
  SELECT specification,blueprint_status INTO spec,status
  FROM framework_project_delivery_blueprint
  WHERE blueprint_code=requested_blueprint_code;

  IF spec IS NULL THEN
    RETURN jsonb_build_object('valid',false,'errors',jsonb_build_array('BLUEPRINT_NOT_FOUND'));
  END IF;
  IF status<>'APPROVED' THEN errors:=errors||'"BLUEPRINT_NOT_APPROVED"'::jsonb; END IF;
  IF jsonb_typeof(spec->'actors')<>'array' THEN errors:=errors||'"ACTORS_MUST_BE_ARRAY"'::jsonb; END IF;
  IF jsonb_typeof(spec->'processCodes')<>'array' THEN errors:=errors||'"PROCESS_CODES_MUST_BE_ARRAY"'::jsonb; END IF;

  IF jsonb_typeof(spec->'actors')='array' THEN
    SELECT count(*),count(*) FILTER(WHERE actor.actor_code IS NULL)
      INTO actor_count,missing_actor_count
    FROM jsonb_array_elements(spec->'actors') item
    LEFT JOIN framework_actor_definition actor
      ON actor.actor_code=item->>'actorCode' AND actor.use_at='Y';
  END IF;

  IF jsonb_typeof(spec->'processCodes')='array' THEN
    WITH requested AS (
      SELECT DISTINCT value process_code FROM jsonb_array_elements_text(spec->'processCodes')
    )
    SELECT count(*),
      count(*) FILTER(WHERE process.process_code IS NULL),
      count(*) FILTER(WHERE process.process_code IS NOT NULL AND NOT EXISTS(
        SELECT 1 FROM framework_process_step step WHERE step.process_code=requested.process_code)),
      count(*) FILTER(WHERE process.process_code IS NOT NULL AND NOT EXISTS(
        SELECT 1 FROM framework_screen_blueprint screen
        WHERE screen.process_code=requested.process_code AND screen.validation_status='VALID')),
      count(*) FILTER(WHERE process.process_code IS NOT NULL AND NOT EXISTS(
        SELECT 1 FROM framework_simulation_case test
        WHERE test.process_code=requested.process_code AND test.case_type='HAPPY_PATH'
          AND test.case_status IN ('READY','ACTIVE','APPROVED','VERIFIED'))),
      coalesce(sum((SELECT count(*) FROM framework_screen_blueprint screen
        WHERE screen.process_code=requested.process_code
          AND screen.validation_status<>'VALID')),0)::integer
    INTO process_count,missing_process_count,process_without_step_count,
      process_without_screen_count,process_without_happy_test_count,invalid_screen_count
    FROM requested
    LEFT JOIN framework_process_definition process
      ON process.process_code=requested.process_code;
  END IF;

  IF actor_count=0 THEN errors:=errors||'"ACTOR_REQUIRED"'::jsonb; END IF;
  IF process_count=0 THEN errors:=errors||'"PROCESS_REQUIRED"'::jsonb; END IF;
  IF missing_actor_count>0 THEN errors:=errors||'"UNKNOWN_ACTOR"'::jsonb; END IF;
  IF missing_process_count>0 THEN errors:=errors||'"UNKNOWN_PROCESS"'::jsonb; END IF;
  IF process_without_step_count>0 THEN errors:=errors||'"PROCESS_STEP_MISSING"'::jsonb; END IF;
  IF process_without_screen_count>0 THEN errors:=errors||'"VALID_SCREEN_MISSING"'::jsonb; END IF;
  IF process_without_happy_test_count>0 THEN errors:=errors||'"HAPPY_PATH_TEST_MISSING"'::jsonb; END IF;
  IF invalid_screen_count>0 THEN errors:=errors||'"INVALID_SCREEN_EXISTS"'::jsonb; END IF;

  RETURN jsonb_build_object(
    'valid',jsonb_array_length(errors)=0,'errors',errors,
    'actorCount',actor_count,'processCount',process_count,
    'missingActorCount',missing_actor_count,'missingProcessCount',missing_process_count,
    'processWithoutStepCount',process_without_step_count,
    'processWithoutScreenCount',process_without_screen_count,
    'processWithoutHappyTestCount',process_without_happy_test_count,
    'invalidScreenCount',invalid_screen_count
  );
END $$;

CREATE OR REPLACE FUNCTION framework_apply_project_delivery_blueprint(
  requested_blueprint_code varchar,
  requested_tenant_id varchar,
  requested_project_id varchar,
  requested_by varchar DEFAULT 'SYSTEM'
) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  blueprint framework_project_delivery_blueprint%rowtype;
  validation jsonb;
  release_id_value bigint;
  release_code_value varchar;
  previous_release bigint;
  actor_item jsonb;
  process_code_value varchar;
  impact jsonb := '[]'::jsonb;
  sync_result record;
BEGIN
  IF coalesce(trim(requested_tenant_id),'')='' OR coalesce(trim(requested_project_id),'')='' THEN
    RETURN jsonb_build_object('success',false,'errors',jsonb_build_array('TENANT_AND_PROJECT_REQUIRED'));
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('PROJECT_DELIVERY:'||requested_tenant_id||':'||requested_project_id));

  SELECT * INTO blueprint FROM framework_project_delivery_blueprint
  WHERE blueprint_code=requested_blueprint_code FOR UPDATE;
  validation:=framework_validate_project_delivery_blueprint(requested_blueprint_code);
  IF NOT coalesce((validation->>'valid')::boolean,false) THEN
    RETURN jsonb_build_object('success',false,'validation',validation,'mutated',false);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM emission_project_registry project
    WHERE project.project_id=requested_project_id AND project.tenant_id=requested_tenant_id) THEN
    RETURN jsonb_build_object('success',false,'errors',jsonb_build_array('PROJECT_CONTEXT_NOT_FOUND'),'mutated',false);
  END IF;

  SELECT release_id INTO previous_release FROM framework_project_delivery_release
  WHERE tenant_id=requested_tenant_id AND project_id=requested_project_id
    AND release_status='ACTIVE' FOR UPDATE;

  release_code_value:='PDR_'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'_'||substr(md5(random()::text),1,8);
  INSERT INTO framework_project_delivery_release(
    release_code,blueprint_code,blueprint_version,specification_hash,tenant_id,project_id,
    release_status,validation_result,previous_release_id,requested_by)
  VALUES(release_code_value,blueprint.blueprint_code,blueprint.blueprint_version,
    blueprint.specification_hash,requested_tenant_id,requested_project_id,
    'VALIDATING',validation,previous_release,requested_by)
  RETURNING release_id INTO release_id_value;

  FOR actor_item IN SELECT value FROM jsonb_array_elements(blueprint.specification->'actors') LOOP
    IF coalesce(actor_item->>'accountId','')<>'' THEN
      INSERT INTO framework_account_actor_assignment(
        account_id,tenant_id,project_id,actor_code,data_scope,assignment_status)
      VALUES(actor_item->>'accountId',requested_tenant_id,requested_project_id,
        actor_item->>'actorCode',coalesce(nullif(actor_item->>'dataScope',''),'*'),'ACTIVE')
      ON CONFLICT(account_id,tenant_id,project_id,actor_code) DO UPDATE SET
        data_scope=excluded.data_scope,assignment_status='ACTIVE';

      INSERT INTO framework_project_actor_assignment(project_id,actor_code,user_id,active_yn)
      VALUES(requested_project_id,actor_item->>'actorCode',actor_item->>'accountId','Y')
      ON CONFLICT(project_id,actor_code,user_id) DO UPDATE SET active_yn='Y',assigned_at=current_timestamp;
    END IF;
  END LOOP;

  SELECT * INTO sync_result FROM framework_sync_project_processes(requested_project_id,requested_by);

  FOR process_code_value IN
    SELECT DISTINCT value FROM jsonb_array_elements_text(blueprint.specification->'processCodes')
  LOOP
    impact:=impact||jsonb_build_array(jsonb_build_object(
      'processCode',process_code_value,
      'impact',framework_refresh_screen_generation_impact(1000,process_code_value)));
  END LOOP;

  IF previous_release IS NOT NULL THEN
    UPDATE framework_project_delivery_release SET release_status='SUPERSEDED'
    WHERE release_id=previous_release;
  END IF;
  UPDATE framework_project_delivery_release SET
    release_status='ACTIVE',generation_result=jsonb_build_object('impact',impact),promoted_at=current_timestamp
  WHERE release_id=release_id_value;

  RETURN jsonb_build_object(
    'success',true,'releaseId',release_id_value,'releaseCode',release_code_value,
    'blueprintCode',blueprint.blueprint_code,'projectId',requested_project_id,
    'tenantId',requested_tenant_id,'validation',validation,'screenImpact',impact,
    'processSync',to_jsonb(sync_result)
  );
EXCEPTION WHEN OTHERS THEN
  -- PostgreSQL rolls back every actor/process/task mutation in this invocation.
  RAISE EXCEPTION 'PROJECT_DELIVERY_ROLLED_BACK:%',SQLERRM USING ERRCODE='P0001';
END $$;

CREATE OR REPLACE VIEW framework_project_delivery_status AS
SELECT release.release_id,release.release_code,release.tenant_id,release.project_id,
  release.blueprint_code,release.blueprint_version,release.specification_hash,
  release.release_status,release.validation_result,release.generation_result,
  release.requested_by,release.created_at,release.promoted_at,release.recovered_at,
  count(DISTINCT assignment.actor_code) FILTER(WHERE assignment.assignment_status='ACTIVE') actor_count,
  count(DISTINCT applicability.process_code) FILTER(WHERE applicability.applicability_status='APPLICABLE') process_count,
  count(DISTINCT task.task_id) task_count,
  count(DISTINCT task.task_id) FILTER(WHERE task.task_status='DONE') completed_task_count
FROM framework_project_delivery_release release
LEFT JOIN framework_account_actor_assignment assignment
  ON assignment.tenant_id=release.tenant_id AND assignment.project_id=release.project_id
LEFT JOIN framework_project_process_applicability applicability
  ON applicability.project_id=release.project_id
LEFT JOIN emission_project_task task ON task.project_id=release.project_id
GROUP BY release.release_id;

COMMENT ON TABLE framework_project_delivery_blueprint IS
  '여러 프로젝트에 재사용하는 액터·프로세스·화면·테스트 원자적 배포 명세';
COMMENT ON FUNCTION framework_apply_project_delivery_blueprint(varchar,varchar,varchar,varchar) IS
  '검증된 블루프린트를 프로젝트에 단일 트랜잭션으로 설치하고 화면 증분 생성을 예약한다';
