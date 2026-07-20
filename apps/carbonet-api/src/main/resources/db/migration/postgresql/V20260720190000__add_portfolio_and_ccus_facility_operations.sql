INSERT INTO framework_business_work_type(work_type_code,work_type_name,work_type_name_en,description,sort_order,use_at)
VALUES
('PORTFOLIO','프로젝트·포트폴리오 관리','Project and Portfolio Management','배출량·LCA·감축 프로젝트의 일정, 자원, 의존관계, 마일스톤과 성과를 통합 관리',90,'Y'),
('FACILITY_OPERATION','CCUS 설비·운영','CCUS Facility Operations','포집·압축·운송·주입·저장 설비, 계측기, 정비와 비상 대응 운영',100,'Y')
ON CONFLICT(work_type_code) DO UPDATE SET work_type_name=excluded.work_type_name,
 work_type_name_en=excluded.work_type_name_en,description=excluded.description,
 sort_order=excluded.sort_order,use_at='Y',updated_at=current_timestamp;

UPDATE framework_business_work_type SET sort_order=CASE work_type_code
 WHEN 'MEMBER' THEN 10 WHEN 'EMISSION' THEN 20 WHEN 'LCA' THEN 30 WHEN 'REDUCTION' THEN 40
 WHEN 'MONITORING' THEN 50 WHEN 'TRADE' THEN 60 WHEN 'CERTIFICATE' THEN 70 WHEN 'EDUCATION' THEN 80
 WHEN 'PORTFOLIO' THEN 90 WHEN 'FACILITY_OPERATION' THEN 100 WHEN 'MRV' THEN 110
 WHEN 'COMPLIANCE' THEN 120 WHEN 'DATA_GOVERNANCE' THEN 130 WHEN 'SYSTEM' THEN 140
 WHEN 'COMMON' THEN 150 ELSE sort_order END,updated_at=current_timestamp;

INSERT INTO framework_actor_definition(actor_code,actor_name,actor_name_en,actor_type,purpose,capability_codes,
 delegation_allowed,responsibility_text,accountability_text,competency_requirements,conflict_actor_codes,max_concurrent_assignments,review_cycle_days)
VALUES
('FACILITY_OPERATOR','CCUS 설비 운전 담당자','CCUS Facility Operator','OPERATION','CCUS 설비의 운전 상태와 작업 기록을 관리한다.','FACILITY_OPERATE,ALARM_ACK,SHIFT_HANDOVER',true,'운전조건·알람·교대기록의 정확성','승인 운전범위 준수와 이상 즉시 보고','CCUS 공정·운전·안전 교육','FACILITY_APPROVER',10,180),
('INSTRUMENT_ENGINEER','계측·교정 담당자','Instrumentation Engineer','OPERATION','계측기 검교정과 측정 불확도를 관리한다.','METER_REGISTER,CALIBRATE,UNCERTAINTY_REVIEW',true,'계측기 교정주기·소급성·오차 관리','유효한 계측 데이터 보장','계측·교정 및 측정불확도 역량','FACILITY_OPERATOR',10,180),
('MAINTENANCE_ENGINEER','정비 담당자','Maintenance Engineer','OPERATION','예방·고장 정비와 작업허가를 관리한다.','MAINTENANCE_PLAN,WORK_ORDER,CLOSE_OUT',true,'정비계획·부품·작업결과 관리','설비 건전성과 정비 증빙 보장','기계·전기·배관 정비 역량','FACILITY_OPERATOR',10,180),
('STORAGE_SITE_MANAGER','저장소 운영 책임자','Storage Site Manager','BUSINESS','CO2 주입·저장 운영과 저장소 건전성을 책임진다.','INJECTION_PLAN,STORAGE_OPERATE,PLUME_REVIEW',true,'주입량·압력·저장용량·거동 관리','허가조건과 저장 영구성 준수','지질저장·저류층·주입정 운영 역량','FACILITY_OPERATOR',6,180),
('HSE_MANAGER','안전·환경 비상대응 책임자','HSE Manager','REVIEW','누출·사고·비상대응과 재발 방지를 총괄한다.','INCIDENT_DECLARE,EMERGENCY_COMMAND,RECOVERY_APPROVE',false,'위험성평가·비상조치·사고조사 관리','인명·환경 보호와 법정 보고','산업안전·환경·비상대응 역량','FACILITY_OPERATOR',4,90)
ON CONFLICT(actor_code) DO UPDATE SET actor_name=excluded.actor_name,actor_name_en=excluded.actor_name_en,
 purpose=excluded.purpose,capability_codes=excluded.capability_codes,responsibility_text=excluded.responsibility_text,
 accountability_text=excluded.accountability_text,competency_requirements=excluded.competency_requirements,
 conflict_actor_codes=excluded.conflict_actor_codes,updated_at=current_timestamp;

ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
INSERT INTO framework_process_definition(process_code,process_name,domain_code,process_version,goal,start_condition,
 completion_condition,process_status,automation_mode,development_order,owner_actor_code,regulation_refs,risk_level,
 sla_hours,review_cycle_days,lifecycle_status,effective_from,last_reviewed_at,next_review_at,definition_locked,definition_lock_reason)
VALUES
('FACILITY_ASSET_REGISTRY','CCUS 설비·자산 기준정보 관리','FACILITY_OPERATION','1.0.0','설비·태그·위치·용량·허가·운영책임의 단일 기준정보를 확립한다.','승인된 사업장과 설비 도입 근거가 존재한다.','필수 설비 정보와 책임자·허가·상태 이력이 승인되었다.','ACTIVE','GENERATOR',100,'FACILITY_OPERATOR','산업안전보건·시설 및 환경 인허가 기준','HIGH',72,180,'ACTIVE',current_date,current_timestamp,current_timestamp+interval '180 days',false,'DESIGN_SOURCE_OF_TRUTH'),
('FACILITY_OPERATION_MONITORING','CCUS 설비 운전·상태 모니터링','FACILITY_OPERATION','1.0.0','운전조건·처리량·에너지·알람·교대 기록을 실시간 운영 판단에 연결한다.','운영 가능한 설비와 유효한 계측기가 등록되어 있다.','운전일지와 이상조치 및 교대 인계가 승인·보존되었다.','ACTIVE','GENERATOR',110,'FACILITY_OPERATOR','설비 운전·안전·환경 운영 기준','CRITICAL',24,90,'ACTIVE',current_date,current_timestamp,current_timestamp+interval '90 days',false,'DESIGN_SOURCE_OF_TRUTH'),
('METER_CALIBRATION_MANAGEMENT','계측기·교정·측정불확도 관리','FACILITY_OPERATION','1.0.0','MRV에 사용하는 계측기의 교정 소급성·유효기간·불확도를 보장한다.','계측기와 측정 지점 및 허용오차가 등록되어 있다.','교정성적서·오차·보정·차기 교정일이 승인되었다.','ACTIVE','GENERATOR',120,'INSTRUMENT_ENGINEER','측정기기 검교정 및 MRV 측정 품질 기준','HIGH',72,180,'ACTIVE',current_date,current_timestamp,current_timestamp+interval '180 days',false,'DESIGN_SOURCE_OF_TRUTH'),
('PREVENTIVE_MAINTENANCE','예방·고장 정비 관리','FACILITY_OPERATION','1.0.0','설비 중요도 기반 예방정비와 고장정비를 작업허가·부품·재가동 검증까지 관리한다.','설비 자산과 정비주기 및 위험등급이 확정되어 있다.','작업허가·정비결과·기능시험·재가동 승인이 완료되었다.','ACTIVE','GENERATOR',130,'MAINTENANCE_ENGINEER','설비 정비·작업허가·잠금표찰 기준','HIGH',72,180,'ACTIVE',current_date,current_timestamp,current_timestamp+interval '180 days',false,'DESIGN_SOURCE_OF_TRUTH'),
('CO2_INJECTION_STORAGE_OPERATION','CO2 주입·저장 운영 관리','FACILITY_OPERATION','1.0.0','주입량·압력·온도·저장용량·플룸 거동을 허가조건 내에서 관리한다.','승인된 저장소·주입정·운영계획과 유효 계측기가 존재한다.','주입 실적·저장 건전성·이상 징후와 MRV 인계가 승인되었다.','ACTIVE','GENERATOR',140,'STORAGE_SITE_MANAGER','CO2 지중저장 허가·모니터링·폐쇄 기준','CRITICAL',24,90,'ACTIVE',current_date,current_timestamp,current_timestamp+interval '90 days',false,'DESIGN_SOURCE_OF_TRUTH'),
('FACILITY_EMERGENCY_RESPONSE','설비 사고·비상 대응','FACILITY_OPERATION','1.0.0','누출·압력 이상·설비 사고를 탐지부터 통제·보고·복구·재발방지까지 관리한다.','비상대응 조직·연락망·대응계획과 훈련 이력이 유효하다.','사고 통제·법정보고·원인분석·시정조치·재가동 승인이 완료되었다.','ACTIVE','GENERATOR',150,'HSE_MANAGER','중대재해·환경사고·비상조치 및 보고 기준','CRITICAL',1,90,'ACTIVE',current_date,current_timestamp,current_timestamp+interval '90 days',false,'DESIGN_SOURCE_OF_TRUTH')
ON CONFLICT(process_code) DO NOTHING;
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

CREATE TEMP TABLE facility_step_spec(process_code varchar(80),step_order integer,step_code varchar(80),step_name varchar(160),actor_code varchar(60),command_code varchar(80),requirement_text text,completion_rule text,PRIMARY KEY(process_code,step_code)) ON COMMIT DROP;
INSERT INTO facility_step_spec VALUES
('FACILITY_ASSET_REGISTRY',1,'FAR_REGISTER','설비·태그·위치 등록','FACILITY_OPERATOR','REGISTER_FACILITY','설비 식별자·공정·위치·사양·용량·위험등급을 등록한다.','필수 기준정보와 중복 태그 검사가 완료됨'),
('FACILITY_ASSET_REGISTRY',2,'FAR_ASSIGN','책임·허가·정비기준 연결','MAINTENANCE_ENGINEER','ASSIGN_FACILITY_GOVERNANCE','운영·정비 책임자, 인허가, 검사·정비주기를 연결한다.','책임분리와 유효 인허가가 확인됨'),
('FACILITY_ASSET_REGISTRY',3,'FAR_APPROVE','설비 기준정보 승인','HSE_MANAGER','APPROVE_FACILITY','안전·환경 관점에서 설비 기준정보를 승인한다.','승인 버전과 변경 이력이 보존됨'),
('FACILITY_OPERATION_MONITORING',1,'FOM_PLAN','운전계획·허용범위 설정','FACILITY_OPERATOR','PLAN_OPERATION','처리량·압력·온도·에너지 목표와 허용범위를 설정한다.','승인 운전창과 알람 기준이 확정됨'),
('FACILITY_OPERATION_MONITORING',2,'FOM_OPERATE','운전·알람·조치 기록','FACILITY_OPERATOR','RECORD_OPERATION','운전값·처리량·에너지·알람과 현장 조치를 기록한다.','결측 없는 운전일지와 이상조치가 제출됨'),
('FACILITY_OPERATION_MONITORING',3,'FOM_HANDOVER','교대 검토·인계','HSE_MANAGER','APPROVE_SHIFT_HANDOVER','이상·미결 조치·다음 교대 주의사항을 검토한다.','교대 인계와 미결 위험 담당자가 확정됨'),
('METER_CALIBRATION_MANAGEMENT',1,'MCM_REGISTER','계측기·측정지점 등록','INSTRUMENT_ENGINEER','REGISTER_METER','계측기 사양·범위·정확도·측정지점·MRV 용도를 등록한다.','계측기와 MRV 데이터 항목 연결이 완료됨'),
('METER_CALIBRATION_MANAGEMENT',2,'MCM_CALIBRATE','교정·오차·보정 관리','INSTRUMENT_ENGINEER','RECORD_CALIBRATION','표준기 소급성·교정성적서·전후 오차·보정값을 기록한다.','허용오차와 교정 증빙이 검증됨'),
('METER_CALIBRATION_MANAGEMENT',3,'MCM_APPROVE','유효성·불확도 승인','HSE_MANAGER','APPROVE_METER_VALIDITY','측정불확도와 사용 가능 기간 및 영향 데이터를 승인한다.','유효기간·불확도·차기 교정일이 확정됨'),
('PREVENTIVE_MAINTENANCE',1,'PM_PLAN','위험기반 정비계획','MAINTENANCE_ENGINEER','PLAN_MAINTENANCE','설비 중요도·고장모드·주기·부품·정지창을 계획한다.','정비 범위·자원·작업허가 요구가 확정됨'),
('PREVENTIVE_MAINTENANCE',2,'PM_EXECUTE','작업허가·정비 수행','MAINTENANCE_ENGINEER','EXECUTE_WORK_ORDER','격리·잠금표찰·작업허가 후 정비와 부품 사용을 기록한다.','작업 결과·측정값·사진·부품 이력이 제출됨'),
('PREVENTIVE_MAINTENANCE',3,'PM_RETURN_SERVICE','기능시험·재가동 승인','FACILITY_OPERATOR','RETURN_TO_SERVICE','기능시험·누설시험·보호장치 확인 후 재가동을 승인한다.','재가동 조건과 잔여 위험이 승인됨'),
('CO2_INJECTION_STORAGE_OPERATION',1,'CISO_PLAN','주입계획·허용한계 설정','STORAGE_SITE_MANAGER','PLAN_INJECTION','주입량·압력·온도·정지조건·저장용량을 계획한다.','허가조건 내 주입계획이 승인됨'),
('CO2_INJECTION_STORAGE_OPERATION',2,'CISO_OPERATE','주입 실적·저장거동 기록','STORAGE_SITE_MANAGER','RECORD_INJECTION','주입 실적·정압·환산량·플룸·미소진동·관측정을 기록한다.','주입량 수지와 저장 건전성 자료가 완결됨'),
('CO2_INJECTION_STORAGE_OPERATION',3,'CISO_REVIEW','건전성 검토·MRV 인계','HSE_MANAGER','APPROVE_STORAGE_INTEGRITY','이상 징후·저장용량·누출 가능성과 MRV 인계값을 검토한다.','건전성 판정과 MRV 데이터 버전이 확정됨'),
('FACILITY_EMERGENCY_RESPONSE',1,'FER_DECLARE','사고 탐지·비상 선언','FACILITY_OPERATOR','DECLARE_INCIDENT','누출·압력·화재·인명 위험을 분류하고 비상 단계를 선언한다.','비상등급·위치·영향·초동조치가 등록됨'),
('FACILITY_EMERGENCY_RESPONSE',2,'FER_CONTROL','통제·대피·법정보고','HSE_MANAGER','CONTROL_INCIDENT','설비 정지·격리·대피·환경방제·관계기관 보고를 지휘한다.','위험 통제와 필수 보고·통지가 완료됨'),
('FACILITY_EMERGENCY_RESPONSE',3,'FER_RECOVER','원인분석·복구·재발방지','HSE_MANAGER','CLOSE_INCIDENT','원인·영향량·시정조치·복구시험과 재가동 여부를 결정한다.','CAPA와 재가동 또는 폐쇄 결정이 승인됨');

INSERT INTO framework_process_step(process_code,step_order,step_code,step_name,actor_code,from_state,command_code,to_state,
 completion_rule,user_path,admin_path,api_contract,parent_step_code,step_type,requirement_text,input_contract,output_contract,
 requires_user_page,requires_admin_page,requires_api,requires_database,requires_notification,automation_status,sla_hours,
 escalation_actor_code,evidence_required,evidence_types,segregation_actor_codes,rollback_command_code,decision_rule)
SELECT spec.process_code,spec.step_order,spec.step_code,spec.step_name,spec.actor_code,
 CASE spec.step_order WHEN 1 THEN 'READY' WHEN 2 THEN 'PLANNED' ELSE 'REVIEWED' END,
 spec.command_code,CASE spec.step_order WHEN 1 THEN 'PLANNED' WHEN 2 THEN 'REVIEWED' ELSE 'COMPLETED' END,
 spec.completion_rule,
 '/ccus/facility/'||lower(replace(spec.process_code,'_','-'))||'?step='||lower(spec.step_code),
 '/admin/ccus/facility/'||lower(replace(spec.process_code,'_','-'))||'?step='||lower(spec.step_code),
 '/api/ccus/facility/'||lower(replace(spec.process_code,'_','-'))||'/'||lower(spec.step_code),
 null,CASE WHEN spec.step_order=3 THEN 'DECISION' ELSE 'TASK' END,spec.requirement_text,
 jsonb_build_object('tenantId','string','projectId','string','facilityId','string','rowVersion','integer')::text,
 jsonb_build_object('recordId','string','statusCode',CASE spec.step_order WHEN 3 THEN 'COMPLETED' ELSE 'IN_PROGRESS' END,'evidenceHash','string')::text,
 true,true,true,true,spec.step_order=3,'APPROVED',CASE WHEN spec.process_code='FACILITY_EMERGENCY_RESPONSE' THEN 1 ELSE 24 END,
 'HSE_MANAGER',true,'["OPERATING_RECORD","APPROVAL","EVIDENCE_HASH"]','',
 CASE WHEN spec.step_order=1 THEN '' ELSE 'REVERT_PREVIOUS_STATE' END,
 CASE WHEN spec.step_order=3 THEN '필수 증빙·권한분리·허용한계 검증이 모두 통과해야 완료한다.' ELSE '' END
FROM facility_step_spec spec ON CONFLICT(process_code,step_code) DO NOTHING;

INSERT INTO framework_simulation_case(case_code,process_code,case_name,case_type,preconditions,steps_json,assertions_json,
 case_status,severity,required_evidence,automated,expected_duration_minutes)
SELECT process.process_code||'_'||test.code,process.process_code,process.process_name||' '||test.name,test.type,
 test.preconditions,test.steps,test.assertions,'APPROVED',test.severity,test.evidence,true,test.duration
FROM framework_process_definition process CROSS JOIN (VALUES
 ('HAPPY','정상 완료','HAPPY_PATH','유효한 프로젝트·설비·액터 배정','["계획","수행","검토","완료"]','["상태 COMPLETED","증빙 해시 보존","다음 업무 인계"]','MAJOR','상태이력,증빙해시',30),
 ('EXCEPTION','허용한계·증빙 오류','EXCEPTION','허용한계 초과 또는 필수 증빙 누락','["오류 입력","검증","차단"]','["완료 차단","보완 사유 기록","원본 보존"]','CRITICAL','검증오류,보완이력',15),
 ('AUTHORITY','권한분리 위반','AUTHORITY','수행자가 승인 명령 시도','["권한 없는 승인","서버 검증"]','["403 거부","감사로그 기록","상태 불변"]','CRITICAL','접근감사로그',10),
 ('ISOLATION','테넌트·프로젝트 격리','ISOLATION','다른 프로젝트 식별자로 조회·수정 시도','["교차 범위 요청","서버 범위 검증"]','["데이터 미노출","변경 없음","감사로그 기록"]','CRITICAL','격리검증로그',10),
 ('RECOVERY','중단·충돌 복구','RECOVERY','동시 수정 또는 외부 연계 실패','["충돌 발생","재조회","재시도 또는 롤백"]','["중복 처리 없음","일관 상태 복구","재시도 이력"]','MAJOR','복구이력,멱등키',20)
) test(code,name,type,preconditions,steps,assertions,severity,evidence,duration)
WHERE process.domain_code='FACILITY_OPERATION'
ON CONFLICT(case_code) DO NOTHING;

INSERT INTO framework_professional_screen_contract(process_code,step_code,audience,route_path,screen_name,actor_code,
 business_purpose,entry_condition,exit_condition,kpi_contract,section_contract,field_contract,command_contract,
 state_contract,api_contract,data_contract,evidence_contract,responsive_contract,accessibility_contract,security_contract,
 contract_status,updated_by,menu_visibility,menu_verified)
SELECT step.process_code,step.step_code,audience.code,
 CASE audience.code WHEN 'USER' THEN step.user_path ELSE step.admin_path END,
 step.step_name||CASE audience.code WHEN 'USER' THEN ' 업무 화면' ELSE ' 관리자 화면' END,
 step.actor_code,step.requirement_text,step.from_state,step.completion_rule,
 '["진행률","기한","이상·차단","증빙 완결성"]','["업무요약","검색·필터","전문 데이터","증빙·이력","명령·다음업무"]',
 '["projectId","facilityId","assetTag","siteCode","statusCode","effectiveAt","measurementValue","unitCode","riskLevel","evidenceIds","approvalComment","rowVersion"]',
 jsonb_build_array(step.command_code,'SAVE_DRAFT','REQUEST_CORRECTION')::text,
 '["LOADING","EMPTY","ERROR","FORBIDDEN","READY","BLOCKED","CONFLICT"]',jsonb_build_array(step.api_contract)::text,
 '["tenantId","projectId","facilityId","recordId","statusCode","rowVersion","evidenceHash"]',
 '["원본 운전·계측·정비 기록","승인 이력","무결성 해시"]',
 'KRDS 유동 그리드: 모바일 1열, 태블릿 2열, 데스크톱 업무표+상세패널. 텍스트 넘침 없이 줄바꿈한다.',
 'WCAG 2.1 AA, 키보드 명령, 명시적 라벨·오류·상태 안내를 제공한다.',
 '서버에서 테넌트·프로젝트·액터 권한, 허용상태, 낙관적 잠금과 증빙 무결성을 검증한다.',
 'REVIEW_REQUIRED','FACILITY_DESIGN_FACTORY',false,false
FROM framework_process_step step CROSS JOIN (VALUES('USER'),('ADMIN')) audience(code)
WHERE step.process_code IN (SELECT process_code FROM framework_process_definition WHERE domain_code='FACILITY_OPERATION')
ON CONFLICT(process_code,step_code,audience,route_path) DO NOTHING;

INSERT INTO framework_page_design(process_code,step_code,audience,page_code,page_title,page_purpose,screen_type,
 planned_route_path,actual_route_path,route_status,primary_entity,upstream_step_code,downstream_step_code,actor_code,
 entry_condition,exit_condition,responsive_contract,accessibility_contract,security_contract,exception_contract,design_status,updated_by)
SELECT contract.process_code,contract.step_code,contract.audience,
 contract.process_code||'_'||contract.step_code||'_'||contract.audience,
 contract.screen_name,contract.business_purpose,
 CASE WHEN step.step_type='DECISION' THEN 'REVIEW_DECISION' ELSE 'WORK_EXECUTION' END,
 contract.route_path,null,'DESIGN_ONLY','ccus_facility_operation_record',
 (SELECT prior.step_code FROM framework_process_step prior WHERE prior.process_code=step.process_code AND prior.step_order<step.step_order ORDER BY prior.step_order DESC LIMIT 1),
 (SELECT next.step_code FROM framework_process_step next WHERE next.process_code=step.process_code AND next.step_order>step.step_order ORDER BY next.step_order LIMIT 1),
 contract.actor_code,contract.entry_condition,contract.exit_condition,
 '{"mobile":"single-column","tablet":"two-column","desktop":"table-detail","overflow":"wrap"}',
 '{"standard":"WCAG 2.1 AA","keyboard":true,"labels":true,"liveErrors":true}',
 '{"tenantIsolation":true,"projectIsolation":true,"actorAuthorization":true,"optimisticLock":true}',
 '{"states":["LOADING","EMPTY","ERROR","FORBIDDEN","BLOCKED","CONFLICT"],"recovery":true}',
 'DESIGN_COMPLETE','FACILITY_DESIGN_FACTORY'
FROM framework_professional_screen_contract contract
JOIN framework_process_step step ON step.process_code=contract.process_code AND step.step_code=contract.step_code
WHERE contract.process_code IN (SELECT process_code FROM framework_process_definition WHERE domain_code='FACILITY_OPERATION')
ON CONFLICT(process_code,step_code,audience) DO NOTHING;

WITH fields(field_order,field_group,field_code,field_name,data_type,control_type,required,list_visible,search_enabled,evidence_required,priority) AS (VALUES
 (10,'컨텍스트','projectId','프로젝트','STRING','PROJECT_SELECT',true,true,true,false,10),
 (20,'설비','facilityId','설비 ID','STRING','FACILITY_SELECT',true,true,true,false,10),
 (30,'설비','assetTag','설비 태그','STRING','TEXT',true,true,true,false,10),
 (40,'설비','siteCode','사업장·저장소','CODE','SITE_SELECT',true,true,true,false,10),
 (50,'운영','statusCode','업무 상태','CODE','STATUS_SELECT',true,true,true,false,10),
 (60,'운영','effectiveAt','발생·적용 일시','DATETIME','DATETIME',true,true,true,false,20),
 (70,'전문값','measurementValue','측정·운영 값','DECIMAL','NUMBER_UNIT',true,true,false,false,10),
 (80,'전문값','unitCode','단위','CODE','UNIT_SELECT',true,true,false,false,10),
 (90,'위험·검토','riskLevel','위험 등급','CODE','RISK_SELECT',true,true,true,false,10),
 (100,'증빙','evidenceIds','원본 증빙','ARRAY','FILE_UPLOAD',true,false,false,true,10),
 (110,'승인','approvalComment','검토·승인 의견','TEXT','TEXTAREA',false,false,false,true,20),
 (120,'무결성','rowVersion','데이터 버전','INTEGER','VERSION',true,false,false,false,10)
)
INSERT INTO framework_page_field_definition(page_design_id,field_order,field_group,field_code,field_name,data_type,
 control_type,required,editable,list_visible,search_enabled,api_property,mapping_status,validation_contract,privacy_class,
 permission_code,evidence_required,responsive_priority,help_text,design_source)
SELECT page.page_design_id,field.field_order,field.field_group,field.field_code,field.field_name,field.data_type,
 field.control_type,field.required,true,field.list_visible,field.search_enabled,field.field_code,'LOGICAL_CONTRACT',
 CASE field.field_code WHEN 'measurementValue' THEN '{"numeric":true,"unitRequired":true}'::jsonb
  WHEN 'evidenceIds' THEN '{"minItems":1,"hashRequired":true}'::jsonb ELSE '{}'::jsonb END,
 'INTERNAL',page.actor_code||':'||page.audience,field.evidence_required,field.priority,
 field.field_name||' 전문 업무 계약','FACILITY_DOMAIN_DESIGN'
FROM framework_page_design page CROSS JOIN fields field
WHERE page.process_code IN (SELECT process_code FROM framework_process_definition WHERE domain_code='FACILITY_OPERATION')
ON CONFLICT(page_design_id,field_code) DO NOTHING;

INSERT INTO framework_development_job(process_code,step_code,job_type,job_name,target_path,specification_json,
 job_status,approval_status,execution_mode,job_group_code,required,progress_weight,max_attempts,quality_status,quality_report,created_by)
SELECT step.process_code,step.step_code,'FULL_STACK',step.step_name||' 제너레이터 구현',
 coalesce(step.user_path,step.admin_path),jsonb_build_object('designSource','framework_page_design','generatorRequired',true,'backend',true,'frontend',true,'database',true,'tests',true)::text,
 'PLANNED','APPROVED','PARALLEL',step.process_code||'_IMPLEMENTATION',true,1,3,'PENDING','{"reason":"DESIGN_COMPLETE_IMPLEMENTATION_PENDING"}','FACILITY_DESIGN_FACTORY'
FROM framework_process_step step WHERE step.process_code IN (SELECT process_code FROM framework_process_definition WHERE domain_code='FACILITY_OPERATION')
ON CONFLICT(process_code,step_code,job_type,target_path) DO NOTHING;

UPDATE framework_process_definition SET definition_locked=true,
 definition_lock_reason='DESIGN_SOURCE_OF_TRUTH',updated_at=current_timestamp
WHERE domain_code='FACILITY_OPERATION' AND definition_locked=false;

CREATE TEMP TABLE portfolio_reclass(process_code varchar(80) PRIMARY KEY) ON COMMIT DROP;
INSERT INTO portfolio_reclass VALUES('PROJECT_LIFECYCLE_CONTROL'),('MACC_PORTFOLIO');
ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
UPDATE framework_process_definition process SET domain_code='PORTFOLIO',updated_at=current_timestamp
FROM portfolio_reclass map WHERE map.process_code=process.process_code;
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

UPDATE framework_business_process_sequence sequence SET work_type_code='PORTFOLIO',workflow_phase='PROJECT_PORTFOLIO',
 workflow_order=900000+source.ordinal,updated_at=current_timestamp
FROM (SELECT process_code,row_number() OVER(ORDER BY process_code)::integer ordinal FROM portfolio_reclass) source
WHERE source.process_code=sequence.process_code;

INSERT INTO framework_business_process_sequence(work_type_code,process_code,workflow_order,workflow_phase,process_role,sequence_status)
SELECT 'FACILITY_OPERATION',process.process_code,row_number() OVER(ORDER BY process.development_order)*10,
 CASE WHEN process.process_code IN ('FACILITY_ASSET_REGISTRY','PREVENTIVE_MAINTENANCE') THEN 'ASSET_MAINTENANCE'
      WHEN process.process_code IN ('FACILITY_OPERATION_MONITORING','METER_CALIBRATION_MANAGEMENT') THEN 'OPERATION_MEASUREMENT'
      ELSE 'STORAGE_EMERGENCY' END,'CORE','ACTIVE'
FROM framework_process_definition process WHERE process.domain_code='FACILITY_OPERATION'
ON CONFLICT(process_code) DO UPDATE SET work_type_code='FACILITY_OPERATION',workflow_order=excluded.workflow_order,
 workflow_phase=excluded.workflow_phase,sequence_status='ACTIVE',updated_at=current_timestamp;

CREATE OR REPLACE FUNCTION framework_rebuild_process_execution_topology()
RETURNS TABLE(process_count integer,topology_count integer,classification_mismatch_count integer)
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE framework_business_process_sequence SET workflow_order=workflow_order+1000000,updated_at=current_timestamp;
  WITH ranked AS (
    SELECT process_code,work_type_code,row_number() OVER(PARTITION BY work_type_code ORDER BY workflow_order,process_code)::integer ordinal,
      count(*) OVER(PARTITION BY work_type_code)::integer total
    FROM framework_business_process_sequence WHERE sequence_status='ACTIVE'
  )
  UPDATE framework_business_process_sequence sequence SET workflow_order=ranked.ordinal*10,
    process_role=CASE WHEN ranked.ordinal=1 THEN 'ENTRY' WHEN ranked.ordinal=ranked.total THEN 'EXIT'
      WHEN sequence.process_role IN ('BRANCH','SUPPORT') THEN sequence.process_role ELSE 'CORE' END,updated_at=current_timestamp
  FROM ranked WHERE ranked.process_code=sequence.process_code;
  WITH ordered AS (
    SELECT process_code,lead(process_code) OVER(PARTITION BY work_type_code ORDER BY workflow_order,process_code) next_code
    FROM framework_business_process_sequence WHERE sequence_status='ACTIVE'
  ) UPDATE framework_business_process_sequence sequence SET next_process_code=ordered.next_code,updated_at=current_timestamp
    FROM ordered WHERE ordered.process_code=sequence.process_code;
  WITH ordered AS (
    SELECT sequence.*,sum(CASE WHEN process_role IN ('BRANCH','SUPPORT') THEN 0 ELSE 1 END)
      OVER(PARTITION BY work_type_code ORDER BY workflow_order,process_code) execution_wave
    FROM framework_business_process_sequence sequence WHERE sequence_status='ACTIVE'
  ), normalized AS (
    SELECT ordered.*,row_number() OVER(PARTITION BY work_type_code,execution_wave ORDER BY workflow_order,process_code) lane_order,
      count(*) OVER(PARTITION BY work_type_code,execution_wave) wave_size FROM ordered
  ), topology AS (
    SELECT node.*,coalesce((SELECT jsonb_agg(prior.process_code ORDER BY prior.workflow_order,prior.process_code)
      FROM normalized prior WHERE prior.work_type_code=node.work_type_code AND prior.execution_wave=node.execution_wave-1
      AND prior.process_role NOT IN ('BRANCH','SUPPORT')),'[]'::jsonb) predecessors FROM normalized node
  )
  INSERT INTO framework_process_execution_topology(process_code,work_type_code,stage_code,execution_wave,lane_code,lane_order,
    execution_mode,join_strategy,predecessor_process_codes,shared_milestone_code,required_for_join,applicability_rule,topology_status)
  SELECT process_code,work_type_code,workflow_phase,execution_wave,
    CASE WHEN process_role='BRANCH' THEN 'EXCEPTION' WHEN process_role='SUPPORT' THEN 'SUPPORT' ELSE 'PRIMARY' END,lane_order,
    CASE WHEN process_role IN ('BRANCH','SUPPORT') THEN 'CONDITIONAL' WHEN wave_size>1 THEN 'PARALLEL' ELSE 'SEQUENTIAL' END,
    CASE WHEN execution_wave=1 THEN 'NONE' ELSE 'ALL' END,predecessors,
    work_type_code||'_'||workflow_phase||'_W'||execution_wave,process_role NOT IN ('BRANCH','SUPPORT'),
    CASE WHEN process_role='BRANCH' THEN 'INCIDENT_OR_EXCEPTION' WHEN process_role='SUPPORT' THEN 'ON_DEMAND' ELSE 'ALWAYS' END,'DESIGN_COMPLETE'
  FROM topology ON CONFLICT(process_code) DO UPDATE SET work_type_code=excluded.work_type_code,stage_code=excluded.stage_code,
    execution_wave=excluded.execution_wave,lane_code=excluded.lane_code,lane_order=excluded.lane_order,
    execution_mode=excluded.execution_mode,join_strategy=excluded.join_strategy,
    predecessor_process_codes=excluded.predecessor_process_codes,shared_milestone_code=excluded.shared_milestone_code,
    required_for_join=excluded.required_for_join,applicability_rule=excluded.applicability_rule,
    topology_status='DESIGN_COMPLETE',updated_at=current_timestamp;
  UPDATE framework_process_execution_topology current_node SET successor_process_codes=coalesce((SELECT jsonb_agg(next_node.process_code ORDER BY next_node.lane_order,next_node.process_code)
    FROM framework_process_execution_topology next_node WHERE next_node.work_type_code=current_node.work_type_code
    AND current_node.process_code IN (SELECT jsonb_array_elements_text(next_node.predecessor_process_codes))),'[]'::jsonb),updated_at=current_timestamp;
  UPDATE framework_business_process_sequence sequence SET prerequisite_process_codes=array_to_string(ARRAY(SELECT jsonb_array_elements_text(topology.predecessor_process_codes)),','),updated_at=current_timestamp
    FROM framework_process_execution_topology topology WHERE topology.process_code=sequence.process_code;
  RETURN QUERY SELECT (SELECT count(*)::integer FROM framework_process_definition),
    (SELECT count(*)::integer FROM framework_process_execution_topology WHERE topology_status='DESIGN_COMPLETE'),
    (SELECT count(*)::integer FROM framework_process_definition process JOIN framework_business_process_sequence sequence USING(process_code)
      JOIN framework_process_execution_topology topology USING(process_code)
      WHERE upper(process.domain_code)<>sequence.work_type_code OR sequence.work_type_code<>topology.work_type_code);
END $$;

SELECT * FROM framework_rebuild_process_execution_topology();

UPDATE framework_project_process_applicability applicability SET work_type_code=sequence.work_type_code,
 criteria_snapshot=jsonb_set(criteria_snapshot,'{workTypeCode}',to_jsonb(sequence.work_type_code),true),updated_at=current_timestamp
FROM framework_business_process_sequence sequence WHERE sequence.process_code=applicability.process_code;

DO $$ DECLARE definition text; BEGIN
 definition:=pg_get_functiondef('framework_sync_project_processes(character varying,character varying)'::regprocedure);
 definition:=replace(definition,
  'seq.work_type_code IN (''EMISSION'',''MRV'',''COMPLIANCE'',''DATA_GOVERNANCE'')',
  'seq.work_type_code IN (''EMISSION'',''MRV'',''COMPLIANCE'',''DATA_GOVERNANCE'',''PORTFOLIO'')');
 IF position('''PORTFOLIO''' in definition)=0 THEN RAISE EXCEPTION 'PROJECT_PROCESS_SYNC_PORTFOLIO_PATCH_FAILED'; END IF;
 EXECUTE definition;
END $$;

INSERT INTO framework_process_data_handoff(process_code,from_step_code,to_process_code,to_step_code,handoff_type,context_keys,
 payload_contract,integrity_contract,authorization_contract,failure_contract)
SELECT step.process_code,step.step_code,step.process_code,next.step_code,'STEP',
 '["tenantId","projectId","facilityId","recordId","rowVersion"]',
 jsonb_build_object('fromOutput',framework_try_jsonb(step.output_contract),'toInput',framework_try_jsonb(next.input_contract)),
 '{"immutableSnapshot":true,"evidenceHash":true,"optimisticLock":true}',
 jsonb_build_object('fromActor',step.actor_code,'toActor',next.actor_code,'tenantIsolation',true,'projectIsolation',true,'segregationChecked',true),
 '{"onMissing":"DEPENDENCY_BLOCKED","onInvalid":"VALIDATION_ERROR","onConflict":"RELOAD_AND_REVIEW","onUnauthorized":"DENY_AND_AUDIT"}'
FROM framework_process_step step JOIN framework_process_step next ON next.process_code=step.process_code AND next.step_order=step.step_order+1
WHERE step.process_code IN (SELECT process_code FROM framework_process_definition WHERE domain_code='FACILITY_OPERATION')
ON CONFLICT(process_code,from_step_code,to_process_code,to_step_code,handoff_type) DO NOTHING;

CREATE OR REPLACE VIEW framework_work_type_classification_audit AS
SELECT (SELECT count(*) FROM framework_business_work_type WHERE use_at='Y') active_work_type_count,
 (SELECT count(*) FROM framework_process_definition process LEFT JOIN framework_business_process_sequence sequence USING(process_code)
  LEFT JOIN framework_process_execution_topology topology USING(process_code)
  WHERE sequence.process_code IS NULL OR topology.process_code IS NULL OR upper(process.domain_code)<>sequence.work_type_code OR sequence.work_type_code<>topology.work_type_code) classification_mismatch_count,
 (SELECT count(*) FROM framework_business_work_type work_type WHERE work_type.work_type_code IN ('MRV','COMPLIANCE','DATA_GOVERNANCE','PORTFOLIO','FACILITY_OPERATION') AND work_type.use_at='Y'
  AND EXISTS(SELECT 1 FROM framework_process_definition process WHERE upper(process.domain_code)=work_type.work_type_code)) strategic_work_type_count;
