-- Hermes model routing policy.
-- Purpose: make Qwen40 select the smallest registered local model lane instead
-- of attempting heavyweight or ad-hoc HuggingFace downloads during normal tasks.

CREATE TABLE IF NOT EXISTS hermes_model_lane_policy (
  lane_id VARCHAR(80) NOT NULL,
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  lane_order INTEGER DEFAULT 0 NOT NULL,
  lane_name VARCHAR(200) NOT NULL,
  task_kind_json CLOB,
  preferred_model VARCHAR(120) NOT NULL,
  preferred_base_url VARCHAR(500),
  fallback_model_json CLOB,
  allowed_work CLOB,
  escalation_rule_json CLOB,
  download_policy VARCHAR(80) DEFAULT 'LOCAL_REGISTERED_ONLY' NOT NULL,
  active_yn CHAR(1) DEFAULT 'Y' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (lane_id)
);

CREATE INDEX idx_hermes_model_lane_project
  ON hermes_model_lane_policy (project_id, lane_order, active_yn);

INSERT INTO hermes_model_lane_policy
  (lane_id, lane_order, lane_name, task_kind_json, preferred_model, preferred_base_url, fallback_model_json, allowed_work, escalation_rule_json)
SELECT 'translation', 10, 'Gemma translation lane',
       '["translation","glossary","korean-product-name","i18n"]',
       'gemma4:e2b',
       'http://127.0.0.1:11434/v1',
       '["gemma:2b","qwen3.5:4b"]',
       'Korean/English translation, glossary normalization, product-name mapping, and translation shadow comparison.',
       '["missing_hangul","domain_glossary_conflict","json_parse_failure","model_endpoint_unavailable"]'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_model_lane_policy WHERE lane_id = 'translation');

INSERT INTO hermes_model_lane_policy
  (lane_id, lane_order, lane_name, task_kind_json, preferred_model, preferred_base_url, fallback_model_json, allowed_work, escalation_rule_json)
SELECT 'dev-classify', 20, 'Qwen development classification lane',
       '["development-classification","log-summary","candidate-file-selection"]',
       'qwen3.5:4b',
       'http://127.0.0.1:11434/v1',
       '["qwen2.5-coder:3b","qwen2.5-coder:1.5b"]',
       'Classify development requests, summarize logs, propose candidate files, and choose a compact context pack.',
       '["source_write_needed","db_or_api_contract_unclear","confidence_below_0.75"]'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_model_lane_policy WHERE lane_id = 'dev-classify');

INSERT INTO hermes_model_lane_policy
  (lane_id, lane_order, lane_name, task_kind_json, preferred_model, preferred_base_url, fallback_model_json, allowed_work, escalation_rule_json)
SELECT 'fast-draft', 30, 'Qwen 7B fast development draft lane',
       '["small-development-draft","one-file-explanation","known-script-order"]',
       'qwen2.5-coder:7b',
       'http://127.0.0.1:11434/v1',
       '["qwen3.5:4b"]',
       'One-file explanations, small snippets, and draft command order from known scripts.',
       '["multiple_file_families","shared_contract_change","runtime_behavior_change"]'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_model_lane_policy WHERE lane_id = 'fast-draft');

INSERT INTO hermes_model_lane_policy
  (lane_id, lane_order, lane_name, task_kind_json, preferred_model, preferred_base_url, fallback_model_json, allowed_work, escalation_rule_json)
SELECT 'mid-draft', 40, 'Qwen 14B pattern development draft lane',
       '["repetitive-admin-page","service-pattern-draft","pattern-based-code-draft"]',
       'qwen2.5-coder:14b',
       'http://127.0.0.1:11434/v1',
       '["qwen2.5-coder:7b"]',
       'Repetitive admin/service drafts from an approved existing pattern.',
       '["security","db_migration","mapper_or_dto_contract","runtime_proof_required"]'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_model_lane_policy WHERE lane_id = 'mid-draft');

INSERT INTO hermes_model_lane_policy
  (lane_id, lane_order, lane_name, task_kind_json, preferred_model, preferred_base_url, fallback_model_json, allowed_work, escalation_rule_json)
SELECT 'judge', 90, 'Qwen40 judgment lane',
       '["architecture","risk-review","failure-interpretation","final-correction"]',
       'qwen3.6-40b-deck-opus-q4',
       'http://127.0.0.1:24036/v1',
       '["codex"]',
       'Architecture judgment, risky implementation review, failure interpretation, and final correction.',
       '[]'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_model_lane_policy WHERE lane_id = 'judge');

INSERT INTO hermes_model_lane_policy
  (lane_id, lane_order, lane_name, task_kind_json, preferred_model, preferred_base_url, fallback_model_json, allowed_work, escalation_rule_json)
SELECT 'verify', 100, 'Deterministic verification lane',
       '["build","test","route-probe","db-proof","runtime-proof"]',
       'codex-scripts',
       '',
       '[]',
       'Deterministic command execution, build/test/runtime evidence, and route probes.',
       '["verification_fails","evidence_conflicts_with_plan"]'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_model_lane_policy WHERE lane_id = 'verify');

INSERT INTO hermes_work_execution_guard_policy
  (guard_policy_id, guard_order, guard_code, guard_stage, guard_name, policy_instruction, required_evidence, stop_condition, rework_condition, restore_condition)
SELECT 'WG-018-MODEL-LANE', 18, 'MODEL_LANE_LOCAL_FIRST', 'PRECHECK', 'Select registered local model lane first',
       'Qwen40는 직접 장시간 작업하거나 모델 다운로드를 시도하기 전에 hermes_model_lane_policy와 로컬 등록 모델을 확인하고 translation/dev-classify/fast-draft/mid-draft/verify lane 중 가장 작은 lane을 선택한다.',
       'selected_lane, preferred_model, fallback_model, local_endpoint_check',
       '정상 작업 중 HuggingFace 다운로드를 시작하려 하거나 등록되지 않은 모델만 고집하면 중단하고 로컬 fallback lane을 선택한다.',
       '선택한 모델 endpoint가 없으면 fallback model 또는 judge lane으로 재해석하고 누락 모델 설치는 별도 setup task로 기록한다.',
       '모델 lane 결정은 hermes_model_decision과 context pack에 남겨 재실행 시 같은 정책을 복원한다.'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_work_execution_guard_policy WHERE guard_policy_id = 'WG-018-MODEL-LANE');

UPDATE hermes_development_pattern
   SET pattern_summary = 'Pattern registry, resolver, model lane, context pack, and Hermes workflow memory upgrade pattern.',
       trigger_keywords = '["에르메스","Hermes","패턴","작업 분류","에이전트","가이드","40B","모델","라우팅","컨텍스트","Skills","Docs","shadow","7B","14B","Gemma","Qwen","Ollama","번역"]',
       module_hints = '["ops/hermes","ops/scripts/hermes-record-request.sh","ops/scripts/resonance-dev-orchestrate-40b.sh","ops/scripts/ecoinvent-product-ko-translation-worker.py","docs/ai/00-governance/ai-skill-doc-routing-matrix.md","docs/ai/60-operations/dev-orchestration/qwen40-first-development-orchestration.md","ops/db/carbonet"]',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE pattern_id = 'HERMES_PATTERN_REGISTRY_CHANGE';

COMMIT;
