UPDATE emission_material_translation
SET mapping_status = 'PRODUCT_KO_PENDING_AI',
    source_type = 'ECOINVENT_PRODUCT_EXACT',
    mapping_note = 'reset non-Korean korean_name for Qwen retranslation',
    korean_name = english_name,
    english_exact_name = english_name,
    last_updt_pnttm = CURRENT_DATETIME
WHERE raw_name LIKE 'ecoinvent:%'
  AND source_type = 'QWEN40_PRODUCT_TRANSLATION'
  AND NOT korean_name REGEXP '[가-힣]';

DELETE FROM db_patch_history
WHERE patch_id = '20260515_003_ecoinvent_non_korean_translation_reset';

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
    '20260515_003_ecoinvent_non_korean_translation_reset',
    'Reset non-Korean ecoinvent Korean product names',
    'ai-agent',
    'carbonet-prod',
    'DATA_FIX',
    'LOW',
    'SUCCESS',
    '/opt/Resonance/ops/db/carbonet/20260515_003_ecoinvent_non_korean_translation_reset.sql',
    'Reset QWEN40 rows whose korean_name has no Hangul so worker retranslates them',
    NULL,
    CURRENT_DATETIME,
    'codex',
    'Non-Korean Korean-name rows reset to PRODUCT_KO_PENDING_AI for stricter Qwen translation',
    CURRENT_DATETIME
);

COMMIT;
