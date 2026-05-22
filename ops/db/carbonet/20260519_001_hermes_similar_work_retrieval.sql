-- Hermes similar work retrieval and work packet contract.
-- Purpose: keep repeated Carbonet work from restarting from zero, and preserve
-- enough context for implementation after chat context compression.

CREATE TABLE IF NOT EXISTS hermes_similar_work_match (
  similar_work_match_id VARCHAR(120) NOT NULL,
  hermes_task_id VARCHAR(80) NOT NULL,
  reference_task_id VARCHAR(80),
  reference_route VARCHAR(500),
  reference_artifact_path VARCHAR(1000),
  reference_pattern_id VARCHAR(80),
  similarity_score DOUBLE DEFAULT 0 NOT NULL,
  similarity_reason CLOB,
  lessons_applied CLOB,
  additional_checks CLOB,
  evidence_ref VARCHAR(1000),
  accepted_yn CHAR(1) DEFAULT 'Y' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (similar_work_match_id)
);

CREATE INDEX idx_hermes_similar_work_task
  ON hermes_similar_work_match (hermes_task_id, accepted_yn);

CREATE INDEX idx_hermes_similar_work_pattern
  ON hermes_similar_work_match (reference_pattern_id, accepted_yn);

CREATE TABLE IF NOT EXISTS hermes_task_lesson (
  task_lesson_id VARCHAR(120) NOT NULL,
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  hermes_task_id VARCHAR(80),
  pattern_id VARCHAR(80),
  lesson_type VARCHAR(60) NOT NULL,
  lesson_title VARCHAR(200) NOT NULL,
  lesson_body CLOB,
  applies_to_json CLOB,
  prevention_check CLOB,
  evidence_ref VARCHAR(1000),
  active_yn CHAR(1) DEFAULT 'Y' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (task_lesson_id)
);

CREATE INDEX idx_hermes_task_lesson_pattern
  ON hermes_task_lesson (project_id, pattern_id, lesson_type, active_yn);

CREATE TABLE IF NOT EXISTS hermes_work_packet (
  work_packet_id VARCHAR(120) NOT NULL,
  hermes_task_id VARCHAR(80) NOT NULL,
  pattern_id VARCHAR(80),
  packet_version INTEGER DEFAULT 1 NOT NULL,
  packet_status VARCHAR(40) DEFAULT 'READY' NOT NULL,
  reference_tasks_json CLOB,
  reference_pages_json CLOB,
  source_artifacts_to_open_json CLOB,
  lessons_applied_json CLOB,
  additional_checks_json CLOB,
  expected_evidence_json CLOB,
  packet_hash VARCHAR(80),
  evidence_ref VARCHAR(1000),
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (work_packet_id)
);

CREATE INDEX idx_hermes_work_packet_task
  ON hermes_work_packet (hermes_task_id, packet_status);

INSERT INTO hermes_work_execution_guard_policy
  (guard_policy_id, guard_order, guard_code, guard_stage, guard_name, policy_instruction, required_evidence, stop_condition, rework_condition, restore_condition)
SELECT 'WG-015-SIMILAR-WORK', 15, 'SIMILAR_WORK_RETRIEVAL', 'PRECHECK', 'Retrieve similar work before implementation',
       '패턴 resolve 후 구현 전에 유사 작업, 참조 페이지, 실패/수정 이력, 추가 검수 항목을 조회하고 현재 작업 체크리스트에 반영한다.',
       'similar_work_matches, reference_tasks, lessons_applied, additional_checks',
       '반복 작업인데 유사 작업 검색 결과 또는 검색 부재 기록이 없으면 구현을 시작하지 않는다.',
       '구현 중 유사 작업의 실패 사례와 같은 위험이 발견되면 work packet과 체크리스트를 갱신하고 재검토한다.',
       '유사 작업에서 가져온 판단과 실제 변경 파일을 분리 기록하여 잘못된 참조를 되돌릴 수 있게 한다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_work_execution_guard_policy WHERE guard_policy_id = 'WG-015-SIMILAR-WORK');

INSERT INTO hermes_work_execution_guard_policy
  (guard_policy_id, guard_order, guard_code, guard_stage, guard_name, policy_instruction, required_evidence, stop_condition, rework_condition, restore_condition)
SELECT 'WG-025-WORK-PACKET', 25, 'WORK_PACKET_READY', 'SCOPE_ROUTE', 'Persist compact work packet',
       '선택 패턴, 유사 작업, 참조 파일, 적용 교훈, 추가 검수, 기대 증거를 work packet으로 저장한 뒤 구현한다.',
       'work_packet_id, packet_hash, source_artifacts_to_open, expected_evidence',
       '컨텍스트 압축 후에도 재개 가능한 work packet이 없으면 구현을 시작하지 않는다.',
       '작업 중 범위나 참조가 바뀌면 packet_version을 올리고 변경 이유를 남긴다.',
       'work packet 이전 git 상태와 변경 대상 파일 목록을 복원 기준으로 삼는다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_work_execution_guard_policy WHERE guard_policy_id = 'WG-025-WORK-PACKET');

INSERT INTO hermes_work_checkpoint_template
  (checkpoint_template_id, checkpoint_order, checkpoint_code, checkpoint_stage, checkpoint_name, instruction, command_template, expected_evidence, report_policy, rework_trigger, restore_anchor_policy)
SELECT 'CHK-015-SIMILAR-WORK', 15, 'SIMILAR_WORK_RETRIEVAL', 'PRECHECK', 'Similar work and lesson retrieval',
       '유사 작업, 참조 페이지, 실패/수정 이력, 추가 검수 항목을 조회하고 현재 작업에 반영한다.',
       'SELECT * FROM hermes_task_lesson WHERE active_yn = ''Y''',
       'reference_tasks, reference_pages, lessons_applied, additional_checks',
       '작업 시작 보고에 어떤 유사 작업을 참고했고 어떤 교훈을 반영했는지 포함한다.',
       '유사 작업의 실패 사례가 현재 변경에도 재현되면 구현 전 체크리스트를 보강한다.',
       '참조한 작업/페이지와 실제 수정 파일을 분리해 기록한다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_work_checkpoint_template WHERE checkpoint_template_id = 'CHK-015-SIMILAR-WORK');

INSERT INTO hermes_work_checkpoint_template
  (checkpoint_template_id, checkpoint_order, checkpoint_code, checkpoint_stage, checkpoint_name, instruction, command_template, expected_evidence, report_policy, rework_trigger, restore_anchor_policy)
SELECT 'CHK-025-WORK-PACKET', 25, 'WORK_PACKET_READY', 'SCOPE_ROUTE', 'Compact work packet ready',
       '선택 패턴, 참조 작업, 참조 파일, 적용 교훈, 추가 검수, 기대 증거를 압축 가능한 작업 봉투로 저장한다.',
       'SELECT * FROM hermes_work_packet WHERE hermes_task_id = ?',
       'work_packet_id, packet_hash, packet_version, source_artifacts_to_open',
       '구현 전 보고에 work packet 요약과 반드시 열 파일 목록을 포함한다.',
       '범위가 바뀌면 work packet을 새 버전으로 갱신한다.',
       'work packet 생성 전 상태와 생성 후 상태를 evidence_ref로 분리한다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_work_checkpoint_template WHERE checkpoint_template_id = 'CHK-025-WORK-PACKET');

INSERT INTO hermes_development_pattern_step
  (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT pattern_id || '-015', pattern_id, 15, 'SIMILAR_WORK_RETRIEVAL', 'Similar work retrieval',
       '유사 작업, 참조 페이지, 실패/수정 이력, 추가 검수 항목을 조회하고 현재 작업 체크리스트에 반영한다.',
       'reference_tasks, reference_pages, lessons_applied, additional_checks',
       'HERMES'
FROM hermes_development_pattern p
WHERE active_yn = 'Y'
  AND NOT EXISTS (
    SELECT 1
    FROM hermes_development_pattern_step s
    WHERE s.pattern_id = p.pattern_id
      AND s.stage_code = 'SIMILAR_WORK_RETRIEVAL'
      AND s.active_yn = 'Y'
  );

INSERT INTO hermes_development_pattern_step
  (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT pattern_id || '-025', pattern_id, 25, 'WORK_PACKET_READY', 'Compact work packet ready',
       '선택 패턴, 참조 작업, 참조 파일, 적용 교훈, 추가 검수, 기대 증거를 압축 가능한 작업 봉투로 저장한다.',
       'work_packet_id, source_artifacts_to_open, expected_evidence',
       'HERMES'
FROM hermes_development_pattern p
WHERE active_yn = 'Y'
  AND NOT EXISTS (
    SELECT 1
    FROM hermes_development_pattern_step s
    WHERE s.pattern_id = p.pattern_id
      AND s.stage_code = 'WORK_PACKET_READY'
      AND s.active_yn = 'Y'
  );

COMMIT;
