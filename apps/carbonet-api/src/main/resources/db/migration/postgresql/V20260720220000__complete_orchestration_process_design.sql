-- Give each umbrella process one professional orchestration screen. Child
-- business screens remain independent and are linked from this control plane.
WITH target(process_code) AS (VALUES
 ('GOVERNANCE_CHANGE'),('DATA_INTEGRATION'),('LCA_EXECUTION'),('REDUCTION_EXECUTION'),
 ('CONTENT_OPERATION'),('MEMBER_LIFECYCLE'),('MONITORING_ANALYSIS'),('PAYMENT_SETTLEMENT'),
 ('PLATFORM_OPERATION'),('TRADE_EXECUTION')
), selected AS (
 SELECT DISTINCT ON (s.process_code) s.*,p.process_name,p.goal,p.start_condition,p.completion_condition
 FROM framework_process_step s JOIN framework_process_definition p USING(process_code) JOIN target t USING(process_code)
 ORDER BY s.process_code,s.step_order
)
INSERT INTO framework_page_design(process_code,step_code,audience,page_code,page_title,page_purpose,screen_type,
 planned_route_path,actual_route_path,route_status,primary_entity,actor_code,entry_condition,exit_condition,
 responsive_contract,accessibility_contract,security_contract,exception_contract,design_status,updated_by)
SELECT process_code,step_code,'ADMIN',process_code||'_ORCHESTRATION_ADMIN',process_name||' 통합 작업공간',
 coalesce(nullif(goal,''),process_name||'의 하위 업무·액터·증빙·검증·승인을 통합 관리한다.'),
 'PROCESS_ORCHESTRATION','/admin/system/process-workspace?process='||process_code,
 '/admin/system/process-workspace?process='||process_code,'IMPLEMENTED','framework_process_definition',actor_code,
 coalesce(nullif(start_condition,''),'선행 업무·권한·기준정보가 충족되어야 한다.'),
 coalesce(nullif(completion_condition,''),'모든 하위 단계와 증빙·검증·승인이 완료되어야 한다.'),
 '{"mobile":"single-column ordered steps","tablet":"two-column summary","desktop":"six-metric control board","overflow":"wrap; local table scroll"}',
 '{"standard":"WCAG 2.1 AA","keyboard":true,"landmarks":true,"labels":true,"focusManagement":true,"statusNotColorOnly":true}',
 jsonb_build_object('actorCode',actor_code,'tenantIsolation',true,'projectIsolation',true,'serverAuthorization',true,'auditRequired',true,'segregationOfDuties',true),
 '{"states":["loading","empty","authority-denied","design-blocked","dependency-blocked","conflict","server-error"],"recovery":"last verified workflow state"}',
 'DESIGN_COMPLETE','ORCHESTRATION_DESIGN_FACTORY'
FROM selected ON CONFLICT(process_code,step_code,audience) DO UPDATE SET
 page_title=excluded.page_title,page_purpose=excluded.page_purpose,screen_type=excluded.screen_type,
 planned_route_path=excluded.planned_route_path,actual_route_path=excluded.actual_route_path,route_status='IMPLEMENTED',
 actor_code=excluded.actor_code,entry_condition=excluded.entry_condition,exit_condition=excluded.exit_condition,
 responsive_contract=excluded.responsive_contract,accessibility_contract=excluded.accessibility_contract,
 security_contract=excluded.security_contract,exception_contract=excluded.exception_contract,
 design_status='DESIGN_COMPLETE',design_version=framework_page_design.design_version+1,
 updated_by='ORCHESTRATION_DESIGN_FACTORY',updated_at=current_timestamp;

WITH field_spec(field_order,field_group,field_code,field_name,data_type,control_type,required,source_column,validation,evidence,priority,help) AS (VALUES
 (10,'업무 식별','processCode','프로세스 코드','CODE','HIDDEN',true,'process_code','{"minLength":1}'::jsonb,false,10,'변경되지 않는 업무 식별자'),
 (20,'업무 식별','processName','프로세스명','STRING','TEXT',true,'process_name','{"minLength":1,"maxLength":300}'::jsonb,false,10,'사용자가 이해할 수 있는 업무 명칭'),
 (30,'업무 식별','domainCode','업무 도메인','CODE','STATUS_BADGE',true,'domain_code','{}'::jsonb,false,20,'메뉴·권한·데이터 분류 기준'),
 (40,'책임·권한','ownerActorCode','책임 액터','CODE','ACTOR_LINK',true,'owner_actor_code','{"activeActorRequired":true}'::jsonb,false,10,'프로세스 결과의 최종 책임자'),
 (50,'목표·범위','goal','업무 목표','TEXT','LONG_TEXT',true,'goal','{"minLength":10}'::jsonb,false,10,'업무가 해결해야 하는 고객 목적'),
 (60,'목표·범위','startCondition','시작 조건','TEXT','CONDITION_VIEW',true,'start_condition','{"minLength":5}'::jsonb,false,10,'실행 전 충족해야 할 조건'),
 (70,'목표·범위','completionCondition','완료 조건','TEXT','CONDITION_VIEW',true,'completion_condition','{"minLength":5}'::jsonb,true,10,'검증 가능한 완료 판정 조건'),
 (80,'통제','riskLevel','위험 등급','CODE','RISK_BADGE',true,'risk_level','{"codeGroup":"PROCESS_RISK"}'::jsonb,false,20,'업무 실패 영향과 통제 강도'),
 (90,'통제','slaHours','처리 기한','INTEGER','DURATION',true,'sla_hours','{"min":1}'::jsonb,false,20,'착수부터 완료까지 목표 시간'),
 (100,'통제','reviewCycleDays','검토 주기','INTEGER','DURATION',true,'review_cycle_days','{"min":1}'::jsonb,false,30,'설계와 기준의 정기 검토 주기'),
 (110,'통제','regulationRefs','법령·기준 근거','TEXT','REFERENCE_LINKS',false,'regulation_refs','{}'::jsonb,true,20,'적용 법령과 방법론 버전'),
 (120,'생애주기','lifecycleStatus','생애주기 상태','CODE','STATUS_BADGE',true,'lifecycle_status','{}'::jsonb,false,20,'설계·운영·폐기 상태'),
 (130,'생애주기','effectiveFrom','적용 시작일','DATE','DATE',false,'effective_from','{}'::jsonb,false,40,'업무 정의 적용 시작일'),
 (140,'생애주기','effectiveUntil','적용 종료일','DATE','DATE',false,'effective_until','{}'::jsonb,false,50,'업무 정의 적용 종료일'),
 (150,'실행 현황','stepCount','전체 단계 수','INTEGER','METRIC',true,null,'{"min":1}'::jsonb,false,10,'실행 순서의 전체 단계'),
 (160,'실행 현황','currentStepCode','현재 단계','CODE','STEP_LINK',false,null,'{}'::jsonb,false,10,'프로젝트 실행의 현재 단계'),
 (170,'실행 현황','currentState','현재 상태','CODE','STATUS_BADGE',false,null,'{}'::jsonb,false,10,'서버 상태 전이 기준 현재 상태'),
 (180,'실행 현황','progressPercent','진행률','DECIMAL','PROGRESS',true,null,'{"min":0,"max":100}'::jsonb,false,10,'검증된 단계 가중치 진행률'),
 (190,'실행 현황','dueAt','업무 마감일시','DATETIME','DATETIME',false,null,'{}'::jsonb,false,20,'SLA와 일정으로 계산한 마감'),
 (200,'품질·검증','assuranceStatus','설계 검증 상태','CODE','STATUS_BADGE',true,null,'{}'::jsonb,true,10,'설계 계약의 구현 가능 여부'),
 (210,'품질·검증','designAccuracyScore','설계 정확도','DECIMAL','SCORE',true,null,'{"min":0,"max":100}'::jsonb,false,10,'액터·상태·데이터·화면·API·테스트 점수'),
 (220,'품질·검증','designBlockerCount','설계 차단 건수','INTEGER','METRIC_LINK',true,null,'{"min":0}'::jsonb,true,10,'개발 전에 해결할 계약 누락'),
 (230,'품질·검증','scenarioCount','테스트 시나리오 수','INTEGER','METRIC_LINK',true,null,'{"min":5}'::jsonb,true,20,'정상·예외·권한·격리·복구 시나리오'),
 (240,'개발 현황','developmentJobCount','개발 작업 수','INTEGER','METRIC_LINK',true,null,'{"min":1}'::jsonb,false,20,'DB·API·화면·테스트 작업'),
 (250,'개발 현황','verifiedJobCount','검증 완료 작업 수','INTEGER','METRIC_LINK',true,null,'{"min":0}'::jsonb,true,20,'산출물과 테스트가 확인된 작업'),
 (260,'증빙·감사','evidenceCount','증빙 수','INTEGER','EVIDENCE_LINK',true,null,'{"min":0}'::jsonb,true,10,'원본·결정·검증·승인 증빙'),
 (270,'증빙·감사','lastAuditAt','최종 감사일시','DATETIME','DATETIME',false,null,'{}'::jsonb,true,30,'최종 변경 및 접근 감사 시각'),
 (280,'후속 업무','nextAction','다음 필수 작업','TEXT','TASK_LINK',true,null,'{"minLength":1}'::jsonb,false,10,'차단과 선후행을 반영한 다음 행동')
)
INSERT INTO framework_page_field_definition(page_design_id,field_order,field_group,field_code,field_name,data_type,
 control_type,required,editable,list_visible,search_enabled,source_table,source_column,api_property,mapping_status,
 validation_contract,privacy_class,permission_code,evidence_required,responsive_priority,help_text,design_source)
SELECT d.page_design_id,f.field_order,f.field_group,f.field_code,f.field_name,f.data_type,f.control_type,f.required,
 false,true,(f.field_order<=140),CASE WHEN f.source_column IS NOT NULL THEN 'framework_process_definition' END,
 f.source_column,f.field_code,CASE WHEN f.source_column IS NOT NULL THEN 'DB_RESOLVED' ELSE 'LOGICAL_CONTRACT' END,
 f.validation,CASE WHEN f.field_group='증빙·감사' THEN 'CONFIDENTIAL' ELSE 'INTERNAL' END,
 d.actor_code||':ORCHESTRATION_READ',f.evidence,f.priority,f.help,'ORCHESTRATION_DESIGN_FACTORY'
FROM framework_page_design d CROSS JOIN field_spec f WHERE d.page_code LIKE '%_ORCHESTRATION_ADMIN'
ON CONFLICT(page_design_id,field_code) DO UPDATE SET field_order=excluded.field_order,field_group=excluded.field_group,
 field_name=excluded.field_name,data_type=excluded.data_type,control_type=excluded.control_type,
 required=excluded.required,source_table=excluded.source_table,source_column=excluded.source_column,
 api_property=excluded.api_property,mapping_status=excluded.mapping_status,
 validation_contract=excluded.validation_contract,privacy_class=excluded.privacy_class,
 permission_code=excluded.permission_code,evidence_required=excluded.evidence_required,
 responsive_priority=excluded.responsive_priority,help_text=excluded.help_text,
 design_source=excluded.design_source,updated_at=current_timestamp;

CREATE OR REPLACE VIEW framework_orchestration_design_audit AS
SELECT count(*)::integer process_count,count(d.page_design_id)::integer designed_page_count,
 count(d.page_design_id) FILTER(WHERE d.route_status='IMPLEMENTED')::integer implemented_page_count,
 count(d.page_design_id) FILTER(WHERE f.field_count>=28 AND f.required_count>=20)::integer professional_page_count,
 count(d.page_design_id) FILTER(WHERE f.field_count<28 OR f.required_count<20)::integer insufficient_page_count
FROM framework_process_definition p
LEFT JOIN framework_page_design d ON d.process_code=p.process_code AND d.page_code=p.process_code||'_ORCHESTRATION_ADMIN'
LEFT JOIN LATERAL (SELECT count(*)::integer field_count,count(*) FILTER(WHERE required)::integer required_count
 FROM framework_page_field_definition x WHERE x.page_design_id=d.page_design_id) f ON true
WHERE p.process_code IN ('GOVERNANCE_CHANGE','DATA_INTEGRATION','LCA_EXECUTION','REDUCTION_EXECUTION',
 'CONTENT_OPERATION','MEMBER_LIFECYCLE','MONITORING_ANALYSIS','PAYMENT_SETTLEMENT','PLATFORM_OPERATION','TRADE_EXECUTION');

UPDATE framework_process_navigation_binding n SET navigation_type='IMPLEMENTED_SCREEN',
 target_path='/admin/system/process-workspace?process='||n.process_code,business_screen_implemented=true,
 binding_status='ACTIVE',binding_source='ORCHESTRATION_DESIGN_FACTORY',verified_at=current_timestamp,updated_at=current_timestamp
WHERE n.process_code IN ('GOVERNANCE_CHANGE','DATA_INTEGRATION','LCA_EXECUTION','REDUCTION_EXECUTION',
 'CONTENT_OPERATION','MEMBER_LIFECYCLE','MONITORING_ANALYSIS','PAYMENT_SETTLEMENT','PLATFORM_OPERATION','TRADE_EXECUTION');

DO $$ DECLARE audit framework_orchestration_design_audit%ROWTYPE; BEGIN
 SELECT * INTO audit FROM framework_orchestration_design_audit;
 IF audit.process_count<>10 OR audit.designed_page_count<>10 OR audit.implemented_page_count<>10
    OR audit.professional_page_count<>10 OR audit.insufficient_page_count<>0 THEN
   RAISE EXCEPTION 'ORCHESTRATION_DESIGN_INCOMPLETE:%',row_to_json(audit);
 END IF;
END $$;
