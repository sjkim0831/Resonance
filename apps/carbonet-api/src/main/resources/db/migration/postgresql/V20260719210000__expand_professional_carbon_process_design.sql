-- Expand the professional process map without claiming implementation completion.
-- Every process is queued as DRAFT and must pass design, implementation and actor tests.
WITH process_seed(process_code,process_name,domain_code,parent_code,owner_code,development_order,risk_level,sla_hours,goal,start_condition,completion_condition,regulation_refs) AS (
 VALUES
 ('REGULATORY_SUBMISSION','규제기관 제출·접수·보완','CARBON_EMISSION','EMISSION_PROJECT','COMPANY_MANAGER',100,'CRITICAL',72,'확정된 배출량 자료를 관할 규제기관에 제출하고 접수·보완·수리 결과를 증적으로 남긴다.','승인된 산정 결과와 제출 권한, 적용 법령, 제출 기한이 확정되어 있다.','제출본·접수번호·기관 응답·보완 이력과 최종 상태가 프로젝트에 귀속된다.','탄소중립기본법, 배출권거래법, 목표관리 지침'),
 ('DISCLOSURE_CORRECTION','변경·재산정·정정공시','CARBON_EMISSION','EMISSION_PROJECT','CALCULATOR',101,'CRITICAL',48,'확정 이후 발견된 변경을 영향평가하고 재산정·재검증·정정공시한다.','변경 사유와 영향 대상 기간·조직·자료가 식별되어 있다.','구버전 보존, 차이 설명, 재승인 및 정정 공시가 완료된다.','배출량 산정·보고 지침, 감사 추적성 원칙'),
 ('PROJECT_LIFECYCLE_CONTROL','프로젝트 종료·보관·재개·취소','CARBON_EMISSION','EMISSION_PROJECT','COMPANY_MANAGER',102,'HIGH',24,'프로젝트 생명주기 전환을 권한·보존·미결업무 기준으로 통제한다.','전환 요청자와 사유, 미결 태스크, 보존 정책이 확인된다.','전환 결과와 복구 가능 시점, 감사 로그가 확정된다.','전자기록 보존 정책, 개인정보보호법'),
 ('EXTERNAL_VERIFICATION_ENGAGEMENT','외부 검증기관 계약·독립성·의견서','CARBON_EMISSION','EMISSION_PROJECT','VERIFIER',103,'CRITICAL',120,'외부 검증기관 선정부터 독립성 확인, 검증계획, 의견서 발급까지 통제한다.','검증 범위와 후보 기관, 이해상충 정보가 준비되어 있다.','독립성 승인, 검증 증적, 최종 의견서와 조치 이력이 보존된다.','ISO 14064-3, 검증기관 운영 지침'),
 ('ORGANIZATIONAL_BOUNDARY','조직경계·다사업장 연결·통합','CARBON_EMISSION','EMISSION_PROJECT','COMPANY_MANAGER',104,'CRITICAL',72,'지배력·지분 기준으로 조직경계와 사업장 포함 여부를 결정하고 중복 없이 통합한다.','법인·사업장·소유구조와 보고 기준연도가 준비되어 있다.','경계 결정 근거, 제외 사유, 내부거래 제거 및 통합 결과가 승인된다.','GHG Protocol Corporate Standard, ISO 14064-1'),
 ('MEASUREMENT_DATA_QUALITY','측정기기·교정·데이터 품질','CCUS_MRV','EMISSION_PROJECT','SITE_DATA_OWNER',105,'CRITICAL',24,'측정기기의 유효성과 원시자료 품질을 지속 점검하고 결측·이상치를 통제한다.','측정 지점·기기·교정주기와 수집 채널이 등록되어 있다.','교정 유효성, 완전성, 이상치 조치와 대체값 근거가 검증된다.','ISO 14064-1, 측정기기 교정 기준'),
 ('CCUS_LIFECYCLE_MRV','CCUS 전과정 MRV','CCUS_MRV','EMISSION_PROJECT','CALCULATOR',106,'CRITICAL',72,'포집·압축·수송·주입·저장 전 단계의 물질수지와 배출·감축량을 산정한다.','시설 경계, 측정 지점, 기준선과 모니터링 계획이 승인되어 있다.','단계별 물질수지와 순감축량이 검증되고 MRV 보고서가 확정된다.','ISO 27914, ISO 27916, 국가 CCUS MRV 지침'),
 ('CHAIN_OF_CUSTODY','출처·이동·인수인계 연속성','CCUS_MRV','EMISSION_PROJECT','SYSTEM_INTEGRATOR',107,'CRITICAL',12,'CO2의 출처부터 최종 저장까지 소유권·수량·품질·시간의 연속성을 보장한다.','거점, 운송수단, 인계 당사자와 계량 규칙이 등록되어 있다.','모든 인계가 양측 확인되고 수량 차이가 허용오차 이내이며 중복 사용이 없다.','MRV 추적성 원칙, 운송·저장 계약 기준'),
 ('LEAKAGE_INCIDENT_RESPONSE','누출·사고·비상대응','CCUS_MRV','EMISSION_PROJECT','SITE_DATA_OWNER',108,'CRITICAL',1,'누출·설비 이상을 탐지하고 인명·환경 보호, 보고, 손실량 재산정과 재발방지를 수행한다.','비상연락망, 경보 임계치, 대응 절차와 책임자가 승인되어 있다.','사고 종료, 법정 보고, 영향량 반영, 원인·시정조치 검증이 완료된다.','중대재해처벌법, 산업안전보건법, 환경오염 사고 대응 기준'),
 ('APPEAL_DISPUTE_AUDIT','이의신청·분쟁·감사 대응','GOVERNANCE','EMISSION_PROJECT','AUDITOR',109,'HIGH',120,'검증·승인·규제 결과에 대한 이의와 감사 요구를 독립적으로 접수·판단·종결한다.','대상 결정, 신청 자격, 기한과 원본 증적이 확인된다.','독립 검토 결과, 시정 여부, 통지와 감사 증적이 보존된다.','행정절차법, 내부감사 기준'),
 ('LCA_DATA_QUALITY_UNCERTAINTY','LCA 데이터 품질·불확도','PRODUCT_LCA','LCA_EXECUTION','LCA_PRACTITIONER',110,'HIGH',72,'시간·지역·기술 대표성과 완전성 및 불확도를 정량 평가한다.','인벤토리 데이터와 출처·기간·지역·기술 메타데이터가 존재한다.','품질등급, 불확도 범위, 개선 우선순위와 한계가 승인된다.','ISO 14040, ISO 14044'),
 ('PCR_EPD_VERIFICATION','PCR·EPD·제품탄소발자국 검증','PRODUCT_LCA','LCA_EXECUTION','VERIFIER',111,'CRITICAL',120,'적용 PCR을 선택하고 EPD·제품탄소발자국 산출물의 적합성과 검증 상태를 관리한다.','제품 분류, 시장, 적용 기간과 후보 PCR이 확인된다.','PCR 적합성, 선언 단위, 필수 지표, 독립 검증 결과가 확정된다.','ISO 14025, ISO 14067, 적용 PCR'),
 ('LCA_ALLOCATION_SENSITIVITY','할당·민감도 분석','PRODUCT_LCA','LCA_EXECUTION','LCA_PRACTITIONER',112,'HIGH',72,'제품·부산물 간 할당 규칙을 적용하고 대안별 결과 민감도를 비교한다.','공정 산출물, 질량·경제가치·물리관계 자료가 준비되어 있다.','선택 규칙의 정당성, 대안 결과, 민감 항목과 결론이 검토된다.','ISO 14044 할당 원칙'),
 ('BACKGROUND_DB_VERSION_IMPACT','배경 DB 버전·영향 관리','PRODUCT_LCA','LCA_EXECUTION','LCA_PRACTITIONER',113,'HIGH',48,'LCI 배경 DB의 버전·지역·시스템모델 변경 영향을 추적하고 재현성을 보장한다.','매핑된 배경 데이터셋과 버전 메타데이터가 존재한다.','잠금 버전, 변경 차이, 재산정 영향과 사용 라이선스가 기록된다.','ISO 14044 데이터 품질 원칙, DB 라이선스'),
 ('COMPARATIVE_ASSERTION_REVIEW','비교주장·비판적 검토 보고','PRODUCT_LCA','LCA_EXECUTION','VERIFIER',114,'CRITICAL',168,'대외 비교주장의 공정성·동등성·불확도를 독립적으로 검토하고 공개 조건을 통제한다.','비교 대상과 기능단위, 경계, 데이터 품질, 공개 목적이 정의되어 있다.','동등성 검토, 패널 의견, 제한사항과 승인된 공개본이 보존된다.','ISO 14040, ISO 14044 비교주장·비판적 검토')
)
INSERT INTO framework_process_definition(process_code,process_name,domain_code,process_version,goal,start_condition,completion_condition,process_status,development_order,prerequisite_codes,parent_process_code,process_level,automation_mode,owner_actor_code,regulation_refs,risk_level,sla_hours,review_cycle_days,lifecycle_status,effective_from,next_review_at,definition_locked)
SELECT process_code,process_name,domain_code,'1.0.0',goal,start_condition,completion_condition,'DRAFT',development_order,parent_code,parent_code,2,'GENERATOR_READY',owner_code,regulation_refs,risk_level,sla_hours,90,'DESIGN',current_date,current_timestamp+interval '90 days',false
FROM process_seed
ON CONFLICT(process_code) DO UPDATE SET process_name=excluded.process_name,domain_code=excluded.domain_code,goal=excluded.goal,start_condition=excluded.start_condition,completion_condition=excluded.completion_condition,development_order=excluded.development_order,prerequisite_codes=excluded.prerequisite_codes,parent_process_code=excluded.parent_process_code,process_level=2,automation_mode='GENERATOR_READY',owner_actor_code=excluded.owner_actor_code,regulation_refs=excluded.regulation_refs,risk_level=excluded.risk_level,sla_hours=excluded.sla_hours,review_cycle_days=90,lifecycle_status='DESIGN',definition_locked=false,updated_at=current_timestamp;

-- Four complete control stages per process. Routes remain NULL until generated and verified.
DELETE FROM framework_process_step WHERE process_code IN (
 'REGULATORY_SUBMISSION','DISCLOSURE_CORRECTION','PROJECT_LIFECYCLE_CONTROL','EXTERNAL_VERIFICATION_ENGAGEMENT','ORGANIZATIONAL_BOUNDARY','MEASUREMENT_DATA_QUALITY','CCUS_LIFECYCLE_MRV','CHAIN_OF_CUSTODY','LEAKAGE_INCIDENT_RESPONSE','APPEAL_DISPUTE_AUDIT','LCA_DATA_QUALITY_UNCERTAINTY','PCR_EPD_VERIFICATION','LCA_ALLOCATION_SENSITIVITY','BACKGROUND_DB_VERSION_IMPACT','COMPARATIVE_ASSERTION_REVIEW');

WITH config(process_code,owner_code,reviewer_code,approver_code,n1,n2,n3,n4) AS (
 VALUES
 ('REGULATORY_SUBMISSION','COMPANY_MANAGER','VERIFIER','APPROVER','제출 범위·기한 확인','제출 패키지 생성·서명','기관 제출·접수 추적','보완·수리·종결'),
 ('DISCLOSURE_CORRECTION','CALCULATOR','VERIFIER','APPROVER','변경 접수·영향평가','버전 복제·재산정','독립 재검증·재승인','정정공시·이해관계자 통지'),
 ('PROJECT_LIFECYCLE_CONTROL','COMPANY_MANAGER','AUDITOR','APPROVER','전환 요청·미결업무 확인','보존·잠금·영향평가','권한분리 승인','종료·보관·재개·취소 실행'),
 ('EXTERNAL_VERIFICATION_ENGAGEMENT','COMPANY_MANAGER','AUDITOR','APPROVER','검증 범위·후보 선정','독립성·역량 심사','검증 수행·발견사항 조치','의견서 승인·발급'),
 ('ORGANIZATIONAL_BOUNDARY','COMPANY_MANAGER','CALCULATOR','APPROVER','법인·사업장·소유구조 수집','경계 기준·포함 여부 판정','내부거래 제거·통합 계산','경계 승인·버전 확정'),
 ('MEASUREMENT_DATA_QUALITY','SITE_DATA_OWNER','VERIFIER','APPROVER','측정 지점·기기 등록','교정·가동상태 검증','결측·이상치 판정·대체','품질등급 승인·개선조치'),
 ('CCUS_LIFECYCLE_MRV','CALCULATOR','VERIFIER','APPROVER','시설경계·기준선 확정','포집·수송·저장 데이터 통합','물질수지·순감축량 계산','독립 검증·MRV 확정'),
 ('CHAIN_OF_CUSTODY','SYSTEM_INTEGRATOR','VERIFIER','APPROVER','출처·거점·당사자 등록','출고·운송·인수 계량 연계','양측 인계확인·차이 조정','연속성·중복사용 검증'),
 ('LEAKAGE_INCIDENT_RESPONSE','SITE_DATA_OWNER','VERIFIER','COMPANY_MANAGER','경보 수신·상황 등급화','비상정지·인명환경 보호','법정보고·누출량 산정','원인분석·시정·재가동 승인'),
 ('APPEAL_DISPUTE_AUDIT','AUDITOR','VERIFIER','APPROVER','이의·감사 요청 적격성 확인','원본 증적 동결·독립 배정','쟁점 검토·소명·재현','결정 통지·시정·종결'),
 ('LCA_DATA_QUALITY_UNCERTAINTY','LCA_PRACTITIONER','VERIFIER','APPROVER','품질 메타데이터 수집','대표성·완전성 점수화','불확도·민감도 계산','개선 우선순위·한계 승인'),
 ('PCR_EPD_VERIFICATION','LCA_PRACTITIONER','VERIFIER','APPROVER','제품 분류·PCR 탐색','PCR 적합성·유효기간 판정','EPD·PCF 필수항목 검증','독립 검증·공개본 승인'),
 ('LCA_ALLOCATION_SENSITIVITY','LCA_PRACTITIONER','VERIFIER','APPROVER','다중 산출물·관계자료 확인','할당 회피·규칙 선택','대안별 재계산·민감도 비교','규칙 정당성·결론 승인'),
 ('BACKGROUND_DB_VERSION_IMPACT','LCA_PRACTITIONER','VERIFIER','APPROVER','데이터셋·버전·라이선스 수집','버전 잠금·재현성 스냅샷','버전 변경 영향 재계산','마이그레이션 결정·감사기록'),
 ('COMPARATIVE_ASSERTION_REVIEW','LCA_PRACTITIONER','VERIFIER','APPROVER','비교 목적·동등 조건 확인','데이터 품질·방법론 동등성 검토','비판적 검토·패널 의견 조치','제한사항 포함 공개 승인')
), expanded AS (
 SELECT c.*,v.ord,v.step_name,
        CASE v.ord WHEN 1 THEN c.owner_code WHEN 2 THEN c.owner_code WHEN 3 THEN c.reviewer_code ELSE c.approver_code END actor_code
 FROM config c CROSS JOIN LATERAL (VALUES (1,c.n1),(2,c.n2),(3,c.n3),(4,c.n4)) v(ord,step_name)
)
INSERT INTO framework_process_step(process_code,step_order,step_code,step_name,actor_code,from_state,command_code,to_state,completion_rule,user_path,admin_path,api_contract,parent_step_code,step_type,requirement_text,input_contract,output_contract,requires_user_page,requires_admin_page,requires_api,requires_database,requires_notification,automation_status,sla_hours,escalation_actor_code,evidence_required,evidence_types,segregation_actor_codes,rollback_command_code,decision_rule)
SELECT process_code,ord,process_code||'_S'||ord,step_name,actor_code,
       CASE ord WHEN 1 THEN 'READY' ELSE 'STEP_'||(ord-1)||'_COMPLETED' END,
       process_code||'_EXECUTE_'||ord,'STEP_'||ord||'_COMPLETED',
       step_name||'의 필수 입력, 권한, 증적, 상태 전이가 모두 검증되어야 한다.',
       NULL,NULL,NULL,NULL,CASE WHEN ord IN (3,4) THEN 'DECISION' ELSE 'TASK' END,
       step_name||' 화면·API·DB 계약은 테넌트와 프로젝트 경계를 포함하고 실패 시 이전 상태로 복구 가능해야 한다.',
       jsonb_build_object('processCode',process_code,'stepOrder',ord,'tenantId','required','projectId','required','actorCode',actor_code,'idempotencyKey','required')::text,
       jsonb_build_object('state','STEP_'||ord||'_COMPLETED','auditEvent','required','evidence','required','nextTaskCreated',ord<4)::text,
       true,true,true,true,(ord IN (3,4)),'PLANNED',CASE WHEN ord=4 THEN 24 ELSE 12 END,
       CASE WHEN actor_code='APPROVER' THEN 'AUDITOR' ELSE 'APPROVER' END,true,
       '원본 입력, 결정 근거, 상태전이 로그, 담당자·시각, 생성 산출물',
       CASE WHEN actor_code='APPROVER' THEN owner_code ELSE approver_code END,
       process_code||'_ROLLBACK_'||ord,
       '필수값·권한·기한·증적·중복요청·테넌트 격리를 모두 통과할 때만 다음 상태로 전이한다.'
FROM expanded;

-- Standard professional scenario pack: normal, exception, authority, isolation and recovery.
DELETE FROM framework_simulation_case WHERE process_code IN (SELECT process_code FROM framework_process_definition WHERE development_order BETWEEN 100 AND 114);
WITH types(case_type,suffix,label,severity,minutes) AS (VALUES
 ('HAPPY_PATH','HAPPY','정상 완료','HIGH',30),('EXCEPTION','EXCEPTION','필수값·업무예외','HIGH',20),
 ('AUTHORITY','AUTH','권한분리 위반','CRITICAL',15),('ISOLATION','ISOLATION','테넌트·프로젝트 격리','CRITICAL',15),
 ('RECOVERY','RECOVERY','중단·중복요청 복구','HIGH',25)
)
INSERT INTO framework_simulation_case(case_code,process_code,case_name,case_type,preconditions,steps_json,assertions_json,case_status,severity,required_evidence,automated,expected_duration_minutes)
SELECT p.process_code||'_'||t.suffix,p.process_code,p.process_name||' - '||t.label,t.case_type,
       '서로 다른 액터 계정, 두 개 이상의 테넌트와 프로젝트, 정상·오류 입력 및 감사 수집기가 준비되어 있다.',
       (SELECT jsonb_agg(jsonb_build_object('order',s.step_order,'stepCode',s.step_code,'actorCode',s.actor_code,'command',s.command_code) ORDER BY s.step_order)::text FROM framework_process_step s WHERE s.process_code=p.process_code),
       CASE t.case_type
        WHEN 'HAPPY_PATH' THEN '["최종 상태 도달","모든 단계 증적 존재","다음 태스크 연결","감사 로그 완전"]'
        WHEN 'EXCEPTION' THEN '["잘못된 입력 거부","상태 불변","보완 태스크 생성","원인과 필드 오류 기록"]'
        WHEN 'AUTHORITY' THEN '["비인가 액션 403","요청자와 승인자 분리","거부 시도 감사 기록"]'
        WHEN 'ISOLATION' THEN '["타 테넌트·프로젝트 자료 0건","직접 식별자 접근 403 또는 404","검색·파일·내보내기 격리"]'
        ELSE '["멱등키 중복 생성 없음","중단 단계부터 안전 재개","롤백 후 원본 보존","재시도 횟수와 결과 기록"]' END,
       'DRAFT',t.severity,'화면 캡처, API 응답, DB 상태, 감사 이벤트, 생성 파일 해시',true,t.minutes
FROM framework_process_definition p CROSS JOIN types t WHERE p.development_order BETWEEN 100 AND 114;

-- Queue deterministic work. It is intentionally PLANNED/PENDING, never VERIFIED.
INSERT INTO framework_development_job(process_code,step_code,job_type,job_name,target_path,specification_json,job_status,approval_status,created_by,execution_mode,job_group_code,required,progress_weight,max_attempts,quality_status,quality_report)
SELECT s.process_code,s.step_code,j.job_type,s.step_name||' - '||j.job_name,
       'design://process/'||lower(s.process_code)||'/'||lower(s.step_code)||'/'||lower(j.job_type),
       jsonb_build_object('processCode',s.process_code,'stepCode',s.step_code,'actorCode',s.actor_code,'completionRule',s.completion_rule,'inputContract',s.input_contract::jsonb,'outputContract',s.output_contract::jsonb,'reuseCommonAssets',true,'responsiveRequired',true,'accessibility','WCAG_2_1_AA','implementationClaimed',false)::text,
       'PLANNED','PENDING','PROCESS_DESIGN_EXPANSION',CASE WHEN j.job_type IN ('FRONTEND_USER','FRONTEND_ADMIN','ACTOR_TEST','TEST') THEN 'PARALLEL' ELSE 'SEQUENTIAL' END,
       j.group_code,true,j.weight,3,'PENDING','설계 검토와 실제 구현·실행 증적이 필요함'
FROM framework_process_step s
CROSS JOIN (VALUES
 ('DESIGN','상세 설계 계약','DESIGN',1.0::numeric),('DESIGN_PREFLIGHT','설계 품질 게이트','DESIGN',0.5::numeric),
 ('DATABASE','스키마·마이그레이션','BACKEND_DATA',1.0::numeric),('API','API·권한·멱등성','BACKEND_API',1.0::numeric),
 ('FRONTEND_USER','사용자 업무 화면','FRONTEND',1.0::numeric),('FRONTEND_ADMIN','관리자 대응 화면','FRONTEND',1.0::numeric),
 ('ACTOR_TEST','액터 권한 테스트','TEST',1.0::numeric),('TEST','정상·예외·격리·복구 테스트','TEST',1.0::numeric),
 ('INTEGRATION','메뉴·화면·API·DB 통합','INTEGRATION',1.0::numeric)
) j(job_type,job_name,group_code,weight)
WHERE s.process_code IN (SELECT process_code FROM framework_process_definition WHERE development_order BETWEEN 100 AND 114)
ON CONFLICT(process_code,step_code,job_type,target_path) DO UPDATE SET job_name=excluded.job_name,specification_json=excluded.specification_json,job_status=CASE WHEN framework_development_job.job_status IN ('VERIFIED','COMPLETED') THEN framework_development_job.job_status ELSE 'PLANNED' END,approval_status=CASE WHEN framework_development_job.job_status IN ('VERIFIED','COMPLETED') THEN framework_development_job.approval_status ELSE 'PENDING' END,quality_status=CASE WHEN framework_development_job.job_status IN ('VERIFIED','COMPLETED') THEN framework_development_job.quality_status ELSE 'PENDING' END,updated_at=current_timestamp;

DO $$ DECLARE code varchar; BEGIN
 FOR code IN SELECT process_code FROM framework_process_definition WHERE development_order BETWEEN 100 AND 114 LOOP
   PERFORM framework_sync_development_dependencies(code);
 END LOOP;
END $$;

COMMENT ON TABLE framework_process_definition IS '액터가 수행하는 업무 프로세스의 단일 설계 원본. DRAFT는 구현 완료를 의미하지 않는다.';
