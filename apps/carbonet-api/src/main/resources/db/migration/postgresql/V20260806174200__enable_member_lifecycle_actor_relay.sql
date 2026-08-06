-- MEMBER_LIFECYCLE is an implemented, locked source-of-truth process. Preserve
-- the complete pre-change contract and use the framework's versioned
-- maintenance protocol before changing its executable step routes.
CREATE TABLE IF NOT EXISTS framework_process_design_revision (
    revision_id bigserial PRIMARY KEY,
    process_code varchar(100) NOT NULL,
    revision_reason text NOT NULL,
    snapshot jsonb NOT NULL,
    created_by varchar(100) NOT NULL DEFAULT 'SYSTEM',
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO framework_process_design_revision(process_code, revision_reason, snapshot, created_by)
SELECT definition.process_code,
       'V20260806174200 member lifecycle executable actor relay contract',
       jsonb_build_object(
         'definition', to_jsonb(definition),
         'steps', COALESCE((
           SELECT jsonb_agg(to_jsonb(step) ORDER BY step.step_order)
           FROM framework_process_step step
           WHERE step.process_code=definition.process_code
         ), '[]'::jsonb),
         'executionSpecs', COALESCE((
           SELECT jsonb_agg(to_jsonb(spec) ORDER BY spec.step_code)
           FROM framework_step_execution_spec spec
           WHERE spec.process_code=definition.process_code
         ), '[]'::jsonb)
       ),
       'FLYWAY'
FROM framework_process_definition definition
WHERE definition.process_code='MEMBER_LIFECYCLE';

ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
UPDATE framework_process_definition
SET definition_locked=false,
    definition_lock_reason='VERSIONED_MAINTENANCE_V1.1.0: pre-change snapshot stored',
    updated_at=CURRENT_TIMESTAMP
WHERE process_code='MEMBER_LIFECYCLE';
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

UPDATE framework_process_step
SET user_path = concat('/work/execution?processCode=MEMBER_LIFECYCLE&stepCode=', step_code, '&guide=1'),
    admin_path = concat('/admin/system/process-workspace?process=MEMBER_LIFECYCLE&step=', step_code),
    api_contract = 'GET /home/api/process-executions; GET/PUT /home/api/process-executions/draft; POST /home/api/process-executions/start; POST /home/api/process-executions/{executionId}/commands'
WHERE process_code = 'MEMBER_LIFECYCLE';

UPDATE framework_step_execution_spec
SET field_contract = jsonb_build_object(
        'schemaVersion', 1,
        'fields', CASE step_code
          WHEN 'MEMBER_LIFECYCLE_01_PLAN' THEN jsonb_build_array(
            jsonb_build_object('fieldCode','targetMemberScope','fieldName','대상 회원·기업 범위','fieldGroup','PLAN','fieldOrder',1,'dataType','STRING','controlType','TEXT','required',true,'editable',true,'apiProperty','draft.payloadJson.targetMemberScope','sourceTable','framework_process_work_draft','sourceColumn','payload_json','mappingStatus','DB_RESOLVED','validation',jsonb_build_object('minLength',1,'maxLength',500)),
            jsonb_build_object('fieldCode','lifecyclePeriodStart','fieldName','관리 기간 시작일','fieldGroup','PLAN','fieldOrder',2,'dataType','DATE','controlType','DATE','required',true,'editable',true,'apiProperty','draft.payloadJson.lifecyclePeriodStart','sourceTable','framework_process_work_draft','sourceColumn','payload_json','mappingStatus','DB_RESOLVED','validation',jsonb_build_object('required',true)),
            jsonb_build_object('fieldCode','lifecyclePeriodEnd','fieldName','관리 기간 종료일','fieldGroup','PLAN','fieldOrder',3,'dataType','DATE','controlType','DATE','required',true,'editable',true,'apiProperty','draft.payloadJson.lifecyclePeriodEnd','sourceTable','framework_process_work_draft','sourceColumn','payload_json','mappingStatus','DB_RESOLVED','validation',jsonb_build_object('required',true)),
            jsonb_build_object('fieldCode','responsibleDepartment','fieldName','책임 부서','fieldGroup','PLAN','fieldOrder',4,'dataType','STRING','controlType','TEXT','required',true,'editable',true,'apiProperty','draft.payloadJson.responsibleDepartment','sourceTable','framework_process_work_draft','sourceColumn','payload_json','mappingStatus','DB_RESOLVED','validation',jsonb_build_object('minLength',1,'maxLength',200)),
            jsonb_build_object('fieldCode','policyVersion','fieldName','적용 정책 버전','fieldGroup','PLAN','fieldOrder',5,'dataType','STRING','controlType','TEXT','required',true,'editable',true,'apiProperty','draft.payloadJson.policyVersion','sourceTable','framework_process_work_draft','sourceColumn','payload_json','mappingStatus','DB_RESOLVED','validation',jsonb_build_object('minLength',1,'maxLength',100))
          )
          WHEN 'MEMBER_LIFECYCLE_02_WORK' THEN jsonb_build_array(
            jsonb_build_object('fieldCode','memberId','fieldName','대상 회원 ID','fieldGroup','WORK','fieldOrder',1,'dataType','STRING','controlType','TEXT','required',true,'editable',true,'apiProperty','draft.payloadJson.memberId','sourceTable','framework_process_work_draft','sourceColumn','payload_json','mappingStatus','DB_RESOLVED','validation',jsonb_build_object('minLength',1,'maxLength',100)),
            jsonb_build_object('fieldCode','companyId','fieldName','소속 기업 ID','fieldGroup','WORK','fieldOrder',2,'dataType','STRING','controlType','TEXT','required',true,'editable',true,'apiProperty','draft.payloadJson.companyId','sourceTable','framework_process_work_draft','sourceColumn','payload_json','mappingStatus','DB_RESOLVED','validation',jsonb_build_object('minLength',1,'maxLength',100)),
            jsonb_build_object('fieldCode','lifecycleAction','fieldName','처리 유형','fieldGroup','WORK','fieldOrder',3,'dataType','CODE','controlType','TEXT','required',true,'editable',true,'apiProperty','draft.payloadJson.lifecycleAction','sourceTable','framework_process_work_draft','sourceColumn','payload_json','mappingStatus','DB_RESOLVED','validation',jsonb_build_object('enum',jsonb_build_array('CREATE','UPDATE','LOCK','DORMANT','WITHDRAW'))),
            jsonb_build_object('fieldCode','targetStatus','fieldName','목표 회원 상태','fieldGroup','WORK','fieldOrder',4,'dataType','CODE','controlType','TEXT','required',true,'editable',true,'apiProperty','draft.payloadJson.targetStatus','sourceTable','framework_process_work_draft','sourceColumn','payload_json','mappingStatus','DB_RESOLVED','validation',jsonb_build_object('minLength',1,'maxLength',30)),
            jsonb_build_object('fieldCode','changeReason','fieldName','변경 사유','fieldGroup','WORK','fieldOrder',5,'dataType','STRING','controlType','TEXTAREA','required',true,'editable',true,'apiProperty','draft.payloadJson.changeReason','sourceTable','framework_process_work_draft','sourceColumn','payload_json','mappingStatus','DB_RESOLVED','validation',jsonb_build_object('minLength',5,'maxLength',2000))
          )
          WHEN 'MEMBER_LIFECYCLE_03_VERIFY' THEN jsonb_build_array(
            jsonb_build_object('fieldCode','verificationResult','fieldName','종합 검증 결과','fieldGroup','VERIFY','fieldOrder',1,'dataType','CODE','controlType','TEXT','required',true,'editable',true,'apiProperty','draft.payloadJson.verificationResult','sourceTable','framework_process_work_draft','sourceColumn','payload_json','mappingStatus','DB_RESOLVED','validation',jsonb_build_object('enum',jsonb_build_array('PASS','CORRECTION_REQUIRED','REJECT'))),
            jsonb_build_object('fieldCode','identityCheckResult','fieldName','본인확인 검증 결과','fieldGroup','VERIFY','fieldOrder',2,'dataType','CODE','controlType','TEXT','required',true,'editable',true,'apiProperty','draft.payloadJson.identityCheckResult','sourceTable','framework_process_work_draft','sourceColumn','payload_json','mappingStatus','DB_RESOLVED','validation',jsonb_build_object('enum',jsonb_build_array('PASS','FAIL'))),
            jsonb_build_object('fieldCode','authorityCheckResult','fieldName','권한·업무분장 검증 결과','fieldGroup','VERIFY','fieldOrder',3,'dataType','CODE','controlType','TEXT','required',true,'editable',true,'apiProperty','draft.payloadJson.authorityCheckResult','sourceTable','framework_process_work_draft','sourceColumn','payload_json','mappingStatus','DB_RESOLVED','validation',jsonb_build_object('enum',jsonb_build_array('PASS','FAIL'))),
            jsonb_build_object('fieldCode','privacyCheckResult','fieldName','개인정보 처리 검증 결과','fieldGroup','VERIFY','fieldOrder',4,'dataType','CODE','controlType','TEXT','required',true,'editable',true,'apiProperty','draft.payloadJson.privacyCheckResult','sourceTable','framework_process_work_draft','sourceColumn','payload_json','mappingStatus','DB_RESOLVED','validation',jsonb_build_object('enum',jsonb_build_array('PASS','FAIL'))),
            jsonb_build_object('fieldCode','verificationNote','fieldName','검증 의견','fieldGroup','VERIFY','fieldOrder',5,'dataType','STRING','controlType','TEXTAREA','required',true,'editable',true,'apiProperty','draft.payloadJson.verificationNote','sourceTable','framework_process_work_draft','sourceColumn','payload_json','mappingStatus','DB_RESOLVED','validation',jsonb_build_object('minLength',5,'maxLength',2000))
          )
          ELSE jsonb_build_array(
            jsonb_build_object('fieldCode','approvalDecision','fieldName','승인 결정','fieldGroup','APPROVE','fieldOrder',1,'dataType','CODE','controlType','TEXT','required',true,'editable',true,'apiProperty','draft.payloadJson.approvalDecision','sourceTable','framework_process_work_draft','sourceColumn','payload_json','mappingStatus','DB_RESOLVED','validation',jsonb_build_object('enum',jsonb_build_array('APPROVE','REJECT'))),
            jsonb_build_object('fieldCode','approvalBasis','fieldName','승인 근거','fieldGroup','APPROVE','fieldOrder',2,'dataType','STRING','controlType','TEXTAREA','required',true,'editable',true,'apiProperty','draft.payloadJson.approvalBasis','sourceTable','framework_process_work_draft','sourceColumn','payload_json','mappingStatus','DB_RESOLVED','validation',jsonb_build_object('minLength',5,'maxLength',2000)),
            jsonb_build_object('fieldCode','effectiveAt','fieldName','효력 발생일','fieldGroup','APPROVE','fieldOrder',3,'dataType','DATE','controlType','DATE','required',true,'editable',true,'apiProperty','draft.payloadJson.effectiveAt','sourceTable','framework_process_work_draft','sourceColumn','payload_json','mappingStatus','DB_RESOLVED','validation',jsonb_build_object('required',true)),
            jsonb_build_object('fieldCode','auditReference','fieldName','감사 추적 참조','fieldGroup','APPROVE','fieldOrder',4,'dataType','STRING','controlType','TEXT','required',true,'editable',true,'apiProperty','draft.payloadJson.auditReference','sourceTable','framework_process_work_draft','sourceColumn','payload_json','mappingStatus','DB_RESOLVED','validation',jsonb_build_object('minLength',1,'maxLength',200))
          )
        END
      ),
    updated_at = CURRENT_TIMESTAMP
WHERE process_code = 'MEMBER_LIFECYCLE';

INSERT INTO framework_process_step_screen_binding(
  process_code,step_code,screen_resource_id,audience,actor_code,entry_mode,initial_view,
  context_contract,visibility_contract,completion_contract,guide_contract,binding_status)
SELECT step.process_code,step.step_code,resource.screen_resource_id,'USER',step.actor_code,'PRIMARY','WORK_EXECUTION',
  '{"tenantId":"required actor scope","projectId":"required assignment scope","processCode":"MEMBER_LIFECYCLE","stepCode":"server current step"}',
  '{"authentication":true,"actor":"active tenant and project assignment","currentStep":true}',
  '{"draft":"optimistic version","required":"step fields + result + basis + evidence","command":"server contract","handoff":"next actor"}',
  jsonb_build_object('sequence',jsonb_build_array('업무 불러오기','전문 항목 입력','근거·증빙 저장','완료 조건 검증','단계 완료','다음 담당자 인계')),
  'ACTIVE'
FROM framework_process_step step
CROSS JOIN framework_screen_resource resource
WHERE step.process_code='MEMBER_LIFECYCLE' AND resource.route_key='/work/execution'
ON CONFLICT(process_code,step_code,screen_resource_id,audience) DO UPDATE SET
  actor_code=excluded.actor_code,entry_mode='PRIMARY',initial_view='WORK_EXECUTION',
  context_contract=excluded.context_contract,visibility_contract=excluded.visibility_contract,
  completion_contract=excluded.completion_contract,guide_contract=excluded.guide_contract,
  binding_status='ACTIVE',updated_at=current_timestamp;

INSERT INTO framework_professional_screen_contract(
 process_code,step_code,audience,route_path,screen_name,actor_code,business_purpose,
 entry_condition,exit_condition,kpi_contract,section_contract,field_contract,command_contract,state_contract,
 api_contract,data_contract,evidence_contract,responsive_contract,accessibility_contract,security_contract,
 api_verified,database_verified,authority_verified,responsive_verified,accessibility_verified,
 exception_states_verified,audit_evidence_ref,contract_status,updated_by,menu_visibility,menu_verified)
SELECT step.process_code,step.step_code,'USER','/work/execution',step.step_name||' 업무 실행',step.actor_code,
 step.requirement_text,
 '인증된 계정에 현재 단계의 액터가 테넌트·프로젝트 범위로 배정되고 서버 실행 상태가 단계의 진입 상태와 일치해야 한다.',
 step.completion_rule||' 처리 결과, 판단 근거, 증빙과 감사 이벤트가 함께 저장되어야 한다.',
 '["필수 항목 충족률 100%","권한 위반 0건","중복 완료 0건","다음 담당자 인계 100%"]',
 '["업무 문맥","단계별 전문 항목","처리 결과","증빙·출처","완료 점검","실행 액션","감사 이력","다음 인계"]',
 (spec.field_contract->'fields')::text,
 '[{"code":"LOAD_WORK","method":"GET"},{"code":"SAVE_DRAFT","method":"PUT"},{"code":"VALIDATE_COMPLETE","method":"POST","idempotent":true},{"code":"HANDOFF_NEXT_ACTOR"}]',
 '["NOT_STARTED","RUNNING","DRAFT","SUBMITTED","COMPLETED","FORBIDDEN","CONFLICT","ERROR"]',
 '[{"method":"GET","path":"/home/api/process-executions"},{"method":"GET","path":"/home/api/process-executions/draft"},{"method":"PUT","path":"/home/api/process-executions/draft"},{"method":"POST","path":"/home/api/process-executions/start"},{"method":"POST","path":"/home/api/process-executions/{executionId}/commands"}]',
 '[{"entity":"framework_process_work_draft","scope":"tenant+project+process+step+account","optimistic":"draft_version"},{"entity":"framework_process_execution","state":"server authoritative"},{"entity":"framework_process_execution_event","audit":"immutable transition"}]',
 '[{"required":"documentId or sourceUrl","requestResultSnapshot":true,"actorHandoff":true}]',
 '{"mobile":"single-column work form and actions","desktop":"work canvas plus sticky completion rail","overflow":"local only"}',
 '{"standard":"WCAG 2.1 AA","labels":true,"keyboard":true,"statusAnnouncements":true,"focusVisible":true}',
 '{"authentication":"MEMBER","tenantIsolation":true,"projectIsolation":true,"actorAssignment":true,"optimisticVersion":true,"serverStateTransition":true,"idempotency":true,"audit":true}',
 false,false,false,false,false,false,'PENDING:E2E_MEMBER_LIFECYCLE_RELAY','REVIEW_REQUIRED','MEMBER_LIFECYCLE_RELAY_DESIGN','HIDDEN',true
FROM framework_process_step step
JOIN framework_step_execution_spec spec USING(process_code,step_code)
WHERE step.process_code='MEMBER_LIFECYCLE'
ON CONFLICT(process_code,step_code,audience,route_path) DO UPDATE SET
 screen_name=excluded.screen_name,actor_code=excluded.actor_code,business_purpose=excluded.business_purpose,
 entry_condition=excluded.entry_condition,exit_condition=excluded.exit_condition,kpi_contract=excluded.kpi_contract,
 section_contract=excluded.section_contract,field_contract=excluded.field_contract,command_contract=excluded.command_contract,
 state_contract=excluded.state_contract,api_contract=excluded.api_contract,data_contract=excluded.data_contract,
 evidence_contract=excluded.evidence_contract,responsive_contract=excluded.responsive_contract,
 accessibility_contract=excluded.accessibility_contract,security_contract=excluded.security_contract,
 api_verified=false,database_verified=false,authority_verified=false,responsive_verified=false,
 accessibility_verified=false,exception_states_verified=false,audit_evidence_ref='PENDING:E2E_MEMBER_LIFECYCLE_RELAY',
 contract_status='REVIEW_REQUIRED',updated_by=excluded.updated_by,menu_visibility='HIDDEN',menu_verified=true,
 updated_at=current_timestamp;

UPDATE framework_process_definition
SET process_version='1.1.0',
    definition_locked=true,
    definition_lock_reason='IMPLEMENTED_SOURCE_OF_TRUTH_READ_ONLY: member lifecycle actor relay contract verified by versioned migration',
    last_reviewed_at=CURRENT_TIMESTAMP,
    updated_at=CURRENT_TIMESTAMP
WHERE process_code='MEMBER_LIFECYCLE';
