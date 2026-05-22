UPDATE emission_material_translation
SET korean_name = NULL,
    mapping_note = 'pending Qwen Korean product-name translation; Korean display placeholder cleared',
    last_updt_pnttm = CURRENT_DATETIME
WHERE raw_name LIKE 'ecoinvent:%'
  AND mapping_status = 'PRODUCT_KO_PENDING_AI'
  AND korean_name IS NOT NULL
  AND NOT korean_name REGEXP '[가-힣]';

DELETE FROM db_patch_history
WHERE patch_id = '20260516_001_ecoinvent_pending_korean_placeholder_cleanup';

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
    '20260516_001_ecoinvent_pending_korean_placeholder_cleanup',
    'Clear pending ecoinvent Korean-name placeholders',
    'ai-agent',
    'carbonet-prod',
    'DATA_FIX',
    'LOW',
    'SUCCESS',
    '/opt/Resonance/ops/db/carbonet/20260516_001_ecoinvent_pending_korean_placeholder_cleanup.sql',
    'Set korean_name NULL for PRODUCT_KO_PENDING_AI rows whose korean_name is still an English product-name placeholder',
    NULL,
    CURRENT_DATETIME,
    'codex',
    'Pending ecoinvent Korean-name placeholders cleared so untranslated product names are not displayed as Korean names',
    CURRENT_DATETIME
);

COMMIT;
