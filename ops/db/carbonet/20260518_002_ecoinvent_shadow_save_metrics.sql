ALTER TABLE emission_material_translation
ADD COLUMN shadow_saved_at DATETIME;

ALTER TABLE emission_material_translation
ADD COLUMN shadow_save_elapsed_ms BIGINT;

DELETE FROM db_patch_history
WHERE patch_id = '20260518_002_ecoinvent_shadow_save_metrics';

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
    '20260518_002_ecoinvent_shadow_save_metrics',
    'Add ecoinvent shadow DB save metrics',
    'ai-agent',
    'carbonet-prod',
    'SCHEMA_EXTEND',
    'LOW',
    'SUCCESS',
    '/opt/Resonance/ops/db/carbonet/20260518_002_ecoinvent_shadow_save_metrics.sql',
    'Add shadow_saved_at and shadow_save_elapsed_ms to measure shadow worker DB write timing in DBeaver',
    NULL,
    CURRENT_DATETIME,
    'codex',
    'Added shadow save timestamp and elapsed milliseconds columns',
    CURRENT_DATETIME
);

COMMIT;
