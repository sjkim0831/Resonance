-- Qwen3.6 40B speed-first Hermes runtime and watchdog policy.
-- Purpose: retire SuperGemma 26B, restore Qwen3.6 40B as the fixed main
-- model, keep Qwen2.5 Coder 7B CPU as the always-on Hermes supervisor, and
-- use Gemma4 E4B GPU only for small translation/glossary work.

UPDATE hermes_model_lane_policy
   SET preferred_model = 'gemma4-e4b-gpu-shadow',
       preferred_base_url = 'http://127.0.0.1:24451/v1',
       fallback_model_json = '["qwen3.6-40b-deck-opus-q4"]',
       allowed_work = 'Gemma4 E4B GPU handles short Korean/English translation, glossary normalization, product-name mapping, and UI copy only. Complex design judgment uses Qwen3.6 40B.',
       escalation_rule_json = '["domain_glossary_conflict","json_parse_failure","model_endpoint_unavailable","complex_design_judgment"]',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE lane_id = 'translation';

UPDATE hermes_model_lane_policy
   SET preferred_model = 'qwen2.5-coder-7b-instruct-shadow',
       preferred_base_url = 'http://127.0.0.1:24751/v1',
       fallback_model_json = '["qwen3.6-40b-deck-opus-q4"]',
       allowed_work = 'CPU 7B helper classifies normal Carbonet requests, summarizes logs, proposes candidate files, chooses compact context packs, and flags judge escalation. It also supervises Hermes for loops, stalls, and evidence gaps.',
       escalation_rule_json = '["security_or_permission","db_migration","shared_api_dto_mapper_contract","architecture_decision","confidence_below_0.75","hermes_loop_or_timeout"]',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE lane_id = 'dev-classify';

UPDATE hermes_model_lane_policy
   SET preferred_model = 'qwen2.5-coder-7b-instruct-shadow',
       preferred_base_url = 'http://127.0.0.1:24751/v1',
       fallback_model_json = '["qwen3.6-40b-deck-opus-q4"]',
       allowed_work = 'CPU 7B helper produces bounded small drafts and watchdog feedback. Qwen3.6 40B remains the main implementation judge; Codex applies and verifies.',
       escalation_rule_json = '["multiple_file_families","shared_contract_change","security_or_permission","db_migration","verification_failure","confidence_below_0.75","hermes_loop_or_timeout"]',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE lane_id = 'fast-draft';

UPDATE hermes_model_lane_policy
   SET preferred_model = 'qwen2.5-coder-7b-instruct-shadow',
       preferred_base_url = 'http://127.0.0.1:24751/v1',
       fallback_model_json = '["qwen3.6-40b-deck-opus-q4"]',
       allowed_work = 'Mid-draft is mapped to CPU 7B by default. Qwen14 is disabled unless manually benchmarked; escalate complex work to Qwen3.6 40B.',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE lane_id = 'mid-draft';

UPDATE hermes_model_lane_policy
   SET preferred_model = 'qwen3.6-40b-deck-opus-q4',
       preferred_base_url = 'http://127.0.0.1:24036/v1',
       fallback_model_json = '["gemma4-e4b-gpu-shadow"]',
       allowed_work = 'Complex design, layout, KRDS, and serviceability judgment uses Qwen3.6 40B. Gemma4 GPU may support short copy and translation only.',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE lane_id = 'design-specialist';

UPDATE hermes_model_lane_policy
   SET preferred_model = 'qwen3.6-40b-deck-opus-q4',
       preferred_base_url = 'http://127.0.0.1:24036/v1',
       fallback_model_json = '["codex"]',
       allowed_work = 'Qwen3.6 40B is the fixed main model for architecture judgment, risky review, failure interpretation, and final correction at 131K context.',
       escalation_rule_json = '["script_evidence_conflict","operator_approval_required"]',
       download_policy = 'LOCAL_REGISTERED_ONLY',
       active_yn = 'Y',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE lane_id = 'judge';

UPDATE hermes_model_lane_policy
   SET active_yn = 'N',
       allowed_work = 'Retired. SuperGemma 26B was deleted from the runtime host and must not be selected.',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE lane_id = 'supergemma26-benchmark';

UPDATE hermes_model_candidate_registry
   SET status = 'RETIRED_DELETED',
       active_yn = 'N',
       allowed_use = 'None. Model removed from the runtime host.',
       forbidden_use = 'All normal, benchmark, authority, DB, deploy, security, and source-write work.',
       benchmark_gate = 'Retired after comparison; Qwen3.6 40B restored as main.',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE candidate_model_id = 'candidate-supergemma4-26b-uncensored-gguf-v2';

UPDATE hermes_model_candidate_registry
   SET status = 'DISABLED_BY_SPEED_POLICY',
       allowed_use = 'Manual benchmark only. Do not keep Qwen14 active with Qwen40 131K unless a no-regression benchmark is recorded.',
       forbidden_use = 'Default Hermes classify/context/draft path while Qwen40 131K is active.',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE candidate_model_id = 'candidate-qwen25-coder-14b';

UPDATE hermes_agent_team_registry
   SET primary_model = 'Qwen/Qwen2.5-Coder-7B-Instruct CPU',
       fallback_model = 'Qwen3.6-40B-Deck-Opus',
       model_lane_json = '["dev-classify","fast-draft","judge","verify"]',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE team_id IN ('codex55-execution-intelligence','framework-builder','development-rag-governor','query-dev');

UPDATE hermes_agent_team_registry
   SET primary_model = 'Gemma4-E4B-GPU',
       fallback_model = 'Qwen3.6-40B-Deck-Opus',
       model_lane_json = '["translation","design-specialist","judge","verify"]',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE team_id IN ('design-specialist');

INSERT INTO hermes_agent_gap_registry
  (agent_gap_id, project_id, gap_order, gap_area, gap_name, gap_summary, mitigation_policy, status, evidence_ref)
SELECT 'gap-hermes-runtime-watchdog', 'carbonet', 38, 'agent-runtime', 'Hermes can stall or loop during its own execution',
       'Hermes execution can fail before the task itself fails: wrong task extraction, repeated commands, terminal preparation loops, model endpoint mismatch, iteration budget exhaustion, or success without evidence.',
       'Use Qwen2.5 Coder 7B CPU as a watchdog. Record checkpoints at task-stage/command-result/error boundaries, store compact feedback, and feed it back to Qwen40 before the next stage. Do not write per-token DB logs.',
       'MITIGATED_BY_POLICY',
       '/opt/Resonance/var/ai-runtime/hermes-watchdog/hermes-watchdog-events.jsonl'
FROM db_root
WHERE NOT EXISTS (
  SELECT 1 FROM hermes_agent_gap_registry WHERE agent_gap_id = 'gap-hermes-runtime-watchdog'
);

INSERT INTO hermes_development_pattern
  (pattern_id, category_code, pattern_name, pattern_summary, trigger_keywords, route_hints, module_hints, risk_level, skill_name, default_action_id)
SELECT 'HERMES_RUNTIME_WATCHDOG_SUPERVISION',
       'AI_RUNTIME',
       'Hermes runtime watchdog supervision',
       'Before and during Hermes work, extract the exact task list, watch for runtime stalls/loops/repeated failures, store checkpoint summaries, and feed compact corrections back to the Qwen40 main model.',
       '["Hermes","에르메스","무한 루프","지연","iteration budget","작업 추출","watchdog","7B","Qwen40"]',
       '["/admin/system/codex-request","/admin/system/development-pattern-management"]',
       '["ops/scripts/hermes-record-request.sh","ops/scripts/resonance-model-ask.sh","/opt/Resonance/var/ai-model-runtime/model-runtime-registry.json","/opt/Resonance/var/ai-agent-teams/ai-agent-teams.json"]',
       'MEDIUM',
       'resonance-ai-orchestrator',
       'hermes-record-request'
FROM db_root
WHERE NOT EXISTS (
  SELECT 1 FROM hermes_development_pattern WHERE pattern_id = 'HERMES_RUNTIME_WATCHDOG_SUPERVISION'
);

INSERT INTO hermes_development_pattern_step
  (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-010', 'HERMES_RUNTIME_WATCHDOG_SUPERVISION', 10, 'REQUEST_EXTRACT',
       'Extract exact task list first',
       'Parse the user script into task items, forbidden/risky actions, completion criteria, and verification candidates before tool execution.',
       'task_list_json, risk_items_json, completion_criteria',
       'QWEN7_SUPERVISOR'
FROM db_root
WHERE NOT EXISTS (
  SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-010'
);

INSERT INTO hermes_development_pattern_step
  (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-020', 'HERMES_RUNTIME_WATCHDOG_SUPERVISION', 20, 'CHECKPOINT_WATCH',
       'Watch Hermes runtime checkpoints',
       'At each command result, error, retry, or stage transition, detect repeated command/error, no-output timeout, terminal preparation loop, model mismatch, context stall, and evidence gaps.',
       'checkpoint_event_jsonl, watchdog_signal',
       'QWEN7_SUPERVISOR'
FROM db_root
WHERE NOT EXISTS (
  SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-020'
);

INSERT INTO hermes_development_pattern_step
  (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-030', 'HERMES_RUNTIME_WATCHDOG_SUPERVISION', 30, 'FEEDBACK_TO_MAIN',
       'Feed compact correction to Qwen40',
       'Summarize watchdog findings into a compact feedback block and pass it to Qwen40 before the next stage. If evidence conflicts, deterministic script output wins.',
       'feedback_block, selected_next_action, evidence_ref',
       'QWEN40_MAIN'
FROM db_root
WHERE NOT EXISTS (
  SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-030'
);

INSERT INTO hermes_development_pattern_check
  (pattern_check_id, pattern_id, check_order, check_type, command_template, pass_criteria)
SELECT 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-C010', 'HERMES_RUNTIME_WATCHDOG_SUPERVISION', 10, 'SCRIPT',
       'bash -n ops/scripts/hermes-record-request.sh ops/scripts/resonance-model-ask.sh ops/scripts/resonance-ai-model-stack-health.sh',
       'exit_code=0'
FROM db_root
WHERE NOT EXISTS (
  SELECT 1 FROM hermes_development_pattern_check WHERE pattern_check_id = 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-C010'
);

DELETE FROM db_patch_history
WHERE patch_id = '20260520_002_qwen40_speed_watchdog_runtime';

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
    '20260520_002_qwen40_speed_watchdog_runtime',
    'Qwen40 speed-first Hermes runtime and 7B watchdog policy',
    'ai-agent',
    'carbonet-prod',
    'RUNTIME_POLICY',
    'MEDIUM',
    'SUCCESS',
    '/opt/Resonance/ops/db/carbonet/20260520_002_qwen40_speed_watchdog_runtime.sql',
    'Retire SuperGemma 26B, restore Qwen3.6 40B as main, set CPU 7B as Hermes watchdog, and use Gemma4 GPU for translation.',
    NULL,
    CURRENT_DATETIME,
    'codex',
    'Qwen3.6 40B is the main model; CPU 7B supervises Hermes runtime; Gemma4 E4B GPU handles small translation; Qwen14 and SuperGemma 26B are disabled.',
    CURRENT_DATETIME
);

COMMIT;
