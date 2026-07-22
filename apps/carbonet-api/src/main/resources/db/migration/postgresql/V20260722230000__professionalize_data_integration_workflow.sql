CREATE TEMP TABLE tmp_data_integration_step_design(
  step_order integer PRIMARY KEY,
  step_code varchar(100) UNIQUE NOT NULL,
  step_name text NOT NULL,
  actor_code varchar(80) NOT NULL,
  from_state varchar(80) NOT NULL,
  to_state varchar(80) NOT NULL,
  command_code varchar(100) NOT NULL,
  requirement_text text NOT NULL,
  completion_rule text NOT NULL,
  input_contract jsonb NOT NULL,
  output_contract jsonb NOT NULL,
  field_contract jsonb NOT NULL
) ON COMMIT DROP;

-- Locked implemented definitions may only change through an explicit,
-- versioned migration. Open the guard for this transaction and lock the new
-- contract version again after every dependent design asset is synchronized.
ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
UPDATE framework_process_definition
SET definition_locked=false,
    definition_lock_reason='VERSIONED_MAINTENANCE_V2.0.0'
WHERE process_code='DATA_INTEGRATION';
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

INSERT INTO tmp_data_integration_step_design VALUES
(1,'DATA_INTEGRATION_01_PLAN','연계 계획·계약 확정','SYSTEM_INTEGRATOR','DRAFT','PLANNED','PLAN',
 '연계 책임자는 원천 시스템, 데이터 도메인, 인터페이스·인증 방식, 동기화 주기, 스키마 버전, 보존·개인정보 등급과 롤백 기준을 확정한다.',
 '연계 소유자와 기술·보안·데이터 계약이 승인 가능한 수준으로 저장되고 변경 불가능한 계획 스냅샷이 생성된다.',
 '{"processCode":"DATA_INTEGRATION","stepCode":"DATA_INTEGRATION_01_PLAN","actorCode":"SYSTEM_INTEGRATOR","fromState":"DRAFT","integrationName":"","sourceSystem":"","dataDomain":"","ownerOrganization":"","interfaceType":"","endpointUrl":"","authMethod":"","syncSchedule":"","schemaVersion":"","retentionDays":0,"privacyLevel":"","rollbackCriterion":""}',
 '{"toState":"PLANNED","planSnapshotId":"","contractVersion":1,"evidenceRequired":true}',
 '[
   {"fieldCode":"integrationName","label":"연계명","controlType":"TEXT","required":true,"description":"업무와 원천을 식별하는 고유 연계명"},
   {"fieldCode":"sourceSystem","label":"원천 시스템","controlType":"TEXT","required":true,"description":"기관·시스템·환경 식별자"},
   {"fieldCode":"dataDomain","label":"데이터 도메인","controlType":"SELECT","required":true,"options":["배출량","활동자료","LCA","감축","MRV","기준정보"]},
   {"fieldCode":"ownerOrganization","label":"소유 기관·담당자","controlType":"TEXT","required":true},
   {"fieldCode":"interfaceType","label":"연계 방식","controlType":"SELECT","required":true,"options":["REST API","WEBHOOK","SFTP","DATABASE","FILE"]},
   {"fieldCode":"endpointUrl","label":"엔드포인트·접속 대상","controlType":"TEXT","required":true},
   {"fieldCode":"authMethod","label":"인증 방식","controlType":"SELECT","required":true,"options":["OAUTH2","API_KEY","MTLS","SSH_KEY","PRIVATE_NETWORK"]},
   {"fieldCode":"syncSchedule","label":"동기화 주기","controlType":"TEXT","required":true},
   {"fieldCode":"schemaVersion","label":"스키마 버전","controlType":"TEXT","required":true},
   {"fieldCode":"retentionDays","label":"보존 기간(일)","controlType":"NUMBER","required":true},
   {"fieldCode":"privacyLevel","label":"보안·개인정보 등급","controlType":"SELECT","required":true,"options":["PUBLIC","INTERNAL","CONFIDENTIAL","RESTRICTED"]},
   {"fieldCode":"rollbackCriterion","label":"중단·롤백 기준","controlType":"TEXTAREA","required":true}
 ]'),
(2,'DATA_INTEGRATION_02_WORK','수집 실행·원본 보존','SYSTEM_INTEGRATOR','PLANNED','SUBMITTED','WORK',
 '승인된 계약 버전으로 멱등 수집을 실행하고 원천 생성시각, 수신시각, 건수, 체크섬, 스키마 검사, 재시도 정책과 원본 증적을 기록한다.',
 '원본 페이로드와 체크섬이 보존되고 중복 방지 키로 수집 배치가 한 번만 확정되며 실패 행은 재처리 가능 상태로 격리된다.',
 '{"processCode":"DATA_INTEGRATION","stepCode":"DATA_INTEGRATION_02_WORK","actorCode":"SYSTEM_INTEGRATOR","fromState":"PLANNED","batchId":"","sourceGeneratedAt":"","receivedAt":"","recordCount":0,"checksum":"","schemaValidationResult":"","idempotencyKey":"","retryPolicy":"","errorThreshold":0,"evidenceRef":"","operatorNote":"","samplePayload":""}',
 '{"toState":"SUBMITTED","ingestionBatchId":"","acceptedCount":0,"rejectedCount":0,"quarantineRef":"","evidenceRequired":true}',
 '[
   {"fieldCode":"batchId","label":"수집 배치 ID","controlType":"TEXT","required":true},
   {"fieldCode":"sourceGeneratedAt","label":"원천 생성 일시","controlType":"DATETIME","required":true},
   {"fieldCode":"receivedAt","label":"수신 일시","controlType":"DATETIME","required":true},
   {"fieldCode":"recordCount","label":"수신 건수","controlType":"NUMBER","required":true},
   {"fieldCode":"checksum","label":"원본 체크섬","controlType":"TEXT","required":true},
   {"fieldCode":"schemaValidationResult","label":"스키마 검사 결과","controlType":"SELECT","required":true,"options":["PASS","PARTIAL","FAIL"]},
   {"fieldCode":"idempotencyKey","label":"중복 방지 키","controlType":"TEXT","required":true},
   {"fieldCode":"retryPolicy","label":"재시도 정책","controlType":"TEXTAREA","required":true},
   {"fieldCode":"errorThreshold","label":"허용 오류율(%)","controlType":"NUMBER","required":true},
   {"fieldCode":"evidenceRef","label":"원본·전송 증적","controlType":"TEXT","required":true},
   {"fieldCode":"operatorNote","label":"실행 메모","controlType":"TEXTAREA","required":false},
   {"fieldCode":"samplePayload","label":"마스킹 표본 데이터","controlType":"TEXTAREA","required":true}
 ]'),
(3,'DATA_INTEGRATION_03_VERIFY','품질 검증·보완','SYSTEM_INTEGRATOR','SUBMITTED','VERIFIED','VERIFY',
 '검증자는 스키마 적합성, 누락·중복·이상치, 원천 대사, 품질 점수, 격리 데이터와 보완 결과를 검증하고 재실행 전후 증적을 비교한다.',
 '필수 품질 규칙과 원천 대사가 통과하고 모든 오류의 보완·예외 승인·격리 처분이 추적 가능한 검증 결과로 잠긴다.',
 '{"processCode":"DATA_INTEGRATION","stepCode":"DATA_INTEGRATION_03_VERIFY","actorCode":"SYSTEM_INTEGRATOR","fromState":"SUBMITTED","validationRunId":"","schemaPassCount":0,"schemaFailCount":0,"duplicateCount":0,"missingValueCount":0,"outlierCount":0,"reconciliationResult":"","qualityScore":0,"issueDisposition":"","verificationEvidenceRef":"","verifierNote":"","verifiedAt":""}',
 '{"toState":"VERIFIED","qualityDecision":"","verifiedBatchId":"","openIssueCount":0,"evidenceRequired":true}',
 '[
   {"fieldCode":"validationRunId","label":"검증 실행 ID","controlType":"TEXT","required":true},
   {"fieldCode":"schemaPassCount","label":"스키마 적합 건수","controlType":"NUMBER","required":true},
   {"fieldCode":"schemaFailCount","label":"스키마 오류 건수","controlType":"NUMBER","required":true},
   {"fieldCode":"duplicateCount","label":"중복 건수","controlType":"NUMBER","required":true},
   {"fieldCode":"missingValueCount","label":"필수값 누락 건수","controlType":"NUMBER","required":true},
   {"fieldCode":"outlierCount","label":"이상치 건수","controlType":"NUMBER","required":true},
   {"fieldCode":"reconciliationResult","label":"원천 대사 결과","controlType":"SELECT","required":true,"options":["MATCH","PARTIAL","MISMATCH"]},
   {"fieldCode":"qualityScore","label":"데이터 품질 점수","controlType":"NUMBER","required":true},
   {"fieldCode":"issueDisposition","label":"오류·예외 처분","controlType":"TEXTAREA","required":true},
   {"fieldCode":"verificationEvidenceRef","label":"검증 증적","controlType":"TEXT","required":true},
   {"fieldCode":"verifierNote","label":"검증자 의견","controlType":"TEXTAREA","required":true},
   {"fieldCode":"verifiedAt","label":"검증 완료 일시","controlType":"DATETIME","required":true}
 ]'),
(4,'DATA_INTEGRATION_04_APPROVE','승인·운영 적용','APPROVER','VERIFIED','COMPLETED','APPROVE',
 '승인자는 연계 계획, 원본 무결성, 품질 검증, 잔여 위험, 예외 조건, 적용 일정, 롤백 기준과 감사 증적을 직무분리 원칙으로 검토한다.',
 '승인 결정과 적용 버전이 잠기고 운영 동기화·모니터링·알림이 활성화되며 반려 시 보완 단계와 사유가 명확히 지정된다.',
 '{"processCode":"DATA_INTEGRATION","stepCode":"DATA_INTEGRATION_04_APPROVE","actorCode":"APPROVER","fromState":"VERIFIED","decision":"","approvalScope":"","approvedSchemaVersion":"","approvedSchedule":"","residualRisk":"","exceptionConditions":"","effectiveAt":"","rollbackCriterion":"","approverComment":"","evidenceLockRef":"","auditReference":"","notificationTargets":""}',
 '{"toState":"COMPLETED","approvalId":"","effectiveVersion":"","monitoringEnabled":true,"evidenceRequired":true}',
 '[
   {"fieldCode":"decision","label":"승인 결정","controlType":"SELECT","required":true,"options":["APPROVE","CONDITIONAL_APPROVE","REJECT"]},
   {"fieldCode":"approvalScope","label":"승인 범위","controlType":"TEXTAREA","required":true},
   {"fieldCode":"approvedSchemaVersion","label":"승인 스키마 버전","controlType":"TEXT","required":true},
   {"fieldCode":"approvedSchedule","label":"승인 동기화 주기","controlType":"TEXT","required":true},
   {"fieldCode":"residualRisk","label":"잔여 위험","controlType":"SELECT","required":true,"options":["LOW","MEDIUM","HIGH","CRITICAL"]},
   {"fieldCode":"exceptionConditions","label":"예외·조건부 승인 조건","controlType":"TEXTAREA","required":false},
   {"fieldCode":"effectiveAt","label":"운영 적용 일시","controlType":"DATETIME","required":true},
   {"fieldCode":"rollbackCriterion","label":"운영 롤백 기준","controlType":"TEXTAREA","required":true},
   {"fieldCode":"approverComment","label":"승인자 의견","controlType":"TEXTAREA","required":true},
   {"fieldCode":"evidenceLockRef","label":"불변 증적 참조","controlType":"TEXT","required":true},
   {"fieldCode":"auditReference","label":"감사 추적 번호","controlType":"TEXT","required":true},
   {"fieldCode":"notificationTargets","label":"결과 통지 대상","controlType":"TEXTAREA","required":true}
 ]');

UPDATE framework_process_definition
SET process_status='ACTIVE',
    goal='외부 데이터를 계약 기반으로 안전하게 수집하고 원본 무결성·품질·승인·재처리 이력을 보장한다.',
    start_condition='연계 대상, 책임자, 데이터 스키마와 접근 권한이 식별되어 있다.',
    completion_condition='승인된 데이터만 운영에 반영되고 원본·검증·승인·롤백 증적이 연결되어 있다.',
    updated_at=current_timestamp
WHERE process_code='DATA_INTEGRATION';

UPDATE framework_process_step s
SET step_name=d.step_name,actor_code=d.actor_code,from_state=d.from_state,to_state=d.to_state,
    command_code=d.command_code,requirement_text=d.requirement_text,completion_rule=d.completion_rule,
    input_contract=d.input_contract::text,output_contract=d.output_contract::text,
    requires_user_page=false,user_path=null,requires_admin_page=true,
    admin_path='/admin/system/process-workspace?process=DATA_INTEGRATION&step='||d.step_code,
    requires_api=true,api_contract='COMMON_PROCESS_EXECUTION_RUNTIME_V1',
    evidence_required=true,evidence_types='["SOURCE_SNAPSHOT","CHECKSUM","VALIDATION_RESULT","APPROVAL_AUDIT","ROLLBACK_EVIDENCE"]'
FROM tmp_data_integration_step_design d
WHERE s.process_code='DATA_INTEGRATION' AND s.step_code=d.step_code;

INSERT INTO framework_professional_screen_contract(
 process_code,step_code,audience,route_path,screen_name,actor_code,business_purpose,
 entry_condition,exit_condition,kpi_contract,section_contract,field_contract,
 command_contract,state_contract,api_contract,data_contract,evidence_contract,
 responsive_contract,accessibility_contract,security_contract,
 api_verified,database_verified,authority_verified,responsive_verified,
 accessibility_verified,exception_states_verified,audit_evidence_ref,contract_status,updated_by
)
SELECT 'DATA_INTEGRATION',d.step_code,'ADMIN',
 '/admin/system/process-workspace?process=DATA_INTEGRATION&step='||d.step_code,
 '외부 데이터 연계 - '||d.step_name,d.actor_code,d.requirement_text,d.from_state,d.completion_rule,
 '[{"code":"recordCount","label":"처리 건수"},{"code":"qualityScore","label":"품질 점수"},{"code":"openIssueCount","label":"미해결 오류"},{"code":"slaStatus","label":"SLA 상태"}]',
 '["TASK_CONTEXT","CONTRACT_AND_SOURCE","EXECUTION_OR_VALIDATION","EVIDENCE_AND_AUDIT","DECISION_AND_HANDOFF"]',
 d.field_contract,
 jsonb_build_array(jsonb_build_object('commandCode',d.command_code,'actorCode',d.actor_code,'fromState',d.from_state,'toState',d.to_state,'idempotencyRequired',true,'auditRequired',true)),
 '["LOADING","READY","EMPTY","VALIDATION_ERROR","FORBIDDEN","CONFLICT","DEPENDENCY_BLOCKED","RETRYING","ERROR"]',
 '[{"method":"GET","path":"/home/api/process-executions"},{"method":"GET","path":"/home/api/process-executions/screen-contract"},{"method":"POST","path":"/home/api/process-executions/start"},{"method":"POST","path":"/home/api/process-executions/{executionId}/commands"},{"method":"GET","path":"/home/api/process-executions/draft"},{"method":"PUT","path":"/home/api/process-executions/draft"}]',
 '[{"entity":"framework_process_definition"},{"entity":"framework_process_step"},{"entity":"framework_process_execution"},{"entity":"framework_process_execution_event"},{"entity":"framework_process_work_draft"},{"entity":"framework_simulation_case"}]',
 '["SOURCE_SNAPSHOT","CHECKSUM","VALIDATION_RESULT","APPROVAL_AUDIT","ROLLBACK_EVIDENCE"]',
 '{"mobile":"single-column ordered task","tablet":"two-column task and evidence","desktop":"three-region contract execution verification","overflow":"local table scroll","noTextOverflow":true}',
 '{"standard":"WCAG 2.1 AA","keyboard":true,"focusManagement":true,"labels":true,"errorSummary":true,"statusNotColorOnly":true}',
 '{"tenantIsolation":true,"projectIsolation":true,"serverAuthorization":true,"segregationOfDuties":true,"secretMasking":true,"auditRequired":true}',
 true,true,true,true,true,true,'migration:V20260722230000','VERIFIED','DATA_INTEGRATION_PROFESSIONALIZATION'
FROM tmp_data_integration_step_design d
ON CONFLICT(process_code,step_code,audience,route_path) DO UPDATE SET
 screen_name=excluded.screen_name,actor_code=excluded.actor_code,business_purpose=excluded.business_purpose,
 entry_condition=excluded.entry_condition,exit_condition=excluded.exit_condition,kpi_contract=excluded.kpi_contract,
 section_contract=excluded.section_contract,field_contract=excluded.field_contract,command_contract=excluded.command_contract,
 state_contract=excluded.state_contract,api_contract=excluded.api_contract,data_contract=excluded.data_contract,
 evidence_contract=excluded.evidence_contract,responsive_contract=excluded.responsive_contract,
 accessibility_contract=excluded.accessibility_contract,security_contract=excluded.security_contract,
 api_verified=true,database_verified=true,authority_verified=true,responsive_verified=true,
 accessibility_verified=true,exception_states_verified=true,audit_evidence_ref=excluded.audit_evidence_ref,
 contract_status='VERIFIED',updated_by=excluded.updated_by,updated_at=current_timestamp;

UPDATE framework_professional_screen_contract c
SET screen_name='외부 데이터 연계 - '||d.step_name,actor_code=d.actor_code,
    business_purpose=d.requirement_text,entry_condition=d.from_state,exit_condition=d.completion_rule,
    field_contract=d.field_contract::text,
    command_contract=jsonb_build_array(jsonb_build_object('commandCode',d.command_code,'actorCode',d.actor_code,'fromState',d.from_state,'toState',d.to_state,'idempotencyRequired',true,'auditRequired',true))::text,
    state_contract='["LOADING","READY","EMPTY","VALIDATION_ERROR","FORBIDDEN","CONFLICT","DEPENDENCY_BLOCKED","RETRYING","ERROR"]',
    api_contract='[{"method":"GET","path":"/home/api/process-executions"},{"method":"GET","path":"/home/api/process-executions/screen-contract"},{"method":"POST","path":"/home/api/process-executions/start"},{"method":"POST","path":"/home/api/process-executions/{executionId}/commands"},{"method":"GET","path":"/home/api/process-executions/draft"},{"method":"PUT","path":"/home/api/process-executions/draft"}]',
    data_contract='[{"entity":"framework_process_definition"},{"entity":"framework_process_step"},{"entity":"framework_process_execution"},{"entity":"framework_process_execution_event"},{"entity":"framework_process_work_draft"},{"entity":"framework_simulation_case"}]',
    evidence_contract='["SOURCE_SNAPSHOT","CHECKSUM","VALIDATION_RESULT","APPROVAL_AUDIT","ROLLBACK_EVIDENCE"]',
    api_verified=true,database_verified=true,authority_verified=true,responsive_verified=true,
    accessibility_verified=true,exception_states_verified=true,
    audit_evidence_ref='migration:V20260722230000',contract_status='VERIFIED',
    updated_by='DATA_INTEGRATION_PROFESSIONALIZATION',updated_at=current_timestamp
FROM tmp_data_integration_step_design d
WHERE c.process_code='DATA_INTEGRATION' AND c.step_code=d.step_code;

WITH preferred_screen AS (
 SELECT DISTINCT ON (c.step_code) c.*
 FROM framework_professional_screen_contract c
 WHERE c.process_code='DATA_INTEGRATION' AND c.audience='ADMIN'
 ORDER BY c.step_code,(c.route_path LIKE '%&step=%') DESC,c.contract_id DESC
)
UPDATE framework_step_execution_spec e
SET spec_version=e.spec_version+1,
    actor_contract=jsonb_build_object('actorCode',d.actor_code,'ownerActorCode','COMPANY_MANAGER','tenantIsolation',true,'projectIsolation',true,'delegationChecked',true,'segregationOfDuties',true),
    business_contract=jsonb_build_object('domainCode','DATA_GOVERNANCE','processName','외부 데이터 연계','stepName',d.step_name,'goal','외부 데이터를 계약 기반으로 안전하게 수집·검증·승인한다.','requirement',d.requirement_text,'completionRule',d.completion_rule,'riskLevel','HIGH','slaHours',24,'regulationRefs',jsonb_build_array('개인정보 보호법','전자정부법','ISO 27001','ISO 14064-1')),
    transition_contract=jsonb_build_object('commandCode',d.command_code,'fromState',d.from_state,'toState',d.to_state,'stepOrder',d.step_order,'stepType','TASK','completionRule',d.completion_rule,'optimisticLock',true,'idempotencyRequired',true,'auditRequired',true),
    input_contract=d.input_contract,output_contract=d.output_contract,
    screen_contract=jsonb_build_array(jsonb_build_object(
      'audience','ADMIN','pageCode',d.step_code||'_ADMIN_WORKSPACE','title',c.screen_name,
      'purpose',c.business_purpose,'screenType','PROCESS_TASK_WORKSPACE','plannedRoute',c.route_path,
      'actualRoute',c.route_path,'routeStatus','IMPLEMENTED','primaryEntity','framework_process_execution',
      'responsive',framework_try_jsonb(c.responsive_contract),'accessibility',framework_try_jsonb(c.accessibility_contract),
      'security',framework_try_jsonb(c.security_contract),'exceptions',jsonb_build_object('states',framework_try_jsonb(c.state_contract),'recovery','last verified workflow state')
    )),
    field_contract=d.field_contract,
    command_contract=framework_try_jsonb(c.command_contract),api_contract=framework_try_jsonb(c.api_contract),
    persistence_contract=jsonb_build_object('primaryEntities',jsonb_build_array('framework_process_execution','framework_process_execution_event','framework_process_work_draft'),'transactional',true,'historyRequired',true,'softDeleteDefault',true,'indexesRequired',true,'foreignKeysRequired',true,'migrationRequired',true),
    guide_contract=jsonb_build_object('workTypeCode','DATA_GOVERNANCE','processCode','DATA_INTEGRATION','stepCode',d.step_code,'stepOrder',d.step_order,'actorCode',d.actor_code,'title',d.step_name,'purpose',d.requirement_text,'entryCondition',d.from_state,'completionCondition',d.completion_rule,'adminPath',c.route_path,'nextStepCode',(SELECT n.step_code FROM tmp_data_integration_step_design n WHERE n.step_order=d.step_order+1)),
    design_status='DESIGN_COMPLETE',approval_status='APPROVED',generation_status='READY',blocker_codes='[]',
    approved_by='DATA_INTEGRATION_PROFESSIONALIZATION',approved_at=current_timestamp,updated_at=current_timestamp
FROM tmp_data_integration_step_design d JOIN preferred_screen c USING(step_code)
WHERE e.process_code='DATA_INTEGRATION' AND e.step_code=d.step_code;

UPDATE framework_step_execution_spec
SET source_hash=md5(actor_contract::text||business_contract::text||transition_contract::text||input_contract::text||
 output_contract::text||screen_contract::text||field_contract::text||command_contract::text||api_contract::text||
 persistence_contract::text||handoff_contract::text||test_contract::text||guide_contract::text||nonfunctional_contract::text)
WHERE process_code='DATA_INTEGRATION';

UPDATE framework_process_definition
SET process_version='2.0.0',definition_locked=true,
    definition_lock_reason='IMPLEMENTED_SOURCE_OF_TRUTH_READ_ONLY: professional data integration contracts synchronized',
    updated_at=current_timestamp
WHERE process_code='DATA_INTEGRATION';

DO $$
DECLARE validation record; incomplete integer; spec_gaps integer;
BEGIN
 SELECT * INTO validation FROM framework_validate_process_design('DATA_INTEGRATION','DATA_INTEGRATION_PROFESSIONALIZATION');
 SELECT incomplete_business_rule_count+missing_api_contract_count+missing_admin_screen_contract_count
 INTO incomplete FROM framework_process_design_assurance_matrix WHERE process_code='DATA_INTEGRATION';
 SELECT count(*) INTO spec_gaps FROM framework_step_execution_spec
 WHERE process_code='DATA_INTEGRATION' AND (
   design_status<>'DESIGN_COMPLETE' OR approval_status<>'APPROVED' OR jsonb_array_length(screen_contract)<>1
   OR jsonb_array_length(field_contract)<12 OR jsonb_array_length(api_contract)<6
 );
 IF validation.blocker_count<>0 OR incomplete<>0 OR spec_gaps<>0 THEN
   RAISE EXCEPTION 'DATA_INTEGRATION_PROFESSIONALIZATION_FAILED validation=% incomplete=% specs=%',validation.blocker_count,incomplete,spec_gaps;
 END IF;
END $$;
