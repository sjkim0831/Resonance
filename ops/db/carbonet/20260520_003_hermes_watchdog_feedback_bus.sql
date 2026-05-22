-- Hermes watchdog feedback bus.
-- Purpose: make the CPU 7B supervisor feedback durable in hermes_runtime_snapshot
-- and require the next Hermes/Qwen40 interpretation to read the compact feedback
-- block before selecting the next stage.

UPDATE hermes_agent_gap_registry
   SET mitigation_policy = 'Use Qwen2.5 Coder 7B CPU as a watchdog. Record checkpoints at task-stage/command-result/error boundaries, store compact feedback in JSONL and hermes_runtime_snapshot, and feed recent feedback back to Qwen40 before the next stage. Do not write per-token DB logs.',
       status = 'MITIGATED_WITH_FEEDBACK_BUS',
       evidence_ref = '/opt/Resonance/var/ai-runtime/hermes-watchdog/hermes-watchdog-events.jsonl, hermes_runtime_snapshot.WATCHDOG_FEEDBACK',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE agent_gap_id = 'gap-hermes-runtime-watchdog';

INSERT INTO hermes_work_checkpoint_template
  (checkpoint_template_id, project_id, pattern_id, checkpoint_order, checkpoint_code, checkpoint_stage, checkpoint_name, instruction, command_template, expected_evidence, report_policy, rework_trigger, restore_anchor_policy)
SELECT 'HERMES-WATCHDOG-FEEDBACK-BUS-010',
       'carbonet',
       'HERMES_RUNTIME_WATCHDOG_SUPERVISION',
       35,
       'WATCHDOG_FEEDBACK_BUS',
       'CHECKPOINT_WATCH',
       'Persist watchdog feedback before the next Hermes stage',
       'Run the 7B watchdog on each Hermes checkpoint, append JSONL evidence, insert hermes_runtime_snapshot.WATCHDOG_FEEDBACK, and include recent feedback in the next hermes-record-request modelDecision.watchdogFeedbackBlock.',
       'bash ops/scripts/hermes-watchdog-checkpoint.sh <plan-json> <stage> <note>',
       'hermes-watchdog-events.jsonl row, hermes_runtime_snapshot row, modelDecision.watchdogFeedbackBlock',
       'If DB write fails, keep JSONL evidence and continue; the watchdog must never stop the primary Hermes workflow.',
       'Repeated HIGH severity watchdog feedback, repeated same command/error, no-output timeout, or claimed success without evidence.',
       'Previous hermes_runtime_snapshot.WATCHDOG_FEEDBACK row and plan JSON path.'
FROM db_root
WHERE NOT EXISTS (
  SELECT 1 FROM hermes_work_checkpoint_template WHERE checkpoint_template_id = 'HERMES-WATCHDOG-FEEDBACK-BUS-010'
);

INSERT INTO hermes_development_pattern_step
  (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-040',
       'HERMES_RUNTIME_WATCHDOG_SUPERVISION',
       40,
       'FEEDBACK_BUS',
       'Persist watchdog feedback to DB snapshot memory',
       'After a checkpoint review, write the compact 7B feedback to hermes_runtime_snapshot with snapshot_type WATCHDOG_FEEDBACK, then pass recent feedback into the next modelDecision.watchdogFeedbackBlock.',
       'hermes_runtime_snapshot.WATCHDOG_FEEDBACK, modelDecision.watchdogFeedbackBlock',
       'QWEN7_SUPERVISOR'
FROM db_root
WHERE NOT EXISTS (
  SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-040'
);

INSERT INTO hermes_development_pattern_check
  (pattern_check_id, pattern_id, check_order, check_type, command_template, pass_criteria)
SELECT 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-C020',
       'HERMES_RUNTIME_WATCHDOG_SUPERVISION',
       20,
       'DB_QUERY',
       'select hermes_snapshot_id, hermes_task_id, snapshot_type, collected_by from hermes_runtime_snapshot where snapshot_type=''WATCHDOG_FEEDBACK'' order by frst_regist_pnttm desc limit 3;',
       'At least one new WATCHDOG_FEEDBACK row appears after hermes-watchdog-checkpoint.sh runs.'
FROM db_root
WHERE NOT EXISTS (
  SELECT 1 FROM hermes_development_pattern_check WHERE pattern_check_id = 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-C020'
);

INSERT INTO hermes_development_pattern_check
  (pattern_check_id, pattern_id, check_order, check_type, command_template, pass_criteria)
SELECT 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-C030',
       'HERMES_RUNTIME_WATCHDOG_SUPERVISION',
       30,
       'MODEL_PROMPT_CHECK',
       'printf ''{\"checkpointStage\":\"REQUEST_RECORDED\",\"checkpointNote\":\"normal checkpoint\"}'' | /usr/local/bin/resonance-model-ask watchdog',
       'For a normal checkpoint, watchdog returns severity LOW and signals [] instead of copying the full risk taxonomy.'
FROM db_root
WHERE NOT EXISTS (
  SELECT 1 FROM hermes_development_pattern_check WHERE pattern_check_id = 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-C030'
);

DELETE FROM db_patch_history
WHERE patch_id = '20260520_003_hermes_watchdog_feedback_bus';

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
    '20260520_003_hermes_watchdog_feedback_bus',
    'Hermes watchdog feedback bus to DB snapshot memory',
    'ai-agent',
    'carbonet-prod',
    'RUNTIME_POLICY',
    'LOW',
    'SUCCESS',
    '/opt/Resonance/ops/db/carbonet/20260520_003_hermes_watchdog_feedback_bus.sql',
    'Persist 7B watchdog checkpoint feedback in hermes_runtime_snapshot and require the next Hermes plan to read watchdogFeedbackBlock.',
    NULL,
    CURRENT_DATETIME,
    'codex',
    'Hermes watchdog feedback now has JSONL plus DB snapshot evidence and is fed back into subsequent modelDecision context.',
    CURRENT_DATETIME
);

COMMIT;
