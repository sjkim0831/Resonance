-- Update live Hermes development pattern data for model-lane and context-pack routing.
-- Target DB: CUBRID-compatible SQL.

UPDATE hermes_development_pattern
   SET pattern_summary = 'Pattern registry, resolver, model lane, context pack, and Hermes workflow memory upgrade pattern.',
       trigger_keywords = '["에르메스","Hermes","패턴","작업 분류","에이전트","가이드","40B","모델","라우팅","컨텍스트","Skills","Docs","shadow","7B","14B","Gemma","Qwen"]',
       module_hints = '["ops/hermes","ops/scripts/hermes-record-request.sh","ops/scripts/resonance-dev-orchestrate-40b.sh","docs/ai/00-governance/ai-skill-doc-routing-matrix.md","docs/ai/60-operations/dev-orchestration/qwen40-first-development-orchestration.md","ops/db/carbonet"]',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE pattern_id = 'HERMES_PATTERN_REGISTRY_CHANGE';

UPDATE hermes_development_pattern_step
   SET step_instruction = '자연어 요청, 기대되는 에이전트 보정 범위, 모델 lane 요구사항을 기록한다.',
       expected_evidence = 'raw_request, requested_model_lane, requested_context_policy',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE pattern_step_id = 'HERMES_PATTERN_REGISTRY_CHANGE-010';

UPDATE hermes_development_pattern_step
   SET step_instruction = '기존 Hermes workflow, action registry, model lane, context pack, pattern docs를 매핑한다.',
       expected_evidence = 'memory_sources, model_lane, context_pack',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE pattern_step_id = 'HERMES_PATTERN_REGISTRY_CHANGE-020';

UPDATE hermes_development_pattern_step
   SET step_instruction = '패턴 레지스트리, 해석기, 모델 라우팅 문서, context pack 정책을 갱신한다.',
       expected_evidence = 'sql, script, doc, context_pack_policy',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE pattern_step_id = 'HERMES_PATTERN_REGISTRY_CHANGE-030';

UPDATE hermes_development_pattern_step
   SET step_instruction = 'resolver dry-run, model lane 매칭, shell syntax 검사를 수행한다.',
       expected_evidence = 'resolver_json, model_lane_match, bash_n',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE pattern_step_id = 'HERMES_PATTERN_REGISTRY_CHANGE-040';

UPDATE hermes_development_pattern_step
   SET step_instruction = 'Hermes 패턴 변경 목적, 모델 lane, context pack 요구사항을 문서화한다.',
       expected_evidence = 'pattern_spec, model_lane_policy, context_pack_policy',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE pattern_step_id = 'step-hermes-10';

UPDATE hermes_development_pattern_step
   SET step_instruction = '영향받는 패턴, Skills/Docs 라우팅, 작은 모델 지원 lane을 식별한다.',
       expected_evidence = 'pattern_dependencies, selected_skills_docs, support_lanes',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE pattern_step_id = 'step-hermes-20';

UPDATE hermes_development_pattern_step
   SET step_instruction = '현재 DB 패턴, seed JSON, Hermes 해석 프롬프트의 라우팅 상태를 확인한다.',
       expected_evidence = 'registry_state, seed_state, prompt_state',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE pattern_step_id = 'step-hermes-30';

UPDATE hermes_development_pattern_step
   SET step_instruction = 'DB 패턴, seed JSON, Hermes 스크립트, 모델 라우팅 문서를 일관되게 수정한다.',
       expected_evidence = 'pattern_changes, script_changes, doc_changes',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE pattern_step_id = 'step-hermes-40';

UPDATE hermes_development_pattern_step
   SET step_instruction = '모델 라우팅 요청이 HERMES_PATTERN_REGISTRY_CHANGE로 매칭되고 context pack 근거가 남는지 검증한다.',
       expected_evidence = 'pattern_test_results, context_pack_match',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE pattern_step_id = 'step-hermes-50';

UPDATE hermes_development_pattern_check
   SET command_template = 'bash -n ops/scripts/hermes-record-request.sh ops/scripts/hermes-resolve-pattern.sh ops/scripts/resonance-dev-orchestrate-40b.sh',
       pass_criteria = 'exit_code=0',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE pattern_check_id = 'HERMES_PATTERN_REGISTRY_CHANGE-C010';

INSERT INTO hermes_development_pattern_check (pattern_check_id, pattern_id, check_order, check_type, command_template, pass_criteria)
SELECT 'HERMES_PATTERN_REGISTRY_CHANGE-C020', 'HERMES_PATTERN_REGISTRY_CHANGE', 20, 'SCRIPT',
       'bash ops/scripts/hermes-resolve-pattern.sh --request ''Hermes 모델 라우팅과 Skills Docs 컨텍스트 선택 정책 반영'' --out /tmp/hermes-model-routing-pattern-test.json',
       'selectedPattern.patternId=HERMES_PATTERN_REGISTRY_CHANGE and matchedReasons include model/context keywords'
  FROM db_root
 WHERE NOT EXISTS (
       SELECT 1
         FROM hermes_development_pattern_check
        WHERE pattern_check_id = 'HERMES_PATTERN_REGISTRY_CHANGE-C020'
 );

UPDATE hermes_development_pattern_check
   SET command_template = 'bash ops/scripts/hermes-resolve-pattern.sh --request ''Hermes 모델 라우팅과 Skills Docs 컨텍스트 선택 정책 반영'' --out /tmp/hermes-model-routing-pattern-test.json',
       pass_criteria = 'selectedPattern.patternId=HERMES_PATTERN_REGISTRY_CHANGE and matchedReasons include model/context keywords',
       active_yn = 'Y',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE pattern_check_id = 'HERMES_PATTERN_REGISTRY_CHANGE-C020';

UPDATE hermes_development_pattern_team_rule
   SET selection_reason = '요청 해석, 작업 단계 분해, 모델 lane, context pack 정책을 변경한다.',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE team_rule_id IN ('HERMES_PATTERN_REGISTRY_CHANGE-T-required-codex55', 'team-hermes-1');

COMMIT;
