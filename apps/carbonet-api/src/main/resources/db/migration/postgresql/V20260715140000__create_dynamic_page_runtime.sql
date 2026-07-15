CREATE TABLE IF NOT EXISTS framework_dynamic_page_version (
 version_id bigserial PRIMARY KEY,
 page_id varchar(100) NOT NULL,
 version_no integer NOT NULL,
 definition_json text NOT NULL,
 version_status varchar(20) NOT NULL DEFAULT 'PUBLISHED',
 published_by varchar(100) NOT NULL,
 published_at timestamp NOT NULL DEFAULT current_timestamp,
 UNIQUE(page_id,version_no)
);

CREATE TABLE IF NOT EXISTS framework_page_data_contract (
 contract_id varchar(120) PRIMARY KEY,
 page_id varchar(100) NOT NULL,
 binding_key varchar(100) NOT NULL,
 source_type varchar(30) NOT NULL,
 endpoint_path varchar(500),
 static_payload_json text,
 refresh_seconds integer NOT NULL DEFAULT 0,
 active_yn char(1) NOT NULL DEFAULT 'Y',
 updated_at timestamp NOT NULL DEFAULT current_timestamp,
 UNIQUE(page_id,binding_key)
);

CREATE TABLE IF NOT EXISTS framework_page_action_contract (
 action_id varchar(120) PRIMARY KEY,
 page_id varchar(100) NOT NULL,
 action_code varchar(80) NOT NULL,
 action_type varchar(30) NOT NULL,
 target_path varchar(500),
 http_method varchar(10),
 confirmation_text varchar(500),
 required_actor_codes varchar(500) NOT NULL DEFAULT '',
 active_yn char(1) NOT NULL DEFAULT 'Y',
 updated_at timestamp NOT NULL DEFAULT current_timestamp,
 UNIQUE(page_id,action_code)
);

INSERT INTO ui_page_manifest(page_id,page_name,route_path,domain_code,layout_version,design_token_version,active_yn,created_at,updated_at,data_source_config,page_title,page_url,page_title_en,component_schema,version_status,version_id)
VALUES('DYNAMIC_PLATFORM_OVERVIEW','동적 플랫폼 개요','/runtime/page?pageId=DYNAMIC_PLATFORM_OVERVIEW','HOME','1.0.0','KRDS_GOV_DEFAULT','Y',current_timestamp,current_timestamp,'{"mode":"STATIC"}','동적 플랫폼 개요','/runtime/page?pageId=DYNAMIC_PLATFORM_OVERVIEW','Dynamic Platform Overview','{"pageType":"DASHBOARD","description":"DB 정의만으로 즉시 조립된 화면입니다."}','PUBLISHED','1')
ON CONFLICT(page_id) DO UPDATE SET page_name=excluded.page_name,route_path=excluded.route_path,design_token_version=excluded.design_token_version,data_source_config=excluded.data_source_config,page_title=excluded.page_title,page_url=excluded.page_url,page_title_en=excluded.page_title_en,component_schema=excluded.component_schema,version_status='PUBLISHED',active_yn='Y',updated_at=current_timestamp;

INSERT INTO ui_component_registry(component_id,component_name,component_type,owner_domain,props_schema_json,design_reference,active_yn,created_at,updated_at,category,default_props,asset_fingerprint) VALUES
('DYN_OVERVIEW_HEADER','동적 화면 헤더','PAGE_HEADER','HOME','{}','KRDS_GOV_DEFAULT','Y',current_timestamp,current_timestamp,'DYNAMIC','{"eyebrow":"DB-Driven Runtime","title":"동적 플랫폼 개요","description":"화면·섹션·데이터·액션 계약을 DB에서 읽어 공통 런타임이 즉시 조립합니다."}',md5('PAGE_HEADER|DYN_OVERVIEW_HEADER')),
('DYN_OVERVIEW_KPI','동적 화면 지표','KPI_GRID','HOME','{}','KRDS_GOV_DEFAULT','Y',current_timestamp,current_timestamp,'DYNAMIC','{"items":[{"label":"등록 가능 화면","value":"1,000","unit":"개"},{"label":"공통 화면 유형","value":"15","unit":"종"},{"label":"빌드 필요","value":"0","unit":"회"},{"label":"테마","value":"KRDS","unit":"GOV"}]}',md5('KPI_GRID|DYN_OVERVIEW_KPI')),
('DYN_OVERVIEW_STEPS','동적 화면 절차','TIMELINE','HOME','{}','KRDS_GOV_DEFAULT','Y',current_timestamp,current_timestamp,'DYNAMIC','{"title":"화면 생성 절차","items":[{"title":"설계 계약 등록","description":"액터·프로세스·데이터·테스트를 정의합니다."},{"title":"DB 일괄 컴파일","description":"페이지와 컴포넌트 정의를 트랜잭션으로 등록합니다."},{"title":"즉시 렌더링","description":"공통 런타임이 새 정의를 다시 빌드하지 않고 출력합니다."}]}',md5('TIMELINE|DYN_OVERVIEW_STEPS')),
('DYN_OVERVIEW_TABLE','동적 화면 현황표','DATA_TABLE','HOME','{}','KRDS_GOV_DEFAULT','Y',current_timestamp,current_timestamp,'DYNAMIC','{"title":"런타임 지원 범위","columns":[{"key":"area","label":"영역"},{"key":"status","label":"상태"},{"key":"owner","label":"관리 기준"}],"rows":[{"area":"페이지·레이아웃","status":"지원","owner":"ui_page_manifest"},{"area":"컴포넌트 조립","status":"지원","owner":"ui_component_registry"},{"area":"데이터 바인딩","status":"지원","owner":"framework_page_data_contract"},{"area":"액션 계약","status":"지원","owner":"framework_page_action_contract"}]}',md5('DATA_TABLE|DYN_OVERVIEW_TABLE'))
ON CONFLICT(component_id) DO UPDATE SET component_name=excluded.component_name,component_type=excluded.component_type,design_reference=excluded.design_reference,default_props=excluded.default_props,asset_fingerprint=excluded.asset_fingerprint,active_yn='Y',updated_at=current_timestamp;

INSERT INTO ui_page_component_map(map_id,page_id,layout_zone,component_id,instance_key,display_order,conditional_rule_summary,created_at,updated_at) VALUES
('DYN_OVERVIEW_MAP_01','DYNAMIC_PLATFORM_OVERVIEW','header','DYN_OVERVIEW_HEADER','overview-header',10,'always',current_timestamp,current_timestamp),
('DYN_OVERVIEW_MAP_02','DYNAMIC_PLATFORM_OVERVIEW','summary','DYN_OVERVIEW_KPI','overview-kpi',20,'always',current_timestamp,current_timestamp),
('DYN_OVERVIEW_MAP_03','DYNAMIC_PLATFORM_OVERVIEW','content','DYN_OVERVIEW_STEPS','overview-steps',30,'always',current_timestamp,current_timestamp),
('DYN_OVERVIEW_MAP_04','DYNAMIC_PLATFORM_OVERVIEW','content','DYN_OVERVIEW_TABLE','overview-table',40,'always',current_timestamp,current_timestamp)
ON CONFLICT(map_id) DO UPDATE SET layout_zone=excluded.layout_zone,component_id=excluded.component_id,instance_key=excluded.instance_key,display_order=excluded.display_order,conditional_rule_summary=excluded.conditional_rule_summary,updated_at=current_timestamp;

INSERT INTO framework_dynamic_page_version(page_id,version_no,definition_json,published_by)
SELECT 'DYNAMIC_PLATFORM_OVERVIEW',1,'{"source":"FLYWAY","runtime":"DynamicPage"}','FLYWAY'
WHERE NOT EXISTS(SELECT 1 FROM framework_dynamic_page_version WHERE page_id='DYNAMIC_PLATFORM_OVERVIEW');

CREATE INDEX IF NOT EXISTS idx_dynamic_page_version_latest ON framework_dynamic_page_version(page_id,version_no DESC);
CREATE INDEX IF NOT EXISTS idx_page_data_contract_page ON framework_page_data_contract(page_id,active_yn);
CREATE INDEX IF NOT EXISTS idx_page_action_contract_page ON framework_page_action_contract(page_id,active_yn);
