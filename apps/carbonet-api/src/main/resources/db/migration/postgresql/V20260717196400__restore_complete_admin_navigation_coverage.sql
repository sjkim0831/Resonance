-- Restore every active node in the approved A101-A111 administrator information architecture.
-- Explicitly disabled rows (use_at='N') remain untouched. Active placeholders are linked to
-- an existing domain workspace and retain their menu code as page context.
WITH domain_fallback(root_code, base_url) AS (
    VALUES
        ('A101', '/admin/'),
        ('A102', '/admin/member/list'),
        ('A103', '/admin/emission/project-operations'),
        ('A104', '/admin/emission/survey-admin'),
        ('A105', '/admin/emission/definition-studio'),
        ('A106', '/admin/emission/definition-studio'),
        ('A107', '/admin/emission/validation-rule'),
        ('A108', '/admin/content/board_list'),
        ('A109', '/admin/trade/approve'),
        ('A110', '/admin/external/connection_list'),
        ('A111', '/admin/system/menu')
), repaired AS (
    SELECT menu.menu_code,
           fallback.base_url || CASE WHEN fallback.base_url LIKE '%?%' THEN '&' ELSE '?' END
             || 'menuCode=' || menu.menu_code AS resolved_url
    FROM comtnmenuinfo menu
    JOIN domain_fallback fallback ON fallback.root_code = left(menu.menu_code, 4)
    WHERE menu.use_at = 'Y'
      AND (menu.menu_url IS NULL OR btrim(menu.menu_url) IN ('', '#'))
)
UPDATE comtnmenuinfo menu
SET menu_url = repaired.resolved_url,
    expsr_at = 'Y',
    last_updt_pnttm = CURRENT_TIMESTAMP
FROM repaired
WHERE menu.menu_code = repaired.menu_code;

UPDATE comtccmmndetailcode detail
SET code_dc = menu.menu_url,
    use_at = 'Y',
    last_updt_pnttm = CURRENT_TIMESTAMP,
    last_updusr_id = 'MENU_COVERAGE'
FROM comtnmenuinfo menu
WHERE detail.code_id = 'AMENU1'
  AND detail.code = menu.menu_code
  AND menu.menu_code ~ '^A(10[1-9]|11[01])'
  AND menu.use_at = 'Y'
  AND menu.expsr_at = 'Y';

CREATE OR REPLACE VIEW framework_admin_menu_integrity AS
SELECT left(menu_code, 4) AS root_code,
       count(*) FILTER (WHERE use_at = 'Y') AS active_count,
       count(*) FILTER (WHERE use_at = 'Y' AND expsr_at = 'Y') AS exposed_count,
       count(*) FILTER (
           WHERE use_at = 'Y'
             AND (menu_url IS NULL OR btrim(menu_url) IN ('', '#'))
       ) AS invalid_url_count
FROM comtnmenuinfo
WHERE menu_code ~ '^A(10[1-9]|11[01])'
GROUP BY left(menu_code, 4);

DO $$
DECLARE
    invalid_count integer;
BEGIN
    SELECT coalesce(sum(invalid_url_count), 0)
      INTO invalid_count
      FROM framework_admin_menu_integrity;
    IF invalid_count <> 0 THEN
        RAISE EXCEPTION 'Active administrator menu nodes with invalid URLs remain: %', invalid_count;
    END IF;
END $$;

