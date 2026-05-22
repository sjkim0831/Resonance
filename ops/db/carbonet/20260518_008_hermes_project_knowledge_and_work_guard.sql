-- Hermes project knowledge registry and work guard policy.
-- Purpose: force every Hermes/Codex task to consult DB-backed work order,
-- project structure, skill/doc/harness knowledge, checkpoint, rework, and restore rules.

CREATE TABLE IF NOT EXISTS hermes_work_execution_guard_policy (
  guard_policy_id VARCHAR(100) NOT NULL,
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  guard_order INTEGER DEFAULT 0 NOT NULL,
  guard_code VARCHAR(80) NOT NULL,
  guard_stage VARCHAR(80) NOT NULL,
  guard_name VARCHAR(200) NOT NULL,
  policy_instruction CLOB,
  required_evidence CLOB,
  stop_condition CLOB,
  rework_condition CLOB,
  restore_condition CLOB,
  active_yn CHAR(1) DEFAULT 'Y' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (guard_policy_id)
);

CREATE INDEX idx_hermes_work_guard_project
  ON hermes_work_execution_guard_policy (project_id, guard_stage, active_yn);

CREATE TABLE IF NOT EXISTS hermes_work_checkpoint_template (
  checkpoint_template_id VARCHAR(120) NOT NULL,
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  pattern_id VARCHAR(80),
  checkpoint_order INTEGER DEFAULT 0 NOT NULL,
  checkpoint_code VARCHAR(80) NOT NULL,
  checkpoint_stage VARCHAR(80) NOT NULL,
  checkpoint_name VARCHAR(200) NOT NULL,
  instruction CLOB,
  command_template CLOB,
  expected_evidence CLOB,
  report_policy CLOB,
  rework_trigger CLOB,
  restore_anchor_policy CLOB,
  active_yn CHAR(1) DEFAULT 'Y' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (checkpoint_template_id)
);

CREATE INDEX idx_hermes_checkpoint_template_pattern
  ON hermes_work_checkpoint_template (project_id, pattern_id, checkpoint_order, active_yn);

CREATE TABLE IF NOT EXISTS hermes_task_work_checkpoint (
  checkpoint_id VARCHAR(120) NOT NULL,
  hermes_task_id VARCHAR(80) NOT NULL,
  checkpoint_order INTEGER DEFAULT 0 NOT NULL,
  checkpoint_code VARCHAR(80) NOT NULL,
  checkpoint_stage VARCHAR(80) NOT NULL,
  checkpoint_name VARCHAR(200) NOT NULL,
  instruction CLOB,
  expected_evidence CLOB,
  status VARCHAR(40) DEFAULT 'PLANNED' NOT NULL,
  report_payload CLOB,
  evidence_ref VARCHAR(1000),
  rework_needed_yn CHAR(1) DEFAULT 'N' NOT NULL,
  restore_available_yn CHAR(1) DEFAULT 'N' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (checkpoint_id)
);

CREATE INDEX idx_hermes_task_checkpoint_task
  ON hermes_task_work_checkpoint (hermes_task_id, checkpoint_order, status);

CREATE TABLE IF NOT EXISTS hermes_project_scan_batch (
  scan_batch_id VARCHAR(100) NOT NULL,
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  scan_type VARCHAR(80) DEFAULT 'PROJECT_KNOWLEDGE' NOT NULL,
  root_path VARCHAR(1000) NOT NULL,
  status VARCHAR(40) DEFAULT 'COMPLETED' NOT NULL,
  asset_count INTEGER DEFAULT 0 NOT NULL,
  evidence_ref VARCHAR(1000),
  summary CLOB,
  scanned_by VARCHAR(80) DEFAULT 'hermes-sync-project-knowledge' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (scan_batch_id)
);

CREATE INDEX idx_hermes_project_scan_batch
  ON hermes_project_scan_batch (project_id, scan_type, frst_regist_pnttm);

CREATE TABLE IF NOT EXISTS hermes_project_knowledge_asset (
  knowledge_asset_id VARCHAR(120) NOT NULL,
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  scan_batch_id VARCHAR(100) NOT NULL,
  asset_type VARCHAR(80) NOT NULL,
  asset_path VARCHAR(1000) NOT NULL,
  parent_path VARCHAR(1000),
  asset_depth INTEGER DEFAULT 0 NOT NULL,
  owner_surface VARCHAR(120),
  primary_pattern_id VARCHAR(80),
  primary_team_id VARCHAR(100),
  file_count INTEGER DEFAULT 0 NOT NULL,
  directory_count INTEGER DEFAULT 0 NOT NULL,
  content_hash VARCHAR(80),
  summary CLOB,
  pattern_hints CLOB,
  evidence_ref VARCHAR(1000),
  active_yn CHAR(1) DEFAULT 'Y' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (knowledge_asset_id)
);

CREATE INDEX idx_hermes_knowledge_asset_type
  ON hermes_project_knowledge_asset (project_id, asset_type, active_yn);
CREATE INDEX idx_hermes_knowledge_asset_pattern
  ON hermes_project_knowledge_asset (project_id, primary_pattern_id, active_yn);

INSERT INTO hermes_work_execution_guard_policy
  (guard_policy_id, guard_order, guard_code, guard_stage, guard_name, policy_instruction, required_evidence, stop_condition, rework_condition, restore_condition)
SELECT 'WG-010-DB-WORK-ORDER', 10, 'DB_WORK_ORDER_FIRST', 'PRECHECK', 'Check registered DB work order first',
       '작업 전 hermes_development_pattern, step, check, team_rule, project_knowledge_asset를 조회하고 선택된 작업 순서와 파일 범위를 확정한다.',
       'selected_pattern, pattern_steps, pattern_checks, team_rules, knowledge_assets',
       '등록된 패턴/단계/파일 범위가 없거나 요청과 맞지 않으면 구현을 시작하지 않고 범위를 재해석한다.',
       '작업 중 선택 패턴과 실제 변경 파일이 어긋나면 구현을 멈추고 다시 pattern resolve를 수행한다.',
       '작업 시작 전 git diff/status와 변경 대상 파일 목록을 저장하여 원복 기준으로 삼는다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_work_execution_guard_policy WHERE guard_policy_id = 'WG-010-DB-WORK-ORDER');

INSERT INTO hermes_work_execution_guard_policy
  (guard_policy_id, guard_order, guard_code, guard_stage, guard_name, policy_instruction, required_evidence, stop_condition, rework_condition, restore_condition)
SELECT 'WG-020-CONTEXT-CHECK', 20, 'CONTEXT_GAP_CHECK', 'SCOPE_ROUTE', 'Check context gaps and assumptions',
       '스크립트로 충분한 컨텍스트를 받았더라도 기존 소스, 스킬, 문서, 하네스와 대조하고 누락/불확실성을 표시한다.',
       'source_hits, skill_hits, doc_hits, harness_hits, uncertainty_list',
       '핵심 파일/스크립트/문서 확인 없이 구현 결론을 내리면 중단한다.',
       '분석 결론이 기존 스크립트나 문서와 충돌하면 관련 파일을 다시 읽고 단계표를 수정한다.',
       '분석 단계 산출물과 변경 전 상태를 evidence_ref에 남긴다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_work_execution_guard_policy WHERE guard_policy_id = 'WG-020-CONTEXT-CHECK');

INSERT INTO hermes_work_execution_guard_policy
  (guard_policy_id, guard_order, guard_code, guard_stage, guard_name, policy_instruction, required_evidence, stop_condition, rework_condition, restore_condition)
SELECT 'WG-030-MIDPOINT-REPORT', 30, 'MIDPOINT_REPORT_AND_OPTIONS', 'IMPLEMENT', 'Midpoint report and option gate',
       '분석 후 구현 전, 그리고 구현 중 위험한 분기에서 중간 보고/선택지/작업 선별 결과를 남긴다.',
       'checkpoint_report, selected_option, rejected_options, reason',
       '선택지가 사용자 승인 또는 정책 게이트를 요구하면 구현을 보류한다.',
       '중간 점검에서 불필요한 변경이나 잘못된 대상이 발견되면 해당 변경을 폐기하고 범위를 재설정한다.',
       '선택 전 diff와 선택 후 diff를 구분해 복원 가능성을 유지한다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_work_execution_guard_policy WHERE guard_policy_id = 'WG-030-MIDPOINT-REPORT');

INSERT INTO hermes_work_execution_guard_policy
  (guard_policy_id, guard_order, guard_code, guard_stage, guard_name, policy_instruction, required_evidence, stop_condition, rework_condition, restore_condition)
SELECT 'WG-040-SCRIPT-PARITY', 40, 'EXISTING_SCRIPT_PARITY', 'VERIFY', 'Compare with existing scripts and harnesses',
       '기존 스크립트, 검증 하네스, skill 문서와 결과물을 비교하여 정확하지 않거나 수정 불필요한 변경을 잡는다.',
       'script_parity_result, harness_result, diff_review',
       '기존 검증 스크립트가 실패하거나 더 적절한 기존 스크립트가 있으면 최종 성공을 선언하지 않는다.',
       '검증에서 부정확한 결과 또는 불필요한 수정이 확인되면 재작업하고 checkpoint를 갱신한다.',
       '잘못된 변경은 git diff와 파일별 백업/원본 기준으로 되돌릴 수 있어야 한다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_work_execution_guard_policy WHERE guard_policy_id = 'WG-040-SCRIPT-PARITY');

INSERT INTO hermes_work_execution_guard_policy
  (guard_policy_id, guard_order, guard_code, guard_stage, guard_name, policy_instruction, required_evidence, stop_condition, rework_condition, restore_condition)
SELECT 'WG-050-REWORK-RESTORE', 50, 'VERIFY_REWORK_AND_RESTORE', 'REFLECT', 'Rework or restore when verification/user review fails',
       '검증 실패, 사용자 이상 보고, 불필요 변경 확인 시 재작업 또는 복원 요청을 정확히 수행할 수 있게 결과/복원 기준을 남긴다.',
       'verification_summary, failed_checks, rework_plan, restore_anchor',
       '복원 기준이 없거나 실패 검증을 무시하면 완료로 처리하지 않는다.',
       '검증 실패나 사용자 이상 보고가 있으면 실패 원인을 기록하고 재실행 가능한 수정 계획을 만든다.',
       '사용자가 복원 요청 시 변경 파일/DB migration/배포 산출물을 각각 분리하여 복원 경로를 제시한다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_work_execution_guard_policy WHERE guard_policy_id = 'WG-050-REWORK-RESTORE');

INSERT INTO hermes_work_checkpoint_template
  (checkpoint_template_id, checkpoint_order, checkpoint_code, checkpoint_stage, checkpoint_name, instruction, command_template, expected_evidence, report_policy, rework_trigger, restore_anchor_policy)
SELECT 'CHK-010-DB-ORDER', 10, 'DB_ORDER_CHECK', 'PRECHECK', 'Registered DB work order check',
       '선택된 패턴, 단계, 검증, 팀 규칙, 지식 자산을 DB에서 조회한다.',
       'SELECT pattern_id FROM hermes_development_pattern WHERE active_yn = ''Y''',
       'pattern_id, step_count, check_count, team_rule_count, asset_hints',
       '작업 시작 보고에 선택 패턴과 제외한 패턴 후보를 포함한다.',
       '패턴이 없거나 요청과 맞지 않으면 resolver를 다시 실행한다.',
       '작업 시작 전 git status와 변경 대상 파일 목록을 저장한다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_work_checkpoint_template WHERE checkpoint_template_id = 'CHK-010-DB-ORDER');

INSERT INTO hermes_work_checkpoint_template
  (checkpoint_template_id, checkpoint_order, checkpoint_code, checkpoint_stage, checkpoint_name, instruction, command_template, expected_evidence, report_policy, rework_trigger, restore_anchor_policy)
SELECT 'CHK-020-SCOPE-REPORT', 20, 'SCOPE_REPORT', 'SCOPE_ROUTE', 'Scope and option midpoint report',
       '분석 결과, 작업할 것/하지 않을 것, 선택지를 중간 보고로 남긴다.',
       'git diff --stat && rg -n "<request keywords>" <candidate paths>',
       'candidate_files, selected_files, rejected_files, uncertainty_list',
       '사용자가 확인할 수 있게 작업 선별 근거와 선택지를 요약한다.',
       '수정 불필요 파일이 선택되었으면 제외하고 범위를 다시 계산한다.',
       '범위 확정 전 diff는 별도 저장한다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_work_checkpoint_template WHERE checkpoint_template_id = 'CHK-020-SCOPE-REPORT');

INSERT INTO hermes_work_checkpoint_template
  (checkpoint_template_id, checkpoint_order, checkpoint_code, checkpoint_stage, checkpoint_name, instruction, command_template, expected_evidence, report_policy, rework_trigger, restore_anchor_policy)
SELECT 'CHK-030-PARITY-VERIFY', 30, 'PARITY_VERIFY', 'VERIFY', 'Existing script and harness parity verification',
       '기존 빌드/검증/감사 스크립트와 결과물을 대조한다.',
       'git diff --check; npm run build; mvn -q -DskipTests package',
       'diff_check, build_result, maven_result, route_or_api_probe',
       '통과/실패와 재작업 여부를 명확히 보고한다.',
       '검증 실패 또는 부정확한 산출물 발견 시 구현 단계로 되돌아간다.',
       '검증 실패 시 사용자가 이전 상태로 복원할 수 있는 파일 목록을 함께 남긴다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_work_checkpoint_template WHERE checkpoint_template_id = 'CHK-030-PARITY-VERIFY');

INSERT INTO hermes_work_checkpoint_template
  (checkpoint_template_id, checkpoint_order, checkpoint_code, checkpoint_stage, checkpoint_name, instruction, command_template, expected_evidence, report_policy, rework_trigger, restore_anchor_policy)
SELECT 'CHK-040-RESTORE-READY', 40, 'RESTORE_READY', 'REFLECT', 'Restore readiness and rework summary',
       '완료 전 변경 파일, DB 변경, 원격 적용, 복원 방법, 남은 위험을 기록한다.',
       'git status --short; git diff --stat',
       'changed_files, db_changes, remote_changes, restore_notes',
       '사용자에게 복원 요청 시 되돌릴 기준을 알려줄 수 있게 요약한다.',
       '사용자 확인에서 이상이 있으면 restore_notes를 기준으로 재작업/복원한다.',
       '파일 변경은 git diff 기준, DB 변경은 migration id 기준, 배포 변경은 release artifact 기준으로 분리한다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_work_checkpoint_template WHERE checkpoint_template_id = 'CHK-040-RESTORE-READY');

COMMIT;
