-- Hermes Gemma4, Qwen2.5 stable lanes, Qwen3.5 9B candidate, and Qwen Math lane update.
-- Purpose: keep local model routing aligned with the server setup:
-- Gemma4 handles translation, Qwen2.5 Instruct/Coder remains the stable
-- 7B/14B development lane, Qwen3.5 9B is preserved as a benchmark candidate,
-- Qwen Math handles calculations, and Qwen3 small models are excluded from local lanes.

UPDATE hermes_model_lane_policy
   SET preferred_model = 'gemma4-e4b-q4_k_m',
       preferred_base_url = 'http://127.0.0.1:24114/v1',
       fallback_model_json = '["gemma4:e2b","gemma:2b"]',
       allowed_work = 'Korean/English translation, glossary normalization, product-name mapping, and translation shadow comparison. Gemma4 is preferred for Korean translation.',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE lane_id = 'translation';

UPDATE hermes_model_lane_policy
   SET lane_name = 'Qwen2.5 Instruct development classification lane',
       preferred_model = 'qwen2.5-instruct:7b',
       preferred_base_url = 'http://127.0.0.1:11434/v1',
       fallback_model_json = '["qwen2.5-instruct:3b","qwen2.5-instruct:1.5b","qwen2.5-instruct:0.5b","qwen3.5-9b-q4_k_m"]',
       allowed_work = 'General conversation, coding assistance, agent task planning, request classification, log summary, candidate file selection, and compact context pack selection.',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE lane_id = 'dev-classify';

UPDATE hermes_model_lane_policy
   SET lane_name = 'Qwen2.5 Coder 7B fast development draft lane',
       preferred_model = 'qwen2.5-coder-7b-q4_k_m',
       preferred_base_url = 'http://127.0.0.1:24127/v1',
       fallback_model_json = '["qwen2.5-coder-14b-q4_k_m"]',
       allowed_work = 'Mandatory first-pass coder for normal development work: one-file explanations, small snippets, draft command order from known scripts, and bounded implementation drafts before 40B review.',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE lane_id = 'fast-draft';

UPDATE hermes_model_lane_policy
   SET lane_name = 'Qwen2.5 Coder 14B pattern development draft lane',
       preferred_model = 'qwen2.5-coder-14b-q4_k_m',
       preferred_base_url = 'http://127.0.0.1:24128/v1',
       fallback_model_json = '["qwen2.5-coder-7b-q4_k_m"]',
       allowed_work = 'Fallback coder when the 7B draft is low quality, unstable, or the pattern-based development task needs stronger code reasoning.',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE lane_id = 'mid-draft';

INSERT INTO hermes_model_lane_policy
  (lane_id, lane_order, lane_name, task_kind_json, preferred_model, preferred_base_url, fallback_model_json, allowed_work, escalation_rule_json)
SELECT 'math', 35, 'Qwen Math calculation lane',
       '["math","formula-check","unit-conversion","numeric-validation","calculation-review"]',
       'qwen-math:7b',
       'http://127.0.0.1:24117/v1',
       '["qwen-math:1.5b","qwen3.5-9b-q4_k_m"]',
       'Math reasoning, formula and unit checks, numeric validation, and calculation review before deterministic verification.',
       '["requires_source_write","requires_audit_evidence","calculation_affects_emission_result"]'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_model_lane_policy WHERE lane_id = 'math');

INSERT INTO hermes_model_lane_policy
  (lane_id, lane_order, lane_name, task_kind_json, preferred_model, preferred_base_url, fallback_model_json, allowed_work, escalation_rule_json)
SELECT 'agent-candidate', 45, 'Qwen3.5 9B agent benchmark candidate lane',
       '["agent-benchmark","general-reasoning-candidate","long-context-candidate","qwen35-evaluation"]',
       'qwen3.5-9b-q4_k_m',
       'http://127.0.0.1:24119/v1',
       '["qwen2.5-coder:7b","qwen3.6-40b-deck-opus-q4"]',
       'Candidate lane for Qwen3.5 9B general reasoning, agent planning, and local benchmark comparison before promotion.',
       '["source_write_needed","benchmark_fails","serving_unstable","thinking_output_not_disabled"]'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_model_lane_policy WHERE lane_id = 'agent-candidate');

UPDATE hermes_work_execution_guard_policy
   SET policy_instruction = 'Qwen40는 직접 장시간 작업하거나 모델 다운로드를 시도하기 전에 hermes_model_lane_policy와 로컬 등록 모델을 확인한다. 일반 개발 작업은 fast-draft qwen2.5-coder-7b-q4_k_m을 먼저 호출하고, 7B 품질이 낮거나 범위가 커질 때만 mid-draft 14B로 승격한다. Qwen3 소형 모델은 Carbonet 로컬 lane에서 선택하지 않는다.',
       required_evidence = 'selected_lane, preferred_model, fallback_model, local_endpoint_check, qwen3_small_model_excluded, coder7b_first_pass_evidence',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE guard_policy_id = 'WG-018-MODEL-LANE';

COMMIT;
