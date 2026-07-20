-- Reference-derived specialized workflows. These are design-complete but remain
-- implementation-pending until generated code and evidence-based tests pass.

INSERT INTO framework_actor_definition(actor_code,actor_name,actor_name_en,actor_type,purpose,capability_codes,
 delegation_allowed,responsibility_text,accountability_text,competency_requirements,conflict_actor_codes,
 max_concurrent_assignments,review_cycle_days)
VALUES
('LAB_ANALYST','CO2 품질·시험 분석 담당자','CO2 Quality and Laboratory Analyst','OPERATION',
 '포집 CO2와 LCO2의 성분·순도·불순물 시험 및 분석장비 적합성을 판정한다.',
 'SAMPLE_PLAN,LAB_ANALYSIS,QUALITY_DECISION',true,
 '시료채취 계획, 시험방법, 분석장비, 시험결과와 불확도를 관리한다.',
 '시험 결과의 추적성·재현성과 품질 판정의 독립성을 보장한다.',
 '가스분석·시험방법·품질보증·측정불확도 역량','TRADE_OPERATOR',8,180)
ON CONFLICT(actor_code) DO UPDATE SET actor_name=excluded.actor_name,actor_name_en=excluded.actor_name_en,
 purpose=excluded.purpose,capability_codes=excluded.capability_codes,responsibility_text=excluded.responsibility_text,
 accountability_text=excluded.accountability_text,competency_requirements=excluded.competency_requirements,
 conflict_actor_codes=excluded.conflict_actor_codes,updated_at=current_timestamp;

ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;
INSERT INTO framework_process_definition(process_code,process_name,domain_code,process_version,goal,start_condition,
 completion_condition,process_status,automation_mode,development_order,prerequisite_codes,parent_process_code,
 process_level,owner_actor_code,regulation_refs,risk_level,sla_hours,review_cycle_days,lifecycle_status,effective_from,
 last_reviewed_at,next_review_at,definition_locked,definition_lock_reason)
VALUES
('CO2_LOT_TAG_MANAGEMENT','포집 CO2 로트·태그·물량 무결성 관리','TRADE','1.0.0',
 '포집 CO2/LCO2를 불변 로트로 식별하고 성분·부피·출처·이동·거래 및 잔량을 중복 없이 추적한다.',
 '승인된 포집 기업·설비·계측기와 생산 실적이 존재한다.',
 '로트 원본·보정 이력·물량수지·소유권·중복사용 검사와 후속 품질시험 인계가 완료되었다.',
 'ACTIVE','GENERATOR',261,'CO2_SUPPLY_REGISTRATION,MRV_TRACEABILITY,DOUBLE_USE_PREVENTION','CO2_SUPPLY_REGISTRATION',2,
 'TRADE_OPERATOR','포집 이산화탄소 태그 및 데이터 관리 요구사항','CRITICAL',24,90,'ACTIVE',current_date,current_timestamp,current_timestamp+interval '90 days',false,'REFERENCE_DESIGN_SOURCE'),
('CO2_QUALITY_ANALYSIS','CO2 성분·품질시험·분석장비 판정','FACILITY_OPERATION','1.0.0',
 '투입·배출 자료와 시료시험으로 CO2 성분을 검증하고 적합한 분석장비·시험방법 및 사용 적격성을 확정한다.',
 '추적 가능한 CO2 로트와 시료채취 지점, 품질 기준이 존재한다.',
 '시험성적서·불확도·부적합 조치와 인증·거래 적격성 판정이 승인되었다.',
 'ACTIVE','GENERATOR',155,'CO2_LOT_TAG_MANAGEMENT,METER_CALIBRATION_MANAGEMENT','CO2_LOT_TAG_MANAGEMENT',2,
 'LAB_ANALYST','인증 평가 가이드라인 및 분석장비 제안 요구사항','HIGH',72,180,'ACTIVE',current_date,current_timestamp,current_timestamp+interval '180 days',false,'REFERENCE_DESIGN_SOURCE'),
('CERTIFICATION_ELIGIBILITY_CHECK','인증 발급 적격성·외부 중복수혜 검증','CERTIFICATE','1.0.0',
 '회원사 유효성·법인인증·재생에너지 투입량·REC 중복수혜·CO2 물량 무결성을 인증 발급 전에 검증한다.',
 '검토 가능한 인증 신청과 잠긴 산정·보고서 데이터셋이 존재한다.',
 '모든 외부 검증 결과와 예외 승인 근거가 보존되고 발급 가능 또는 보완 상태가 확정되었다.',
 'ACTIVE','GENERATOR',296,'REPORT_SUBMISSION,DOUBLE_USE_PREVENTION,CO2_QUALITY_ANALYSIS','CERTIFICATE_REVIEW_ISSUANCE',2,
 'CERTIFICATE_OFFICER','보고서 및 인증서 발급 신청·검토 요구사항','CRITICAL',24,90,'ACTIVE',current_date,current_timestamp,current_timestamp+interval '90 days',false,'REFERENCE_DESIGN_SOURCE'),
('CERTIFICATE_FEE_TAX_REFUND','인증 수수료·세금계산서·환불 통합 처리','CERTIFICATE','1.0.0',
 '인증 수수료 산정부터 가상계좌·입금·세금계산서·환불·정산까지 인증 상태와 원자적으로 연결한다.',
 '적격성 검증을 통과한 인증 신청과 유효한 법인 청구정보가 존재한다.',
 '납부·발행·환불·정산 결과와 감사 증적이 일치하며 발급 차단 또는 해제 상태가 확정되었다.',
 'ACTIVE','GENERATOR',297,'CERTIFICATION_ELIGIBILITY_CHECK,TRADE_SETTLEMENT,REFUND_MANAGEMENT','CERTIFICATE_REVIEW_ISSUANCE',2,
 'SETTLEMENT_OPERATOR','인증서 발급 수수료·계좌·세금계산서 관리 요구사항','CRITICAL',24,90,'ACTIVE',current_date,current_timestamp,current_timestamp+interval '90 days',false,'REFERENCE_DESIGN_SOURCE'),
('COMPANY_MANAGER_DELEGATION','회원사 담당자 위임·승계·업무 인계','MEMBER','1.0.0',
 '회원사 담당자 지정·위임·승계와 직원 승인 권한을 기간·범위·미결업무 인계와 함께 관리한다.',
 '승인된 회원사와 유효한 기존·후임 담당자 후보가 존재한다.',
 '직무분리·권한기간·미결업무·통지·변경이력이 검증되고 담당자 공백이 없다.',
 'ACTIVE','GENERATOR',219,'COMPANY_REGISTRATION_APPROVAL,USER_AUTHORITY_ASSIGNMENT','MEMBER_LIFECYCLE',2,
 'COMPANY_ADMIN','회원정보 관리기능-2 담당자 위임 요구사항','HIGH',48,180,'ACTIVE',current_date,current_timestamp,current_timestamp+interval '180 days',false,'REFERENCE_DESIGN_SOURCE'),
('PRIVACY_RETENTION_DESTRUCTION','개인정보 열람·보존·파기 통제','DATA_GOVERNANCE','1.0.0',
 '추가인증 기반 마스킹 해제와 목적별 보존기간·법적 보류·자동파기 및 파기 증적을 통제한다.',
 '개인정보 분류·처리목적·보존기간·법적 보류 정책이 승인되어 있다.',
 '열람과 파기 대상·예외·실패·재처리·승인 증적이 보존되고 원본이 정책대로 처리되었다.',
 'ACTIVE','GENERATOR',375,'SECURITY_POLICY_OPERATION,AUDIT_LOG_OPERATION,ACCOUNT_WITHDRAWAL','GOVERNANCE_CHANGE',2,
 'PRIVACY_OFFICER','개인정보 마스킹 해제·이력·보존기간 초과 파기 요구사항','CRITICAL',24,90,'ACTIVE',current_date,current_timestamp,current_timestamp+interval '90 days',false,'REFERENCE_DESIGN_SOURCE'),
('SCHEDULED_STATISTICS_REPORTING','정기 통계 생성·확정·행정 보고','MONITORING','1.0.0',
 '설비·시장·배출량·인증·수수료 통계를 주기별로 생성·검토·확정하고 시각화·파일·외부시스템으로 제공한다.',
 '지표 정의·집계 기준·데이터 기준시점·수신기관·일정이 승인되어 있다.',
 '재현 가능한 통계 스냅샷과 생성 이력·승인·배포·실패 재처리 증적이 보존되었다.',
 'ACTIVE','GENERATOR',246,'INTEGRATED_MONITORING,BATCH_SCHEDULE_OPERATION,DATA_INTEGRATION','MONITORING_ANALYSIS',2,
 'DATA_ANALYST','일정관리 및 통계정보 관리 요구사항','HIGH',48,90,'ACTIVE',current_date,current_timestamp,current_timestamp+interval '90 days',false,'REFERENCE_DESIGN_SOURCE'),
('CALCULATION_ENGINE_PARITY','산정 엔진 기준·VBA 동등성 회귀검증','DATA_GOVERNANCE','1.0.0',
 '동일 입력에 대해 기준 Excel VBA와 웹 산정 엔진의 중간값·최종값·반올림·단위 결과 동등성을 보장한다.',
 '승인된 기준 사례·수식·LCI DB·배출계수·단위 버전과 허용오차가 존재한다.',
 '정상·경계·오류·대용량 회귀시험이 통과하고 차이가 승인되지 않으면 배포가 차단된다.',
 'ACTIVE','GENERATOR',376,'EMISSION_CALCULATION,DATA_SCHEMA_CONTRACT,VERSION_BACKUP_RECOVERY','GOVERNANCE_CHANGE',2,
 'VERIFIER','온실가스 배출량 산정 시뮬레이션 VBA 동일 결과 요구사항','CRITICAL',24,90,'ACTIVE',current_date,current_timestamp,current_timestamp+interval '90 days',false,'REFERENCE_DESIGN_SOURCE'),
('LEGAL_NOTIFICATION_DELIVERY','법적·업무 통지·수신증 관리','SYSTEM','1.0.0',
 '신청·보완·승인·반려·납부·발급·취소 통지를 SMS·이메일·국민비서로 전달하고 도달 증적을 관리한다.',
 '통지 사건·대상자·동의·템플릿·우선 채널·대체 채널 정책이 존재한다.',
 '채널별 발송·도달·열람·실패·재시도·대체발송과 법정 수신증이 보존되었다.',
 'ACTIVE','GENERATOR',352,'NOTIFICATION_CENTER_OPERATION,DEADLINE_NOTIFICATION_POLICY,EXTERNAL_SERVICE_STATUS','PLATFORM_OPERATION',2,
 'PLATFORM_OPERATOR','회원·인증 단계별 SMS·이메일·국민비서 통지 요구사항','HIGH',4,90,'ACTIVE',current_date,current_timestamp,current_timestamp+interval '90 days',false,'REFERENCE_DESIGN_SOURCE')
ON CONFLICT(process_code) DO NOTHING;
ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

CREATE TEMP TABLE reference_step_spec(
 process_code varchar(80),step_order integer,step_code varchar(80),step_name varchar(160),actor_code varchar(60),
 command_code varchar(80),requirement_text text,completion_rule text,PRIMARY KEY(process_code,step_code)
) ON COMMIT DROP;

INSERT INTO reference_step_spec VALUES
('CO2_LOT_TAG_MANAGEMENT',1,'CLT_CREATE','로트 생성·원본 태그 확정','TRADE_OPERATOR','CREATE_CO2_LOT','포집회사·설비·성분·부피·생산시점·계측근거를 원본 태그로 생성한다.','고유 로트와 불변 원본 해시가 생성됨'),
('CO2_LOT_TAG_MANAGEMENT',2,'CLT_RECONCILE','이동·거래·잔량 물량수지','TRADE_OPERATOR','RECONCILE_LOT_BALANCE','분할·병합·이동·인수·거래·취소량을 로트 원장에 반영한다.','입출고와 잔량 수지가 일치하고 음수·중복이 없음'),
('CO2_LOT_TAG_MANAGEMENT',3,'CLT_APPROVE','보정·무결성 검토·품질 인계','AUDITOR','APPROVE_LOT_INTEGRITY','원본 변경 없이 보정 이력을 추가하고 이중계상·중복거래를 판정한다.','감사 승인 후 품질시험 대상 로트가 인계됨'),
('CO2_QUALITY_ANALYSIS',1,'CQA_PLAN','성분예측·시료·시험계획','LAB_ANALYST','PLAN_CO2_ANALYSIS','공정 투입·배출 자료로 예상 성분과 필수 시험·장비·채취계획을 정한다.','대표 시료·시험방법·장비·허용기준이 승인됨'),
('CO2_QUALITY_ANALYSIS',2,'CQA_TEST','시험·교정·불확도 기록','LAB_ANALYST','RECORD_CO2_TEST','시료 인계, 교정상태, 시험값, 반복성, 불확도와 성적서를 기록한다.','시험 원자료·성적서·장비 소급성이 검증됨'),
('CO2_QUALITY_ANALYSIS',3,'CQA_DECIDE','품질 적격·재시험 판정','CERTIFICATE_OFFICER','DECIDE_CO2_QUALITY','규격별 적합성 및 인증·거래 가능 여부와 부적합 조치를 결정한다.','적합 판정 또는 보완·재시험 경로가 확정됨'),
('CERTIFICATION_ELIGIBILITY_CHECK',1,'CEC_VALIDATE_COMPANY','법인·회원사·신청 유효성 검증','CERTIFICATE_OFFICER','VALIDATE_CERT_COMPANY','법인인증서·신청 권한·회원사 상태·첨부 원본을 검증한다.','신청 주체와 법인 유효성이 확인됨'),
('CERTIFICATION_ELIGIBILITY_CHECK',2,'CEC_VERIFY_EXTERNAL','재생전력·REC·외부자료 검증','SYSTEM_INTEGRATOR','VERIFY_CERT_EXTERNAL','전력량·REC·외부기관 자료와 중복수혜·중복발급 여부를 조회한다.','외부 응답과 기준시점 및 실패 처리 결과가 보존됨'),
('CERTIFICATION_ELIGIBILITY_CHECK',3,'CEC_DECIDE','발급 적격성 승인·보완','CERTIFICATE_OFFICER','DECIDE_CERT_ELIGIBILITY','산정·품질·물량·외부 검증 결과를 종합해 발급 가능 여부를 결정한다.','발급 가능 또는 사유·기한이 있는 보완 상태가 확정됨'),
('CERTIFICATE_FEE_TAX_REFUND',1,'CFTR_BILL','수수료·가상계좌·청구 생성','SETTLEMENT_OPERATOR','CREATE_CERT_BILLING','인증 종류·물량·요율로 수수료와 세금계산서 발행정보를 생성한다.','중복 없는 청구·가상계좌와 납부기한이 확정됨'),
('CERTIFICATE_FEE_TAX_REFUND',2,'CFTR_SETTLE','입금·세금계산서·정산 확인','SETTLEMENT_OPERATOR','SETTLE_CERT_PAYMENT','입금과 청구를 대사하고 승인 후 세금계산서·정산 이력을 확정한다.','미납 차단 또는 완납 발급해제 상태가 정확함'),
('CERTIFICATE_FEE_TAX_REFUND',3,'CFTR_REFUND','철회·취소·환불 종결','SETTLEMENT_OPERATOR','CLOSE_CERT_REFUND','법인 환불계좌와 사유·원거래·승인을 검증해 환불한다.','환불·취소·인증 상태와 회계 원장이 일치함'),
('COMPANY_MANAGER_DELEGATION',1,'CMD_REQUEST','위임·승계 요청과 후보 검증','COMPANY_ADMIN','REQUEST_MANAGER_DELEGATION','위임 범위·기간·사유·후임자 재직·미결업무를 확인한다.','유효 후보와 인계 대상 업무가 확정됨'),
('COMPANY_MANAGER_DELEGATION',2,'CMD_APPROVE','직무분리·권한 변경 승인','AUTHORITY_ADMIN','APPROVE_MANAGER_DELEGATION','충돌 권한과 승인 한도를 검토하고 기간부 권한을 승인한다.','기존·신규 권한 전이가 원자적으로 예약됨'),
('COMPANY_MANAGER_DELEGATION',3,'CMD_HANDOVER','미결업무 인계·통지·종결','COMPANY_ADMIN','COMPLETE_MANAGER_HANDOVER','미결 신청·프로젝트·승인 Task를 후임자에게 인계하고 통지한다.','담당자 공백·중복 없이 변경이력과 수신증이 보존됨'),
('PRIVACY_RETENTION_DESTRUCTION',1,'PRD_ACCESS','추가인증·마스킹 해제 통제','PRIVACY_OFFICER','AUTHORIZE_PRIVACY_ACCESS','열람 목적·범위·기한·추가인증을 검증해 일시적으로 마스킹을 해제한다.','최소 범위 열람과 접근 감사이력이 생성됨'),
('PRIVACY_RETENTION_DESTRUCTION',2,'PRD_CLASSIFY','보존기간·법적 보류 판정','PRIVACY_OFFICER','CLASSIFY_RETENTION','데이터별 처리목적·법정기간·분쟁·감사 보류 여부를 판정한다.','파기·보존·보류 대상과 근거가 확정됨'),
('PRIVACY_RETENTION_DESTRUCTION',3,'PRD_DESTROY','파기 실행·검증·증적','PRIVACY_OFFICER','EXECUTE_PRIVACY_DESTRUCTION','승인 대상을 원본·복제·검색색인·파일에서 파기하고 실패를 재처리한다.','파기 검증과 증명서 및 예외 목록이 승인됨'),
('SCHEDULED_STATISTICS_REPORTING',1,'SSR_DEFINE','지표·주기·기준시점 확정','DATA_ANALYST','DEFINE_STATISTICS_JOB','설비·시장·배출·인증·수수료 지표와 집계식·일정·수신처를 정의한다.','버전 잠긴 지표·집계·배포 계약이 승인됨'),
('SCHEDULED_STATISTICS_REPORTING',2,'SSR_GENERATE','통계 생성·품질검증·재생성','DATA_ANALYST','GENERATE_STATISTICS','기준시점 스냅샷으로 통계를 생성하고 완전성·차이·이상치를 검증한다.','재현 가능한 결과와 품질검증 이력이 생성됨'),
('SCHEDULED_STATISTICS_REPORTING',3,'SSR_PUBLISH','확정·시각화·파일·기관 전송','APPROVER','PUBLISH_STATISTICS','승인된 통계를 차트·지도·PDF·엑셀 및 연계기관으로 배포한다.','수신·실패·재전송 증적과 공개 버전이 보존됨'),
('CALCULATION_ENGINE_PARITY',1,'CEP_BASELINE','VBA 기준 사례·버전 잠금','VERIFIER','LOCK_CALCULATION_BASELINE','기준 입력·수식·계수·LCI·단위·반올림·기대결과를 버전 잠금한다.','정상·경계·오류·대용량 기준 사례가 승인됨'),
('CALCULATION_ENGINE_PARITY',2,'CEP_COMPARE','웹 엔진 회귀실행·상세 비교','CALCULATOR','RUN_ENGINE_PARITY','동일 입력을 두 엔진에 실행해 중간값·최종값·단위·반올림을 비교한다.','허용오차와 모든 차이 원인이 항목별 기록됨'),
('CALCULATION_ENGINE_PARITY',3,'CEP_GATE','차이 승인·배포 차단/해제','VERIFIER','DECIDE_ENGINE_RELEASE','미승인 차이가 있으면 배포를 차단하고 승인된 차이만 기준 버전에 반영한다.','회귀시험 통과와 배포 게이트 결정 증적이 보존됨'),
('LEGAL_NOTIFICATION_DELIVERY',1,'LND_COMPOSE','통지 사건·템플릿·대상 확정','PLATFORM_OPERATOR','COMPOSE_LEGAL_NOTICE','업무 사건과 법적 문구·언어·대상·동의·기한·우선채널을 확정한다.','개인정보 최소화된 불변 통지 스냅샷이 생성됨'),
('LEGAL_NOTIFICATION_DELIVERY',2,'LND_DELIVER','다중채널 발송·실패 대체','SYSTEM_INTEGRATOR','DELIVER_LEGAL_NOTICE','SMS·이메일·국민비서로 발송하고 실패 시 정책에 따라 재시도·대체한다.','채널별 요청·응답·도달 상태가 추적됨'),
('LEGAL_NOTIFICATION_DELIVERY',3,'LND_RECEIPT','도달·열람·수신증 확정','AUDITOR','CONFIRM_NOTICE_RECEIPT','도달·열람·반송·대체발송 결과를 법정 보존 수신증으로 확정한다.','통지 완료 또는 담당자 에스컬레이션이 확정됨');

INSERT INTO framework_process_step(process_code,step_order,step_code,step_name,actor_code,from_state,command_code,to_state,
 completion_rule,user_path,admin_path,api_contract,parent_step_code,step_type,requirement_text,input_contract,output_contract,
 requires_user_page,requires_admin_page,requires_api,requires_database,requires_notification,automation_status,sla_hours,
 escalation_actor_code,evidence_required,evidence_types,segregation_actor_codes,rollback_command_code,decision_rule)
SELECT spec.process_code,spec.step_order,spec.step_code,spec.step_name,spec.actor_code,
 CASE spec.step_order WHEN 1 THEN 'READY' WHEN 2 THEN 'IN_PROGRESS' ELSE 'REVIEW_READY' END,spec.command_code,
 CASE spec.step_order WHEN 1 THEN 'IN_PROGRESS' WHEN 2 THEN 'REVIEW_READY' ELSE 'COMPLETED' END,spec.completion_rule,
 '/work/'||lower(replace(spec.process_code,'_','-'))||'?step='||lower(spec.step_code),
 '/admin/work/'||lower(replace(spec.process_code,'_','-'))||'?step='||lower(spec.step_code),
 '/api/work/'||lower(replace(spec.process_code,'_','-'))||'/'||lower(spec.step_code),null,
 CASE WHEN spec.step_order=3 THEN 'DECISION' ELSE 'TASK' END,spec.requirement_text,
 jsonb_build_object('tenantId','string','projectId','string','businessId','string','rowVersion','integer')::text,
 jsonb_build_object('recordId','string','statusCode',CASE spec.step_order WHEN 3 THEN 'COMPLETED' ELSE 'IN_PROGRESS' END,
   'evidenceHash','string','nextTask','string')::text,
 true,true,true,true,true,'APPROVED',CASE WHEN spec.process_code='LEGAL_NOTIFICATION_DELIVERY' THEN 4 ELSE 24 END,
 'PLATFORM_OPERATOR',true,'["SOURCE_SNAPSHOT","DECISION_RECORD","AUDIT_EVENT","EVIDENCE_HASH"]','',
 CASE WHEN spec.step_order=1 THEN '' ELSE 'REVERT_PREVIOUS_STATE' END,
 CASE WHEN spec.step_order=3 THEN '필수 증적·권한분리·허용범위·외부검증을 통과해야 완료한다.' ELSE '' END
FROM reference_step_spec spec ON CONFLICT(process_code,step_code) DO NOTHING;

INSERT INTO framework_simulation_case(case_code,process_code,case_name,case_type,preconditions,steps_json,assertions_json,
 case_status,severity,required_evidence,automated,expected_duration_minutes)
SELECT process.process_code||'_'||test.code,process.process_code,process.process_name||' · '||test.name,test.type,
 test.preconditions,test.steps,test.assertions,'APPROVED',test.severity,test.evidence,true,test.duration
FROM framework_process_definition process CROSS JOIN (VALUES
 ('HAPPY','정상 완료','HAPPY_PATH','유효한 액터·선행업무·기준정보·증적이 존재함','["요청","실행","검토","완료","후속업무 인계"]','["상태 COMPLETED","증적 해시 보존","후속업무 1회 생성"]','MAJOR','상태이력,증적해시,인계이력',30),
 ('EXCEPTION','필수값·외부검증 실패','EXCEPTION','필수값 누락 또는 외부검증 불일치가 존재함','["오류 입력","검증","차단","보완요청"]','["완료 차단","사유·담당자·기한 저장","원본 보존"]','CRITICAL','검증오류,보완이력',15),
 ('AUTHORITY','권한·직무분리 위반','AUTHORITY','권한 없는 사용자 또는 자기승인 시도','["금지 명령","서버 권한검사","거부"]','["403","상태 불변","감사 이벤트"]','CRITICAL','접근감사로그',10),
 ('ISOLATION','테넌트·프로젝트 격리','ISOLATION','다른 기업 또는 프로젝트 식별자로 접근 시도','["교차범위 요청","서버 범위검사","거부"]','["데이터 미노출","변경 없음","보안감사"]','CRITICAL','격리검증로그',10),
 ('RECOVERY','중단·중복·연계 실패 복구','RECOVERY','동시 수정·중복 요청 또는 외부 연계 실패','["실패 발생","멱등 재시도","재조회 또는 롤백"]','["중복 없음","일관 상태 복구","실패·재시도 증적"]','MAJOR','복구이력,멱등키',20)
) test(code,name,type,preconditions,steps,assertions,severity,evidence,duration)
WHERE process.process_code IN (SELECT DISTINCT process_code FROM reference_step_spec)
ON CONFLICT(case_code) DO NOTHING;

INSERT INTO framework_professional_screen_contract(process_code,step_code,audience,route_path,screen_name,actor_code,
 business_purpose,entry_condition,exit_condition,kpi_contract,section_contract,field_contract,command_contract,
 state_contract,api_contract,data_contract,evidence_contract,responsive_contract,accessibility_contract,security_contract,
 contract_status,updated_by,menu_visibility,menu_verified)
SELECT step.process_code,step.step_code,audience.code,
 CASE audience.code WHEN 'USER' THEN step.user_path ELSE step.admin_path END,
 step.step_name||CASE audience.code WHEN 'USER' THEN ' 업무 화면' ELSE ' 관리자 검토 화면' END,step.actor_code,
 step.requirement_text,step.from_state,step.completion_rule,
 '["진행률","기한","차단건","미결 증적","후속업무"]',
 '["업무요약","선행조건","전문 데이터","검증·증적","결정·이력","다음업무"]',
 '["tenantId","projectId","businessId","referenceCode","statusCode","effectiveAt","quantityValue","unitCode","qualityCode","externalCheckStatus","evidenceIds","decisionCode","decisionComment","rowVersion"]',
 jsonb_build_array(step.command_code,'SAVE_DRAFT','REQUEST_CORRECTION')::text,
 '["LOADING","EMPTY","ERROR","FORBIDDEN","READY","BLOCKED","CONFLICT","COMPLETED"]',
 jsonb_build_array(step.api_contract)::text,
 '["tenantId","projectId","businessId","recordId","statusCode","rowVersion","evidenceHash","nextTaskId"]',
 '["원본 스냅샷","외부응답","검토·결정","감사이벤트","무결성해시"]',
 'KRDS 유동 그리드. 모바일 1열, 태블릿 2열, 데스크톱 목록·상세 패널. 텍스트는 줄바꿈하고 수평 스크롤은 표 내부로 제한한다.',
 'WCAG 2.1 AA, 키보드 순서, 명시적 라벨, 비색상 판정, 오류 요약과 포커스 이동을 제공한다.',
 '서버에서 테넌트·프로젝트·액터·상태·동시성·직무분리·증적 무결성을 검증한다.',
 'REVIEW_REQUIRED','REFERENCE_PROCESS_FACTORY',false,false
FROM framework_process_step step CROSS JOIN (VALUES('USER'),('ADMIN')) audience(code)
WHERE step.process_code IN (SELECT DISTINCT process_code FROM reference_step_spec)
ON CONFLICT(process_code,step_code,audience,route_path) DO NOTHING;

INSERT INTO framework_page_design(process_code,step_code,audience,page_code,page_title,page_purpose,screen_type,
 planned_route_path,actual_route_path,route_status,primary_entity,upstream_step_code,downstream_step_code,actor_code,
 entry_condition,exit_condition,responsive_contract,accessibility_contract,security_contract,exception_contract,
 design_status,updated_by)
SELECT contract.process_code,contract.step_code,contract.audience,
 contract.process_code||'_'||contract.step_code||'_'||contract.audience,contract.screen_name,contract.business_purpose,
 CASE WHEN step.step_type='DECISION' THEN 'REVIEW_DECISION' ELSE 'WORK_EXECUTION' END,contract.route_path,null,'DESIGN_ONLY',
 lower(contract.process_code)||'_record',
 (SELECT prior.step_code FROM framework_process_step prior WHERE prior.process_code=step.process_code AND prior.step_order<step.step_order ORDER BY prior.step_order DESC LIMIT 1),
 (SELECT next.step_code FROM framework_process_step next WHERE next.process_code=step.process_code AND next.step_order>step.step_order ORDER BY next.step_order LIMIT 1),
 contract.actor_code,contract.entry_condition,contract.exit_condition,
 '{"mobile":"single-column","tablet":"two-column","desktop":"list-detail","overflow":"wrap"}',
 '{"standard":"WCAG 2.1 AA","keyboard":true,"labels":true,"liveErrors":true}',
 '{"tenantIsolation":true,"projectIsolation":true,"actorAuthorization":true,"optimisticLock":true,"segregation":true}',
 '{"states":["LOADING","EMPTY","ERROR","FORBIDDEN","BLOCKED","CONFLICT"],"recovery":true}',
 'DESIGN_COMPLETE','REFERENCE_PROCESS_FACTORY'
FROM framework_professional_screen_contract contract
JOIN framework_process_step step ON step.process_code=contract.process_code AND step.step_code=contract.step_code
WHERE contract.process_code IN (SELECT DISTINCT process_code FROM reference_step_spec)
ON CONFLICT(process_code,step_code,audience) DO NOTHING;

WITH common_fields(field_order,field_group,field_code,field_name,data_type,control_type,required,list_visible,search_enabled,evidence_required,priority) AS (VALUES
 (10,'업무 범위','projectId','프로젝트','STRING','PROJECT_SELECT',true,true,true,false,10),
 (20,'업무 범위','businessId','업무 대상 ID','STRING','ENTITY_SELECT',true,true,true,false,10),
 (30,'업무 범위','referenceCode','참조·로트·신청 번호','STRING','TEXT',true,true,true,false,10),
 (40,'상태','statusCode','업무 상태','CODE','STATUS_SELECT',true,true,true,false,10),
 (50,'기준','effectiveAt','발생·적용 일시','DATETIME','DATETIME',true,true,true,false,10),
 (60,'전문값','quantityValue','수량·측정·금액 값','DECIMAL','NUMBER',false,true,false,false,10),
 (70,'전문값','unitCode','단위·통화','CODE','UNIT_SELECT',false,true,false,false,10),
 (80,'품질·외부검증','qualityCode','품질·적합 등급','CODE','QUALITY_SELECT',false,true,true,false,10),
 (90,'품질·외부검증','externalCheckStatus','외부검증 상태','CODE','STATUS_SELECT',false,true,true,true,10),
 (100,'증적','evidenceIds','원본·결정 증빙','ARRAY','FILE_UPLOAD',true,false,false,true,10),
 (110,'결정','decisionCode','판정·승인 결과','CODE','DECISION_SELECT',false,true,true,true,10),
 (120,'결정','decisionComment','판정·보완·반려 사유','TEXT','TEXTAREA',false,false,false,true,20),
 (130,'무결성','rowVersion','데이터 버전','INTEGER','VERSION',true,false,false,false,10),
 (140,'후속업무','nextTaskId','다음 업무','STRING','TASK_LINK',false,true,false,false,20)
)
INSERT INTO framework_page_field_definition(page_design_id,field_order,field_group,field_code,field_name,data_type,
 control_type,required,editable,list_visible,search_enabled,api_property,mapping_status,validation_contract,privacy_class,
 permission_code,evidence_required,responsive_priority,help_text,design_source)
SELECT page.page_design_id,field.field_order,field.field_group,field.field_code,field.field_name,field.data_type,
 field.control_type,field.required,true,field.list_visible,field.search_enabled,field.field_code,'LOGICAL_CONTRACT',
 CASE field.field_code WHEN 'quantityValue' THEN '{"numeric":true,"unitRequiredWhenPresent":true}'::jsonb
  WHEN 'evidenceIds' THEN '{"minItems":1,"hashRequired":true}'::jsonb
  WHEN 'decisionComment' THEN '{"requiredWhen":["CORRECTION","REJECTED"]}'::jsonb ELSE '{}'::jsonb END,
 CASE field.field_code WHEN 'businessId' THEN 'CONFIDENTIAL' ELSE 'INTERNAL' END,
 page.actor_code||':'||page.audience,field.evidence_required,field.priority,
 field.field_name||' 레퍼런스 전문 업무 계약','REFERENCE_PROCESS_DESIGN'
FROM framework_page_design page CROSS JOIN common_fields field
WHERE page.process_code IN (SELECT DISTINCT process_code FROM reference_step_spec)
ON CONFLICT(page_design_id,field_code) DO NOTHING;

INSERT INTO framework_development_job(process_code,step_code,job_type,job_name,target_path,specification_json,
 job_status,approval_status,execution_mode,job_group_code,required,progress_weight,max_attempts,quality_status,
 quality_report,created_by)
SELECT step.process_code,step.step_code,'FULL_STACK',step.step_name||' 제너레이터 구현',coalesce(step.user_path,step.admin_path),
 jsonb_build_object('designSource','framework_page_design','generatorRequired',true,'backend',true,'frontend',true,
  'database',true,'tests',true,'reuseCommonAssets',true)::text,
 'PLANNED','APPROVED','PARALLEL',step.process_code||'_REFERENCE_IMPLEMENTATION',true,1,3,'PENDING',
 '{"reason":"DESIGN_COMPLETE_IMPLEMENTATION_PENDING"}','REFERENCE_PROCESS_FACTORY'
FROM framework_process_step step
WHERE step.process_code IN (SELECT DISTINCT process_code FROM reference_step_spec)
ON CONFLICT(process_code,step_code,job_type,target_path) DO NOTHING;

INSERT INTO framework_business_process_sequence(work_type_code,process_code,workflow_order,workflow_phase,process_role,sequence_status)
SELECT upper(process.domain_code),process.process_code,900000+row_number() OVER(PARTITION BY process.domain_code ORDER BY process.development_order),
 CASE process.process_code
  WHEN 'CO2_LOT_TAG_MANAGEMENT' THEN 'SUPPLY_TRACEABILITY'
  WHEN 'CO2_QUALITY_ANALYSIS' THEN 'QUALITY_ASSURANCE'
  WHEN 'CERTIFICATION_ELIGIBILITY_CHECK' THEN 'CERTIFICATE_REVIEW'
  WHEN 'CERTIFICATE_FEE_TAX_REFUND' THEN 'CERTIFICATE_FINANCE'
  WHEN 'COMPANY_MANAGER_DELEGATION' THEN 'ACCOUNT_OPERATION'
  WHEN 'PRIVACY_RETENTION_DESTRUCTION' THEN 'DATA_LIFECYCLE'
  WHEN 'SCHEDULED_STATISTICS_REPORTING' THEN 'MONITORING_REPORTING'
  WHEN 'CALCULATION_ENGINE_PARITY' THEN 'DATA_QUALITY'
  ELSE 'NOTIFICATION_DELIVERY' END,
 CASE WHEN process.process_code IN ('CERTIFICATE_FEE_TAX_REFUND','PRIVACY_RETENTION_DESTRUCTION','LEGAL_NOTIFICATION_DELIVERY') THEN 'SUPPORT' ELSE 'CORE' END,'ACTIVE'
FROM framework_process_definition process
WHERE process.process_code IN (SELECT DISTINCT process_code FROM reference_step_spec)
ON CONFLICT(process_code) DO UPDATE SET work_type_code=excluded.work_type_code,workflow_phase=excluded.workflow_phase,
 process_role=excluded.process_role,sequence_status='ACTIVE',updated_at=current_timestamp;

SELECT * FROM framework_rebuild_process_execution_topology();

INSERT INTO framework_process_data_handoff(process_code,from_step_code,to_process_code,to_step_code,handoff_type,context_keys,
 payload_contract,integrity_contract,authorization_contract,failure_contract)
SELECT step.process_code,step.step_code,step.process_code,next.step_code,'STEP',
 '["tenantId","projectId","businessId","recordId","rowVersion"]',
 jsonb_build_object('fromOutput',framework_try_jsonb(step.output_contract),'toInput',framework_try_jsonb(next.input_contract)),
 '{"immutableSnapshot":true,"evidenceHash":true,"optimisticLock":true}',
 jsonb_build_object('fromActor',step.actor_code,'toActor',next.actor_code,'tenantIsolation',true,'projectIsolation',true,'segregationChecked',true),
 '{"onMissing":"DEPENDENCY_BLOCKED","onInvalid":"VALIDATION_ERROR","onConflict":"RELOAD_AND_REVIEW","onUnauthorized":"DENY_AND_AUDIT"}'
FROM framework_process_step step
JOIN framework_process_step next ON next.process_code=step.process_code AND next.step_order=step.step_order+1
WHERE step.process_code IN (SELECT DISTINCT process_code FROM reference_step_spec)
ON CONFLICT(process_code,from_step_code,to_process_code,to_step_code,handoff_type) DO NOTHING;

-- Cross-process handoffs make the reference workflows executable as one business chain.
INSERT INTO framework_process_data_handoff(process_code,from_step_code,to_process_code,to_step_code,handoff_type,context_keys,
 payload_contract,integrity_contract,authorization_contract,failure_contract)
VALUES
('CO2_LOT_TAG_MANAGEMENT','CLT_APPROVE','CO2_QUALITY_ANALYSIS','CQA_PLAN','PROCESS','["tenantId","projectId","businessId","recordId"]','{"lotSnapshot":true,"integrityDecision":true}','{"immutableSnapshot":true,"evidenceHash":true}','{"segregationChecked":true}','{"onMissing":"DEPENDENCY_BLOCKED"}'),
('CO2_QUALITY_ANALYSIS','CQA_DECIDE','CERTIFICATION_ELIGIBILITY_CHECK','CEC_VALIDATE_COMPANY','PROCESS','["tenantId","projectId","businessId","recordId"]','{"qualityDecision":true,"testReportHash":true}','{"immutableSnapshot":true,"evidenceHash":true}','{"segregationChecked":true}','{"onMissing":"DEPENDENCY_BLOCKED"}'),
('CERTIFICATION_ELIGIBILITY_CHECK','CEC_DECIDE','CERTIFICATE_FEE_TAX_REFUND','CFTR_BILL','PROCESS','["tenantId","projectId","businessId","recordId"]','{"eligibilityDecision":true,"eligibleAmount":true}','{"immutableSnapshot":true,"evidenceHash":true}','{"segregationChecked":true}','{"onMissing":"DEPENDENCY_BLOCKED"}'),
('CERTIFICATE_FEE_TAX_REFUND','CFTR_SETTLE','CERTIFICATE_REVIEW_ISSUANCE','CERTIFICATE_REVIEW_ISSUANCE_S1','PROCESS','["tenantId","projectId","businessId","recordId"]','{"paymentCleared":true,"taxInvoiceStatus":true}','{"immutableSnapshot":true,"evidenceHash":true}','{"segregationChecked":true}','{"onMissing":"CERTIFICATE_ISSUANCE_BLOCKED"}'),
('CALCULATION_ENGINE_PARITY','CEP_GATE','GIT_BUILD_DEPLOYMENT','GIT_BUILD_DEPLOYMENT_S1','PROCESS','["tenantId","recordId"]','{"regressionPassed":true,"baselineVersion":true}','{"immutableSnapshot":true,"evidenceHash":true}','{"segregationChecked":true}','{"onMissing":"DEPLOYMENT_BLOCKED"}')
ON CONFLICT(process_code,from_step_code,to_process_code,to_step_code,handoff_type) DO NOTHING;

UPDATE framework_process_definition SET definition_locked=true,definition_lock_reason='REFERENCE_DESIGN_SOURCE',updated_at=current_timestamp
WHERE process_code IN (SELECT DISTINCT process_code FROM reference_step_spec) AND definition_locked=false;

DO $$
DECLARE process_total integer; step_total integer; test_total integer; page_total integer; job_total integer;
BEGIN
 SELECT count(*) INTO process_total FROM framework_process_definition WHERE process_code IN (SELECT DISTINCT process_code FROM reference_step_spec);
 SELECT count(*) INTO step_total FROM framework_process_step WHERE process_code IN (SELECT DISTINCT process_code FROM reference_step_spec);
 SELECT count(*) INTO test_total FROM framework_simulation_case WHERE process_code IN (SELECT DISTINCT process_code FROM reference_step_spec);
 SELECT count(*) INTO page_total FROM framework_page_design WHERE process_code IN (SELECT DISTINCT process_code FROM reference_step_spec);
 SELECT count(*) INTO job_total FROM framework_development_job WHERE process_code IN (SELECT DISTINCT process_code FROM reference_step_spec) AND required;
 IF process_total<>9 OR step_total<>27 OR test_total<>45 OR page_total<>54 OR job_total<27 THEN
   RAISE EXCEPTION 'REFERENCE_PROCESS_DESIGN_INCOMPLETE processes=% steps=% tests=% pages=% jobs=%',process_total,step_total,test_total,page_total,job_total;
 END IF;
END $$;
