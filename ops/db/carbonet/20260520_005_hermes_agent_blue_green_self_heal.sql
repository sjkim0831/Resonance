-- Hermes agent blue/green self-heal automation.
-- Purpose: keep the active Hermes runtime immutable while 7B/40B diagnose
-- failures, prepare a next release, run smoke tests, and hand the original
-- resume command back to the operator.

INSERT INTO hermes_agent_gap_registry
  (agent_gap_id, project_id, gap_order, gap_area, gap_name, gap_summary, mitigation_policy, status, evidence_ref)
SELECT 'gap-hermes-agent-self-repair-active-runtime', 'carbonet', 39, 'agent-runtime',
       'Hermes can break itself if repaired inside the active runtime folder',
       'Hermes agent source, venv, and CLI entrypoint are part of the running runtime. Patching that folder directly can break resume/import/config before recovery finishes.',
       'Use blue/green release folders. Keep hermes-agent-active immutable, copy to hermes-agent-next, let 40B produce a repair plan, apply only complete safe patches to next, smoke test next, and promote only after deterministic tests or operator approval. Always write a handoff with the original resume command.',
       'MITIGATED_WITH_BLUE_GREEN_SELF_HEAL',
       '/opt/Resonance/ops/scripts/hermes-agent-self-heal.sh'
FROM db_root
WHERE NOT EXISTS (
  SELECT 1 FROM hermes_agent_gap_registry WHERE agent_gap_id = 'gap-hermes-agent-self-repair-active-runtime'
);

INSERT INTO hermes_work_checkpoint_template
  (checkpoint_template_id, project_id, pattern_id, checkpoint_order, checkpoint_code, checkpoint_stage, checkpoint_name, instruction, command_template, expected_evidence, report_policy, rework_trigger, restore_anchor_policy)
SELECT 'HERMES-AGENT-BLUE-GREEN-SELF-HEAL-010',
       'carbonet',
       'HERMES_RUNTIME_WATCHDOG_SUPERVISION',
       55,
       'AGENT_SELF_HEAL',
       'REFLECT',
       'Repair Hermes in next release after agent failure',
       'When Hermes exits non-zero, store failure evidence, call Qwen40 for a repair plan, prepare hermes-agent-next from active, optionally apply a safe unified diff to next, run smoke tests, and write a handoff with original resume id.',
       'bash ops/scripts/hermes-agent-self-heal.sh <task-id> <exit-code> <stdout-ref> <stderr-ref> [hermes args...]',
       'HERMES_AGENT_FAILURE snapshot, HERMES_AGENT_REPAIR_PLAN snapshot, next release smoke output, handoff.md',
       'Automatic promotion is gated by Qwen40 promoteRecommended=true plus smoke success. Set HERMES_AGENT_SELF_HEAL_AUTO_PROMOTE=0 to force operator-only promotion.',
       'Hermes exit_code != 0, resume failure, import failure, context window refusal, repeated runtime loop, or tool initialization failure.',
       'hermes-agent-active symlink, hermes-agent-rollback symlink, original resume command.'
FROM db_root
WHERE NOT EXISTS (
  SELECT 1 FROM hermes_work_checkpoint_template WHERE checkpoint_template_id = 'HERMES-AGENT-BLUE-GREEN-SELF-HEAL-010'
);

INSERT INTO hermes_development_pattern_step
  (pattern_step_id, pattern_id, step_order, stage_code, step_title, step_instruction, expected_evidence, allowed_executor)
SELECT 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-060',
       'HERMES_RUNTIME_WATCHDOG_SUPERVISION',
       60,
       'BLUE_GREEN_SELF_HEAL',
       'Blue/green repair instead of active-folder mutation',
       'For Hermes agent failures, never patch the active runtime folder directly. Prepare next, ask Qwen40 for a repair plan, smoke test next, then leave a handoff and resume command. Promotion requires deterministic smoke proof and the configured gate.',
       'HERMES_AGENT_FAILURE, HERMES_AGENT_REPAIR_PLAN, smoke.out, handoff.md',
       'QWEN40_MAIN'
FROM db_root
WHERE NOT EXISTS (
  SELECT 1 FROM hermes_development_pattern_step WHERE pattern_step_id = 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-060'
);

INSERT INTO hermes_development_pattern_check
  (pattern_check_id, pattern_id, check_order, check_type, command_template, pass_criteria)
SELECT 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-C060',
       'HERMES_RUNTIME_WATCHDOG_SUPERVISION',
       60,
       'SCRIPT',
       'bash -n ops/scripts/hermes-agent-release-manager.sh ops/scripts/hermes-agent-self-heal.sh ops/scripts/hermes-next.sh ops/scripts/hermes-agent-promote.sh ops/scripts/hermes-agent-rollback.sh ops/scripts/hermes-launcher.sh ops/scripts/resonance-model-ask.sh',
       'exit_code=0'
FROM db_root
WHERE NOT EXISTS (
  SELECT 1 FROM hermes_development_pattern_check WHERE pattern_check_id = 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-C060'
);

INSERT INTO hermes_development_pattern_check
  (pattern_check_id, pattern_id, check_order, check_type, command_template, pass_criteria)
SELECT 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-C070',
       'HERMES_RUNTIME_WATCHDOG_SUPERVISION',
       70,
       'DB_QUERY',
       'select hermes_snapshot_id, hermes_task_id, snapshot_type, collected_by from hermes_runtime_snapshot where snapshot_type in (''HERMES_AGENT_FAILURE'',''HERMES_AGENT_REPAIR_PLAN'') order by frst_regist_pnttm desc limit 5;',
       'Agent failure and repair plan snapshots are written after hermes-agent-self-heal.sh runs.'
FROM db_root
WHERE NOT EXISTS (
  SELECT 1 FROM hermes_development_pattern_check WHERE pattern_check_id = 'HERMES_RUNTIME_WATCHDOG_SUPERVISION-C070'
);

DELETE FROM db_patch_history
WHERE patch_id = '20260520_005_hermes_agent_blue_green_self_heal';

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
    '20260520_005_hermes_agent_blue_green_self_heal',
    'Hermes blue/green agent self-heal automation',
    'ai-agent',
    'carbonet-prod',
    'RUNTIME_POLICY',
    'MEDIUM',
    'SUCCESS',
    '/opt/Resonance/ops/db/carbonet/20260520_005_hermes_agent_blue_green_self_heal.sql',
    'Register Hermes active/next/rollback release folders, 40B repair planning, smoke-test gate, and original resume handoff.',
    NULL,
    CURRENT_DATETIME,
    'codex',
    'Hermes failures now trigger a blue/green self-heal pipeline that writes failure and repair snapshots and preserves the original resume command.',
    CURRENT_DATETIME
);

COMMIT;
