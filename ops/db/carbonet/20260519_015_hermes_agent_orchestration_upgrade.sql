-- Hermes agent-team and model orchestration upgrade.
-- Purpose: make Hermes route every Carbonet development request through
-- team selection, DB-backed pattern/RAG retrieval, model lane selection,
-- layout-first planning, deterministic verification, and reflection.

CREATE TABLE IF NOT EXISTS hermes_agent_team_registry (
  team_id VARCHAR(120) NOT NULL,
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  team_order INTEGER DEFAULT 0 NOT NULL,
  team_name VARCHAR(240) NOT NULL,
  service_name VARCHAR(240),
  default_start_mode VARCHAR(80),
  primary_model VARCHAR(200),
  fallback_model VARCHAR(200),
  model_lane_json CLOB,
  scope_summary CLOB,
  team_source_ref VARCHAR(1000),
  active_yn CHAR(1) DEFAULT 'Y' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (team_id)
);

CREATE INDEX idx_hermes_agent_team_order
  ON hermes_agent_team_registry (project_id, active_yn, team_order);

CREATE TABLE IF NOT EXISTS hermes_agent_component_registry (
  agent_component_id VARCHAR(160) NOT NULL,
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  team_id VARCHAR(120) NOT NULL,
  component_order INTEGER DEFAULT 0 NOT NULL,
  component_name VARCHAR(240) NOT NULL,
  component_role CLOB,
  autonomy_level VARCHAR(80),
  preferred_lane VARCHAR(80),
  allowed_action CLOB,
  stop_condition CLOB,
  active_yn CHAR(1) DEFAULT 'Y' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (agent_component_id)
);

CREATE INDEX idx_hermes_agent_component_team
  ON hermes_agent_component_registry (project_id, team_id, active_yn, component_order);

CREATE TABLE IF NOT EXISTS hermes_work_kind_model_route (
  work_kind_id VARCHAR(120) NOT NULL,
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  route_order INTEGER DEFAULT 0 NOT NULL,
  work_kind_name VARCHAR(240) NOT NULL,
  trigger_hint_json CLOB,
  primary_team_ids_json CLOB,
  gate_team_ids_json CLOB,
  support_lane_json CLOB,
  required_preflight_json CLOB,
  required_quality_dimension_json CLOB,
  escalation_rule CLOB,
  active_yn CHAR(1) DEFAULT 'Y' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (work_kind_id)
);

CREATE INDEX idx_hermes_work_kind_order
  ON hermes_work_kind_model_route (project_id, active_yn, route_order);

CREATE TABLE IF NOT EXISTS hermes_model_candidate_registry (
  candidate_model_id VARCHAR(160) NOT NULL,
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  candidate_order INTEGER DEFAULT 0 NOT NULL,
  model_name VARCHAR(300) NOT NULL,
  model_file VARCHAR(500),
  candidate_role VARCHAR(240),
  status VARCHAR(80) DEFAULT 'CANDIDATE' NOT NULL,
  allowed_use CLOB,
  forbidden_use CLOB,
  benchmark_gate CLOB,
  source_ref VARCHAR(1000),
  active_yn CHAR(1) DEFAULT 'Y' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (candidate_model_id)
);

CREATE INDEX idx_hermes_model_candidate_status
  ON hermes_model_candidate_registry (project_id, status, active_yn, candidate_order);

CREATE TABLE IF NOT EXISTS hermes_agent_gap_registry (
  agent_gap_id VARCHAR(160) NOT NULL,
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  gap_order INTEGER DEFAULT 0 NOT NULL,
  gap_area VARCHAR(120) NOT NULL,
  gap_name VARCHAR(240) NOT NULL,
  gap_summary CLOB,
  mitigation_policy CLOB,
  status VARCHAR(80) DEFAULT 'OPEN' NOT NULL,
  evidence_ref VARCHAR(1000),
  active_yn CHAR(1) DEFAULT 'Y' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (agent_gap_id)
);

CREATE INDEX idx_hermes_agent_gap_status
  ON hermes_agent_gap_registry (project_id, status, active_yn, gap_order);

INSERT INTO hermes_agent_team_registry
  (team_id, team_order, team_name, service_name, default_start_mode, primary_model, fallback_model, model_lane_json, scope_summary, team_source_ref)
SELECT 'codex55-execution-intelligence', 10, 'Codex 5.5급 실행 지능팀',
       'carbonet-ai-team-codex55-execution-intelligence.service', 'on-demand',
       'Qwen/Qwen2.5-Coder-7B-Instruct', 'qwen3.6-40b-deck-opus-q4',
       '["dev-classify","fast-draft","judge","verify"]',
       '작업 분해, context pack 선택, 구현 순서, 검증 증거, 실패 해석 보조',
       '/opt/Resonance/var/ai-agent-teams/ai-agent-teams.json'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_agent_team_registry WHERE team_id = 'codex55-execution-intelligence');

INSERT INTO hermes_agent_team_registry
  (team_id, team_order, team_name, service_name, default_start_mode, primary_model, fallback_model, model_lane_json, scope_summary, team_source_ref)
SELECT 'framework-builder', 20, 'Carbonet 프레임워크 빌더팀',
       'carbonet-ai-team-framework-builder.service', 'on-demand',
       'Qwen/Qwen2.5-Coder-7B-Instruct', 'Qwen/Qwen2.5-Coder-14B-Instruct',
       '["dev-classify","fast-draft","mid-draft","verify"]',
       '관리자 화면, 메뉴/권한, React migration, Spring service, MyBatis mapper, DB patch 개발',
       '/opt/Resonance/var/ai-agent-teams/ai-agent-teams.json'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_agent_team_registry WHERE team_id = 'framework-builder');

INSERT INTO hermes_agent_team_registry
  (team_id, team_order, team_name, service_name, default_start_mode, primary_model, fallback_model, model_lane_json, scope_summary, team_source_ref)
SELECT 'design-specialist', 30, 'KRDS/Carbonet 디자인 전문팀',
       'carbonet-ai-team-design-specialist.service', 'on-demand',
       'gemma4-e4b-cpu-shadow', 'Qwen/Qwen2.5-Coder-7B-Instruct',
       '["design-specialist","translation","fast-draft"]',
       'KRDS, Carbonet admin density, layout-first planning, theme token, UI copy, accessibility',
       '/opt/Resonance/var/ai-agent-teams/ai-agent-teams.json'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_agent_team_registry WHERE team_id = 'design-specialist');

INSERT INTO hermes_agent_team_registry
  (team_id, team_order, team_name, service_name, default_start_mode, primary_model, fallback_model, model_lane_json, scope_summary, team_source_ref)
SELECT 'development-rag-governor', 40, '개발 RAG/패턴 기억팀',
       'carbonet-ai-team-development-rag-governor.service', 'on-demand',
       'Qwen/Qwen2.5-Coder-7B-Instruct', 'qwen3.6-40b-deck-opus-q4',
       '["dev-classify","fast-draft","verify"]',
       'development RAG, page quality score, pattern binding, similar work retrieval, branch decision',
       '/opt/Resonance/var/ai-agent-teams/ai-agent-teams.json'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_agent_team_registry WHERE team_id = 'development-rag-governor');

INSERT INTO hermes_agent_team_registry
  (team_id, team_order, team_name, service_name, default_start_mode, primary_model, fallback_model, model_lane_json, scope_summary, team_source_ref)
SELECT 'model-benchmark', 50, '모델 벤치마크/승격팀',
       'carbonet-ai-team-model-benchmark.service', 'manual',
       'Qwen/Qwen2.5-Coder-7B-Instruct', 'qwen3.6-40b-deck-opus-q4',
       '["agent-candidate","supergemma26-benchmark","judge"]',
       'Qwen3.5, 14B, SuperGemma 26B 등 후보 모델의 Carbonet 개발 벤치마크와 승격/rollback gate',
       '/opt/Resonance/var/ai-agent-teams/ai-agent-teams.json'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_agent_team_registry WHERE team_id = 'model-benchmark');

INSERT INTO hermes_agent_component_registry
  (agent_component_id, team_id, component_order, component_name, component_role, autonomy_level, preferred_lane, allowed_action, stop_condition)
SELECT 'agent-task-decomposer', 'codex55-execution-intelligence', 10, 'Task Decomposer',
       '요청을 scope/frontend/backend/database/scripts/verification/memory 단계로 분해한다.', 'draft', 'dev-classify',
       '작업 분해와 context pack 초안 작성', '권한/DB/배포/보안 판단은 judge 또는 deterministic gate로 승격'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_agent_component_registry WHERE agent_component_id = 'agent-task-decomposer');

INSERT INTO hermes_agent_component_registry
  (agent_component_id, team_id, component_order, component_name, component_role, autonomy_level, preferred_lane, allowed_action, stop_condition)
SELECT 'agent-page-contract-planner', 'framework-builder', 10, 'Page Contract Planner',
       'route/menu/page manifest, section/field/action/API/DB 계약을 구현 전 확정한다.', 'draft', 'fast-draft',
       '완성 sibling pattern 기반 구현 초안 작성', 'API/DB/권한 계약이 바뀌면 40B judge와 DB patch gate 필요'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_agent_component_registry WHERE agent_component_id = 'agent-page-contract-planner');

INSERT INTO hermes_agent_component_registry
  (agent_component_id, team_id, component_order, component_name, component_role, autonomy_level, preferred_lane, allowed_action, stop_condition)
SELECT 'agent-layout-first-planner', 'design-specialist', 10, 'Layout First Planner',
       '레이아웃, 섹션 밀도, action bar, table/form 구조를 구현 전 설계한다.', 'draft', 'design-specialist',
       '디자인 DB/RAG 기반 layout and visual consistency draft', '생산 코드 단독 작성 금지'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_agent_component_registry WHERE agent_component_id = 'agent-layout-first-planner');

INSERT INTO hermes_agent_component_registry
  (agent_component_id, team_id, component_order, component_name, component_role, autonomy_level, preferred_lane, allowed_action, stop_condition)
SELECT 'agent-rag-retriever', 'development-rag-governor', 10, 'RAG Retriever',
       '완성된 sibling page, 실패/수정 이력, design/theme/backend 패턴을 조회한다.', 'recommend', 'dev-classify',
       'DB-backed RAG and similar-work retrieval', 'RAG 근거가 없으면 새 reference 후보로 기록하고 임의 구현 중단'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_agent_component_registry WHERE agent_component_id = 'agent-rag-retriever');

INSERT INTO hermes_agent_component_registry
  (agent_component_id, team_id, component_order, component_name, component_role, autonomy_level, preferred_lane, allowed_action, stop_condition)
SELECT 'agent-promotion-gate', 'model-benchmark', 10, 'Promotion Gate',
       'candidate -> shadow -> canary -> active 승격과 금지 작업 범위를 판정한다.', 'gate', 'agent-candidate',
       '후보 모델 benchmark scoring and promotion recommendation', 'normal request 중 모델 다운로드 또는 후보 모델 단독 source write 금지'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_agent_component_registry WHERE agent_component_id = 'agent-promotion-gate');

INSERT INTO hermes_model_lane_policy
  (lane_id, lane_order, lane_name, task_kind_json, preferred_model, preferred_base_url, fallback_model_json, allowed_work, escalation_rule_json, download_policy)
SELECT 'design-specialist', 34, 'Gemma4 KRDS and Carbonet design specialist lane',
       '["krds-design","layout-plan","theme-token-review","visual-consistency","copy-tone","screen-serviceability-review"]',
       'gemma4-e4b-cpu-shadow',
       'http://127.0.0.1:24451/v1',
       '["qwen2.5-coder-7b-instruct-shadow","qwen3.6-40b-deck-opus-q4"]',
       'Layout planning, KRDS and Carbonet design pattern review, copy consistency, theme-token mapping, accessibility checklist, and UI gap scoring. It may not write production source alone.',
       '["business_logic_unclear","authority_scope_missing","api_or_db_contract_needed","visual_change_conflicts_with_registered_theme"]',
       'LOCAL_REGISTERED_ONLY'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_model_lane_policy WHERE lane_id = 'design-specialist');

INSERT INTO hermes_model_lane_policy
  (lane_id, lane_order, lane_name, task_kind_json, preferred_model, preferred_base_url, fallback_model_json, allowed_work, escalation_rule_json, download_policy, active_yn)
SELECT 'supergemma26-benchmark', 46, 'SuperGemma 26B main-load reduction benchmark lane',
       '["main-load-reduction-benchmark","korean-coding-candidate","long-context-candidate"]',
       'Jiunsong/supergemma4-26b-uncensored-gguf-v2:Q4_K_M',
       '',
       '["qwen2.5-coder-14b-q4_k_m","qwen3.6-40b-deck-opus-q4"]',
       'Offline benchmark candidate for reducing 40B usage. It must pass Carbonet route, DB, permission, design, and verification benchmarks before any promotion.',
       '["normal_request_execution","source_write_needed","security_or_permission","db_migration","deploy","benchmark_not_recorded"]',
       'BENCHMARK_SETUP_ONLY',
       'N'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_model_lane_policy WHERE lane_id = 'supergemma26-benchmark');

INSERT INTO hermes_model_candidate_registry
  (candidate_model_id, candidate_order, model_name, model_file, candidate_role, status, allowed_use, forbidden_use, benchmark_gate, source_ref)
SELECT 'candidate-supergemma4-26b-uncensored-gguf-v2', 10,
       'Jiunsong/supergemma4-26b-uncensored-gguf-v2',
       'supergemma4-26b-uncensored-fast-v2-Q4_K_M.gguf',
       '40B main-load reduction candidate for Korean/coding/general reasoning',
       'BENCHMARK_ONLY',
       'Offline benchmark and manual comparison only after separate model setup.',
       'Normal Hermes request execution, DB migration, deploy, security, authority, payment, or unreviewed source write.',
       'Must pass Carbonet page/serviceability, DB/permission, design, Korean, and build-verification benchmark set before shadow/canary.',
       'https://huggingface.co/Jiunsong/supergemma4-26b-uncensored-gguf-v2'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_model_candidate_registry WHERE candidate_model_id = 'candidate-supergemma4-26b-uncensored-gguf-v2');

INSERT INTO hermes_model_candidate_registry
  (candidate_model_id, candidate_order, model_name, model_file, candidate_role, status, allowed_use, forbidden_use, benchmark_gate, source_ref)
SELECT 'candidate-qwen25-coder-14b', 20,
       'qwen2.5-coder-14b-q4_k_m',
       '',
       'Optional stronger pattern-draft lane after 7B',
       'ENDPOINT_REQUIRED',
       'Use as mid-draft only after a local endpoint is registered and health checks pass.',
       'Unbounded source edits, DB migration, deploy, authority/security changes without 40B/Codex review.',
       'Endpoint health, prompt latency, and page implementation diff quality must beat 7B on repeated Carbonet tasks.',
       'ops/hermes/model-routing-policy.seed.json'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_model_candidate_registry WHERE candidate_model_id = 'candidate-qwen25-coder-14b');

INSERT INTO hermes_model_candidate_registry
  (candidate_model_id, candidate_order, model_name, model_file, candidate_role, status, allowed_use, forbidden_use, benchmark_gate, source_ref)
SELECT 'candidate-carbonet-design-specialist', 30,
       'carbonet-krds-design-specialist',
       '',
       'Future fine-tuned design specialist for KRDS and Carbonet screen patterns',
       'DATASET_BUILDING',
       'Use design/theme/RAG DB now; fine-tune later from accepted page manifests, screenshots, tokens, and verification evidence.',
       'Immediate production generation without accepted dataset, deterministic UI checks, or human/Codex review.',
       'Requires curated accepted/rejected examples, visual regression checks, accessibility checks, and serviceability scoring.',
       'system_design_pattern_registry, system_theme_token_registry, system_development_rag_chunk'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_model_candidate_registry WHERE candidate_model_id = 'candidate-carbonet-design-specialist');

INSERT INTO hermes_work_kind_model_route
  (work_kind_id, route_order, work_kind_name, trigger_hint_json, primary_team_ids_json, gate_team_ids_json, support_lane_json, required_preflight_json, required_quality_dimension_json, escalation_rule)
SELECT 'AI_ORCHESTRATION_POLICY', 10, 'Hermes agent/team/model orchestration policy',
       '["에르메스","ai-agent-teams","모델 라우팅","7B","4B","14B","26B","supergemma","RAG","개발 패턴"]',
       '["planning","codex55-execution-intelligence","development-rag-governor"]',
       '["qa-audit","build-release"]',
       '["dev-classify","fast-draft","design-specialist","agent-candidate","judge","verify"]',
       '["AGENT_TEAM_FIRST","DEVELOPMENT_RAG","MODEL_LANE_LOCAL_FIRST"]',
       '["RAG_REFERENCE","SERVICE_READINESS"]',
       '26B and unpromoted candidates are benchmark-only; normal work must use registered local 4B/7B/14B/40B lanes.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_work_kind_model_route WHERE work_kind_id = 'AI_ORCHESTRATION_POLICY');

INSERT INTO hermes_work_kind_model_route
  (work_kind_id, route_order, work_kind_name, trigger_hint_json, primary_team_ids_json, gate_team_ids_json, support_lane_json, required_preflight_json, required_quality_dimension_json, escalation_rule)
SELECT 'ADMIN_FULLSTACK_SERVICE_PAGE', 20, 'Serviceable admin fullstack page development',
       '["관리자 화면","빈 페이지","프론트만","실사용","서비스 가능","비즈니스 로직"]',
       '["planning","framework-builder","frontend-dev","backend-dev","db-cubrid"]',
       '["design-specialist","validation","qa-audit","build-release"]',
       '["dev-classify","fast-draft","design-specialist","mid-draft","judge","verify"]',
       '["QUALITY_SCORE_FIRST","PAGE_DESIGN_CONTRACT","DEVELOPMENT_RAG","AUTHORITY_AUDIT_TRACE","LAYOUT_FIRST_CONTRACT"]',
       '["MENU_ROUTE_SCOPE","FRONTEND_SURFACE","DATA_API_CONTRACT","BUSINESS_LOGIC","AUTHORITY_AUDIT_TRACE","DB_STORAGE_AUDIT","SERVICE_READINESS"]',
       'Security, permission, DB migration, shared API/DTO/mapper contracts, architecture, or failed verification escalates to 40B judge.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_work_kind_model_route WHERE work_kind_id = 'ADMIN_FULLSTACK_SERVICE_PAGE');

INSERT INTO hermes_work_kind_model_route
  (work_kind_id, route_order, work_kind_name, trigger_hint_json, primary_team_ids_json, gate_team_ids_json, support_lane_json, required_preflight_json, required_quality_dimension_json, escalation_rule)
SELECT 'FRONTEND_LAYOUT_DESIGN', 30, 'Frontend layout and design quality improvement',
       '["디자인","레이아웃","KRDS","테마","CSS","퍼블리싱","화면 개선"]',
       '["planning","design-specialist","frontend-dev"]',
       '["krds-theme","qa-audit"]',
       '["design-specialist","translation","fast-draft","verify"]',
       '["PAGE_DESIGN_CONTRACT","DEVELOPMENT_RAG","DESIGN_THEME_REGISTRY_FIRST","LAYOUT_FIRST_CONTRACT"]',
       '["FRONTEND_SURFACE","DESIGN_MANIFEST_HELP","RAG_REFERENCE","SERVICE_READINESS"]',
       'Design specialist drafts are advisory; Codex implements and deterministic route/visual/serviceability checks decide.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_work_kind_model_route WHERE work_kind_id = 'FRONTEND_LAYOUT_DESIGN');

INSERT INTO hermes_work_kind_model_route
  (work_kind_id, route_order, work_kind_name, trigger_hint_json, primary_team_ids_json, gate_team_ids_json, support_lane_json, required_preflight_json, required_quality_dimension_json, escalation_rule)
SELECT 'MODEL_BENCHMARK_PROMOTION', 40, 'Local model benchmark and promotion',
       '["14B","26B","supergemma","후보 모델","벤치마크","승격","메인 사용량"]',
       '["model-benchmark","codex55-execution-intelligence"]',
       '["qa-audit","build-release"]',
       '["agent-candidate","supergemma26-benchmark","judge","verify"]',
       '["AGENT_TEAM_FIRST","MODEL_LANE_LOCAL_FIRST","MODEL_BENCHMARK_GATE"]',
       '["RAG_REFERENCE","SERVICE_READINESS"]',
       'Candidate models cannot run normal work until benchmark rows, health checks, and promotion gate evidence exist.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_work_kind_model_route WHERE work_kind_id = 'MODEL_BENCHMARK_PROMOTION');

INSERT INTO system_development_preflight_route
  (preflight_route_id, project_id, route_order, route_code, route_name, route_instruction, query_table_list, required_output, stop_condition)
SELECT 'preflight-050-agent-team-first', 'carbonet', 50, 'AGENT_TEAM_FIRST', 'Select agent teams before execution',
       'Before Hermes writes or asks a model to draft, read /opt/Resonance/var/ai-agent-teams/ai-agent-teams.json plus hermes_agent_team_registry and select required/gate/support teams.',
       'hermes_agent_team_registry, hermes_agent_component_registry, hermes_work_kind_model_route, /opt/Resonance/var/ai-agent-teams/ai-agent-teams.json',
       'selected_required_teams, selected_gate_teams, selected_support_lanes, missing_team_ids',
       'If no team/work-kind route is selected, stop and classify the request again.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM system_development_preflight_route WHERE preflight_route_id = 'preflight-050-agent-team-first');

INSERT INTO system_development_preflight_route
  (preflight_route_id, project_id, route_order, route_code, route_name, route_instruction, query_table_list, required_output, stop_condition)
SELECT 'preflight-060-layout-first-contract', 'carbonet', 60, 'LAYOUT_FIRST_CONTRACT', 'Design layout and service contract first',
       'For page work, design layout, section, field, action, API, DB, authority, audit, and verification contract before source edits.',
       'system_page_design_registry, system_page_design_section_plan, system_page_design_field_plan, system_page_design_action_plan, system_theme_token_registry, system_design_pattern_registry',
       'layout_plan, section_plan, field_plan, action_plan, api_contract, db_contract, authority_audit_contract',
       'If layout/API/DB/authority contract is missing, do not start broad source implementation.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM system_development_preflight_route WHERE preflight_route_id = 'preflight-060-layout-first-contract');

INSERT INTO system_development_preflight_route
  (preflight_route_id, project_id, route_order, route_code, route_name, route_instruction, query_table_list, required_output, stop_condition)
SELECT 'preflight-070-model-benchmark-gate', 'carbonet', 70, 'MODEL_BENCHMARK_GATE', 'Candidate model promotion gate',
       'Before using 14B, 26B, or future design-specialist models as more than advisory helpers, read candidate status and benchmark gates.',
       'hermes_model_candidate_registry, hermes_model_lane_policy, hermes_agent_gap_registry',
       'candidate_status, allowed_use, forbidden_use, benchmark_gate, promotion_decision',
       'If candidate status is BENCHMARK_ONLY, ENDPOINT_REQUIRED, or DATASET_BUILDING, do not use it for normal source-writing work.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM system_development_preflight_route WHERE preflight_route_id = 'preflight-070-model-benchmark-gate');

INSERT INTO hermes_work_execution_guard_policy
  (guard_policy_id, guard_order, guard_code, guard_stage, guard_name, policy_instruction, required_evidence, stop_condition, rework_condition, restore_condition)
SELECT 'WG-021-AGENT-TEAM-FIRST', 21, 'AGENT_TEAM_FIRST', 'SCOPE_ROUTE',
       'Select agent teams before model drafting',
       'Every Hermes request must read the agent-team registry, choose required/gate/support teams, and include the selected teams in the task steps before implementation.',
       'team_source, required_teams, gate_teams, support_teams, missing_team_ids',
       'If no team is selected for a non-trivial request, stop and rerun pattern resolution.',
       'If teams conflict with file ownership or risk, reclassify work-kind and split scope.',
       'Team source and selected teams are stored in hermes_context_pack.agent_team_context.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_work_execution_guard_policy WHERE guard_policy_id = 'WG-021-AGENT-TEAM-FIRST');

INSERT INTO hermes_work_execution_guard_policy
  (guard_policy_id, guard_order, guard_code, guard_stage, guard_name, policy_instruction, required_evidence, stop_condition, rework_condition, restore_condition)
SELECT 'WG-022-LAYOUT-FIRST', 22, 'LAYOUT_FIRST_SERVICEABILITY', 'PRECHECK',
       'Design layout and contracts before service-page source edits',
       'For page development, confirm layout, sections, fields, actions, API, DB, authority, audit, and verification evidence before implementation. The target is service-ready, not placeholder-ready.',
       'layout_plan, section_plan, field_plan, action_plan, api_contract, db_contract, authority_audit_contract, verification_plan',
       'If the plan only says to copy design HTML or create a hollow page, stop and require a serviceability contract.',
       'If implementation drifts from the plan, update branch_decision and rerun serviceability checks.',
       'Previous page quality score and branch decision are the restore anchor.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_work_execution_guard_policy WHERE guard_policy_id = 'WG-022-LAYOUT-FIRST');

INSERT INTO hermes_work_execution_guard_policy
  (guard_policy_id, guard_order, guard_code, guard_stage, guard_name, policy_instruction, required_evidence, stop_condition, rework_condition, restore_condition)
SELECT 'WG-023-MODEL-CANDIDATE-GATE', 23, 'MODEL_CANDIDATE_GATE', 'PRECHECK',
       'Keep 14B/26B/design specialist candidates behind benchmark gates',
       '14B, 26B, and future fine-tuned design models may reduce 40B load only after endpoint, benchmark, safety, and promotion evidence exists. Until then, they are advisory or benchmark-only.',
       'candidate_status, allowed_use, forbidden_use, benchmark_gate, promotion_decision',
       'If a candidate model is selected for normal work while BENCHMARK_ONLY, ENDPOINT_REQUIRED, or DATASET_BUILDING, stop and select 7B/40B fallback.',
       'Record failed benchmark or missing endpoint as setup work, not as normal request failure.',
       'Candidate registry row and benchmark evidence restore the previous routing policy.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_work_execution_guard_policy WHERE guard_policy_id = 'WG-023-MODEL-CANDIDATE-GATE');

INSERT INTO hermes_agent_gap_registry
  (agent_gap_id, gap_order, gap_area, gap_name, gap_summary, mitigation_policy, status, evidence_ref)
SELECT 'gap-hermes-team-first-routing', 10, 'orchestration', 'Team-first routing was implicit',
       'Hermes could infer teams through pattern rules, but the source of truth team registry and DB route were not explicit enough for every request.',
       'Use /opt/Resonance/var/ai-agent-teams/ai-agent-teams.json, hermes_agent_team_registry, and hermes_work_kind_model_route before model drafting.',
       'MITIGATED',
       '20260519_015_hermes_agent_orchestration_upgrade.sql'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_agent_gap_registry WHERE agent_gap_id = 'gap-hermes-team-first-routing');

INSERT INTO hermes_agent_gap_registry
  (agent_gap_id, gap_order, gap_area, gap_name, gap_summary, mitigation_policy, status, evidence_ref)
SELECT 'gap-design-specialist-finetune', 20, 'design', 'No accepted fine-tuned KRDS design model yet',
       'A design specialist model should not be fine-tuned from incomplete examples; accepted pages, manifests, tokens, screenshots, and verification evidence are needed first.',
       'Use design/theme/RAG DB now. Build dataset from service-ready pages and rejected examples before LoRA/fine-tune promotion.',
       'DATASET_BUILDING',
       'system_design_pattern_registry, system_theme_token_registry, system_development_rag_chunk'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_agent_gap_registry WHERE agent_gap_id = 'gap-design-specialist-finetune');

INSERT INTO hermes_agent_gap_registry
  (agent_gap_id, gap_order, gap_area, gap_name, gap_summary, mitigation_policy, status, evidence_ref)
SELECT 'gap-supergemma26-benchmark', 30, 'model', 'SuperGemma 26B is not promoted',
       'The 26B candidate may reduce 40B load, but it is an uncensored community GGUF and must not become a default worker without benchmark and safety evidence.',
       'Keep as BENCHMARK_ONLY. Use 7B primary and 40B judge for normal development until promotion gate passes.',
       'BENCHMARK_REQUIRED',
       'https://huggingface.co/Jiunsong/supergemma4-26b-uncensored-gguf-v2'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_agent_gap_registry WHERE agent_gap_id = 'gap-supergemma26-benchmark');

INSERT INTO hermes_development_pattern
  (pattern_id, category_code, pattern_name, pattern_summary, trigger_keywords, route_hints, module_hints, risk_level, skill_name, default_action_id)
SELECT 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE',
       'AI',
       'Hermes agent team and model lane orchestration change',
       'Hermes agent team, DB-backed RAG/pattern, local model lane, candidate benchmark, and layout-first development policy change.',
       '["에르메스","Hermes","에이전트 팀","ai-agent-teams","모델 라우팅","7B","7비","4B","4비","14B","14비","26B","26비","supergemma","디자인 전문","파인튜닝","KRDS","RAG","개발 패턴","코덱스 5.5"]',
       '["/admin/system/codex-request","/admin/system/development-pattern-management"]',
       '["/opt/Resonance/var/ai-agent-teams/ai-agent-teams.json","ops/hermes/model-routing-policy.seed.json","ops/scripts/hermes-record-request.sh","ops/scripts/hermes-resolve-pattern.sh","ops/db/carbonet"]',
       'MEDIUM',
       'resonance-ai-orchestrator',
       'hermes-agent-orchestration-upgrade'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern WHERE pattern_id = 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE');

INSERT INTO hermes_development_pattern
  (pattern_id, category_code, pattern_name, pattern_summary, trigger_keywords, route_hints, module_hints, risk_level, skill_name, default_action_id)
SELECT 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT',
       'FULLSTACK',
       'Layout-first serviceable admin page development',
       'Service-ready page development pattern: layout, design DB/RAG, frontend, backend, DB, authority, audit, and verification must close together.',
       '["실사용","서비스 가능","빈 페이지","프론트만","페이지 개발","관리자 화면","비즈니스 로직","레이아웃부터","디자인 꼼꼼","200여개","갭 후보"]',
       '["/admin"]',
       '["frontend/src/features","modules/carbonet-common-core/src/main/java","modules/carbonet-common-core/src/main/resources","ops/db/carbonet","frontend/src/generated/pageDesignRegistryInventory.json","frontend/src/generated/developmentRagInventory.json"]',
       'HIGH',
       'carbonet-feature-builder',
       'layout-first-page-build'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern WHERE pattern_id = 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT');

INSERT INTO hermes_development_pattern_step
  (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE-010', 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE', 10, 'REQUEST_CAPTURE',
       'Capture orchestration request',
       '요청을 에이전트 개선, 모델 라우팅, 개발 품질 게이트, DB 패턴 갱신으로 분해한다.',
       'raw_request, affected_policy_files, requested_model_candidates',
       'HERMES'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE-010');

INSERT INTO hermes_development_pattern_step
  (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE-020', 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE', 20, 'SCOPE_ROUTE',
       'Team and DB memory route',
       '/opt/Resonance/var/ai-agent-teams/ai-agent-teams.json, model-routing-policy, DB 패턴/RAG 테이블을 먼저 조회한다.',
       'team_registry, model_lane_policy, pattern_registry, development_rag',
       'CODEX_SCRIPT'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE-020');

INSERT INTO hermes_development_pattern_step
  (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE-030', 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE', 30, 'PRECHECK',
       'Model lane and candidate gate',
       '4B/7B/14B/40B lane 역할과 26B candidate 금지/허용 범위를 확정한다.',
       'lane_decision, benchmark_only_candidates, escalation_rules',
       'CODEX_SCRIPT'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE-030');

INSERT INTO hermes_development_pattern_step
  (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE-040', 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE', 40, 'IMPLEMENT',
       'Update Hermes orchestration',
       'Hermes script, seed JSON, DB patch, routing docs를 같은 정책으로 갱신한다.',
       'script_diff, seed_diff, sql_patch, docs_diff',
       'CODEX'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE-040');

INSERT INTO hermes_development_pattern_step
  (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE-050', 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE', 50, 'VERIFY',
       'Verify orchestration policy',
       'JSON parse, bash syntax, resolver dry-run, DB 적용 결과를 검증한다.',
       'node_json_parse, bash_n, resolver_json, db_counts',
       'CODEX_SCRIPT'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE-050');

INSERT INTO hermes_development_pattern_step
  (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT-010', 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT', 10, 'REQUEST_CAPTURE',
       'Capture target page and skip decision',
       '대상 route/page/menu와 이미 완성된 화면 skip 후보를 확정한다.',
       'target_route, page_id, current_quality_score, skip_decision',
       'HERMES'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT-010');

INSERT INTO hermes_development_pattern_step
  (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT-020', 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT', 20, 'SCOPE_ROUTE',
       'Read page design and RAG',
       'page design registry, quality score, development RAG, design/theme DB를 조회한다.',
       'page_design_rows, quality_dimensions, rag_hits, theme_tokens',
       'CODEX_SCRIPT'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT-020');

INSERT INTO hermes_development_pattern_step
  (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT-030', 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT', 30, 'PRECHECK',
       'Layout and service contract first',
       '레이아웃, 섹션, 필드, 액션, API, DB, 권한, 감사 계약을 작업 전 설계한다.',
       'layout_plan, field_plan, action_plan, api_contract, db_plan, authority_scope',
       'CODEX_SCRIPT'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT-030');

INSERT INTO hermes_development_pattern_step
  (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT-040', 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT', 40, 'IMPLEMENT',
       'Implement serviceable page',
       '기존 React 화면 수준에 맞춰 프론트, 백엔드, mapper, SQL, 메뉴/권한 메타데이터를 구현한다.',
       'source_diff, sql_patch, manifest_update',
       'CODEX'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT-040');

INSERT INTO hermes_development_pattern_step
  (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT-050', 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT', 50, 'VERIFY',
       'Verify page serviceability',
       '빌드, route 접속, API/DB proof, placeholder 제거, 권한/감사 동작을 검증한다.',
       'npm_build, maven_package, route_probe, api_probe, db_rows, audit_trace',
       'CODEX_SCRIPT'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT-050');

INSERT INTO hermes_development_pattern_check
  (pattern_check_id, pattern_id, check_order, check_type, command_template, pass_criteria)
SELECT 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE-C010', 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE', 10, 'SCRIPT',
       'bash -n ops/scripts/hermes-record-request.sh ops/scripts/hermes-resolve-pattern.sh',
       'exit_code=0'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_check WHERE pattern_check_id = 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE-C010');

INSERT INTO hermes_development_pattern_check
  (pattern_check_id, pattern_id, check_order, check_type, command_template, pass_criteria)
SELECT 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE-C020', 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE', 20, 'JSON',
       'node -e "JSON.parse(require(''fs'').readFileSync(''ops/hermes/model-routing-policy.seed.json'',''utf8'')); JSON.parse(require(''fs'').readFileSync(''ops/hermes/development-patterns.seed.json'',''utf8''))"',
       'json_parse_ok'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_check WHERE pattern_check_id = 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE-C020');

INSERT INTO hermes_development_pattern_team_rule
  (team_rule_id, pattern_id, team_id, team_role, selection_reason)
SELECT 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE-T-required-codex55', 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE',
       'codex55-execution-intelligence', 'required',
       '작업 분해, context pack, 검증 중심의 실행 지능이 필요하다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_team_rule WHERE team_rule_id = 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE-T-required-codex55');

INSERT INTO hermes_development_pattern_team_rule
  (team_rule_id, pattern_id, team_id, team_role, selection_reason)
SELECT 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE-T-required-rag', 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE',
       'development-rag-governor', 'required',
       'DB 개발 패턴, RAG, 품질 점수를 항상 조회해야 한다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_team_rule WHERE team_rule_id = 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE-T-required-rag');

INSERT INTO hermes_development_pattern_team_rule
  (team_rule_id, pattern_id, team_id, team_role, selection_reason)
SELECT 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE-T-support-model-benchmark', 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE',
       'model-benchmark', 'support',
       '14B/26B/디자인 전문 후보는 승격 전 벤치마크 게이트가 필요하다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_team_rule WHERE team_rule_id = 'HERMES_AGENT_TEAM_MODEL_ORCHESTRATION_CHANGE-T-support-model-benchmark');

INSERT INTO hermes_development_pattern_team_rule
  (team_rule_id, pattern_id, team_id, team_role, selection_reason)
SELECT 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT-T-required-framework', 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT',
       'framework-builder', 'required',
       '프론트/백엔드/DB/권한/감사 계약을 한 화면 단위로 닫는다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_team_rule WHERE team_rule_id = 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT-T-required-framework');

INSERT INTO hermes_development_pattern_team_rule
  (team_rule_id, pattern_id, team_id, team_role, selection_reason)
SELECT 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT-T-gate-design', 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT',
       'design-specialist', 'gate',
       '레이아웃, 디자인 DB, KRDS, theme token 기준을 구현 전 검수한다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_team_rule WHERE team_rule_id = 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT-T-gate-design');

INSERT INTO hermes_development_pattern_team_rule
  (team_rule_id, pattern_id, team_id, team_role, selection_reason)
SELECT 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT-T-support-rag', 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT',
       'development-rag-governor', 'support',
       '완성 sibling page와 실패/수정 이력을 기반으로 구현 품질을 유지한다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_development_pattern_team_rule WHERE team_rule_id = 'LAYOUT_FIRST_SERVICE_PAGE_DEVELOPMENT-T-support-rag');

UPDATE hermes_work_execution_guard_policy
   SET policy_instruction = 'Qwen40는 직접 장시간 작업하거나 모델 다운로드를 시도하기 전에 hermes_model_lane_policy와 로컬 등록 모델을 확인한다. 일반 개발 작업은 fast-draft qwen2.5-coder-7b-instruct-shadow(24751)를 먼저 호출하고, 번역/용어/디자인 검수는 gemma4-e4b-cpu-shadow(24451)를 먼저 호출한다. 14B는 등록된 엔드포인트가 있을 때만 승격 대상으로 사용한다. SuperGemma 26B는 benchmark-only 후보이며 정상 작업, 권한, DB, 배포, 보안에는 쓰지 않는다.',
       required_evidence = 'selected_lane, preferred_model, fallback_model, local_endpoint_check, qwen3_small_model_excluded, coder7b_first_pass_evidence, candidate_model_gate',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE guard_policy_id = 'WG-018-MODEL-LANE';

DELETE FROM db_patch_history
WHERE patch_id = '20260519_015_hermes_agent_orchestration_upgrade';

INSERT INTO db_patch_history (
    patch_id,
    patch_name,
    source_env,
    target_env,
    patch_direction,
    risk_level,
    status,
    sql_file_path,
    sql_preview,
    checksum,
    applied_at,
    applied_by,
    result_message,
    created_at
) VALUES (
    '20260519_015_hermes_agent_orchestration_upgrade',
    'Hermes agent-team and model orchestration upgrade',
    'ai-agent',
    'carbonet-prod',
    'SCHEMA_AND_POLICY',
    'MEDIUM',
    'SUCCESS',
    '/opt/Resonance/ops/db/carbonet/20260519_015_hermes_agent_orchestration_upgrade.sql',
    'Register team-first Hermes orchestration, work-kind routes, model candidates, layout-first gates, and candidate model safeguards',
    NULL,
    CURRENT_DATETIME,
    'codex',
    'Applied Hermes orchestration policy for 7B/4B-first routing, 14B optional canary, 26B benchmark-only, and DB-backed layout-first development',
    CURRENT_DATETIME
);

COMMIT;
