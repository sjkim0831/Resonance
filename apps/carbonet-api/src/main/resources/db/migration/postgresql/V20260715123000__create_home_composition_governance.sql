CREATE TABLE IF NOT EXISTS framework_home_section_catalog (
 section_code varchar(80) PRIMARY KEY,
 section_name varchar(160) NOT NULL,
 section_name_en varchar(160) NOT NULL,
 category_code varchar(50) NOT NULL,
 description_text varchar(600) NOT NULL DEFAULT '',
 component_key varchar(120) NOT NULL,
 implementation_status varchar(30) NOT NULL DEFAULT 'PLANNED',
 data_status varchar(30) NOT NULL DEFAULT 'NOT_CONNECTED',
 design_reference varchar(100) NOT NULL DEFAULT 'KRDS_GOV_DEFAULT',
 active_yn char(1) NOT NULL DEFAULT 'Y',
 created_at timestamp NOT NULL DEFAULT current_timestamp,
 updated_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS framework_home_composition_draft (
 page_variant varchar(30) NOT NULL,
 section_code varchar(80) NOT NULL REFERENCES framework_home_section_catalog(section_code),
 enabled_yn char(1) NOT NULL DEFAULT 'N',
 sort_order integer NOT NULL DEFAULT 0,
 audience_codes varchar(500) NOT NULL DEFAULT 'PUBLIC,AUTHENTICATED',
 updated_by varchar(100) NOT NULL DEFAULT 'SYSTEM',
 updated_at timestamp NOT NULL DEFAULT current_timestamp,
 PRIMARY KEY(page_variant, section_code)
);

CREATE TABLE IF NOT EXISTS framework_home_composition_version (
 version_id bigserial PRIMARY KEY,
 page_variant varchar(30) NOT NULL,
 version_no integer NOT NULL,
 configuration_json text NOT NULL,
 published_by varchar(100) NOT NULL,
 published_at timestamp NOT NULL DEFAULT current_timestamp,
 UNIQUE(page_variant, version_no)
);

INSERT INTO framework_home_section_catalog(section_code,section_name,section_name_en,category_code,description_text,component_key,implementation_status,data_status) VALUES
('SUMMARY','실시간 데이터 요약','Real-time data summary','DATA','탄소배출·프로젝트·인증 핵심 지표','SummarySection','IMPLEMENTED','SAMPLE'),
('CERTIFICATE_VERIFY','인증서 진위 확인','Certificate verification','SERVICE','공개 인증서와 보고서 검증 진입','CertificateVerificationSection','IMPLEMENTED','CONNECTED'),
('CORE_SERVICES','주요 서비스','Core services','NAVIGATION','핵심 업무 화면 빠른 진입','CoreServiceGrid','IMPLEMENTED','CONNECTED'),
('NOTICE_SUPPORT','공지·기술지원','Notices and support','CONTENT','공지사항과 기술지원 채널','ReferenceHomeLowerSection','IMPLEMENTED','SAMPLE'),
('NEWSLETTER','뉴스레터','Newsletter','CONTENT','정책·기술·교육 소식 수신 설정','NewsletterSection','IMPLEMENTED','CONNECTED'),
('REALTIME_DASHBOARD','통합 모니터링','Integrated monitoring','DATA','배출·감축·인증 운영 현황','RealtimeDashboardSection','IMPLEMENTED','SAMPLE'),
('MY_TASKS','내 업무 요약','My task summary','WORK','로그인 사용자의 담당 업무','MyTaskSummarySection','PLANNED','NOT_CONNECTED'),
('NEXT_TASK','다음 업무','Next task','WORK','프로세스 기준 다음 필수 작업','NextTaskSection','PLANNED','NOT_CONNECTED'),
('DEADLINE','마감·지연 업무','Deadlines and delays','WORK','마감 임박·지연 업무','DeadlineSection','PLANNED','NOT_CONNECTED'),
('APPROVAL','승인 대기','Pending approvals','WORK','검토·승인 대기 목록','ApprovalSection','PLANNED','NOT_CONNECTED'),
('ALERT','주요 알림','Priority alerts','WORK','업무·품질·시스템 알림','AlertSection','PLANNED','NOT_CONNECTED'),
('RECENT_PROJECT','최근 프로젝트','Recent projects','WORK','최근 접근 프로젝트','RecentProjectSection','PLANNED','NOT_CONNECTED'),
('FAVORITE','즐겨찾기','Favorites','NAVIGATION','사용자 즐겨찾기 메뉴','FavoriteSection','PLANNED','NOT_CONNECTED'),
('RECENT_MENU','최근 이용 메뉴','Recent menus','NAVIGATION','최근 이용 화면','RecentMenuSection','PLANNED','NOT_CONNECTED'),
('EMISSION_KPI','탄소배출 핵심 지표','Emission KPIs','DATA','Scope별 배출 핵심 지표','EmissionKpiSection','PLANNED','NOT_CONNECTED'),
('LCA_KPI','LCA 핵심 지표','LCA KPIs','DATA','제품·공정 LCA 핵심 지표','LcaKpiSection','PLANNED','NOT_CONNECTED'),
('REDUCTION_KPI','감축 목표·실적','Reduction targets','DATA','감축 목표 대비 실적','ReductionKpiSection','PLANNED','NOT_CONNECTED'),
('SITE_TREND','사업장 배출 추이','Site emission trend','DATA','조직·사업장 기간별 추이','SiteTrendSection','PLANNED','NOT_CONNECTED'),
('SCOPE_STATUS','Scope 1·2·3 현황','Scope status','DATA','Scope별 배출 구성','ScopeStatusSection','PLANNED','NOT_CONNECTED'),
('DATA_QUALITY','데이터 품질','Data quality','DATA','누락·오류·완전성 품질','DataQualitySection','PLANNED','NOT_CONNECTED'),
('ANOMALY','이상치·경보','Anomalies and alerts','DATA','이상치와 임계치 경보','AnomalySection','PLANNED','NOT_CONNECTED'),
('PROJECT_PROGRESS','프로젝트 진행률','Project progress','WORK','업무 단계별 프로젝트 진행률','ProjectProgressSection','PLANNED','NOT_CONNECTED'),
('REPORT_STATUS','보고서 제출 현황','Report status','WORK','보고서 작성·제출·승인 현황','ReportStatusSection','PLANNED','NOT_CONNECTED'),
('TRADE_STATUS','탄소·자원 거래 현황','Trade status','DATA','공급·수요·거래 진행 현황','TradeStatusSection','PLANNED','NOT_CONNECTED'),
('EDUCATION','교육 일정','Education schedule','CONTENT','교육 신청·진행 일정','EducationSection','PLANNED','NOT_CONNECTED'),
('POLICY','정책·제도','Policy and regulation','CONTENT','관련 정책·제도 변경','PolicySection','PLANNED','NOT_CONNECTED'),
('TECH_TREND','기술 동향','Technology trends','CONTENT','CCUS 기술·연구 동향','TechTrendSection','PLANNED','NOT_CONNECTED'),
('FAQ','자주 묻는 질문','FAQ','CONTENT','주요 질문과 답변','FaqSection','PLANNED','NOT_CONNECTED'),
('SERVICE_GUIDE','플랫폼 이용 가이드','Platform guide','CONTENT','액터별 단계형 이용 안내','ServiceGuideSection','PLANNED','NOT_CONNECTED')
ON CONFLICT(section_code) DO UPDATE SET section_name=excluded.section_name,section_name_en=excluded.section_name_en,category_code=excluded.category_code,description_text=excluded.description_text,component_key=excluded.component_key,implementation_status=excluded.implementation_status,data_status=excluded.data_status,updated_at=current_timestamp;

INSERT INTO ui_section_registry(section_id,section_name,section_type,layout_contract,responsive_contract,accessibility_contract,design_reference,asset_fingerprint)
SELECT 'HOME_'||section_code,section_name,'HOME_SECTION',component_key,'mobile-first; one column below 768px','labelled region, heading hierarchy, keyboard reachable',design_reference,md5(section_code||'|'||component_key)
FROM framework_home_section_catalog
ON CONFLICT(section_id) DO UPDATE SET section_name=excluded.section_name,layout_contract=excluded.layout_contract,responsive_contract=excluded.responsive_contract,accessibility_contract=excluded.accessibility_contract,design_reference=excluded.design_reference,asset_fingerprint=excluded.asset_fingerprint,active_yn='Y',updated_at=current_timestamp;

INSERT INTO framework_home_composition_draft(page_variant,section_code,enabled_yn,sort_order)
SELECT 'PUBLIC',section_code,CASE WHEN section_code IN ('SUMMARY','CERTIFICATE_VERIFY','CORE_SERVICES','NOTICE_SUPPORT','NEWSLETTER') THEN 'Y' ELSE 'N' END,
 CASE section_code WHEN 'SUMMARY' THEN 10 WHEN 'CERTIFICATE_VERIFY' THEN 20 WHEN 'CORE_SERVICES' THEN 30 WHEN 'NOTICE_SUPPORT' THEN 40 WHEN 'NEWSLETTER' THEN 50 ELSE 100 END
FROM framework_home_section_catalog ON CONFLICT(page_variant,section_code) DO NOTHING;

INSERT INTO framework_home_composition_version(page_variant,version_no,configuration_json,published_by)
SELECT 'PUBLIC',1,coalesce(json_agg(json_build_object('sectionCode',section_code,'enabled',enabled_yn='Y','sortOrder',sort_order) ORDER BY sort_order)::text,'[]'),'FLYWAY'
FROM framework_home_composition_draft d WHERE d.page_variant='PUBLIC'
HAVING NOT EXISTS (SELECT 1 FROM framework_home_composition_version WHERE page_variant='PUBLIC');

CREATE INDEX IF NOT EXISTS idx_home_composition_version_latest ON framework_home_composition_version(page_variant,version_no DESC);

INSERT INTO comtccmmndetailcode(code_id,code,code_nm,code_dc,use_at,frst_regist_pnttm,frst_register_id,last_updt_pnttm,last_updusr_id)
VALUES('AMENU1','A1110112','홈 구성 스튜디오','/admin/system/home-page-workbench','Y',current_timestamp,'HOME_COMPOSITION',current_timestamp,'HOME_COMPOSITION')
ON CONFLICT(code_id,code) DO UPDATE SET code_nm=excluded.code_nm,code_dc=excluded.code_dc,use_at='Y',last_updt_pnttm=current_timestamp,last_updusr_id='HOME_COMPOSITION';
INSERT INTO comtnmenuinfo(menu_code,menu_nm,menu_nm_en,menu_url,menu_icon,use_at,frst_regist_pnttm,last_updt_pnttm,expsr_at)
VALUES('A1110112','홈 구성 스튜디오','Home Composition Studio','/admin/system/home-page-workbench','dashboard_customize','Y',current_timestamp,current_timestamp,'Y')
ON CONFLICT(menu_code) DO UPDATE SET menu_nm=excluded.menu_nm,menu_nm_en=excluded.menu_nm_en,menu_url=excluded.menu_url,menu_icon=excluded.menu_icon,use_at='Y',expsr_at='Y',last_updt_pnttm=current_timestamp;
INSERT INTO comtnmenuorder(menu_code,sort_ordr,frst_regist_pnttm,last_updt_pnttm)
VALUES('A1110112',1110112,current_timestamp,current_timestamp)
ON CONFLICT(menu_code) DO UPDATE SET sort_ordr=excluded.sort_ordr,last_updt_pnttm=current_timestamp;
