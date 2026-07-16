CREATE TABLE IF NOT EXISTS framework_professional_screen_contract (
  contract_id bigserial PRIMARY KEY,
  process_code varchar(80) NOT NULL REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
  step_code varchar(100) NOT NULL,
  audience varchar(20) NOT NULL CHECK (audience IN ('USER','ADMIN')),
  route_path varchar(400) NOT NULL,
  screen_name varchar(200) NOT NULL,
  actor_code varchar(60) NOT NULL REFERENCES framework_actor_definition(actor_code),
  business_purpose text NOT NULL,
  entry_condition text NOT NULL,
  exit_condition text NOT NULL,
  kpi_contract text NOT NULL DEFAULT '[]',
  section_contract text NOT NULL DEFAULT '[]',
  field_contract text NOT NULL DEFAULT '[]',
  command_contract text NOT NULL DEFAULT '[]',
  state_contract text NOT NULL DEFAULT '["LOADING","EMPTY","ERROR","FORBIDDEN","READY"]',
  api_contract text NOT NULL DEFAULT '[]',
  data_contract text NOT NULL DEFAULT '[]',
  evidence_contract text NOT NULL DEFAULT '[]',
  responsive_contract text NOT NULL DEFAULT '360px, 768px, 1280px에서 핵심 업무와 주요 명령을 손실 없이 제공한다.',
  accessibility_contract text NOT NULL DEFAULT 'KRDS 및 WCAG 2.1 AA: 키보드, 포커스, 레이블, 오류 안내, 명도 기준을 충족한다.',
  security_contract text NOT NULL DEFAULT '테넌트·프로젝트·액터 권한과 업무 분리를 서버에서 검증한다.',
  api_verified boolean NOT NULL DEFAULT false,
  database_verified boolean NOT NULL DEFAULT false,
  authority_verified boolean NOT NULL DEFAULT false,
  responsive_verified boolean NOT NULL DEFAULT false,
  accessibility_verified boolean NOT NULL DEFAULT false,
  exception_states_verified boolean NOT NULL DEFAULT false,
  audit_evidence_ref text NOT NULL DEFAULT '',
  contract_status varchar(30) NOT NULL DEFAULT 'REVIEW_REQUIRED',
  updated_by varchar(100) NOT NULL DEFAULT 'SYSTEM',
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(process_code,step_code,audience,route_path)
);

CREATE INDEX IF NOT EXISTS idx_professional_screen_contract_process
  ON framework_professional_screen_contract(process_code,step_code,contract_status);

INSERT INTO framework_professional_screen_contract(
  process_code,step_code,audience,route_path,screen_name,actor_code,
  business_purpose,entry_condition,exit_condition,kpi_contract,section_contract,
  field_contract,command_contract,api_contract,data_contract,evidence_contract
)
SELECT s.process_code,s.step_code,x.audience,x.route_path,
       s.step_name||CASE x.audience WHEN 'ADMIN' THEN ' 관리자 업무 화면' ELSE ' 사용자 업무 화면' END,
       s.actor_code,s.requirement_text,s.from_state||' 상태이며 해당 액터가 프로젝트에 배정되어 있다.',
       s.completion_rule,
       '["진행률","마감·지연","차단 오류","담당자"]',
       '["업무 문맥·진행 상태","검색·필터","핵심 데이터 작업공간","증적·이력","다음 업무"]',
       CASE s.step_code
         WHEN 'EMISSION_PROJECT_SETUP' THEN '["프로젝트명","조직·사업장","산정기간","Scope","책임자","마감일"]'
         WHEN 'EMISSION_PROJECT_COLLECT' THEN '["활동자료","값","단위","기간","출처","증빙","품질 상태"]'
         WHEN 'EMISSION_PROJECT_CALCULATE' THEN '["활동자료","배출계수","단위 환산","계산식","배출량","버전"]'
         WHEN 'EMISSION_PROJECT_VALIDATE' THEN '["검증 규칙","오류 위치","심각도","근거","조치 상태"]'
         WHEN 'EMISSION_PROJECT_CORRECT' THEN '["보완 요청","영향 범위","변경 사유","재산정 결과","재검증 상태"]'
         WHEN 'EMISSION_PROJECT_APPROVE' THEN '["검토 의견","확정 버전","승인자","승인 일시","반려 사유"]'
         WHEN 'EMISSION_PROJECT_REPORT' THEN '["보고서 버전","발급 상태","제출처","정규화 데이터셋","OCR","시각 지문"]'
         ELSE '["업무 식별자","상태","담당자","변경 일시"]' END,
       json_build_array(s.command_code,'임시저장','증적첨부','다음 업무 이동')::text,
       coalesce(nullif(s.api_contract,''),'["업무 조회","검증","저장·명령","이력 조회"]'),
       '["tenantId","projectId","processCode","stepCode","actorCode","version","audit fields"]',
       '["요청·응답 증적","상태 전이","권한 판정","감사 이벤트","화면 E2E"]'
FROM framework_process_step s
CROSS JOIN LATERAL (VALUES
  ('USER',nullif(s.user_path,'')),('ADMIN',nullif(s.admin_path,''))
) x(audience,route_path)
WHERE s.process_code='EMISSION_PROJECT' AND x.route_path IS NOT NULL
ON CONFLICT(process_code,step_code,audience,route_path) DO UPDATE SET
  screen_name=excluded.screen_name, actor_code=excluded.actor_code,
  business_purpose=excluded.business_purpose, entry_condition=excluded.entry_condition,
  exit_condition=excluded.exit_condition, updated_at=current_timestamp;

CREATE OR REPLACE VIEW framework_professional_screen_readiness AS
SELECT c.*,
  ((CASE WHEN length(trim(business_purpose))>=20 THEN 5 ELSE 0 END)+
   (CASE WHEN length(trim(entry_condition))>=10 AND length(trim(exit_condition))>=20 THEN 10 ELSE 0 END)+
   (CASE WHEN kpi_contract<>'[]' THEN 5 ELSE 0 END)+
   (CASE WHEN section_contract<>'[]' AND field_contract<>'[]' THEN 10 ELSE 0 END)+
   (CASE WHEN command_contract<>'[]' THEN 5 ELSE 0 END)+
   (CASE WHEN state_contract LIKE '%LOADING%' AND state_contract LIKE '%EMPTY%' AND state_contract LIKE '%ERROR%' AND state_contract LIKE '%FORBIDDEN%' THEN 10 ELSE 0 END)+
   (CASE WHEN api_contract<>'[]' AND data_contract<>'[]' THEN 10 ELSE 0 END)+
   (CASE WHEN evidence_contract<>'[]' THEN 5 ELSE 0 END)+
   (CASE WHEN api_verified THEN 10 ELSE 0 END)+
   (CASE WHEN database_verified THEN 5 ELSE 0 END)+
   (CASE WHEN authority_verified THEN 10 ELSE 0 END)+
   (CASE WHEN responsive_verified THEN 5 ELSE 0 END)+
   (CASE WHEN accessibility_verified THEN 5 ELSE 0 END)+
   (CASE WHEN exception_states_verified THEN 5 ELSE 0 END)+
   (CASE WHEN audit_evidence_ref<>'' THEN 5 ELSE 0 END))::integer AS readiness_score,
  concat_ws(', ',
    CASE WHEN api_contract='[]' OR NOT api_verified THEN '실 API 검증' END,
    CASE WHEN data_contract='[]' OR NOT database_verified THEN 'DB 영속성 검증' END,
    CASE WHEN NOT authority_verified THEN '액터·테넌트 권한 검증' END,
    CASE WHEN NOT responsive_verified THEN '반응형 검증' END,
    CASE WHEN NOT accessibility_verified THEN '접근성 검증' END,
    CASE WHEN NOT exception_states_verified THEN '로딩·빈값·오류·권한없음 상태 검증' END,
    CASE WHEN audit_evidence_ref='' THEN '브라우저 E2E 증적' END
  ) AS readiness_gaps
FROM framework_professional_screen_contract c;
