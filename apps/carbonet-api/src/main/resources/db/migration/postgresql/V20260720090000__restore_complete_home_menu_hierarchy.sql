-- Restore the approved customer navigation hierarchy.  The previous cleanup
-- migrations hid entire branches, which made every GNB domain except carbon
-- emissions appear to contain only one menu.
CREATE TEMP TABLE home_route_family (
    menu_prefix varchar(6) PRIMARY KEY,
    menu_url varchar(500) NOT NULL
) ON COMMIT DROP;

INSERT INTO home_route_family(menu_prefix, menu_url) VALUES
('H10301', '/emission/lca'),
('H10302', '/emission/lci'),
('H10303', '/emission/lca'),
('H10304', '/emission/lca'),
('H10401', '/emission/reduction'),
('H10402', '/emission/reduction'),
('H10403', '/emission/reduction'),
('H10404', '/emission/reduction'),
('H10501', '/monitoring/index'),
('H10502', '/monitoring/alerts'),
('H10503', '/monitoring/statistics'),
('H10601', '/co2/index'),
('H10602', '/trade/index'),
('H10603', '/co2/integrity'),
('H10604', '/co2/credit'),
('H10701', '/edu/index'),
('H10702', '/support/faq'),
('H10703', '/support/inquiry'),
('H10801', '/mypage/profile'),
('H10802', '/emission/my-tasks'),
('H10803', '/mypage/notification');

-- Every approved middle/leaf node is selectable.  Top menus, H101/H102 and
-- the legacy H109 archive are intentionally outside this repair scope.
UPDATE comtnmenuinfo m
SET use_at = 'Y',
    expsr_at = 'Y',
    menu_url = r.menu_url,
    last_updt_pnttm = CURRENT_TIMESTAMP
FROM home_route_family r
WHERE m.menu_code LIKE r.menu_prefix || '%'
  AND length(m.menu_code) IN (6, 8);

-- Prefer a concrete leaf route where the application already has one.
UPDATE comtnmenuinfo
SET menu_url = CASE menu_code
    WHEN 'H1030306' THEN '/emission/simulate'
    WHEN 'H1040304' THEN '/monitoring/reduction_trend'
    WHEN 'H1040305' THEN '/emission/simulate'
    WHEN 'H1050101' THEN '/monitoring/dashboard'
    WHEN 'H1050102' THEN '/monitoring/realtime'
    WHEN 'H1050107' THEN '/monitoring/statistics'
    WHEN 'H1050108' THEN '/monitoring/alerts'
    WHEN 'H1050109' THEN '/monitoring/track'
    WHEN 'H1050110' THEN '/monitoring/export'
    WHEN 'H1050111' THEN '/monitoring/export'
    WHEN 'H1050112' THEN '/monitoring/share'
    WHEN 'H1050201' THEN '/monitoring/statistics'
    WHEN 'H1050202' THEN '/monitoring/share'
    WHEN 'H1050203' THEN '/monitoring/export'
    WHEN 'H1060101' THEN '/co2/production_list'
    WHEN 'H1060102' THEN '/co2/demand_list'
    WHEN 'H1060103' THEN '/co2/analysis'
    WHEN 'H1060104' THEN '/co2/search'
    WHEN 'H1060201' THEN '/trade/index'
    WHEN 'H1060202' THEN '/trade/list'
    WHEN 'H1060203' THEN '/trade/market'
    WHEN 'H1060204' THEN '/trade/complete'
    WHEN 'H1060205' THEN '/trade/report'
    WHEN 'H1060301' THEN '/co2/integrity'
    WHEN 'H1060302' THEN '/co2/integrity'
    WHEN 'H1060303' THEN '/co2/integrity'
    WHEN 'H1060304' THEN '/co2/integrity'
    WHEN 'H1060401' THEN '/co2/credit'
    WHEN 'H1060402' THEN '/certificate/index'
    WHEN 'H1060403' THEN '/certificate/list'
    WHEN 'H1060404' THEN '/home/certificate-verify'
    WHEN 'H1070101' THEN '/edu/course_list'
    WHEN 'H1070102' THEN '/edu/apply'
    WHEN 'H1070103' THEN '/edu/my_course'
    WHEN 'H1070104' THEN '/edu/progress'
    WHEN 'H1070105' THEN '/edu/certificate'
    WHEN 'H1070201' THEN '/support/faq'
    WHEN 'H1070202' THEN '/support/faq'
    WHEN 'H1070203' THEN '/support/faq'
    WHEN 'H1070204' THEN '/support/faq'
    WHEN 'H1070205' THEN '/support/faq'
    WHEN 'H1070206' THEN '/sitemap'
    WHEN 'H1070301' THEN '/support/inquiry'
    WHEN 'H1070302' THEN '/support/inquiry'
    WHEN 'H1070303' THEN '/sitemap'
    WHEN 'H1070304' THEN '/support/inquiry'
    WHEN 'H1070305' THEN '/mypage/marketing'
    WHEN 'H1080101' THEN '/mypage/profile'
    WHEN 'H1080102' THEN '/mypage/company'
    WHEN 'H1080103' THEN '/mypage/staff'
    WHEN 'H1080104' THEN '/emission/project_list'
    WHEN 'H1080105' THEN '/emission/my-tasks'
    WHEN 'H1080106' THEN '/mypage/notification'
    WHEN 'H1080107' THEN '/mypage/marketing'
    WHEN 'H1080108' THEN '/mypage/password'
    WHEN 'H1080109' THEN '/mypage/profile'
    WHEN 'H1080110' THEN '/mypage/download-history'
    WHEN 'H1080111' THEN '/mypage/profile'
    ELSE menu_url
END,
last_updt_pnttm = CURRENT_TIMESTAMP
WHERE menu_code LIKE ANY (ARRAY['H103%', 'H104%', 'H105%', 'H106%', 'H107%', 'H108%'])
  AND length(menu_code) = 8;

UPDATE comtccmmndetailcode d
SET use_at = 'Y',
    code_dc = m.menu_url,
    last_updt_pnttm = CURRENT_TIMESTAMP,
    last_updusr_id = 'HOME_MENU_RESTORE'
FROM comtnmenuinfo m
WHERE d.code_id = 'HMENU1'
  AND d.code = m.menu_code
  AND m.menu_code LIKE ANY (ARRAY['H103%', 'H104%', 'H105%', 'H106%', 'H107%', 'H108%'])
  AND length(m.menu_code) IN (6, 8);

DO $$
DECLARE
    missing_count integer;
    invalid_count integer;
BEGIN
    SELECT count(*) INTO missing_count
    FROM (VALUES
        ('H103', 4, 22), ('H104', 4, 19), ('H105', 3, 15),
        ('H106', 4, 17), ('H107', 3, 16), ('H108', 3, 11)
    ) expected(root_code, middle_count, leaf_count)
    WHERE (SELECT count(*) FROM comtnmenuinfo m
           WHERE m.menu_code LIKE expected.root_code || '__'
             AND length(m.menu_code) = 6 AND m.use_at = 'Y' AND m.expsr_at = 'Y') <> expected.middle_count
       OR (SELECT count(*) FROM comtnmenuinfo m
           WHERE m.menu_code LIKE expected.root_code || '____'
             AND length(m.menu_code) = 8 AND m.use_at = 'Y' AND m.expsr_at = 'Y') <> expected.leaf_count;

    SELECT count(*) INTO invalid_count
    FROM comtnmenuinfo
    WHERE menu_code LIKE ANY (ARRAY['H103%', 'H104%', 'H105%', 'H106%', 'H107%', 'H108%'])
      AND length(menu_code) IN (6, 8)
      AND use_at = 'Y' AND expsr_at = 'Y'
      AND (menu_url IS NULL OR btrim(menu_url) IN ('', '#'));

    IF missing_count > 0 OR invalid_count > 0 THEN
        RAISE EXCEPTION 'home menu hierarchy repair failed: mismatched_domains=%, invalid_urls=%', missing_count, invalid_count;
    END IF;
END $$;
