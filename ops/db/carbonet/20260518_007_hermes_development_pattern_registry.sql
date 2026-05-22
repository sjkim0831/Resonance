-- Hermes DB-backed development pattern registry.
-- Purpose: let Hermes resolve natural-language work requests into governed Carbonet work patterns.

CREATE TABLE IF NOT EXISTS hermes_development_pattern (
  pattern_id VARCHAR(80) NOT NULL,
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  category_code VARCHAR(40) NOT NULL,
  pattern_name VARCHAR(300) NOT NULL,
  pattern_summary CLOB,
  trigger_keywords CLOB,
  route_hints CLOB,
  module_hints CLOB,
  risk_level VARCHAR(30) DEFAULT 'MEDIUM' NOT NULL,
  skill_name VARCHAR(120),
  default_action_id VARCHAR(120),
  active_yn CHAR(1) DEFAULT 'Y' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (pattern_id)
);

CREATE INDEX idx_hermes_dev_pattern_category
  ON hermes_development_pattern (project_id, category_code, active_yn);

CREATE TABLE IF NOT EXISTS hermes_development_pattern_step (
  pattern_step_id VARCHAR(100) NOT NULL,
  pattern_id VARCHAR(80) NOT NULL,
  step_order INTEGER DEFAULT 0 NOT NULL,
  stage_code VARCHAR(80) NOT NULL,
  step_title VARCHAR(200) NOT NULL,
  step_instruction CLOB,
  expected_evidence CLOB,
  allowed_executor VARCHAR(80) DEFAULT 'CODEX_SCRIPT' NOT NULL,
  active_yn CHAR(1) DEFAULT 'Y' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (pattern_step_id)
);

CREATE INDEX idx_hermes_dev_pattern_step_order
  ON hermes_development_pattern_step (pattern_id, step_order, active_yn);

CREATE TABLE IF NOT EXISTS hermes_development_pattern_check (
  pattern_check_id VARCHAR(100) NOT NULL,
  pattern_id VARCHAR(80) NOT NULL,
  check_order INTEGER DEFAULT 0 NOT NULL,
  check_type VARCHAR(80) NOT NULL,
  command_template CLOB,
  pass_criteria CLOB,
  active_yn CHAR(1) DEFAULT 'Y' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (pattern_check_id)
);

CREATE INDEX idx_hermes_dev_pattern_check_order
  ON hermes_development_pattern_check (pattern_id, check_order, active_yn);

CREATE TABLE IF NOT EXISTS hermes_development_pattern_artifact_rule (
  artifact_rule_id VARCHAR(100) NOT NULL,
  pattern_id VARCHAR(80) NOT NULL,
  artifact_type VARCHAR(80) NOT NULL,
  path_glob VARCHAR(1000) NOT NULL,
  ownership_scope VARCHAR(120) NOT NULL,
  active_yn CHAR(1) DEFAULT 'Y' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (artifact_rule_id)
);

CREATE INDEX idx_hermes_dev_pattern_artifact
  ON hermes_development_pattern_artifact_rule (pattern_id, artifact_type, active_yn);

CREATE TABLE IF NOT EXISTS hermes_development_pattern_team_rule (
  team_rule_id VARCHAR(120) NOT NULL,
  pattern_id VARCHAR(80) NOT NULL,
  team_id VARCHAR(100) NOT NULL,
  team_role VARCHAR(40) NOT NULL,
  selection_reason CLOB,
  active_yn CHAR(1) DEFAULT 'Y' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (team_rule_id)
);

CREATE INDEX idx_hermes_dev_pattern_team_rule
  ON hermes_development_pattern_team_rule (pattern_id, team_role, active_yn);

CREATE TABLE IF NOT EXISTS hermes_pattern_match (
  hermes_pattern_match_id VARCHAR(100) NOT NULL,
  hermes_task_id VARCHAR(80) NOT NULL,
  pattern_id VARCHAR(80) NOT NULL,
  confidence_score DOUBLE DEFAULT 0 NOT NULL,
  matched_reason CLOB,
  selected_by VARCHAR(80) DEFAULT 'HERMES_RESOLVER' NOT NULL,
  accepted_yn CHAR(1) DEFAULT 'Y' NOT NULL,
  evidence_ref VARCHAR(1000),
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (hermes_pattern_match_id)
);

CREATE INDEX idx_hermes_pattern_match_task
  ON hermes_pattern_match (hermes_task_id, accepted_yn);

INSERT INTO hermes_development_pattern (pattern_id, category_code, pattern_name, pattern_summary, trigger_keywords, route_hints, module_hints, risk_level, skill_name, default_action_id)
SELECT 'BUILD_RESTART_18000', 'DEPLOY', 'Local build restart and freshness verification',
       'Local :18000 build, restart, and freshness evidence pattern.',
       '["18000","구동","재시작","빌드","로컬","freshness","runtime"]',
       '[":18000"]',
       '["frontend","apps/carbonet-app","ops/scripts"]',
       'MEDIUM', 'carbonet-fast-bootstrap-ops', 'build-restart-18000'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern WHERE pattern_id = 'BUILD_RESTART_18000');

INSERT INTO hermes_development_pattern (pattern_id, category_code, pattern_name, pattern_summary, trigger_keywords, route_hints, module_hints, risk_level, skill_name, default_action_id)
SELECT 'BUILD_REDEPLOY_80', 'DEPLOY', 'Production-like port 80 build and redeploy',
       'Remote or production-like port 80 build/redeploy pattern with route proof.',
       '["80포트","재배포","배포","프로덕션","구동해줘","빌드 재배포"]',
       '["http://172.16.1.232",":80"]',
       '["frontend","modules/resonance-common","ops/scripts"]',
       'HIGH', 'carbonet-runtime-topology-ops', 'deploy-80'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern WHERE pattern_id = 'BUILD_REDEPLOY_80');

INSERT INTO hermes_development_pattern (pattern_id, category_code, pattern_name, pattern_summary, trigger_keywords, route_hints, module_hints, risk_level, skill_name, default_action_id)
SELECT 'ADMIN_REACT_PAGE_CHANGE', 'FRONTEND', 'Admin React page behavior or label change',
       'Governed admin React page change pattern for labels, sorting, dropdowns, popups, and route UI.',
       '["관리자 화면","컬럼","라벨","정렬","드롭다운","팝업","화면","React"]',
       '["/admin/"]',
       '["frontend/src/features","frontend/src/app/routes","frontend/src/platform/screen-registry"]',
       'MEDIUM', 'admin-screen-unifier', 'frontend-build'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern WHERE pattern_id = 'ADMIN_REACT_PAGE_CHANGE');

INSERT INTO hermes_development_pattern (pattern_id, category_code, pattern_name, pattern_summary, trigger_keywords, route_hints, module_hints, risk_level, skill_name, default_action_id)
SELECT 'BACKEND_CONTROLLER_SERVICE_API_CHANGE', 'BACKEND', 'Spring controller service repository API change',
       'Spring backend API chain pattern across controller, service, repository, and DTO boundaries.',
       '["API","컨트롤러","서비스","백엔드","엔드포인트","조회","저장"]',
       '["/api/","/admin/api/"]',
       '["modules/carbonet-common-core/src/main/java","src/main/java"]',
       'MEDIUM', 'carbonet-feature-builder', 'backend-package'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern WHERE pattern_id = 'BACKEND_CONTROLLER_SERVICE_API_CHANGE');

INSERT INTO hermes_development_pattern (pattern_id, category_code, pattern_name, pattern_summary, trigger_keywords, route_hints, module_hints, risk_level, skill_name, default_action_id)
SELECT 'DB_SCHEMA_PATCH_CHANGE', 'DB', 'Governed DB schema or seed patch',
       'CUBRID-compatible schema, seed, or migration patch pattern.',
       '["DB","디비","테이블","컬럼","스키마","시드","마이그레이션","SQL"]',
       '[]',
       '["ops/db/carbonet","docs/sql"]',
       'HIGH', 'carbonet-audit-trace-architecture', 'db-schema-patch'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern WHERE pattern_id = 'DB_SCHEMA_PATCH_CHANGE');

INSERT INTO hermes_development_pattern (pattern_id, category_code, pattern_name, pattern_summary, trigger_keywords, route_hints, module_hints, risk_level, skill_name, default_action_id)
SELECT 'HERMES_PATTERN_REGISTRY_CHANGE', 'AI', 'Hermes DB-backed development pattern registry change',
       'Pattern registry, resolver, and Hermes workflow memory upgrade pattern.',
       '["에르메스","Hermes","패턴","작업 분류","에이전트","가이드","40B","모델","라우팅","컨텍스트","Skills","Docs","shadow"]',
       '["/admin/system/development-pattern-management"]',
       '["ops/hermes","ops/scripts/hermes-record-request.sh","ops/db/carbonet"]',
       'MEDIUM', 'resonance-ai-orchestrator', 'hermes-record-request'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern WHERE pattern_id = 'HERMES_PATTERN_REGISTRY_CHANGE');

INSERT INTO hermes_development_pattern (pattern_id, category_code, pattern_name, pattern_summary, trigger_keywords, route_hints, module_hints, risk_level, skill_name, default_action_id)
SELECT 'FULLSTACK_ADMIN_DB_API_CHANGE', 'FULLSTACK', 'Admin screen with backend API and DB change',
       'Admin React screen, Spring API, and CUBRID DB change pattern.',
       '["화면 API DB","API랑 DB","화면이랑 DB","프론트 백엔드 DB","풀스택","관리자 화면 API","DB 컬럼"]',
       '["/admin/","/api/"]',
       '["frontend/src/features","modules/carbonet-common-core/src/main/java","ops/db/carbonet"]',
       'HIGH', 'carbonet-feature-builder', 'fullstack-admin-db-api'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern WHERE pattern_id = 'FULLSTACK_ADMIN_DB_API_CHANGE');

INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'BUILD_RESTART_18000-010', 'BUILD_RESTART_18000', 10, 'REQUEST_CAPTURE', 'Request capture', '요청 원문과 대상 런타임을 기록한다.', 'raw_request, trace_id', 'HERMES'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'BUILD_RESTART_18000-010');
INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'BUILD_RESTART_18000-020', 'BUILD_RESTART_18000', 20, 'PRECHECK', 'Runtime precheck', 'git 상태와 기존 18000 프로세스/포트 상태를 확인한다.', 'git_status, pid_or_port_status', 'CODEX_SCRIPT'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'BUILD_RESTART_18000-020');
INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'BUILD_RESTART_18000-030', 'BUILD_RESTART_18000', 30, 'IMPLEMENT', 'Bounded implementation', '필요한 소스 변경 또는 설정 변경을 적용한다.', 'changed_files, patch_summary', 'CODEX'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'BUILD_RESTART_18000-030');
INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'BUILD_RESTART_18000-040', 'BUILD_RESTART_18000', 40, 'VERIFY', 'Freshness verification', 'ops/scripts/build-restart-18000.sh 후 freshness verifier를 실행한다.', 'build_log, runtime_jar_match, health_or_route_probe', 'CODEX_SCRIPT'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'BUILD_RESTART_18000-040');

INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'BUILD_REDEPLOY_80-010', 'BUILD_REDEPLOY_80', 10, 'REQUEST_CAPTURE', 'Deploy request capture', '대상 서버, 포트, 배포 범위를 기록한다.', 'raw_request, deploy_target', 'HERMES'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'BUILD_REDEPLOY_80-010');
INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'BUILD_REDEPLOY_80-020', 'BUILD_REDEPLOY_80', 20, 'PRECHECK', 'Remote deploy precheck', '원격 git 상태, 빌드 산출물, 현재 서비스 상태를 확인한다.', 'git_status, service_status', 'CODEX_SCRIPT'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'BUILD_REDEPLOY_80-020');
INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'BUILD_REDEPLOY_80-030', 'BUILD_REDEPLOY_80', 30, 'IMPLEMENT', 'Build and deploy', '프론트 빌드와 백엔드 패키징 후 지정 배포 스크립트를 실행한다.', 'build_log, deploy_log', 'CODEX_SCRIPT'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'BUILD_REDEPLOY_80-030');
INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'BUILD_REDEPLOY_80-040', 'BUILD_REDEPLOY_80', 40, 'VERIFY', 'Port 80 route proof', '80포트 URL과 핵심 관리자 라우트가 최신 산출물을 반환하는지 확인한다.', 'curl_status, route_probe', 'CODEX_SCRIPT'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'BUILD_REDEPLOY_80-040');

INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'ADMIN_REACT_PAGE_CHANGE-010', 'ADMIN_REACT_PAGE_CHANGE', 10, 'REQUEST_CAPTURE', 'Admin route request capture', '대상 관리자 라우트와 화면 요구사항을 기록한다.', 'route, requested_change', 'HERMES'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'ADMIN_REACT_PAGE_CHANGE-010');
INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'ADMIN_REACT_PAGE_CHANGE-020', 'ADMIN_REACT_PAGE_CHANGE', 20, 'SCOPE_ROUTE', 'Admin route scope', '라우트, manifest, feature 컴포넌트, API 호출 지점을 찾는다.', 'route_map, file_scope', 'CODEX'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'ADMIN_REACT_PAGE_CHANGE-020');
INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'ADMIN_REACT_PAGE_CHANGE-030', 'ADMIN_REACT_PAGE_CHANGE', 30, 'IMPLEMENT', 'Admin UI implementation', '기존 admin UI 패턴에 맞춰 화면 변경을 적용한다.', 'changed_files', 'CODEX'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'ADMIN_REACT_PAGE_CHANGE-030');
INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'ADMIN_REACT_PAGE_CHANGE-040', 'ADMIN_REACT_PAGE_CHANGE', 40, 'VERIFY', 'Frontend route verification', 'frontend build와 변경 라우트 응답을 확인한다.', 'npm_build, route_probe', 'CODEX_SCRIPT'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'ADMIN_REACT_PAGE_CHANGE-040');

INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'BACKEND_CONTROLLER_SERVICE_API_CHANGE-010', 'BACKEND_CONTROLLER_SERVICE_API_CHANGE', 10, 'REQUEST_CAPTURE', 'API contract capture', 'API 목적, 요청/응답, 권한 범위를 기록한다.', 'api_contract', 'HERMES'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'BACKEND_CONTROLLER_SERVICE_API_CHANGE-010');
INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'BACKEND_CONTROLLER_SERVICE_API_CHANGE-020', 'BACKEND_CONTROLLER_SERVICE_API_CHANGE', 20, 'SCOPE_ROUTE', 'Backend chain scope', 'controller, service, repository, DTO 경계를 찾는다.', 'backend_chain', 'CODEX'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'BACKEND_CONTROLLER_SERVICE_API_CHANGE-020');
INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'BACKEND_CONTROLLER_SERVICE_API_CHANGE-030', 'BACKEND_CONTROLLER_SERVICE_API_CHANGE', 30, 'IMPLEMENT', 'Backend implementation', '기존 패키지와 예외/응답 패턴에 맞춰 구현한다.', 'changed_files', 'CODEX'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'BACKEND_CONTROLLER_SERVICE_API_CHANGE-030');
INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'BACKEND_CONTROLLER_SERVICE_API_CHANGE-040', 'BACKEND_CONTROLLER_SERVICE_API_CHANGE', 40, 'VERIFY', 'Backend verification', 'Maven package와 필요 시 curl/API probe를 수행한다.', 'maven_package, api_probe', 'CODEX_SCRIPT'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'BACKEND_CONTROLLER_SERVICE_API_CHANGE-040');

INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'DB_SCHEMA_PATCH_CHANGE-010', 'DB_SCHEMA_PATCH_CHANGE', 10, 'REQUEST_CAPTURE', 'DB change capture', 'DB 변경 목적과 대상 테이블을 기록한다.', 'db_change_request', 'HERMES'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'DB_SCHEMA_PATCH_CHANGE-010');
INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'DB_SCHEMA_PATCH_CHANGE-020', 'DB_SCHEMA_PATCH_CHANGE', 20, 'PRECHECK', 'Schema precheck', '기존 스키마와 유사 migration을 확인한다.', 'schema_probe, existing_migration', 'CODEX_SCRIPT'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'DB_SCHEMA_PATCH_CHANGE-020');
INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'DB_SCHEMA_PATCH_CHANGE-030', 'DB_SCHEMA_PATCH_CHANGE', 30, 'IMPLEMENT', 'CUBRID SQL implementation', 'CUBRID 호환 SQL과 idempotent seed를 작성한다.', 'sql_file', 'CODEX'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'DB_SCHEMA_PATCH_CHANGE-030');
INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'DB_SCHEMA_PATCH_CHANGE-040', 'DB_SCHEMA_PATCH_CHANGE', 40, 'VERIFY', 'SQL and build verification', 'SQL 문법 리뷰와 관련 backend build를 수행한다.', 'sql_review, maven_package', 'CODEX_SCRIPT'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'DB_SCHEMA_PATCH_CHANGE-040');

INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'HERMES_PATTERN_REGISTRY_CHANGE-010', 'HERMES_PATTERN_REGISTRY_CHANGE', 10, 'REQUEST_CAPTURE', 'Hermes request capture', '자연어 요청과 기대되는 에이전트 보정 범위를 기록한다.', 'raw_request', 'HERMES'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'HERMES_PATTERN_REGISTRY_CHANGE-010');
INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'HERMES_PATTERN_REGISTRY_CHANGE-020', 'HERMES_PATTERN_REGISTRY_CHANGE', 20, 'SCOPE_ROUTE', 'Hermes memory scope', '기존 Hermes workflow, action registry, model lane, context pack, pattern docs를 매핑한다.', 'memory_sources, model_lane, context_pack', 'CODEX'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'HERMES_PATTERN_REGISTRY_CHANGE-020');
INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'HERMES_PATTERN_REGISTRY_CHANGE-030', 'HERMES_PATTERN_REGISTRY_CHANGE', 30, 'IMPLEMENT', 'Hermes registry implementation', '패턴 레지스트리/해석기/모델 라우팅 문서를 갱신한다.', 'sql, script, doc', 'CODEX'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'HERMES_PATTERN_REGISTRY_CHANGE-030');
INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'HERMES_PATTERN_REGISTRY_CHANGE-040', 'HERMES_PATTERN_REGISTRY_CHANGE', 40, 'VERIFY', 'Hermes resolver verification', 'resolver dry-run과 shell syntax 검사를 수행한다.', 'resolver_json, bash_n', 'CODEX_SCRIPT'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'HERMES_PATTERN_REGISTRY_CHANGE-040');

INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'FULLSTACK_ADMIN_DB_API_CHANGE-010', 'FULLSTACK_ADMIN_DB_API_CHANGE', 10, 'REQUEST_CAPTURE', 'Full-stack request capture', '대상 관리자 화면, API 계약, DB 변경 범위를 함께 기록한다.', 'route, api_contract, db_change_request', 'HERMES'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'FULLSTACK_ADMIN_DB_API_CHANGE-010');
INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'FULLSTACK_ADMIN_DB_API_CHANGE-020', 'FULLSTACK_ADMIN_DB_API_CHANGE', 20, 'SCOPE_ROUTE', 'Full-stack scope', '프론트 컴포넌트, controller/service/repository, SQL migration 경계를 한 번에 매핑한다.', 'frontend_scope, backend_chain, sql_scope', 'CODEX'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'FULLSTACK_ADMIN_DB_API_CHANGE-020');
INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'FULLSTACK_ADMIN_DB_API_CHANGE-030', 'FULLSTACK_ADMIN_DB_API_CHANGE', 30, 'PRECHECK', 'Full-stack precheck', '기존 화면/백엔드/DB 패턴과 유사 구현을 확인한다.', 'existing_pattern, schema_probe', 'CODEX_SCRIPT'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'FULLSTACK_ADMIN_DB_API_CHANGE-030');
INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'FULLSTACK_ADMIN_DB_API_CHANGE-040', 'FULLSTACK_ADMIN_DB_API_CHANGE', 40, 'IMPLEMENT', 'Full-stack implementation', 'DB migration, backend API, frontend binding 순서로 작게 구현한다.', 'sql_file, backend_files, frontend_files', 'CODEX'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'FULLSTACK_ADMIN_DB_API_CHANGE-040');
INSERT INTO hermes_development_pattern_step (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'FULLSTACK_ADMIN_DB_API_CHANGE-050', 'FULLSTACK_ADMIN_DB_API_CHANGE', 50, 'VERIFY', 'Full-stack verification', 'frontend build, Maven package, route/API probe를 수행한다.', 'npm_build, maven_package, route_or_api_probe', 'CODEX_SCRIPT'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'FULLSTACK_ADMIN_DB_API_CHANGE-050');

INSERT INTO hermes_development_pattern_check (pattern_check_id, pattern_id, check_order, check_type, command_template, pass_criteria)
SELECT 'BUILD_RESTART_18000-C010', 'BUILD_RESTART_18000', 10, 'BUILD', 'bash ops/scripts/build-restart-18000.sh', 'exit_code=0'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_check WHERE pattern_check_id = 'BUILD_RESTART_18000-C010');
INSERT INTO hermes_development_pattern_check (pattern_check_id, pattern_id, check_order, check_type, command_template, pass_criteria)
SELECT 'BUILD_RESTART_18000-C020', 'BUILD_RESTART_18000', 20, 'RUNTIME', 'VERIFY_WAIT_SECONDS=20 bash ops/scripts/codex-verify-18000-freshness.sh', 'pid_alive, port_listening, jar_match'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_check WHERE pattern_check_id = 'BUILD_RESTART_18000-C020');
INSERT INTO hermes_development_pattern_check (pattern_check_id, pattern_id, check_order, check_type, command_template, pass_criteria)
SELECT 'BUILD_REDEPLOY_80-C010', 'BUILD_REDEPLOY_80', 10, 'BUILD', 'cd frontend && npm run build', 'exit_code=0'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_check WHERE pattern_check_id = 'BUILD_REDEPLOY_80-C010');
INSERT INTO hermes_development_pattern_check (pattern_check_id, pattern_id, check_order, check_type, command_template, pass_criteria)
SELECT 'BUILD_REDEPLOY_80-C020', 'BUILD_REDEPLOY_80', 20, 'BUILD', 'mvn -q -DskipTests package', 'exit_code=0'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_check WHERE pattern_check_id = 'BUILD_REDEPLOY_80-C020');
INSERT INTO hermes_development_pattern_check (pattern_check_id, pattern_id, check_order, check_type, command_template, pass_criteria)
SELECT 'ADMIN_REACT_PAGE_CHANGE-C010', 'ADMIN_REACT_PAGE_CHANGE', 10, 'BUILD', 'cd frontend && npm run build', 'exit_code=0'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_check WHERE pattern_check_id = 'ADMIN_REACT_PAGE_CHANGE-C010');
INSERT INTO hermes_development_pattern_check (pattern_check_id, pattern_id, check_order, check_type, command_template, pass_criteria)
SELECT 'BACKEND_CONTROLLER_SERVICE_API_CHANGE-C010', 'BACKEND_CONTROLLER_SERVICE_API_CHANGE', 10, 'BUILD', 'mvn -q -DskipTests package', 'exit_code=0'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_check WHERE pattern_check_id = 'BACKEND_CONTROLLER_SERVICE_API_CHANGE-C010');
INSERT INTO hermes_development_pattern_check (pattern_check_id, pattern_id, check_order, check_type, command_template, pass_criteria)
SELECT 'DB_SCHEMA_PATCH_CHANGE-C010', 'DB_SCHEMA_PATCH_CHANGE', 10, 'SQL', 'rg -n "CREATE TABLE|INSERT INTO" ops/db/carbonet docs/sql', 'expected_objects_present'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_check WHERE pattern_check_id = 'DB_SCHEMA_PATCH_CHANGE-C010');
INSERT INTO hermes_development_pattern_check (pattern_check_id, pattern_id, check_order, check_type, command_template, pass_criteria)
SELECT 'HERMES_PATTERN_REGISTRY_CHANGE-C010', 'HERMES_PATTERN_REGISTRY_CHANGE', 10, 'SCRIPT', 'bash -n ops/scripts/hermes-record-request.sh ops/scripts/hermes-resolve-pattern.sh', 'exit_code=0'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_check WHERE pattern_check_id = 'HERMES_PATTERN_REGISTRY_CHANGE-C010');
INSERT INTO hermes_development_pattern_check (pattern_check_id, pattern_id, check_order, check_type, command_template, pass_criteria)
SELECT 'FULLSTACK_ADMIN_DB_API_CHANGE-C010', 'FULLSTACK_ADMIN_DB_API_CHANGE', 10, 'BUILD', 'cd frontend && npm run build', 'exit_code=0'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_check WHERE pattern_check_id = 'FULLSTACK_ADMIN_DB_API_CHANGE-C010');
INSERT INTO hermes_development_pattern_check (pattern_check_id, pattern_id, check_order, check_type, command_template, pass_criteria)
SELECT 'FULLSTACK_ADMIN_DB_API_CHANGE-C020', 'FULLSTACK_ADMIN_DB_API_CHANGE', 20, 'BUILD', 'mvn -q -DskipTests package', 'exit_code=0'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_check WHERE pattern_check_id = 'FULLSTACK_ADMIN_DB_API_CHANGE-C020');

INSERT INTO hermes_development_pattern_artifact_rule (artifact_rule_id, pattern_id, artifact_type, path_glob, ownership_scope)
SELECT 'ADMIN_REACT_PAGE_CHANGE-A010', 'ADMIN_REACT_PAGE_CHANGE', 'frontend', 'frontend/src/features/**', 'FRONTEND'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_artifact_rule WHERE artifact_rule_id = 'ADMIN_REACT_PAGE_CHANGE-A010');
INSERT INTO hermes_development_pattern_artifact_rule (artifact_rule_id, pattern_id, artifact_type, path_glob, ownership_scope)
SELECT 'BACKEND_CONTROLLER_SERVICE_API_CHANGE-A010', 'BACKEND_CONTROLLER_SERVICE_API_CHANGE', 'backend', 'modules/carbonet-common-core/src/main/java/**', 'BACKEND'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_artifact_rule WHERE artifact_rule_id = 'BACKEND_CONTROLLER_SERVICE_API_CHANGE-A010');
INSERT INTO hermes_development_pattern_artifact_rule (artifact_rule_id, pattern_id, artifact_type, path_glob, ownership_scope)
SELECT 'DB_SCHEMA_PATCH_CHANGE-A010', 'DB_SCHEMA_PATCH_CHANGE', 'sql', 'ops/db/carbonet/*.sql', 'DB_MIGRATION'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_artifact_rule WHERE artifact_rule_id = 'DB_SCHEMA_PATCH_CHANGE-A010');
INSERT INTO hermes_development_pattern_artifact_rule (artifact_rule_id, pattern_id, artifact_type, path_glob, ownership_scope)
SELECT 'HERMES_PATTERN_REGISTRY_CHANGE-A010', 'HERMES_PATTERN_REGISTRY_CHANGE', 'script', 'ops/scripts/hermes-*.sh', 'HERMES_SCRIPT'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_artifact_rule WHERE artifact_rule_id = 'HERMES_PATTERN_REGISTRY_CHANGE-A010');
INSERT INTO hermes_development_pattern_artifact_rule (artifact_rule_id, pattern_id, artifact_type, path_glob, ownership_scope)
SELECT 'FULLSTACK_ADMIN_DB_API_CHANGE-A010', 'FULLSTACK_ADMIN_DB_API_CHANGE', 'frontend', 'frontend/src/features/**', 'FRONTEND'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_artifact_rule WHERE artifact_rule_id = 'FULLSTACK_ADMIN_DB_API_CHANGE-A010');
INSERT INTO hermes_development_pattern_artifact_rule (artifact_rule_id, pattern_id, artifact_type, path_glob, ownership_scope)
SELECT 'FULLSTACK_ADMIN_DB_API_CHANGE-A020', 'FULLSTACK_ADMIN_DB_API_CHANGE', 'backend', 'modules/carbonet-common-core/src/main/java/**', 'BACKEND'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_artifact_rule WHERE artifact_rule_id = 'FULLSTACK_ADMIN_DB_API_CHANGE-A020');
INSERT INTO hermes_development_pattern_artifact_rule (artifact_rule_id, pattern_id, artifact_type, path_glob, ownership_scope)
SELECT 'FULLSTACK_ADMIN_DB_API_CHANGE-A030', 'FULLSTACK_ADMIN_DB_API_CHANGE', 'sql', 'ops/db/carbonet/*.sql', 'DB_MIGRATION'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_artifact_rule WHERE artifact_rule_id = 'FULLSTACK_ADMIN_DB_API_CHANGE-A030');

INSERT INTO hermes_development_pattern_team_rule (team_rule_id, pattern_id, team_id, team_role, selection_reason)
SELECT 'BUILD_RESTART_18000-T-required-build-release', 'BUILD_RESTART_18000', 'build-release', 'REQUIRED', '로컬 런타임 freshness와 재시작 증거가 핵심이다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_team_rule WHERE team_rule_id = 'BUILD_RESTART_18000-T-required-build-release');
INSERT INTO hermes_development_pattern_team_rule (team_rule_id, pattern_id, team_id, team_role, selection_reason)
SELECT 'BUILD_RESTART_18000-T-required-ops-control', 'BUILD_RESTART_18000', 'ops-control', 'REQUIRED', '서비스 상태와 헬스체크 확인이 필요하다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_team_rule WHERE team_rule_id = 'BUILD_RESTART_18000-T-required-ops-control');

INSERT INTO hermes_development_pattern_team_rule (team_rule_id, pattern_id, team_id, team_role, selection_reason)
SELECT 'BUILD_REDEPLOY_80-T-required-build-release', 'BUILD_REDEPLOY_80', 'build-release', 'REQUIRED', '80포트 배포는 빌드 산출물 검증이 선행되어야 한다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_team_rule WHERE team_rule_id = 'BUILD_REDEPLOY_80-T-required-build-release');
INSERT INTO hermes_development_pattern_team_rule (team_rule_id, pattern_id, team_id, team_role, selection_reason)
SELECT 'BUILD_REDEPLOY_80-T-gate-web-pod-ops', 'BUILD_REDEPLOY_80', 'web-pod-ops', 'GATE', '파드 readiness와 트래픽 전환 조건을 확인해야 한다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_team_rule WHERE team_rule_id = 'BUILD_REDEPLOY_80-T-gate-web-pod-ops');

INSERT INTO hermes_development_pattern_team_rule (team_rule_id, pattern_id, team_id, team_role, selection_reason)
SELECT 'ADMIN_REACT_PAGE_CHANGE-T-required-frontend-dev', 'ADMIN_REACT_PAGE_CHANGE', 'frontend-dev', 'REQUIRED', '관리자 React 화면 구현 범위 확인이 필요하다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_team_rule WHERE team_rule_id = 'ADMIN_REACT_PAGE_CHANGE-T-required-frontend-dev');
INSERT INTO hermes_development_pattern_team_rule (team_rule_id, pattern_id, team_id, team_role, selection_reason)
SELECT 'ADMIN_REACT_PAGE_CHANGE-T-required-design-layout', 'ADMIN_REACT_PAGE_CHANGE', 'design-layout', 'REQUIRED', '관리 화면 레이아웃과 공통 패턴 준수가 필요하다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_team_rule WHERE team_rule_id = 'ADMIN_REACT_PAGE_CHANGE-T-required-design-layout');

INSERT INTO hermes_development_pattern_team_rule (team_rule_id, pattern_id, team_id, team_role, selection_reason)
SELECT 'BACKEND_CONTROLLER_SERVICE_API_CHANGE-T-required-backend-dev', 'BACKEND_CONTROLLER_SERVICE_API_CHANGE', 'backend-dev', 'REQUIRED', 'controller/service/mapper 체인 구현이 필요하다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_team_rule WHERE team_rule_id = 'BACKEND_CONTROLLER_SERVICE_API_CHANGE-T-required-backend-dev');
INSERT INTO hermes_development_pattern_team_rule (team_rule_id, pattern_id, team_id, team_role, selection_reason)
SELECT 'BACKEND_CONTROLLER_SERVICE_API_CHANGE-T-gate-validation', 'BACKEND_CONTROLLER_SERVICE_API_CHANGE', 'validation', 'GATE', 'API 계약과 상태 전이를 검증해야 한다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_team_rule WHERE team_rule_id = 'BACKEND_CONTROLLER_SERVICE_API_CHANGE-T-gate-validation');

INSERT INTO hermes_development_pattern_team_rule (team_rule_id, pattern_id, team_id, team_role, selection_reason)
SELECT 'DB_SCHEMA_PATCH_CHANGE-T-required-db-cubrid', 'DB_SCHEMA_PATCH_CHANGE', 'db-cubrid', 'REQUIRED', 'CUBRID broker/migration guard 기준 검토가 필요하다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_team_rule WHERE team_rule_id = 'DB_SCHEMA_PATCH_CHANGE-T-required-db-cubrid');
INSERT INTO hermes_development_pattern_team_rule (team_rule_id, pattern_id, team_id, team_role, selection_reason)
SELECT 'DB_SCHEMA_PATCH_CHANGE-T-required-query-dev', 'DB_SCHEMA_PATCH_CHANGE', 'query-dev', 'REQUIRED', 'MyBatis SQL과 CUBRID 문법 검토가 필요하다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_team_rule WHERE team_rule_id = 'DB_SCHEMA_PATCH_CHANGE-T-required-query-dev');

INSERT INTO hermes_development_pattern_team_rule (team_rule_id, pattern_id, team_id, team_role, selection_reason)
SELECT 'FULLSTACK_ADMIN_DB_API_CHANGE-T-required-frontend-dev', 'FULLSTACK_ADMIN_DB_API_CHANGE', 'frontend-dev', 'REQUIRED', '화면 변경 범위 선별이 필요하다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_team_rule WHERE team_rule_id = 'FULLSTACK_ADMIN_DB_API_CHANGE-T-required-frontend-dev');
INSERT INTO hermes_development_pattern_team_rule (team_rule_id, pattern_id, team_id, team_role, selection_reason)
SELECT 'FULLSTACK_ADMIN_DB_API_CHANGE-T-required-backend-dev', 'FULLSTACK_ADMIN_DB_API_CHANGE', 'backend-dev', 'REQUIRED', 'API 체인 구현 범위 선별이 필요하다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_team_rule WHERE team_rule_id = 'FULLSTACK_ADMIN_DB_API_CHANGE-T-required-backend-dev');
INSERT INTO hermes_development_pattern_team_rule (team_rule_id, pattern_id, team_id, team_role, selection_reason)
SELECT 'FULLSTACK_ADMIN_DB_API_CHANGE-T-required-db-cubrid', 'FULLSTACK_ADMIN_DB_API_CHANGE', 'db-cubrid', 'REQUIRED', 'DB migration guard가 필요하다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_team_rule WHERE team_rule_id = 'FULLSTACK_ADMIN_DB_API_CHANGE-T-required-db-cubrid');
INSERT INTO hermes_development_pattern_team_rule (team_rule_id, pattern_id, team_id, team_role, selection_reason)
SELECT 'FULLSTACK_ADMIN_DB_API_CHANGE-T-gate-build-release', 'FULLSTACK_ADMIN_DB_API_CHANGE', 'build-release', 'GATE', '프론트/백엔드 빌드 검증 게이트가 필요하다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_team_rule WHERE team_rule_id = 'FULLSTACK_ADMIN_DB_API_CHANGE-T-gate-build-release');

INSERT INTO hermes_development_pattern_team_rule (team_rule_id, pattern_id, team_id, team_role, selection_reason)
SELECT 'HERMES_PATTERN_REGISTRY_CHANGE-T-required-codex55', 'HERMES_PATTERN_REGISTRY_CHANGE', 'codex55-execution-intelligence', 'REQUIRED', '요청 해석과 작업 단계 분해 정책을 변경한다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_team_rule WHERE team_rule_id = 'HERMES_PATTERN_REGISTRY_CHANGE-T-required-codex55');
INSERT INTO hermes_development_pattern_team_rule (team_rule_id, pattern_id, team_id, team_role, selection_reason)
SELECT 'HERMES_PATTERN_REGISTRY_CHANGE-T-gate-qa-audit', 'HERMES_PATTERN_REGISTRY_CHANGE', 'qa-audit', 'GATE', '자동 실행 전 증거와 감사 게이트를 확인한다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_team_rule WHERE team_rule_id = 'HERMES_PATTERN_REGISTRY_CHANGE-T-gate-qa-audit');

COMMIT;
