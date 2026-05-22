-- SuperGemma 26B Hermes minimum context fix.
-- Purpose: record the runtime correction from 32K to 64K because Hermes Agent
-- requires at least 64,000 tokens to initialize.

UPDATE hermes_model_candidate_registry
   SET allowed_use = 'Temporary Hermes/Codex judge-path benchmark on port 24036 with 65,536 context. Normal work may use it only with JSON response_format, DB/RAG/team preflight, and deterministic verification.',
       benchmark_gate = 'Hermes minimum context is satisfied at 65,536. Continue comparing against Qwen3.6 40B on Carbonet planning JSON, layout-first page planning, API/DB/authority reasoning, and verification failure interpretation.',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE candidate_model_id = 'candidate-supergemma4-26b-uncensored-gguf-v2';

UPDATE hermes_model_lane_policy
   SET allowed_work = 'Temporary main judge benchmark on the existing 24036 judge path with 65,536 context. Use response_format=json_object for Hermes planning. Keep Qwen2.5 Coder 7B as primary fast-draft and deterministic scripts as source of truth.',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE lane_id = 'judge';

INSERT INTO hermes_agent_gap_registry
  (agent_gap_id, project_id, gap_order, gap_area, gap_name, gap_summary, mitigation_policy, status, evidence_ref)
SELECT 'gap-supergemma26-context64k', 'carbonet', 36, 'model', 'SuperGemma 26B was initially below Hermes minimum context',
       'Hermes Agent refused to initialize at 32,768 context because it requires at least 64,000 tokens.',
       'Set /etc/default/codex-qwen36 QWEN36_CONTEXT=65536 and /home/sjkim/.hermes/config.yaml context_length/n_ctx=65536 for the SuperGemma test model.',
       'MITIGATED',
       '/opt/Resonance/var/backups/supergemma26-context64k-20260519-144735'
FROM db_root
WHERE NOT EXISTS (
  SELECT 1 FROM hermes_agent_gap_registry WHERE agent_gap_id = 'gap-supergemma26-context64k'
);

DELETE FROM db_patch_history
WHERE patch_id = '20260519_017_supergemma26_context64k_fix';

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
    '20260519_017_supergemma26_context64k_fix',
    'SuperGemma 26B Hermes 64K context fix',
    'ai-agent',
    'carbonet-prod',
    'RUNTIME_POLICY',
    'LOW',
    'SUCCESS',
    '/opt/Resonance/ops/db/carbonet/20260519_017_supergemma26_context64k_fix.sql',
    'Raise SuperGemma 26B runtime and Hermes config from 32K to 64K to satisfy Hermes Agent minimum context requirement',
    NULL,
    CURRENT_DATETIME,
    'codex',
    'Hermes one-shot initialization succeeded with SuperGemma 26B at 65,536 context',
    CURRENT_DATETIME
);

COMMIT;
