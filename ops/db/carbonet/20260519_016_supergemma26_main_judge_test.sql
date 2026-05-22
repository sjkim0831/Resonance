-- SuperGemma 26B temporary main-judge test activation.
-- Purpose: record that codex-qwen36.service on :24036 is temporarily serving
-- SuperGemma 26B for Hermes/Codex benchmark comparison instead of Qwen3.6 40B.

UPDATE hermes_model_candidate_registry
   SET status = 'TEST_ACTIVE_MAIN_PORT',
       allowed_use = 'Temporary Hermes/Codex judge-path benchmark on port 24036. Normal work may use it only with JSON response_format, DB/RAG/team preflight, and deterministic verification.',
       forbidden_use = 'Final authority/security/DB migration/deploy decisions without restoring or comparing Qwen3.6 40B; unreviewed source writes; harmful or unsafe requests.',
       benchmark_gate = 'Compare against Qwen3.6 40B on Carbonet planning JSON, layout-first page planning, API/DB/authority reasoning, and verification failure interpretation. Revert if JSON validity, instruction following, or safety is weaker.',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE candidate_model_id = 'candidate-supergemma4-26b-uncensored-gguf-v2';

UPDATE hermes_model_lane_policy
   SET preferred_model = 'supergemma4-26b-uncensored-q4_k_m',
       preferred_base_url = 'http://127.0.0.1:24036/v1',
       fallback_model_json = '["qwen3.6-40b-deck-opus-q4","codex"]',
       allowed_work = 'Temporary main judge benchmark on the existing 24036 judge path. Use response_format=json_object for Hermes planning. Keep Qwen2.5 Coder 7B as primary fast-draft and deterministic scripts as source of truth.',
       escalation_rule_json = '["json_parse_failure","security_or_permission","db_migration","deploy","unsafe_content","quality_below_qwen40_baseline"]',
       download_policy = 'LOCAL_REGISTERED_ONLY',
       active_yn = 'Y',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE lane_id = 'judge';

UPDATE hermes_model_lane_policy
   SET active_yn = 'Y',
       preferred_base_url = 'http://127.0.0.1:24036/v1',
       allowed_work = 'Benchmark lane is active only because SuperGemma 26B is temporarily bound to the main judge port. Do not use it for production source writes or final high-risk decisions without Qwen40 comparison.',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE lane_id = 'supergemma26-benchmark';

INSERT INTO hermes_agent_gap_registry
  (agent_gap_id, project_id, gap_order, gap_area, gap_name, gap_summary, mitigation_policy, status, evidence_ref)
SELECT 'gap-supergemma26-json-mode', 'carbonet', 35, 'model', 'SuperGemma 26B needs JSON response_format for Hermes planning',
       'Initial strict JSON prompt produced a malformed JSON response. response_format=json_object fixed the Hermes record-request path.',
       'Keep response_format=json_object in hermes-record-request.sh for judge calls and watch judgeParseFailed in hermes_model_decision/context logs.',
       'MITIGATED_FOR_TEST',
       'hermes-20260519-143528-3264437'
FROM db_root
WHERE NOT EXISTS (
  SELECT 1 FROM hermes_agent_gap_registry WHERE agent_gap_id = 'gap-supergemma26-json-mode'
);

DELETE FROM db_patch_history
WHERE patch_id = '20260519_016_supergemma26_main_judge_test';

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
    '20260519_016_supergemma26_main_judge_test',
    'SuperGemma 26B temporary main judge test activation',
    'ai-agent',
    'carbonet-prod',
    'RUNTIME_POLICY',
    'MEDIUM',
    'SUCCESS',
    '/opt/Resonance/ops/db/carbonet/20260519_016_supergemma26_main_judge_test.sql',
    'Record SuperGemma 26B on 24036 as temporary Hermes/Codex judge-path benchmark with JSON-mode mitigation and Qwen40 restore gate',
    NULL,
    CURRENT_DATETIME,
    'codex',
    'SuperGemma 26B is test-active on the main judge path; Qwen3.6 40B config is backed up and should be restored for final high-risk decisions until benchmark completes',
    CURRENT_DATETIME
);

COMMIT;
