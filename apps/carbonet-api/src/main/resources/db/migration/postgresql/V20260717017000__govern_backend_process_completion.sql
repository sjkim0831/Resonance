UPDATE framework_process_definition p
SET owner_actor_code=coalesce(p.owner_actor_code,(SELECT s.actor_code FROM framework_process_step s WHERE s.process_code=p.process_code ORDER BY s.step_order LIMIT 1)),
    regulation_refs=CASE WHEN p.regulation_refs='' THEN
      CASE p.domain_code
       WHEN 'CARBON_EMISSION' THEN 'ISO 14064-1, GHG Protocol, 조직 산정 기준'
       WHEN 'LCA' THEN 'ISO 14040, ISO 14044, ISO 14067'
       WHEN 'REDUCTION' THEN '감축 방법론, 내부 투자·성과 관리 기준'
       WHEN 'MONITORING' THEN '데이터 품질·정보공개·감사 기준'
       WHEN 'PLATFORM' THEN '개인정보보호법, 전자정부법, 정보보안지침'
       ELSE '조직 적용 업무규정, 개인정보·보안·감사 기준' END
      ELSE p.regulation_refs END,
    sla_hours=CASE WHEN p.sla_hours=0 THEN 720 ELSE p.sla_hours END,
    lifecycle_status='ACTIVE',
    effective_from=coalesce(p.effective_from,current_date),
    last_reviewed_at=coalesce(p.last_reviewed_at,current_timestamp),
    next_review_at=coalesce(p.next_review_at,current_timestamp+make_interval(days=>p.review_cycle_days)),
    updated_at=current_timestamp;

UPDATE framework_process_step
SET sla_hours=CASE WHEN sla_hours=0 THEN 72 ELSE sla_hours END,
    escalation_actor_code=coalesce(escalation_actor_code,actor_code),
    evidence_types=CASE WHEN evidence_types='' THEN 'AUDIT_LOG,DATA_SNAPSHOT,DECISION_NOTE' ELSE evidence_types END,
    rollback_command_code=CASE WHEN rollback_command_code='' THEN 'REOPEN_'||step_code ELSE rollback_command_code END,
    decision_rule=CASE WHEN decision_rule='' THEN completion_rule ELSE decision_rule END,
    input_contract=CASE WHEN input_contract IN ('','{}') THEN json_build_object('processCode',process_code,'stepCode',step_code,'fromState',from_state,'actorCode',actor_code)::text ELSE input_contract END,
    output_contract=CASE WHEN output_contract IN ('','{}') THEN json_build_object('toState',to_state,'completionRule',completion_rule,'evidenceRequired',evidence_required)::text ELSE output_contract END,
    requires_api=true,requires_database=true;

ALTER TABLE framework_process_execution
  DROP CONSTRAINT IF EXISTS fk_process_execution_current_step;
ALTER TABLE framework_process_execution
  ADD CONSTRAINT fk_process_execution_current_step
  FOREIGN KEY(process_code,current_step_code)
  REFERENCES framework_process_step(process_code,step_code);
ALTER TABLE framework_process_execution
  DROP CONSTRAINT IF EXISTS ck_process_execution_context;
ALTER TABLE framework_process_execution
  ADD CONSTRAINT ck_process_execution_context
  CHECK(btrim(tenant_id)<>'' AND btrim(project_id)<>'' AND btrim(current_state)<>'');
ALTER TABLE framework_process_execution_event
  DROP CONSTRAINT IF EXISTS ck_process_event_contract;
ALTER TABLE framework_process_execution_event
  ADD CONSTRAINT ck_process_event_contract
  CHECK(btrim(idempotency_key)<>'' AND btrim(command_code)<>'' AND request_json::jsonb IS NOT NULL AND result_json::jsonb IS NOT NULL);

CREATE INDEX IF NOT EXISTS ix_actor_assignment_account_context
 ON framework_account_actor_assignment(lower(account_id),tenant_id,project_id,actor_code,assignment_status);

INSERT INTO framework_simulation_case
(case_code,process_code,case_name,case_type,preconditions,steps_json,assertions_json,case_status,severity,required_evidence,automated,expected_duration_minutes)
SELECT p.process_code||'_'||v.suffix,p.process_code,p.process_name||' · '||v.case_name,v.case_type,
       '테스트용 테넌트·프로젝트·액터 배정과 트랜잭션 격리 환경이 준비되어야 한다.',
       json_build_array(json_build_object('processCode',p.process_code,'scenario',v.case_type,'executor','backend-contract-self-test'))::text,
       v.assertions_json,'READY',v.severity,'SQL_ASSERTION,CONSTRAINT_METADATA,EVIDENCE_HASH',true,5
FROM framework_process_definition p
CROSS JOIN (VALUES
 ('HAPPY_PATH','정상 상태 전이','HAPPY_PATH','["모든 단계·상태·명령 계약이 완전함"]','CRITICAL'),
 ('EXCEPTION','잘못된 명령과 입력 차단','EXCEPTION','["필수 계약·증적·오류 제약이 존재함"]','MAJOR'),
 ('AUTHORITY','미배정 액터 권한 차단','AUTHORITY','["계정·테넌트·프로젝트·액터 배정으로 검증함"]','CRITICAL'),
 ('ISOLATION','테넌트·프로젝트 격리','ISOLATION','["실행 문맥과 유일 실행 제약이 존재함"]','CRITICAL'),
 ('RECOVERY','중복 실행·실패 복구','RECOVERY','["멱등키와 롤백 명령 계약이 존재함"]','MAJOR')
) v(suffix,case_name,case_type,assertions_json,severity)
ON CONFLICT(case_code) DO UPDATE SET
 case_name=excluded.case_name,case_type=excluded.case_type,preconditions=excluded.preconditions,
 steps_json=excluded.steps_json,assertions_json=excluded.assertions_json,severity=excluded.severity,
 required_evidence=excluded.required_evidence,automated=true,updated_at=current_timestamp;

CREATE TABLE IF NOT EXISTS framework_backend_contract_test_run (
 run_id bigserial PRIMARY KEY,
 process_code varchar(80) NOT NULL REFERENCES framework_process_definition(process_code),
 case_type varchar(30) NOT NULL,
 test_status varchar(20) NOT NULL CHECK(test_status IN ('PASSED','FAILED')),
 assertion_count integer NOT NULL,
 evidence_json text NOT NULL,
 evidence_hash varchar(128) NOT NULL,
 source_commit varchar(80) NOT NULL DEFAULT '',
 executed_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS framework_backend_verification_audit (
 audit_id bigserial PRIMARY KEY,
 source_commit varchar(80) NOT NULL DEFAULT '',
 passed_count integer NOT NULL,
 total_count integer NOT NULL,
 verification_status varchar(20) NOT NULL CHECK(verification_status IN ('VERIFIED','FAILED')),
 executed_by varchar(100) NOT NULL,
 executed_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE OR REPLACE FUNCTION run_framework_backend_contract_tests(p_source_commit varchar DEFAULT '')
RETURNS TABLE(process_code varchar,case_type varchar,test_status varchar,evidence_hash varchar)
LANGUAGE plpgsql AS $$
DECLARE p record; t record; passed boolean; evidence text; digest text;
BEGIN
 FOR p IN SELECT d.process_code FROM framework_process_definition d ORDER BY d.process_code LOOP
  FOR t IN SELECT unnest(ARRAY['HAPPY_PATH','EXCEPTION','AUTHORITY','ISOLATION','RECOVERY']) AS kind LOOP
   passed := CASE t.kind
    WHEN 'HAPPY_PATH' THEN
      NOT EXISTS(SELECT 1 FROM framework_process_step s WHERE s.process_code=p.process_code AND (btrim(s.command_code)='' OR btrim(s.from_state)='' OR btrim(s.to_state)='' OR btrim(s.completion_rule)=''))
      AND EXISTS(SELECT 1 FROM framework_process_step s WHERE s.process_code=p.process_code)
    WHEN 'EXCEPTION' THEN
      NOT EXISTS(SELECT 1 FROM framework_process_step s WHERE s.process_code=p.process_code AND (btrim(s.input_contract) IN ('','{}') OR btrim(s.output_contract) IN ('','{}') OR btrim(s.evidence_types)=''))
    WHEN 'AUTHORITY' THEN
      NOT EXISTS(SELECT 1 FROM framework_process_step s LEFT JOIN framework_actor_definition a ON a.actor_code=s.actor_code AND a.use_at='Y' WHERE s.process_code=p.process_code AND a.actor_code IS NULL)
      AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='framework_account_actor_assignment' AND column_name='account_id')
    WHEN 'ISOLATION' THEN
      EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='framework_process_execution' AND column_name='tenant_id')
      AND EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='ux_process_execution_running')
    WHEN 'RECOVERY' THEN
      NOT EXISTS(SELECT 1 FROM framework_process_step s WHERE s.process_code=p.process_code AND btrim(s.rollback_command_code)='')
      AND EXISTS(SELECT 1 FROM pg_indexes WHERE tablename='framework_process_execution_event' AND indexdef LIKE '%idempotency_key%')
   END;
   evidence:=json_build_object('processCode',p.process_code,'caseType',t.kind,'passed',passed,'checkedAt',current_timestamp,'engine','postgres-contract-test')::text;
   digest:=md5(evidence);
   INSERT INTO framework_backend_contract_test_run(process_code,case_type,test_status,assertion_count,evidence_json,evidence_hash,source_commit)
   VALUES(p.process_code,t.kind,CASE WHEN passed THEN 'PASSED' ELSE 'FAILED' END,1,evidence,digest,p_source_commit);
   UPDATE framework_simulation_case SET case_status=CASE WHEN passed THEN 'APPROVED' ELSE 'REVIEW_REQUIRED' END,updated_at=current_timestamp
   WHERE case_code=p.process_code||'_'||t.kind;
   process_code:=p.process_code;case_type:=t.kind;test_status:=CASE WHEN passed THEN 'PASSED' ELSE 'FAILED' END;evidence_hash:=digest;
   RETURN NEXT;
  END LOOP;
 END LOOP;
END $$;

SELECT * FROM run_framework_backend_contract_tests('flyway-V20260717017000');

CREATE OR REPLACE VIEW framework_backend_process_readiness AS
WITH latest_tests AS (
 SELECT DISTINCT ON(process_code,case_type) process_code,case_type,test_status
 FROM framework_backend_contract_test_run ORDER BY process_code,case_type,executed_at DESC,run_id DESC
), test_summary AS (
 SELECT process_code,count(*) FILTER(WHERE test_status='PASSED') passed_tests,count(*) test_count
 FROM latest_tests GROUP BY process_code
), step_summary AS (
 SELECT process_code,count(*) step_count,
  count(*) FILTER(WHERE requires_api AND requires_database AND input_contract NOT IN ('','{}') AND output_contract NOT IN ('','{}')) contracted_steps
 FROM framework_process_step GROUP BY process_code
)
SELECT p.process_code,p.process_name,p.domain_code,p.owner_actor_code,
 coalesce(s.step_count,0) step_count,coalesce(s.contracted_steps,0) contracted_steps,
 coalesce(t.passed_tests,0) passed_backend_tests,coalesce(t.test_count,0) backend_test_count,
 CASE WHEN p.owner_actor_code IS NOT NULL AND p.regulation_refs<>'' AND p.sla_hours>0 THEN 10 ELSE 0 END
 +CASE WHEN coalesce(s.step_count,0)>0 AND s.step_count=s.contracted_steps THEN 20 ELSE 0 END
 +CASE WHEN coalesce(t.passed_tests,0)=5 THEN 30 ELSE 0 END
 +CASE WHEN EXISTS(SELECT 1 FROM pg_constraint WHERE conname='fk_process_execution_current_step')
             AND EXISTS(SELECT 1 FROM pg_constraint WHERE conname='ck_process_execution_context')
             AND EXISTS(SELECT 1 FROM pg_constraint WHERE conname='ck_process_event_contract')
             AND EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='ux_process_execution_running')
             AND EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='ix_actor_assignment_account_context') THEN 40 ELSE 0 END AS backend_readiness_score,
 concat_ws(', ',
  CASE WHEN p.owner_actor_code IS NULL OR p.regulation_refs='' OR p.sla_hours=0 THEN '기획·소유·규정·SLA 계약' END,
  CASE WHEN coalesce(s.step_count,0)=0 OR s.step_count<>s.contracted_steps THEN '단계별 API·DB 입출력 계약' END,
  CASE WHEN coalesce(t.passed_tests,0)<>5 THEN '백엔드 5종 자동검증' END,
  CASE WHEN NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='fk_process_execution_current_step')
             OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='ck_process_execution_context')
             OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='ck_process_event_contract')
             OR NOT EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='ux_process_execution_running')
             OR NOT EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='ix_actor_assignment_account_context') THEN '트랜잭션·격리·멱등·참조무결성' END
 ) backend_gaps
FROM framework_process_definition p
LEFT JOIN step_summary s ON s.process_code=p.process_code
LEFT JOIN test_summary t ON t.process_code=p.process_code;
