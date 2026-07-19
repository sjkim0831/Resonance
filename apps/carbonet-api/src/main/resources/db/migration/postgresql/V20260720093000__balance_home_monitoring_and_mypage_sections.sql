-- Keep mega-menu sections useful: earlier cleanup left H10503, H10802 and
-- H10803 empty while their items remained concentrated in the first section.
CREATE TEMP TABLE home_menu_reparent (
    source_code varchar(20) PRIMARY KEY,
    target_code varchar(20) UNIQUE NOT NULL
) ON COMMIT DROP;

INSERT INTO home_menu_reparent(source_code, target_code) VALUES
('H1050107','H1050201'), ('H1050108','H1050202'), ('H1050109','H1050203'),
('H1050110','H1050301'), ('H1050111','H1050302'), ('H1050112','H1050303'),
('H1080104','H1080201'), ('H1080105','H1080202'),
('H1080106','H1080301'), ('H1080107','H1080302'), ('H1080108','H1080303'),
('H1080109','H1080304'), ('H1080110','H1080305'), ('H1080111','H1080306');

INSERT INTO comtnmenuinfo
    (menu_code, menu_nm, menu_nm_en, menu_url, menu_icon, use_at,
     frst_regist_pnttm, last_updt_pnttm, expsr_at)
SELECT r.target_code, source.menu_nm, source.menu_nm_en, source.menu_url,
       source.menu_icon, 'Y', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Y'
FROM home_menu_reparent r
JOIN comtnmenuinfo source ON source.menu_code = r.source_code
ON CONFLICT (menu_code) DO UPDATE SET
    menu_nm = EXCLUDED.menu_nm,
    menu_nm_en = EXCLUDED.menu_nm_en,
    menu_url = EXCLUDED.menu_url,
    menu_icon = EXCLUDED.menu_icon,
    use_at = 'Y', expsr_at = 'Y', last_updt_pnttm = CURRENT_TIMESTAMP;

INSERT INTO comtnmenuorder(menu_code, sort_ordr, frst_regist_pnttm, last_updt_pnttm)
SELECT r.target_code, coalesce(o.sort_ordr, 9999), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM home_menu_reparent r
LEFT JOIN comtnmenuorder o ON o.menu_code = r.source_code
ON CONFLICT (menu_code) DO UPDATE SET
    sort_ordr = EXCLUDED.sort_ordr, last_updt_pnttm = CURRENT_TIMESTAMP;

INSERT INTO comtccmmndetailcode
    (code_id, code, code_nm, code_dc, use_at, frst_regist_pnttm,
     frst_register_id, last_updt_pnttm, last_updusr_id)
SELECT 'HMENU1', r.target_code, m.menu_nm, m.menu_url, 'Y', CURRENT_TIMESTAMP,
       'HOME_MENU_REPARENT', CURRENT_TIMESTAMP, 'HOME_MENU_REPARENT'
FROM home_menu_reparent r
JOIN comtnmenuinfo m ON m.menu_code = r.target_code
ON CONFLICT (code_id, code) DO UPDATE SET
    code_nm = EXCLUDED.code_nm, code_dc = EXCLUDED.code_dc, use_at = 'Y',
    last_updt_pnttm = CURRENT_TIMESTAMP, last_updusr_id = 'HOME_MENU_REPARENT';

UPDATE comtnmenuinfo
SET use_at = 'N', expsr_at = 'N', last_updt_pnttm = CURRENT_TIMESTAMP
WHERE menu_code IN (SELECT source_code FROM home_menu_reparent);

UPDATE comtccmmndetailcode
SET use_at = 'N', last_updt_pnttm = CURRENT_TIMESTAMP,
    last_updusr_id = 'HOME_MENU_REPARENT'
WHERE code_id = 'HMENU1'
  AND code IN (SELECT source_code FROM home_menu_reparent);

DO $$
DECLARE invalid_sections integer;
BEGIN
    SELECT count(*) INTO invalid_sections
    FROM (VALUES ('H105',3,12), ('H108',3,11)) expected(root_code, section_count, item_count)
    WHERE (SELECT count(*) FROM comtnmenuinfo m
           WHERE m.menu_code LIKE expected.root_code || '__' AND length(m.menu_code)=6
             AND m.use_at='Y' AND m.expsr_at='Y') <> expected.section_count
       OR (SELECT count(*) FROM comtnmenuinfo m
           WHERE m.menu_code LIKE expected.root_code || '____' AND length(m.menu_code)=8
             AND m.use_at='Y' AND m.expsr_at='Y') <> expected.item_count
       OR EXISTS (
           SELECT 1 FROM comtnmenuinfo middle
           WHERE middle.menu_code LIKE expected.root_code || '__'
             AND length(middle.menu_code)=6 AND middle.use_at='Y' AND middle.expsr_at='Y'
             AND NOT EXISTS (
                 SELECT 1 FROM comtnmenuinfo leaf
                 WHERE leaf.menu_code LIKE middle.menu_code || '__'
                   AND length(leaf.menu_code)=8 AND leaf.use_at='Y' AND leaf.expsr_at='Y'
             )
       );
    IF invalid_sections > 0 THEN
        RAISE EXCEPTION 'home menu section balancing failed for % domains', invalid_sections;
    END IF;
END $$;
