-- Hermes live watchdog supervision.
-- Purpose: make every Hermes launcher session use CPU 7B supervision during
-- execution, not only during initial request recording.

UPDATE hermes_agent_gap_registry
   SET mitigation_policy = 'Use Qwen2.5 Coder 7B CPU as both preflight watchdog and live session supervisor. Record checkpoints, transcript/stdout tail samples, no-output stalls, repeated lines, repeated errors, and evidence gaps into JSONL and hermes_runtime_snapshot. Feedback is advisory and must not kill Hermes by itself.',
       status = 'MITIGATED_WITH_LIVE_SUPERVISION',
       evidence_ref = '/opt/Resonance/ops/scripts/hermes-live-watchdog.sh, hermes_runtime_snapshot.HERMES_LIVE_WATCHDOG',
       last_updt_pnttm = CURRENT_DATETIME
 WHERE agent_gap_id = 'gap-hermes-runtime-watchdog';

INSERT INTO hermes_work_checkpoint_template
  (checkpoint_template_id, project_id, pattern_id, checkpoint_order, checkpoint_code, checkpoint_stage, checkpoint_name, instruction, command_template, expected_evidence, report_policy, rework_trigger, restore_anchor_policy)
SELECT 'HERMES-LIVE-WATCHDOG-010',
       'carbonet',
       'HERMES_RUNTIME_WATCHDOG_SUPERVISION',
       45,
       'LIVE_WATCHDOG',
       'IMPLEMENT',
       'Live 7B supervision while Hermes executes',
       'During Hermes interactive or single-query execution, sample transcript/stdout tails with hermes-live-watchdog.sh. Detect repeated command/error, no-output stall, iteration budget, model endpoint mismatch, and success without evidence.',
       'bash ops/scripts/hermes-live-watchdog.sh <task-id> <observed-file> <stage> <note>',
       'hermes-live-watchdog-events.jsonl row, hermes_runtime_snapshot.HERMES_LIVE_WATCHDOG row',
       'The live watchdog records evidence and recommends next action; it must not stop Hermes unless a separate deterministic guard or operator approval does so.',
       'HIGH severity live watchdog feedback, repeated identical output, no output beyond stall threshold, iteration budget reached, or success without route/build/DB evidence.',
       'Latest HERMES_LIVE_WATCHDOG and HERMES_TRANSCRIPT_TAIL snapshots.'
FROM db_root
WHERE NOT EXISTS (
  SELECT 1 FROM hermes_work_checkpoint_template WHERE checkpoint_template_id = 'HERMES-LIVE-WATCHDOG-010'
);

INSERT INTO hermes_development_pattern_step
  (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-050',
       'HERMES_RUNTIME_WATCHDOG_SUPERVISION',
       50,
       'LIVE_SUPERVISION',
       'Run 7B live watchdog during Hermes execution',
       'Use hermes-launcher.sh to attach hermes-live-watchdog.sh to transcript/stdout tails. Store live feedback in hermes_runtime_snapshot and feed later compact findings into subsequent requests.',
       'HERMES_LIVE_WATCHDOG snapshot, live watchdog JSONL, launcher stdout/stderr refs',
       'QWEN7_SUPERVISOR'
FROM db_root
WHERE NOT EXISTS (
  SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-050'
);

INSERT INTO hermes_development_pattern_check
  (pattern_check_id, pattern_id, check_order, check_type, command_template, pass_criteria)
SELECT 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-C040',
       'HERMES_RUNTIME_WATCHDOG_SUPERVISION',
       40,
       'SCRIPT',
       'bash -n ops/scripts/hermes-launcher.sh ops/scripts/hermes-live-watchdog.sh ops/scripts/hermes-watchdog-checkpoint.sh ops/scripts/hermes-record-request.sh ops/scripts/resonance-model-ask.sh',
       'exit_code=0'
FROM db_root
WHERE NOT EXISTS (
  SELECT 1 FROM hermes_development_pattern_check WHERE pattern_check_id = 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-C040'
);

INSERT INTO hermes_development_pattern_check
  (pattern_check_id, pattern_id, check_order, check_type, command_template, pass_criteria)
SELECT 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-C050',
       'HERMES_RUNTIME_WATCHDOG_SUPERVISION',
       50,
       'DB_QUERY',
       'select hermes_snapshot_id, hermes_task_id, snapshot_type, collected_by from hermes_runtime_snapshot where snapshot_type=''HERMES_LIVE_WATCHDOG'' order by frst_regist_pnttm desc limit 3;',
       'At least one HERMES_LIVE_WATCHDOG row appears after hermes-live-watchdog.sh runs.'
FROM db_root
WHERE NOT EXISTS (
  SELECT 1 FROM hermes_development_pattern_check WHERE pattern_check_id = 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-C050'
);

DELETE FROM db_patch_history
WHERE patch_id = '20260520_004_hermes_live_watchdog_supervision';

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
    '20260520_004_hermes_live_watchdog_supervision',
    'Hermes live 7B watchdog supervision',
    'ai-agent',
    'carbonet-prod',
    'RUNTIME_POLICY',
    'MEDIUM',
    'SUCCESS',
    '/opt/Resonance/ops/db/carbonet/20260520_004_hermes_live_watchdog_supervision.sql',
    'Attach CPU 7B watchdog to Hermes launcher transcript/stdout tails and persist live supervision feedback.',
    NULL,
    CURRENT_DATETIME,
    'codex',
    'Every Hermes launcher session can now be supervised by Qwen2.5 Coder 7B during execution, with live feedback stored as HERMES_LIVE_WATCHDOG snapshots.',
    CURRENT_DATETIME
);

COMMIT;
