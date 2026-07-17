CREATE TABLE IF NOT EXISTS framework_development_work_type (
  work_type_code varchar(40) PRIMARY KEY,
  work_type_name varchar(120) NOT NULL,
  description text NOT NULL,
  execution_order integer NOT NULL,
  active_yn char(1) NOT NULL DEFAULT 'Y',
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS framework_development_work_template (
  work_type_code varchar(40) NOT NULL REFERENCES framework_development_work_type(work_type_code) ON DELETE CASCADE,
  task_code varchar(60) NOT NULL,
  task_name varchar(160) NOT NULL,
  job_type varchar(40) NOT NULL,
  trigger_scope varchar(30) NOT NULL,
  task_order integer NOT NULL,
  requirement_template text NOT NULL,
  target_pattern varchar(300) NOT NULL,
  required boolean NOT NULL DEFAULT true,
  auto_queue boolean NOT NULL DEFAULT true,
  active_yn char(1) NOT NULL DEFAULT 'Y',
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  PRIMARY KEY(work_type_code,task_code)
);

ALTER TABLE framework_development_job
  ADD COLUMN IF NOT EXISTS work_type_code varchar(40),
  ADD COLUMN IF NOT EXISTS template_task_code varchar(60);

CREATE INDEX IF NOT EXISTS idx_development_job_work_type
  ON framework_development_job(work_type_code,template_task_code,job_status);

INSERT INTO framework_development_work_type(work_type_code,work_type_name,description,execution_order) VALUES
 ('NEW_PAGE','신규 페이지','액터와 프로세스에 연결된 신규 업무 화면 개발',10),
 ('PAGE_CHANGE','페이지 수정','기존 화면 기능과 회귀 영향 수정',20),
 ('COMPONENT','컴포넌트 개발','공통 컴포넌트와 속성 계약 개발',30),
 ('COMPONENT_COMMON','컴포넌트 공통화','중복 구조와 클래스 및 속성 공통화',40),
 ('BACKEND_API','백엔드 API','권한과 트랜잭션을 포함한 API 개발',50),
 ('DATABASE','DB 변경','스키마와 인덱스 및 마이그레이션 개발',60),
 ('SEARCH','검색 개선','검색 대상과 정렬 및 인덱스 개선',70),
 ('UI_QUALITY','UI 품질','KRDS와 반응형 및 접근성 검증',80),
 ('PERFORMANCE','성능 개선','측정 기반 병목과 회귀 개선',90),
 ('DEPLOYMENT','배포','변경 범위 기반 최소 빌드와 무중단 배포',100),
 ('INCIDENT','장애 수정','원인과 재현 및 재발 방지 검증',110),
 ('SCREEN_COMPLETION','기존 화면 완성화','업무 가능성과 API 및 DB 연결 완성',120)
ON CONFLICT(work_type_code) DO UPDATE SET
 work_type_name=excluded.work_type_name,description=excluded.description,
 execution_order=excluded.execution_order,active_yn='Y',updated_at=current_timestamp;

INSERT INTO framework_development_work_template
 (work_type_code,task_code,task_name,job_type,trigger_scope,task_order,requirement_template,target_pattern,required,auto_queue) VALUES
 ('NEW_PAGE','DESIGN_PREFLIGHT','공통 디자인 자산 사전검사','DESIGN_PREFLIGHT','PAGE',10,'기존 테마·섹션·컴포넌트를 검색하고 재사용 여부를 증명한다.','quality/{process}/{step}/design-preflight',true,true),
 ('COMPONENT_COMMON','COMPONENT_REUSE','공통 컴포넌트 재사용·등록','COMPONENT_COMMON','PAGE',20,'동일 구조 컴포넌트를 재사용하고 페이지별 값만 인스턴스 속성으로 저장한다.','quality/{process}/{step}/component-common',true,true),
 ('COMPONENT_COMMON','CLASS_PROPERTY_COMMON','클래스·속성 공통화','CLASS_PROPERTY_COMMON','PAGE',30,'동일 CSS 클래스 세트와 속성 스키마를 공통 레지스트리에 통합하고 중복을 차단한다.','quality/{process}/{step}/class-property-common',true,true),
 ('UI_QUALITY','KRDS_RESPONSIVE_A11Y','KRDS·모바일·접근성 검사','UI_QUALITY','PAGE',40,'KRDS 토큰, 모바일 오버플로, WCAG 접근성, 폰트 및 레이아웃을 검증한다.','quality/{process}/{step}/ui-quality',true,true),
 ('SEARCH','SEARCH_IMPACT','메뉴·업무·게시글 검색 영향 검사','SEARCH','PAGE',50,'신규 경로와 업무 데이터가 통합 검색 및 인덱스에 포함되는지 검증한다.','quality/{process}/{step}/search-impact',true,true),
 ('BACKEND_API','API_CONTRACT_QUALITY','API·권한·트랜잭션 검사','API_QUALITY','API',60,'입출력 계약, 액터 권한, 멱등성, 트랜잭션과 오류 응답을 검증한다.','quality/{process}/{step}/api-quality',true,true),
 ('DATABASE','MIGRATION_ROLLBACK','DB 마이그레이션·롤백 검사','DATABASE_QUALITY','DATABASE',70,'Flyway 변경을 롤백 전제로 시험하고 데이터 보존 및 인덱스를 검증한다.','quality/{process}/{step}/database-quality',true,true),
 ('PERFORMANCE','CHANGE_PERFORMANCE','빌드·검색 성능 영향 측정','PERFORMANCE','ALWAYS',80,'변경 전후 빌드 시간과 검색 응답 시간 및 회귀 여부를 기록한다.','quality/{process}/{step}/performance',true,true),
 ('DEPLOYMENT','DEPLOYMENT_SELECTOR','최소 빌드·배포 방식 자동 선택','DEPLOYMENT','ALWAYS',90,'DB 정의, 프론트, Java 변경 범위를 판별하여 무빌드 또는 증분 빌드와 무중단 배포를 선택한다.','quality/{process}/{step}/deployment',true,true),
 ('SCREEN_COMPLETION','ACTOR_E2E_TEST','액터 종단간 업무 테스트','ACTOR_TEST','ALWAYS',100,'액터가 선행 화면부터 후속 화면까지 프로세스 기대값을 충족하는지 검증한다.','quality/{process}/{step}/actor-e2e',true,true)
ON CONFLICT(work_type_code,task_code) DO UPDATE SET
 task_name=excluded.task_name,job_type=excluded.job_type,trigger_scope=excluded.trigger_scope,
 task_order=excluded.task_order,requirement_template=excluded.requirement_template,
 target_pattern=excluded.target_pattern,required=excluded.required,auto_queue=excluded.auto_queue,
 active_yn='Y',updated_at=current_timestamp;
