UPDATE emission_material_translation
SET korean_name = '코크스',
    english_name = 'coke',
    english_exact_name = 'coke',
    mapping_note = 'qwen40 product translation with Carbonet industrial glossary correction',
    last_updt_pnttm = CURRENT_DATETIME
WHERE raw_name LIKE 'ecoinvent:%'
  AND source_type = 'QWEN40_PRODUCT_TRANSLATION'
  AND english_name = 'coke';

UPDATE emission_material_translation
SET korean_name = '강재 딥 드로잉, 3500 kN 프레스, 단일 스트로크',
    english_name = 'deep drawing, steel, 3500 kN press, single stroke',
    english_exact_name = 'deep drawing, steel, 3500 kN press, single stroke',
    mapping_note = 'qwen40 product translation with Carbonet industrial glossary correction',
    last_updt_pnttm = CURRENT_DATETIME
WHERE raw_name = 'ecoinvent:1184';

UPDATE emission_material_translation
SET korean_name = '무수 플루오로규산, 22% 용액 상태',
    english_name = 'fluosilicic acid, without water, in 22% solution state',
    english_exact_name = 'fluosilicic acid, without water, in 22% solution state',
    mapping_note = 'qwen40 product translation with Carbonet industrial glossary correction',
    last_updt_pnttm = CURRENT_DATETIME
WHERE raw_name = 'ecoinvent:1190';

DELETE FROM db_patch_history
WHERE patch_id = '20260515_004_ecoinvent_industrial_glossary_correction';

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
    '20260515_004_ecoinvent_industrial_glossary_correction',
    'Correct ecoinvent industrial product translation glossary',
    'ai-agent',
    'carbonet-prod',
    'DATA_FIX',
    'LOW',
    'SUCCESS',
    '/opt/Resonance/ops/db/carbonet/20260515_004_ecoinvent_industrial_glossary_correction.sql',
    'Correct coke/deep drawing/fluosilicic acid Korean product names and keep worker glossary aligned',
    NULL,
    CURRENT_DATETIME,
    'codex',
    'Applied Carbonet industrial glossary corrections to QWEN40 product translations',
    CURRENT_DATETIME
);

COMMIT;
