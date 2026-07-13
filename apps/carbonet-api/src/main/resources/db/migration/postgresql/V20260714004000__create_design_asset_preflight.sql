ALTER TABLE ui_component_registry ADD COLUMN IF NOT EXISTS asset_fingerprint varchar(64);
ALTER TABLE comtncomponentinfo ADD COLUMN IF NOT EXISTS asset_fingerprint varchar(64);

CREATE TABLE IF NOT EXISTS ui_section_registry (
 section_id varchar(100) PRIMARY KEY, section_name varchar(180) NOT NULL, section_type varchar(40) NOT NULL,
 layout_contract text NOT NULL, responsive_contract text NOT NULL, accessibility_contract text NOT NULL,
 design_reference varchar(200), asset_fingerprint varchar(64), active_yn char(1) NOT NULL DEFAULT 'Y',
 created_at timestamp NOT NULL DEFAULT current_timestamp, updated_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS framework_design_preflight (
 preflight_id bigserial PRIMARY KEY, page_id varchar(120) NOT NULL, route_path varchar(400) NOT NULL,
 theme_id varchar(80), section_id varchar(100), component_id varchar(120), decision varchar(30) NOT NULL,
 asset_fingerprint varchar(64), evidence_json text NOT NULL DEFAULT '{}', executed_by varchar(100) NOT NULL,
 executed_at timestamp NOT NULL DEFAULT current_timestamp
);

INSERT INTO comtnthemedefinition(theme_id,theme_nm,theme_dc,theme_type,color_config,typography_config,spacing_config,border_config,shadow_config,class_prefix,is_default,is_active,sort_order,use_at,creat_pnttm,creat_user_id)
VALUES('KRDS_GOV_DEFAULT','KRDS 공공 기본 테마','공공기관 사용자·관리자 화면 공통 표준 테마','SYSTEM','{"primary":"#246BEB","navy":"#052B57","text":"#1D1D1D","surface":"#FFFFFF","background":"#F5F7FA","danger":"#D50136"}','{"family":"Pretendard, Noto Sans KR, sans-serif","scale":[12,14,16,18,24,32]}','{"unit":4,"containerMax":1280,"density":"adaptive"}','{"radius":[4,8,12,16],"focus":"2px solid #246BEB"}','{"card":"0 1px 3px rgba(0,0,0,.12)"}','krds-','Y','Y',1,'Y',current_timestamp,'FLYWAY')
ON CONFLICT(theme_id) DO UPDATE SET theme_nm=excluded.theme_nm,theme_dc=excluded.theme_dc,color_config=excluded.color_config,typography_config=excluded.typography_config,spacing_config=excluded.spacing_config,is_default='Y',is_active='Y',use_at='Y',updt_pnttm=current_timestamp,updt_user_id='FLYWAY';

INSERT INTO comtnthemeclassset(class_set_id,theme_id,class_set_nm,class_set_dc,target_component,base_classes,hover_classes,focus_classes,active_classes,disabled_classes,responsive_classes,sort_order,use_at,creat_pnttm,creat_user_id) VALUES
('KRDS_BUTTON_PRIMARY','KRDS_GOV_DEFAULT','주요 버튼','KRDS 주요 실행 버튼','BUTTON','inline-flex min-h-11 items-center justify-center rounded-lg bg-[#246beb] px-4 font-bold text-white','hover:bg-[#174ea6]','focus:outline-none focus:ring-2 focus:ring-blue-300','','disabled:opacity-50','w-full sm:w-auto',1,'Y',current_timestamp,'FLYWAY'),
('KRDS_FORM_CONTROL','KRDS_GOV_DEFAULT','입력 컨트롤','KRDS 입력·선택 공통','INPUT','min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3','hover:border-slate-400','focus:border-[#246beb] focus:outline-none focus:ring-2 focus:ring-blue-100','','disabled:bg-slate-100','text-sm sm:text-base',2,'Y',current_timestamp,'FLYWAY'),
('KRDS_CONTENT_CARD','KRDS_GOV_DEFAULT','콘텐츠 카드','KRDS 섹션 카드','SECTION','rounded-2xl border border-slate-200 bg-white p-5 shadow-sm','hover:border-blue-200','focus-within:ring-2 focus-within:ring-blue-100','','','p-4 sm:p-5 lg:p-6',3,'Y',current_timestamp,'FLYWAY')
ON CONFLICT(class_set_id) DO UPDATE SET base_classes=excluded.base_classes,hover_classes=excluded.hover_classes,focus_classes=excluded.focus_classes,responsive_classes=excluded.responsive_classes,use_at='Y',updt_pnttm=current_timestamp,updt_user_id='FLYWAY';

INSERT INTO ui_section_registry(section_id,section_name,section_type,layout_contract,responsive_contract,accessibility_contract,design_reference,asset_fingerprint) VALUES
('PAGE_HEADER','페이지 헤더','HEADER','title,breadcrumb,primary-action','stack below 768px','heading hierarchy and labelled actions','KRDS_GOV_DEFAULT',md5('header|title,breadcrumb,primary-action')),
('SUMMARY_METRICS','요약 지표','METRIC_GRID','2-4 metric cards','1 col 360,2 col 768,4 col 1280','values include labels and non-color state','KRDS_GOV_DEFAULT',md5('metric_grid|2-4')),
('SEARCH_FILTER','검색·필터','FILTER','keyword,filters,search,reset','controls wrap without overflow','all controls labelled and keyboard reachable','KRDS_GOV_DEFAULT',md5('filter|search')),
('WORK_TABLE','업무 목록','DATA_GRID','caption,thead,tbody,pagination','horizontal scroll only inside table','caption,scope,keyboard actions,status text','KRDS_GOV_DEFAULT',md5('data_grid|work')),
('DETAIL_WORKSPACE','상세 작업공간','WORKSPACE','summary,tabs,forms,history,actions','single column mobile','focus order,error summary,action confirmation','KRDS_GOV_DEFAULT',md5('workspace|detail'))
ON CONFLICT(section_id) DO UPDATE SET section_name=excluded.section_name,section_type=excluded.section_type,layout_contract=excluded.layout_contract,responsive_contract=excluded.responsive_contract,accessibility_contract=excluded.accessibility_contract,design_reference=excluded.design_reference,asset_fingerprint=excluded.asset_fingerprint,active_yn='Y',updated_at=current_timestamp;

UPDATE ui_component_registry SET asset_fingerprint=md5(lower(trim(coalesce(component_type,'')))||'|'||lower(trim(coalesce(component_name,'')))||'|'||coalesce(props_schema_json,'{}')||'|'||coalesce(design_reference,'')) WHERE asset_fingerprint IS NULL;
UPDATE comtncomponentinfo SET asset_fingerprint=md5(lower(trim(coalesce(component_type,'')))||'|'||lower(trim(coalesce(component_nm,'')))||'|'||coalesce(default_props,'{}')||'|'||coalesce(default_class_nm,'')) WHERE asset_fingerprint IS NULL;

CREATE INDEX IF NOT EXISTS idx_ui_component_registry_fingerprint ON ui_component_registry(asset_fingerprint) WHERE active_yn='Y';
CREATE INDEX IF NOT EXISTS idx_design_preflight_page ON framework_design_preflight(page_id,executed_at DESC);
