-- Development migration: separate general My Page inbox from emission-specific work.
-- ui_page_manifest and framework_dynamic_page_version remain the single SDUI registry/version source.
-- Required permissions are stored in the immutable definition_json version snapshot.
-- The old home-dashboard alias is hidden so each work page has one canonical active menu route.
UPDATE comtnmenuinfo
   SET expsr_at='N', last_updt_pnttm=current_timestamp
 WHERE menu_code='H1010102';

UPDATE comtnmenuinfo
   SET menu_nm='탄소배출 내 업무', menu_nm_en='Emission My Tasks',
       menu_url='/emission/my-tasks', last_updt_pnttm=current_timestamp
 WHERE menu_code='H1020103';

UPDATE comtccmmndetailcode
   SET code_nm='내 업무 요약', code_dc='/emission/my-tasks', last_updt_pnttm=current_timestamp
 WHERE code_id='HMENU1' AND code='H1010102';

UPDATE comtccmmndetailcode
   SET code_nm='탄소배출 내 업무', code_dc='Emission My Tasks', last_updt_pnttm=current_timestamp
 WHERE code_id='HMENU1' AND code='H1020103';

-- Keep the My Page group as a landing/container and place general tasks under its 업무·승인 section.
UPDATE comtnmenuinfo
   SET menu_url='#', last_updt_pnttm=current_timestamp
 WHERE menu_code='H10802';

UPDATE comtccmmndetailcode
   SET code_dc='#', last_updt_pnttm=current_timestamp
 WHERE code_id='HMENU1' AND code='H10802';

-- The approval inbox is not the emission task inbox; route it to the existing approval tab.
UPDATE comtnmenuinfo
   SET menu_url='/emission/validate?tab=approval', last_updt_pnttm=current_timestamp
 WHERE menu_code='H1080202';

UPDATE comtccmmndetailcode
   SET code_dc='/emission/validate?tab=approval', last_updt_pnttm=current_timestamp
 WHERE code_id='HMENU1' AND code='H1080202';

INSERT INTO comtnmenuinfo
    (menu_code, menu_nm, menu_nm_en, menu_url, menu_icon, use_at,
     frst_regist_pnttm, last_updt_pnttm, expsr_at, dependent_screen_code)
VALUES
    ('H1080203', '일반 내 업무', 'General My Tasks', '/mypage/my-tasks', 'assignment', 'Y',
     current_timestamp, current_timestamp, 'Y', NULL)
ON CONFLICT (menu_code) DO UPDATE SET
    menu_nm=EXCLUDED.menu_nm, menu_nm_en=EXCLUDED.menu_nm_en,
    menu_url=EXCLUDED.menu_url, menu_icon=EXCLUDED.menu_icon,
    use_at=EXCLUDED.use_at, expsr_at=EXCLUDED.expsr_at,
    last_updt_pnttm=current_timestamp;

INSERT INTO comtnmenuorder
    (menu_code, sort_ordr, frst_regist_pnttm, last_updt_pnttm)
VALUES ('H1080203', 6, current_timestamp, current_timestamp)
ON CONFLICT (menu_code) DO UPDATE SET
    sort_ordr=EXCLUDED.sort_ordr, last_updt_pnttm=current_timestamp;

INSERT INTO comtccmmndetailcode
    (code_id, code, code_nm, code_dc, use_at, frst_regist_pnttm,
     frst_register_id, last_updt_pnttm, last_updusr_id)
VALUES
    ('HMENU1', 'H1080203', '일반 내 업무', '/mypage/my-tasks', 'Y', current_timestamp,
     'WORKFLOW_SPLIT', current_timestamp, 'WORKFLOW_SPLIT')
ON CONFLICT (code_id, code) DO UPDATE SET
    code_nm=EXCLUDED.code_nm, code_dc=EXCLUDED.code_dc,
    use_at=EXCLUDED.use_at, last_updt_pnttm=current_timestamp,
    last_updusr_id='WORKFLOW_SPLIT';
