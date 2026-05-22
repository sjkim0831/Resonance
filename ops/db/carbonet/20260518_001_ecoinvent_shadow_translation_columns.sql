ALTER TABLE emission_material_translation
ADD COLUMN shadow_translation_json VARCHAR(4000);

ALTER TABLE emission_material_translation
ADD COLUMN shadow_translation_status VARCHAR(80);

DELETE FROM db_patch_history
WHERE patch_id = '20260518_001_ecoinvent_shadow_translation_columns';

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
    '20260518_001_ecoinvent_shadow_translation_columns',
    'Add ecoinvent shadow translation result columns',
    'ai-agent',
    'carbonet-prod',
    'SCHEMA_EXTEND',
    'LOW',
    'SUCCESS',
    '/opt/Resonance/ops/db/carbonet/20260518_001_ecoinvent_shadow_translation_columns.sql',
    'Add shadow_translation_json and shadow_translation_status to emission_material_translation for non-final small-model comparison',
    NULL,
    CURRENT_DATETIME,
    'codex',
    'Added shadow translation columns for small-model comparison without changing final Korean/English mapping',
    CURRENT_DATETIME
);

COMMIT;
