CREATE TABLE IF NOT EXISTS framework_process_menu_policy (
  process_code varchar(80) NOT NULL REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
  audience varchar(20) NOT NULL CHECK (audience IN ('USER','ADMIN')),
  domain_code varchar(4) NOT NULL,
  domain_name varchar(200) NOT NULL,
  domain_name_en varchar(200) NOT NULL,
  group_code varchar(6) NOT NULL,
  group_name varchar(200) NOT NULL,
  group_name_en varchar(200) NOT NULL,
  icon_name varchar(80) NOT NULL DEFAULT 'task_alt',
  PRIMARY KEY(process_code,audience)
);

INSERT INTO framework_process_menu_policy VALUES
 ('EMISSION_PROJECT','USER','H102','탄소배출 관리','Carbon Emission Management','H10201','현황·프로젝트','Overview & Projects','eco'),
 ('EMISSION_PROJECT','ADMIN','A103','탄소배출 운영','Emission Operations','A10301','프로젝트 운영','Project Operations','fact_check')
ON CONFLICT(process_code,audience) DO UPDATE SET
 domain_code=excluded.domain_code,domain_name=excluded.domain_name,domain_name_en=excluded.domain_name_en,
 group_code=excluded.group_code,group_name=excluded.group_name,group_name_en=excluded.group_name_en,icon_name=excluded.icon_name;

ALTER TABLE framework_professional_screen_contract
  ADD COLUMN IF NOT EXISTS menu_code varchar(8),
  ADD COLUMN IF NOT EXISTS menu_visibility varchar(20) NOT NULL DEFAULT 'HIDDEN',
  ADD COLUMN IF NOT EXISTS menu_verified boolean NOT NULL DEFAULT false;

UPDATE framework_professional_screen_contract
SET menu_visibility=CASE
 WHEN route_path IN ('/emission/project_list','/admin/emission/management') THEN 'VISIBLE'
 ELSE 'HIDDEN' END
WHERE process_code='EMISSION_PROJECT';

CREATE TABLE IF NOT EXISTS framework_professional_factory_run (
  run_id uuid PRIMARY KEY,
  process_code varchar(80) NOT NULL REFERENCES framework_process_definition(process_code),
  requested_actor_code varchar(60) NOT NULL REFERENCES framework_actor_definition(actor_code),
  run_status varchar(30) NOT NULL DEFAULT 'RUNNING',
  menu_count integer NOT NULL DEFAULT 0,
  screen_count integer NOT NULL DEFAULT 0,
  scenario_count integer NOT NULL DEFAULT 0,
  development_job_count integer NOT NULL DEFAULT 0,
  blocked_step_count integer NOT NULL DEFAULT 0,
  result_json text NOT NULL DEFAULT '{}',
  requested_by varchar(100) NOT NULL,
  started_at timestamp NOT NULL DEFAULT current_timestamp,
  completed_at timestamp
);

CREATE INDEX IF NOT EXISTS idx_professional_factory_run_process
 ON framework_professional_factory_run(process_code,started_at DESC);

CREATE OR REPLACE VIEW framework_professional_screen_readiness AS
SELECT c.*,
  ((CASE WHEN length(trim(business_purpose))>=20 THEN 5 ELSE 0 END)+
   (CASE WHEN length(trim(entry_condition))>=10 AND length(trim(exit_condition))>=20 THEN 5 ELSE 0 END)+
   (CASE WHEN kpi_contract<>'[]' THEN 5 ELSE 0 END)+
   (CASE WHEN section_contract<>'[]' AND field_contract<>'[]' THEN 10 ELSE 0 END)+
   (CASE WHEN command_contract<>'[]' THEN 5 ELSE 0 END)+
   (CASE WHEN state_contract LIKE '%LOADING%' AND state_contract LIKE '%EMPTY%' AND state_contract LIKE '%ERROR%' AND state_contract LIKE '%FORBIDDEN%' THEN 10 ELSE 0 END)+
   (CASE WHEN api_contract<>'[]' AND data_contract<>'[]' THEN 5 ELSE 0 END)+
   (CASE WHEN evidence_contract<>'[]' THEN 5 ELSE 0 END)+
   (CASE WHEN menu_verified THEN 5 ELSE 0 END)+
   (CASE WHEN api_verified THEN 10 ELSE 0 END)+
   (CASE WHEN database_verified THEN 5 ELSE 0 END)+
   (CASE WHEN authority_verified THEN 10 ELSE 0 END)+
   (CASE WHEN responsive_verified THEN 5 ELSE 0 END)+
   (CASE WHEN accessibility_verified THEN 5 ELSE 0 END)+
   (CASE WHEN exception_states_verified THEN 5 ELSE 0 END)+
   (CASE WHEN audit_evidence_ref<>'' THEN 5 ELSE 0 END))::integer AS readiness_score,
  concat_ws(', ',
    CASE WHEN NOT menu_verified THEN 'DB 메뉴·화면·권한 연결' END,
    CASE WHEN api_contract='[]' OR NOT api_verified THEN '실 API 검증' END,
    CASE WHEN data_contract='[]' OR NOT database_verified THEN 'DB 영속성 검증' END,
    CASE WHEN NOT authority_verified THEN '액터·테넌트 권한 검증' END,
    CASE WHEN NOT responsive_verified THEN '반응형 검증' END,
    CASE WHEN NOT accessibility_verified THEN '접근성 검증' END,
    CASE WHEN NOT exception_states_verified THEN '로딩·빈값·오류·권한없음 상태 검증' END,
    CASE WHEN audit_evidence_ref='' THEN '브라우저 E2E 증적' END
  ) AS readiness_gaps
FROM framework_professional_screen_contract c;
