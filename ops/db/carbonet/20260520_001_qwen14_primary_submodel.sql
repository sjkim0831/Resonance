-- Qwen2.5 Coder 14B primary submodel activation.
-- Purpose: replace the 7B fast-draft/classifier submodel with the 14B
-- coder shadow on the same local endpoint (:24751) while keeping 7B as a
-- rollback fallback.

UPDATE hermes_model_lane_policy
   SET preferred_model = 'qwen2.5-coder-14b-instruct-shadow',
       preferred_base_url = 'http://127.0.0.1:24751/v1',
       fallback_model_json = '["qwen2.5-coder-7b-instruct-shadow","qwen2.5-instruct:3b","qwen2.5-instruct:1.5b","qwen2.5-instruct:0.5b","supergemma4-26b-uncensored-q4_k_m"]',
       allowed_work = 'Primary classifier for normal Carbonet development requests: classify task type, summarize logs, propose candidate files, choose a compact context pack, and decide whether judge escalation is needed. 14B is active on :24751; 7B is rollback fallback.',
       escalation_rule_json = '["security_or_permission","db_migration","shared_api_dto_mapper_contract","architecture_decision","confidence_below_0.75","qwen14_endpoint_unavailable"]',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE lane_id = 'dev-classify';

UPDATE hermes_model_lane_policy
   SET preferred_model = 'qwen2.5-coder-14b-instruct-shadow',
       preferred_base_url = 'http://127.0.0.1:24751/v1',
       fallback_model_json = '["qwen2.5-coder-7b-instruct-shadow","supergemma4-26b-uncensored-q4_k_m","qwen3.6-40b-deck-opus-q4"]',
       allowed_work = 'Primary bounded development worker for normal work: intent classification, compact context pack, one-file explanations, small snippets, draft command order from known scripts, and bounded implementation drafts. Codex applies and verifies; judge reviews only escalation cases. 14B is active on :24751; 7B is rollback fallback.',
       escalation_rule_json = '["multiple_file_families","shared_contract_change","security_or_permission","db_migration","verification_failure","confidence_below_0.75","qwen14_endpoint_unavailable"]',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE lane_id = 'fast-draft';

UPDATE hermes_model_lane_policy
   SET preferred_model = 'qwen2.5-coder-14b-instruct-shadow',
       preferred_base_url = 'http://127.0.0.1:24751/v1',
       fallback_model_json = '["qwen2.5-coder-7b-instruct-shadow","supergemma4-26b-uncensored-q4_k_m"]',
       allowed_work = '14B is currently the primary submodel on port 24751. Use this lane name for stronger pattern-draft work and keep judge escalation for risky reasoning.',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE lane_id = 'mid-draft';

UPDATE hermes_agent_team_registry
   SET primary_model = 'Qwen/Qwen2.5-Coder-14B-Instruct',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE team_id IN ('codex55-execution-intelligence','framework-builder','development-rag-governor','model-benchmark');

UPDATE hermes_agent_team_registry
   SET fallback_model = 'Qwen/Qwen2.5-Coder-7B-Instruct',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE team_id = 'framework-builder';

UPDATE hermes_agent_team_registry
   SET model_lane_json = '["dev-classify","fast-draft","judge","verify"]',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE team_id = 'codex55-execution-intelligence';

UPDATE hermes_agent_team_registry
   SET model_lane_json = '["dev-classify","fast-draft","judge","verify"]',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE team_id = 'development-rag-governor';

UPDATE hermes_model_candidate_registry
   SET status = 'PRIMARY_SUBMODEL_ACTIVE',
       allowed_use = 'Primary Hermes fast-draft/classify/context submodel on port 24751. Use for bounded drafts before Codex applies changes and deterministic verification runs.',
       forbidden_use = 'Final authority/security/DB migration/deploy decisions without judge review and script evidence.',
       benchmark_gate = 'Watch latency, GPU memory, JSON validity, candidate path hallucination, and verification pass rate against the prior 7B baseline.',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE candidate_model_id = 'candidate-qwen25-coder-14b';

INSERT INTO hermes_agent_gap_registry
  (agent_gap_id, project_id, gap_order, gap_area, gap_name, gap_summary, mitigation_policy, status, evidence_ref)
SELECT 'gap-qwen14-submodel-gpu-headroom', 'carbonet', 37, 'model', 'Qwen14 primary submodel leaves narrow GPU headroom',
       'SuperGemma 26B 64K plus Qwen2.5 Coder 14B 32K uses about 28.5GB on the 32GB RTX 5090, leaving about 3.6GB free.',
       'Keep qwen14 parallel slots at 1. If CUDA OOM or context pressure appears, stop resonance-shadow-qwen14.service, remove the qwen7 Restart=no override if auto-restart is desired, then re-enable/start resonance-shadow-qwen7.service from the backup.',
       'WATCH',
       '/opt/Resonance/var/backups/qwen14-submodel-test-20260519-150410'
FROM db_root
WHERE NOT EXISTS (
  SELECT 1 FROM hermes_agent_gap_registry WHERE agent_gap_id = 'gap-qwen14-submodel-gpu-headroom'
);

DELETE FROM db_patch_history
WHERE patch_id = '20260520_001_qwen14_primary_submodel';

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
    '20260520_001_qwen14_primary_submodel',
    'Qwen2.5 Coder 14B primary submodel activation',
    'ai-agent',
    'carbonet-prod',
    'RUNTIME_POLICY',
    'MEDIUM',
    'SUCCESS',
    '/opt/Resonance/ops/db/carbonet/20260520_001_qwen14_primary_submodel.sql',
    'Replace 7B submodel with Qwen2.5 Coder 14B on :24751, update Hermes lanes and team registry, keep 7B rollback fallback',
    NULL,
    CURRENT_DATETIME,
    'codex',
    'Qwen2.5 Coder 14B is active as Hermes classify/context/draft submodel on :24751; 7B service is disabled with Restart=no override and kept as rollback fallback',
    CURRENT_DATETIME
);

COMMIT;
