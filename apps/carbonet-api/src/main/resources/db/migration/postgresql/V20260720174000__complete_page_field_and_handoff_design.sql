-- Complete the design layer without claiming that planned routes, APIs, or
-- persistence are implemented. Existing verified screen contracts remain the
-- source of truth; this catalog covers every required page and every handoff.

UPDATE framework_process_definition
SET owner_actor_code='COMPANY_ADMIN',updated_at=current_timestamp
WHERE process_code='COMPANY_ONBOARDING' AND nullif(btrim(owner_actor_code),'') IS NULL;

CREATE TABLE IF NOT EXISTS framework_page_design (
  page_design_id bigserial PRIMARY KEY,
  process_code varchar(80) NOT NULL REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
  step_code varchar(100) NOT NULL,
  audience varchar(16) NOT NULL CHECK(audience IN ('USER','ADMIN')),
  page_code varchar(220) NOT NULL,
  page_title varchar(300) NOT NULL,
  page_purpose text NOT NULL,
  screen_type varchar(40) NOT NULL,
  planned_route_path varchar(500) NOT NULL,
  actual_route_path varchar(500),
  route_status varchar(24) NOT NULL CHECK(route_status IN ('IMPLEMENTED','DESIGN_ONLY')),
  primary_entity varchar(160) NOT NULL,
  upstream_step_code varchar(100),
  downstream_step_code varchar(100),
  actor_code varchar(80) NOT NULL REFERENCES framework_actor_definition(actor_code),
  entry_condition text NOT NULL,
  exit_condition text NOT NULL,
  responsive_contract jsonb NOT NULL,
  accessibility_contract jsonb NOT NULL,
  security_contract jsonb NOT NULL,
  exception_contract jsonb NOT NULL,
  design_status varchar(24) NOT NULL DEFAULT 'DESIGN_COMPLETE',
  design_version integer NOT NULL DEFAULT 1,
  updated_by varchar(100) NOT NULL DEFAULT 'PAGE_FIELD_DESIGN_FACTORY',
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(process_code,step_code,audience),
  UNIQUE(page_code),
  FOREIGN KEY(process_code,step_code) REFERENCES framework_process_step(process_code,step_code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS framework_page_field_definition (
  page_field_id bigserial PRIMARY KEY,
  page_design_id bigint NOT NULL REFERENCES framework_page_design(page_design_id) ON DELETE CASCADE,
  field_order integer NOT NULL,
  field_group varchar(80) NOT NULL,
  field_code varchar(120) NOT NULL,
  field_name varchar(240) NOT NULL,
  data_type varchar(40) NOT NULL,
  control_type varchar(40) NOT NULL,
  required boolean NOT NULL DEFAULT false,
  editable boolean NOT NULL DEFAULT true,
  list_visible boolean NOT NULL DEFAULT false,
  search_enabled boolean NOT NULL DEFAULT false,
  source_table varchar(160),
  source_column varchar(160),
  api_property varchar(160) NOT NULL,
  mapping_status varchar(24) NOT NULL CHECK(mapping_status IN ('DB_RESOLVED','LOGICAL_CONTRACT','CONTEXT')),
  validation_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  privacy_class varchar(24) NOT NULL DEFAULT 'INTERNAL',
  permission_code varchar(120) NOT NULL,
  evidence_required boolean NOT NULL DEFAULT false,
  responsive_priority integer NOT NULL DEFAULT 100,
  help_text text NOT NULL DEFAULT '',
  design_source varchar(40) NOT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(page_design_id,field_code)
);

CREATE INDEX IF NOT EXISTS idx_page_field_search
  ON framework_page_field_definition(page_design_id,search_enabled,field_order);
CREATE INDEX IF NOT EXISTS idx_page_field_source
  ON framework_page_field_definition(source_table,source_column);

CREATE TABLE IF NOT EXISTS framework_process_data_handoff (
  handoff_id bigserial PRIMARY KEY,
  process_code varchar(80) NOT NULL REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
  from_step_code varchar(100) NOT NULL,
  to_process_code varchar(80) NOT NULL REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
  to_step_code varchar(100) NOT NULL,
  handoff_type varchar(24) NOT NULL CHECK(handoff_type IN ('STEP','PROCESS')),
  context_keys jsonb NOT NULL,
  payload_contract jsonb NOT NULL,
  integrity_contract jsonb NOT NULL,
  authorization_contract jsonb NOT NULL,
  failure_contract jsonb NOT NULL,
  design_status varchar(24) NOT NULL DEFAULT 'DESIGN_COMPLETE',
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(process_code,from_step_code,to_process_code,to_step_code,handoff_type),
  FOREIGN KEY(process_code,from_step_code) REFERENCES framework_process_step(process_code,step_code) ON DELETE CASCADE,
  FOREIGN KEY(to_process_code,to_step_code) REFERENCES framework_process_step(process_code,step_code) ON DELETE CASCADE
);

WITH ordered AS (
  SELECT s.*,p.domain_code,
    lag(s.step_code) OVER(PARTITION BY s.process_code ORDER BY s.step_order) AS upstream_step,
    lead(s.step_code) OVER(PARTITION BY s.process_code ORDER BY s.step_order) AS downstream_step
  FROM framework_process_step s JOIN framework_process_definition p USING(process_code)
), pages AS (
  SELECT o.*,'USER'::varchar AS audience,o.user_path AS actual_path
  FROM ordered o WHERE o.requires_user_page
  UNION ALL
  SELECT o.*,'ADMIN'::varchar,o.admin_path
  FROM ordered o WHERE o.requires_admin_page
)
INSERT INTO framework_page_design(
  process_code,step_code,audience,page_code,page_title,page_purpose,screen_type,
  planned_route_path,actual_route_path,route_status,primary_entity,upstream_step_code,
  downstream_step_code,actor_code,entry_condition,exit_condition,responsive_contract,
  accessibility_contract,security_contract,exception_contract,design_status)
SELECT process_code,step_code,audience,
  process_code||'_'||step_code||'_'||audience,
  step_name||CASE WHEN audience='ADMIN' THEN ' 관리' ELSE '' END,
  coalesce(nullif(requirement_text,''),step_name||' 업무를 처리하고 다음 단계에 검증 가능한 산출물을 전달한다.'),
  CASE
    WHEN upper(step_code||' '||step_name) ~ '(LIST|SEARCH|MONITOR|DASHBOARD|현황|조회|목록)' THEN 'LIST_DASHBOARD'
    WHEN upper(step_code||' '||step_name) ~ '(APPROV|REVIEW|VERIFY|VALIDAT|검토|승인|검증)' THEN 'REVIEW_DECISION'
    WHEN upper(step_code||' '||step_name) ~ '(REPORT|CERTIFICATE|보고|인증)' THEN 'REPORT_DOCUMENT'
    WHEN upper(step_code||' '||step_name) ~ '(CREATE|REGISTER|SETUP|APPLY|등록|신청|설정)' THEN 'FORM_WIZARD'
    WHEN upper(step_code||' '||step_name) ~ '(UPLOAD|COLLECT|SUBMIT|제출|수집|업로드)' THEN 'DATA_COLLECTION'
    ELSE 'WORKSPACE' END,
  CASE WHEN nullif(btrim(actual_path),'') IS NOT NULL THEN split_part(actual_path,'?',1)
       ELSE (CASE WHEN audience='ADMIN' THEN '/admin/planned/' ELSE '/planned/' END)
         ||lower(replace(domain_code,'_','-'))||'/'||lower(replace(process_code,'_','-'))||'/'||lower(replace(step_code,'_','-')) END,
  nullif(btrim(actual_path),''),
  CASE WHEN nullif(btrim(actual_path),'') IS NOT NULL THEN 'IMPLEMENTED' ELSE 'DESIGN_ONLY' END,
  CASE upper(domain_code)
    WHEN 'MEMBER' THEN 'comtnentrprsmber'
    WHEN 'EMISSION' THEN 'emission_project_registry'
    WHEN 'LCA' THEN 'lca_process_inventory'
    WHEN 'REDUCTION' THEN 'reduction_project'
    WHEN 'MONITORING' THEN 'monitoring_metric_observation'
    WHEN 'CERTIFICATE' THEN 'emission_project_report'
    WHEN 'TRADE' THEN 'carbon_trade_contract'
    WHEN 'EDUCATION' THEN 'education_enrollment'
    WHEN 'SYSTEM' THEN 'framework_process_definition'
    ELSE 'framework_business_record' END,
  upstream_step,downstream_step,actor_code,
  coalesce(nullif(from_state,''),'READY')||' 상태이고 입력 계약과 액터 권한 검증을 통과해야 한다.',
  coalesce(nullif(completion_rule,''),'필수값, 권한, 데이터 무결성, 증빙 검증을 통과해야 한다.'),
  '{"mobile":"single-column and priority fields","tablet":"adaptive two-column","desktop":"task-optimized grid","overflow":"wrap-or-scroll-with-sticky-key-column"}'::jsonb,
  '{"standard":"WCAG 2.1 AA","keyboard":true,"labels":true,"errorSummary":true,"focusManagement":true}'::jsonb,
  jsonb_build_object('actorCode',actor_code,'tenantIsolation',true,'projectIsolation',true,'fieldLevelAuthorization',true,'auditRequired',true),
  '{"states":["loading","empty","validation-error","authority-denied","conflict","dependency-blocked","server-error","recovery"],"retry":"idempotent commands only"}'::jsonb,
  'DESIGN_COMPLETE'
FROM pages
ON CONFLICT(process_code,step_code,audience) DO UPDATE SET
  page_title=excluded.page_title,page_purpose=excluded.page_purpose,screen_type=excluded.screen_type,
  planned_route_path=excluded.planned_route_path,actual_route_path=excluded.actual_route_path,
  route_status=excluded.route_status,primary_entity=excluded.primary_entity,
  upstream_step_code=excluded.upstream_step_code,downstream_step_code=excluded.downstream_step_code,
  actor_code=excluded.actor_code,entry_condition=excluded.entry_condition,exit_condition=excluded.exit_condition,
  responsive_contract=excluded.responsive_contract,accessibility_contract=excluded.accessibility_contract,
  security_contract=excluded.security_contract,exception_contract=excluded.exception_contract,
  design_status='DESIGN_COMPLETE',design_version=framework_page_design.design_version+1,updated_at=current_timestamp;

-- Context, lifecycle, ownership and audit fields exist on every professional page.
INSERT INTO framework_page_field_definition(
  page_design_id,field_order,field_group,field_code,field_name,data_type,control_type,
  required,editable,list_visible,search_enabled,source_table,source_column,api_property,
  mapping_status,validation_contract,privacy_class,permission_code,evidence_required,
  responsive_priority,help_text,design_source)
SELECT d.page_design_id,f.ord,'공통',f.code,f.name,f.dtype,f.control,f.required,f.editable,
  f.list_visible,f.search_enabled,
  CASE WHEN f.code='processCode' THEN 'framework_process_definition'
       WHEN f.code='stepCode' THEN 'framework_process_step'
       WHEN f.code='projectId' AND p.domain_code='EMISSION' THEN 'emission_project_registry' END,
  CASE WHEN f.code='processCode' THEN 'process_code'
       WHEN f.code='stepCode' THEN 'step_code'
       WHEN f.code='projectId' AND p.domain_code='EMISSION' THEN 'project_id' END,
  f.code,CASE WHEN f.code IN ('tenantId','processCode','stepCode') THEN 'CONTEXT'
              WHEN f.code='projectId' AND p.domain_code='EMISSION' THEN 'DB_RESOLVED' ELSE 'LOGICAL_CONTRACT' END,
  f.validation,'INTERNAL',d.actor_code||':'||d.audience,false,f.priority,f.help,'COMMON_REQUIRED'
FROM framework_page_design d JOIN framework_process_definition p USING(process_code)
CROSS JOIN (VALUES
  (10,'tenantId','테넌트','STRING','HIDDEN',true,false,false,false,10,'{"minLength":1}'::jsonb,'고객 데이터 격리 기준'),
  (20,'projectId','프로젝트','STRING','PROJECT_SELECT',true,true,true,true,10,'{"minLength":1}'::jsonb,'업무가 귀속되는 프로젝트'),
  (30,'processCode','프로세스 코드','CODE','HIDDEN',true,false,false,false,100,'{}'::jsonb,'표준 프로세스 식별자'),
  (40,'stepCode','단계 코드','CODE','HIDDEN',true,false,false,false,100,'{}'::jsonb,'표준 단계 식별자'),
  (50,'recordId','업무 레코드 ID','UUID','HIDDEN',false,false,false,false,100,'{}'::jsonb,'업무 데이터 식별자'),
  (60,'statusCode','처리 상태','CODE','STATUS_BADGE',true,false,true,true,10,'{"codeGroup":"WORK_STATUS"}'::jsonb,'현재 처리 상태'),
  (70,'ownerActorCode','담당 액터','CODE','ACTOR_SELECT',true,true,true,true,20,'{}'::jsonb,'현재 업무 책임자'),
  (80,'rowVersion','데이터 버전','INTEGER','HIDDEN',true,false,false,false,100,'{"min":0}'::jsonb,'동시 수정 충돌 방지'),
  (90,'createdAt','등록 일시','DATETIME','DATETIME',false,false,true,false,80,'{}'::jsonb,'최초 등록 시각'),
  (100,'updatedAt','최종 수정 일시','DATETIME','DATETIME',false,false,true,true,70,'{}'::jsonb,'최종 변경 시각'),
  (110,'evidenceCount','증빙 수','INTEGER','EVIDENCE_LINK',false,false,true,false,30,'{"min":0}'::jsonb,'연결된 증빙과 감사 추적')
) AS f(ord,code,name,dtype,control,required,editable,list_visible,search_enabled,priority,validation,help)
ON CONFLICT(page_design_id,field_code) DO NOTHING;

-- Domain columns provide the minimum professional vocabulary shared by all
-- pages in that business area. Page-specific contracts below add commands.
WITH domain_field(domain_code,ord,code,name,dtype,control,required,list_visible,search_enabled,priority,help) AS (VALUES
 ('MEMBER',200,'companyId','기업','STRING','COMPANY_SELECT',true,true,true,10,'소속 기업 및 데이터 범위'),
 ('MEMBER',210,'accountId','사용자 계정','STRING','USER_SELECT',true,true,true,10,'로그인 계정 식별자'),
 ('MEMBER',220,'actorCodes','업무 액터','ARRAY','ACTOR_MULTI_SELECT',true,true,true,20,'수행 가능한 업무 역할'),
 ('MEMBER',230,'authorityCode','권한 그룹','CODE','AUTHORITY_SELECT',true,true,true,20,'메뉴·API 접근 권한'),
 ('MEMBER',240,'accountStatus','계정 상태','CODE','STATUS_SELECT',true,true,true,20,'가입·승인·잠금·탈퇴 상태'),
 ('MEMBER',250,'consentVersion','동의서 버전','STRING','CONSENT_VIEW',false,false,true,50,'적용된 약관과 개인정보 동의'),
 ('EMISSION',200,'reportingYear','보고연도','YEAR','YEAR',true,true,true,10,'배출량 보고 기준연도'),
 ('EMISSION',210,'organizationId','조직','STRING','ORGANIZATION_SELECT',true,true,true,10,'조직 경계'),
 ('EMISSION',220,'siteId','사업장','STRING','SITE_SELECT',true,true,true,10,'활동자료 귀속 사업장'),
 ('EMISSION',230,'facilityId','배출시설','STRING','FACILITY_SELECT',false,true,true,20,'배출시설 식별자'),
 ('EMISSION',240,'scopeCode','Scope','CODE','SCOPE_SELECT',true,true,true,10,'Scope 1·2·3 분류'),
 ('EMISSION',250,'activityValue','활동량','DECIMAL','NUMBER',false,true,false,10,'기간별 원시 활동량'),
 ('EMISSION',260,'unitCode','단위','CODE','UNIT_SELECT',false,true,true,10,'측정·환산 단위'),
 ('EMISSION',270,'factorId','배출계수','STRING','FACTOR_SEARCH',false,true,true,20,'출처·버전이 고정된 배출계수'),
 ('EMISSION',280,'emissionValue','배출량','DECIMAL','CALCULATED_NUMBER',false,true,false,10,'산정된 온실가스 배출량'),
 ('EMISSION',290,'qualityStatus','데이터 품질','CODE','QUALITY_BADGE',true,true,true,20,'완전성·정확성·일관성 결과'),
 ('LCA',200,'lcaProjectId','LCA 프로젝트','STRING','PROJECT_SELECT',true,true,true,10,'LCA 산정 프로젝트'),
 ('LCA',210,'productId','제품','STRING','PRODUCT_SELECT',true,true,true,10,'기능 단위 대상 제품'),
 ('LCA',220,'processId','공정','STRING','PROCESS_SELECT',true,true,true,10,'시스템 경계 내 공정'),
 ('LCA',230,'flowType','흐름 구분','CODE','FLOW_TYPE_SELECT',true,true,true,10,'투입·제품·부산물·배출물'),
 ('LCA',240,'substanceId','물질','STRING','SUBSTANCE_SEARCH',true,true,true,10,'LCI 물질 및 매핑'),
 ('LCA',250,'quantity','수량','DECIMAL','NUMBER',true,true,false,10,'기능 단위 기준 수량'),
 ('LCA',260,'unitCode','단위','CODE','UNIT_SELECT',true,true,true,10,'LCI 수량 단위'),
 ('LCA',270,'allocationRatio','할당 비율','DECIMAL','PERCENT',false,true,false,20,'제품·부산물 환경부하 할당'),
 ('LCA',280,'impactCategory','영향범주','CODE','IMPACT_SELECT',false,true,true,20,'LCIA 영향범주'),
 ('LCA',290,'impactResult','영향평가 결과','DECIMAL','CALCULATED_NUMBER',false,true,false,10,'기능 단위별 영향 결과'),
 ('REDUCTION',200,'baselineYear','기준연도','YEAR','YEAR',true,true,true,10,'감축 기준연도'),
 ('REDUCTION',210,'baselineEmission','기준 배출량','DECIMAL','NUMBER',true,true,false,10,'검증된 기준 배출량'),
 ('REDUCTION',220,'targetYear','목표연도','YEAR','YEAR',true,true,true,10,'감축 목표연도'),
 ('REDUCTION',230,'targetReduction','목표 감축량','DECIMAL','NUMBER',true,true,false,10,'목표 감축량'),
 ('REDUCTION',240,'reductionMethod','감축 수단','CODE','METHOD_SELECT',true,true,true,10,'기술·운영·조달 감축 수단'),
 ('REDUCTION',250,'expectedReduction','예상 감축량','DECIMAL','CALCULATED_NUMBER',true,true,false,10,'사전 산정 감축량'),
 ('REDUCTION',260,'actualReduction','실적 감축량','DECIMAL','CALCULATED_NUMBER',false,true,false,10,'검증된 실제 감축량'),
 ('REDUCTION',270,'capex','투자비','DECIMAL','CURRENCY',false,true,false,30,'CAPEX'),
 ('REDUCTION',280,'opex','운영비','DECIMAL','CURRENCY',false,true,false,30,'OPEX'),
 ('MONITORING',200,'metricCode','지표','CODE','METRIC_SELECT',true,true,true,10,'모니터링 지표'),
 ('MONITORING',210,'dimensionKey','분석 차원','STRING','DIMENSION_SELECT',true,true,true,10,'조직·사업장·Scope·기간 차원'),
 ('MONITORING',220,'observedAt','관측 시각','DATETIME','DATETIME',true,true,true,10,'지표 관측 시각'),
 ('MONITORING',230,'observedValue','관측값','DECIMAL','NUMBER',true,true,false,10,'수집된 지표 값'),
 ('MONITORING',240,'thresholdValue','임계값','DECIMAL','NUMBER',false,true,false,20,'경보 기준값'),
 ('MONITORING',250,'anomalyStatus','이상치 상태','CODE','ALERT_BADGE',false,true,true,10,'이상 탐지 결과'),
 ('CERTIFICATE',200,'reportId','보고서','STRING','REPORT_SELECT',true,true,true,10,'확정 보고서'),
 ('CERTIFICATE',210,'certificateId','인증서','STRING','CERTIFICATE_LINK',false,true,true,10,'발급 인증서 식별자'),
 ('CERTIFICATE',220,'reportVersion','보고서 버전','INTEGER','VERSION',true,true,false,20,'확정 보고서 버전'),
 ('CERTIFICATE',230,'integrityHash','무결성 해시','HASH','HASH_VIEW',true,true,true,10,'보고서 SHA-256'),
 ('CERTIFICATE',240,'datasetHash','데이터셋 해시','HASH','HASH_VIEW',true,true,true,10,'검증 데이터셋 SHA-256'),
 ('CERTIFICATE',250,'certificateStatus','인증 상태','CODE','STATUS_BADGE',true,true,true,10,'발급·폐기·만료 상태'),
 ('CERTIFICATE',260,'issuedAt','발급 일시','DATETIME','DATETIME',false,true,true,20,'인증 발급 시각'),
 ('TRADE',200,'listingId','거래 공고','STRING','LISTING_SELECT',true,true,true,10,'공급·수요 공고'),
 ('TRADE',210,'tradeType','거래 구분','CODE','TRADE_TYPE_SELECT',true,true,true,10,'공급·수요·크레딧 구분'),
 ('TRADE',220,'quantity','거래 수량','DECIMAL','NUMBER',true,true,false,10,'계약 대상 수량'),
 ('TRADE',230,'unitPrice','단가','DECIMAL','CURRENCY',true,true,false,10,'거래 단가'),
 ('TRADE',240,'counterpartyId','거래 상대','STRING','COMPANY_SELECT',true,true,true,10,'계약 상대 기업'),
 ('TRADE',250,'mrvReference','MRV 근거','STRING','EVIDENCE_LINK',true,true,true,20,'출처·이동·사용 검증 근거'),
 ('TRADE',260,'contractStatus','계약 상태','CODE','STATUS_BADGE',true,true,true,10,'협의·계약·정산 상태'),
 ('TRADE',270,'settlementStatus','정산 상태','CODE','STATUS_BADGE',false,true,true,20,'결제·정산·환불 상태'),
 ('EDUCATION',200,'courseId','교육 과정','STRING','COURSE_SELECT',true,true,true,10,'교육 과정'),
 ('EDUCATION',210,'scheduleId','교육 일정','STRING','SCHEDULE_SELECT',true,true,true,10,'교육 회차와 일정'),
 ('EDUCATION',220,'learnerId','학습자','STRING','USER_SELECT',true,true,true,10,'수강 사용자'),
 ('EDUCATION',230,'enrollmentStatus','신청 상태','CODE','STATUS_BADGE',true,true,true,10,'신청·승인·취소 상태'),
 ('EDUCATION',240,'progressRate','진도율','DECIMAL','PERCENT',false,true,false,10,'학습 진도'),
 ('EDUCATION',250,'attendanceStatus','출석 상태','CODE','STATUS_BADGE',false,true,true,20,'출석 결과'),
 ('EDUCATION',260,'evaluationScore','평가 점수','DECIMAL','SCORE',false,true,false,20,'평가 결과'),
 ('SYSTEM',200,'resourceCode','관리 자원 코드','CODE','CODE_INPUT',true,true,true,10,'메뉴·화면·API·자산 식별자'),
 ('SYSTEM',210,'resourceName','관리 자원명','STRING','TEXT',true,true,true,10,'사용자에게 표시되는 명칭'),
 ('SYSTEM',220,'resourceType','자원 유형','CODE','TYPE_SELECT',true,true,true,10,'시스템 자산 유형'),
 ('SYSTEM',230,'resourceVersion','자원 버전','STRING','VERSION',true,true,false,20,'배포·설계 버전'),
 ('SYSTEM',240,'changeReason','변경 사유','TEXT','TEXTAREA',true,true,false,20,'감사 가능한 변경 목적'),
 ('SYSTEM',250,'deploymentStatus','배포 상태','CODE','STATUS_BADGE',false,true,true,10,'빌드·배포·롤백 상태')
)
INSERT INTO framework_page_field_definition(
 page_design_id,field_order,field_group,field_code,field_name,data_type,control_type,
 required,editable,list_visible,search_enabled,api_property,mapping_status,validation_contract,
 privacy_class,permission_code,evidence_required,responsive_priority,help_text,design_source)
SELECT d.page_design_id,f.ord,p.domain_code,f.code,f.name,f.dtype,f.control,f.required,true,
 f.list_visible,f.search_enabled,f.code,'LOGICAL_CONTRACT','{}'::jsonb,'INTERNAL',d.actor_code||':'||d.audience,
 f.code IN ('integrityHash','datasetHash','mrvReference'),f.priority,f.help,'DOMAIN_PROFESSIONAL_TEMPLATE'
FROM framework_page_design d JOIN framework_process_definition p USING(process_code)
JOIN domain_field f ON f.domain_code=upper(p.domain_code)
ON CONFLICT(page_design_id,field_code) DO NOTHING;

-- Command-specific fields keep list, collection, review and setup pages from
-- collapsing into the same generic form.
WITH command_field(kind,ord,code,name,dtype,control,required,list_visible,search_enabled,priority,help) AS (VALUES
 ('FORM',400,'businessName','업무명','STRING','TEXT',true,true,true,10,'업무를 식별하는 명칭'),
 ('FORM',410,'businessPurpose','목적·근거','TEXT','TEXTAREA',true,false,false,20,'수행 목적과 규정 근거'),
 ('FORM',420,'effectiveFrom','적용 시작일','DATE','DATE',true,true,true,20,'적용 기간 시작'),
 ('FORM',430,'effectiveTo','적용 종료일','DATE','DATE',false,true,true,30,'적용 기간 종료'),
 ('COLLECT',400,'sourceType','자료 출처','CODE','SOURCE_SELECT',true,true,true,10,'원천 시스템 또는 제출자'),
 ('COLLECT',410,'sourceReference','원본 참조','STRING','SOURCE_LINK',true,true,true,10,'원본 파일·API·문서 위치'),
 ('COLLECT',420,'attachmentIds','첨부 증빙','ARRAY','FILE_UPLOAD',false,false,false,10,'검증 가능한 원본 증빙'),
 ('COLLECT',430,'submittedAt','제출 일시','DATETIME','DATETIME',false,true,true,30,'제출 완료 시각'),
 ('REVIEW',400,'decisionCode','판정','CODE','DECISION_RADIO',true,true,true,10,'승인·반려·보완요청'),
 ('REVIEW',410,'reviewComment','검토 의견','TEXT','TEXTAREA',true,false,false,20,'판정 근거'),
 ('REVIEW',420,'rejectionReasonCode','반려 사유','CODE','REASON_SELECT',false,true,true,20,'표준 반려 사유'),
 ('REVIEW',430,'decidedAt','판정 일시','DATETIME','DATETIME',false,true,true,30,'최종 판정 시각'),
 ('LIST',400,'keyword','검색어','STRING','SEARCH',false,false,true,10,'명칭·코드 통합검색'),
 ('LIST',410,'statusFilter','상태 필터','ARRAY','STATUS_MULTI_SELECT',false,false,true,10,'업무 상태 필터'),
 ('LIST',420,'dateFrom','조회 시작일','DATE','DATE',false,false,true,20,'조회 기간 시작'),
 ('LIST',430,'dateTo','조회 종료일','DATE','DATE',false,false,true,20,'조회 기간 종료'),
 ('LIST',440,'sortContract','정렬','STRING','SORT_SELECT',false,false,false,30,'업무 우선순위·마감·최종수정 정렬'),
 ('REPORT',400,'documentVersion','문서 버전','INTEGER','VERSION',true,true,false,10,'불변 산출물 버전'),
 ('REPORT',410,'languageCode','문서 언어','CODE','LANGUAGE_SELECT',true,true,true,20,'국문·영문 출력 언어'),
 ('REPORT',420,'documentHash','문서 해시','HASH','HASH_VIEW',false,true,true,10,'다운로드 산출물 무결성'),
 ('REPORT',430,'downloadFormat','다운로드 형식','CODE','FORMAT_SELECT',false,false,false,20,'PDF·XLSX 등 산출 형식'),
 ('WORK',400,'taskComment','업무 메모','TEXT','TEXTAREA',false,false,false,30,'인수인계와 처리 메모'),
 ('WORK',410,'dueAt','마감 일시','DATETIME','DATETIME',false,true,true,20,'SLA 기반 마감'),
 ('WORK',420,'nextActorCode','다음 담당 액터','CODE','ACTOR_VIEW',false,true,false,30,'다음 단계 책임자')
), classified AS (
 SELECT d.*,
  CASE WHEN d.screen_type='FORM_WIZARD' THEN 'FORM'
       WHEN d.screen_type='DATA_COLLECTION' THEN 'COLLECT'
       WHEN d.screen_type='REVIEW_DECISION' THEN 'REVIEW'
       WHEN d.screen_type='LIST_DASHBOARD' THEN 'LIST'
       WHEN d.screen_type='REPORT_DOCUMENT' THEN 'REPORT' ELSE 'WORK' END AS kind
 FROM framework_page_design d
)
INSERT INTO framework_page_field_definition(
 page_design_id,field_order,field_group,field_code,field_name,data_type,control_type,
 required,editable,list_visible,search_enabled,api_property,mapping_status,validation_contract,
 privacy_class,permission_code,evidence_required,responsive_priority,help_text,design_source)
SELECT d.page_design_id,f.ord,'업무 처리',f.code,f.name,f.dtype,f.control,f.required,true,
 f.list_visible,f.search_enabled,f.code,'LOGICAL_CONTRACT','{}'::jsonb,'INTERNAL',d.actor_code||':'||d.audience,
 f.code IN ('attachmentIds','documentHash'),f.priority,f.help,'SCREEN_TYPE_TEMPLATE'
FROM classified d JOIN command_field f USING(kind)
ON CONFLICT(page_design_id,field_code) DO NOTHING;

-- Preserve all manually curated field labels from existing professional contracts.
INSERT INTO framework_page_field_definition(
 page_design_id,field_order,field_group,field_code,field_name,data_type,control_type,
 required,editable,list_visible,search_enabled,api_property,mapping_status,validation_contract,
 privacy_class,permission_code,evidence_required,responsive_priority,help_text,design_source)
SELECT d.page_design_id,600+e.ordinality,'기존 전문 설계',
 'contract_'||substr(md5(e.label),1,12),e.label,'STRING','DOMAIN_CONTROL',true,true,true,false,
 'contract_'||substr(md5(e.label),1,12),'LOGICAL_CONTRACT','{}'::jsonb,'INTERNAL',d.actor_code||':'||d.audience,
 lower(e.label) ~ '(증빙|근거|해시)',40,e.label||' 전문 화면 계약','EXISTING_PROFESSIONAL_CONTRACT'
FROM framework_professional_screen_contract c
JOIN framework_page_design d ON d.process_code=c.process_code AND d.step_code=c.step_code AND d.audience=c.audience
CROSS JOIN LATERAL jsonb_array_elements_text(framework_try_jsonb(c.field_contract)) WITH ORDINALITY e(label,ordinality)
WHERE jsonb_typeof(framework_try_jsonb(c.field_contract))='array'
ON CONFLICT(page_design_id,field_code) DO NOTHING;

-- Resolve only mappings that actually exist in PostgreSQL. Logical fields
-- remain explicit implementation requirements rather than false DB claims.
UPDATE framework_page_field_definition f
SET source_table=d.primary_entity,source_column=c.column_name,mapping_status='DB_RESOLVED',updated_at=current_timestamp
FROM framework_page_design d
JOIN information_schema.columns c ON c.table_schema='public'
WHERE f.page_design_id=d.page_design_id
  AND lower(c.table_name)=lower(d.primary_entity)
  AND lower(c.column_name)=lower(regexp_replace(f.field_code,'([a-z0-9])([A-Z])','\1_\2','g'));

-- In-process step handoffs.
INSERT INTO framework_process_data_handoff(
 process_code,from_step_code,to_process_code,to_step_code,handoff_type,context_keys,
 payload_contract,integrity_contract,authorization_contract,failure_contract)
SELECT s.process_code,s.step_code,s.process_code,n.step_code,'STEP',
 '["tenantId","projectId","processCode","recordId","rowVersion"]'::jsonb,
 jsonb_build_object('fromOutput',framework_try_jsonb(s.output_contract),'toInput',framework_try_jsonb(n.input_contract),'requiredContext',jsonb_build_array('tenantId','projectId','recordId','statusCode','rowVersion')),
 '{"immutableSnapshot":true,"hashWhenEvidenceOrCalculation":true,"optimisticLock":true}'::jsonb,
 jsonb_build_object('fromActor',s.actor_code,'toActor',n.actor_code,'tenantIsolation',true,'projectIsolation',true,'segregationChecked',true),
 '{"onMissing":"DEPENDENCY_BLOCKED","onInvalid":"VALIDATION_ERROR","onConflict":"RELOAD_AND_REVIEW","onUnauthorized":"DENY_AND_AUDIT"}'::jsonb
FROM framework_process_step s
JOIN framework_process_step n ON n.process_code=s.process_code AND n.step_order=(
 SELECT min(x.step_order) FROM framework_process_step x WHERE x.process_code=s.process_code AND x.step_order>s.step_order)
ON CONFLICT(process_code,from_step_code,to_process_code,to_step_code,handoff_type) DO UPDATE SET
 payload_contract=excluded.payload_contract,integrity_contract=excluded.integrity_contract,
 authorization_contract=excluded.authorization_contract,failure_contract=excluded.failure_contract,updated_at=current_timestamp;

-- Cross-process handoffs use the registered workflow sequence.
INSERT INTO framework_process_data_handoff(
 process_code,from_step_code,to_process_code,to_step_code,handoff_type,context_keys,
 payload_contract,integrity_contract,authorization_contract,failure_contract)
SELECT seq.process_code,from_step.step_code,seq.next_process_code,to_step.step_code,'PROCESS',
 '["tenantId","projectId","recordId","completedProcessCode","outputVersion"]'::jsonb,
 jsonb_build_object('fromOutput',framework_try_jsonb(from_step.output_contract),'toInput',framework_try_jsonb(to_step.input_contract),'completionCondition',p.completion_condition),
 '{"completedProcessRequired":true,"immutableOutputVersion":true,"handoffAudit":true}'::jsonb,
 jsonb_build_object('fromActor',from_step.actor_code,'toActor',to_step.actor_code,'projectApplicabilityRequired',true,'segregationChecked',true),
 '{"onMissingNextProcess":"WORKFLOW_COMPLETE","onInapplicable":"SKIP_WITH_AUDIT","onInvalid":"DESIGN_REVIEW_REQUIRED"}'::jsonb
FROM framework_business_process_sequence seq
JOIN framework_process_definition p ON p.process_code=seq.process_code
JOIN LATERAL (SELECT * FROM framework_process_step s WHERE s.process_code=seq.process_code ORDER BY s.step_order DESC LIMIT 1) from_step ON true
JOIN LATERAL (SELECT * FROM framework_process_step s WHERE s.process_code=seq.next_process_code ORDER BY s.step_order LIMIT 1) to_step ON true
WHERE nullif(seq.next_process_code,'') IS NOT NULL
ON CONFLICT(process_code,from_step_code,to_process_code,to_step_code,handoff_type) DO UPDATE SET
 payload_contract=excluded.payload_contract,integrity_contract=excluded.integrity_contract,
 authorization_contract=excluded.authorization_contract,failure_contract=excluded.failure_contract,updated_at=current_timestamp;

CREATE OR REPLACE VIEW framework_page_design_readiness AS
SELECT d.page_design_id,d.process_code,d.step_code,d.audience,d.page_code,d.page_title,d.page_purpose,
 d.screen_type,d.planned_route_path,d.actual_route_path,d.route_status,d.primary_entity,d.actor_code,
 d.upstream_step_code,d.downstream_step_code,d.design_status,
 count(f.page_field_id)::integer AS field_count,
 count(f.page_field_id) FILTER(WHERE f.required)::integer AS required_field_count,
 count(f.page_field_id) FILTER(WHERE f.list_visible)::integer AS list_field_count,
 count(f.page_field_id) FILTER(WHERE f.search_enabled)::integer AS search_field_count,
 count(f.page_field_id) FILTER(WHERE f.mapping_status='DB_RESOLVED')::integer AS db_resolved_field_count,
 count(f.page_field_id) FILTER(WHERE f.mapping_status='LOGICAL_CONTRACT')::integer AS implementation_field_count,
 count(f.page_field_id) FILTER(WHERE f.evidence_required)::integer AS evidence_field_count,
 coalesce(string_agg(f.field_name,', ' ORDER BY f.field_order),'') AS field_summary,
 CASE WHEN count(f.page_field_id)<10 THEN 'FIELD_CONTRACT_INCOMPLETE'
      WHEN count(f.page_field_id) FILTER(WHERE f.required)<5 THEN 'REQUIRED_FIELDS_INCOMPLETE'
      WHEN d.route_status='DESIGN_ONLY' THEN 'IMPLEMENTATION_PENDING'
      ELSE 'DESIGN_COMPLETE' END AS readiness_status
FROM framework_page_design d LEFT JOIN framework_page_field_definition f USING(page_design_id)
GROUP BY d.page_design_id;

CREATE OR REPLACE VIEW framework_process_page_design_assurance AS
SELECT p.process_code,
 count(d.page_design_id)::integer AS page_design_count,
 count(d.page_design_id) FILTER(WHERE d.audience='USER')::integer AS user_page_count,
 count(d.page_design_id) FILTER(WHERE d.audience='ADMIN')::integer AS admin_page_count,
 coalesce(sum(d.field_count),0)::integer AS field_count,
 coalesce(sum(d.required_field_count),0)::integer AS required_field_count,
 coalesce(sum(d.db_resolved_field_count),0)::integer AS db_resolved_field_count,
 coalesce(sum(d.implementation_field_count),0)::integer AS implementation_field_count,
 count(d.page_design_id) FILTER(WHERE d.readiness_status='FIELD_CONTRACT_INCOMPLETE')::integer AS field_contract_gap_count,
 count(d.page_design_id) FILTER(WHERE d.route_status='DESIGN_ONLY')::integer AS implementation_pending_page_count,
 (SELECT count(*) FROM framework_process_data_handoff h WHERE h.process_code=p.process_code)::integer AS handoff_count,
 CASE WHEN count(d.page_design_id)=0 AND EXISTS(SELECT 1 FROM framework_process_step s WHERE s.process_code=p.process_code AND (s.requires_user_page OR s.requires_admin_page)) THEN 'PAGE_DESIGN_MISSING'
      WHEN count(d.page_design_id) FILTER(WHERE d.readiness_status='FIELD_CONTRACT_INCOMPLETE')>0 THEN 'FIELD_DESIGN_INCOMPLETE'
      ELSE 'DESIGN_COMPLETE' END AS page_design_status
FROM framework_process_definition p LEFT JOIN framework_page_design_readiness d USING(process_code)
GROUP BY p.process_code;

CREATE OR REPLACE VIEW framework_page_design_summary AS
SELECT count(*)::integer AS page_count,
 count(*) FILTER(WHERE route_status='IMPLEMENTED')::integer AS implemented_page_count,
 count(*) FILTER(WHERE route_status='DESIGN_ONLY')::integer AS design_only_page_count,
 coalesce(sum(field_count),0)::integer AS field_count,
 coalesce(sum(required_field_count),0)::integer AS required_field_count,
 coalesce(sum(db_resolved_field_count),0)::integer AS db_resolved_field_count,
 coalesce(sum(implementation_field_count),0)::integer AS implementation_field_count,
 count(*) FILTER(WHERE readiness_status='FIELD_CONTRACT_INCOMPLETE')::integer AS incomplete_page_count,
 (SELECT count(*) FROM framework_process_data_handoff)::integer AS handoff_count
FROM framework_page_design_readiness;
