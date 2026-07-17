-- Restore the approved reduction-operations branch with links to existing screens.
-- The deprecated A10502/A10503 branches intentionally remain disabled.
WITH reduction_menu(menu_code, menu_nm, menu_nm_en, menu_url, menu_icon) AS (
    VALUES
        ('A105',     '감축 운영',          'Reduction Operations',        '/admin/emission/definition-studio', 'trending_down'),
        ('A10501',   '목표·과제',          'Targets and Tasks',            '/admin/emission/definition-studio', 'folder'),
        ('A1050101', '감축 목표 관리',     'Reduction Targets',            '/admin/emission/definition-studio', 'track_changes'),
        ('A1050102', '감축 과제 관리',     'Reduction Tasks',              '/admin/emission/management',        'task_alt'),
        ('A1050103', '과제 검토·승인',     'Task Review',                  '/admin/emission/approval-workflow', 'approval'),
        ('A1050104', '감축 실적 관리',     'Reduction Results',            '/admin/emission/result_list',       'fact_check'),
        ('A1050105', '시나리오 관리',      'Scenario Management',         '/admin/emission/calculation-rule',  'account_tree'),
        ('A1050106', '감축계수·산정 기준', 'Factors and Rules',            '/admin/emission/factor-management', 'calculate'),
        ('A1050107', '비용·투자 관리',     'Cost and Investment',          '/admin/emission/data_history',      'payments'),
        ('A1050108', '감축 보고서',        'Reduction Reports',           '/admin/emission/survey-report',     'description')
)
UPDATE comtnmenuinfo menu
SET menu_nm = source.menu_nm,
    menu_nm_en = source.menu_nm_en,
    menu_url = source.menu_url,
    menu_icon = source.menu_icon,
    use_at = 'Y',
    expsr_at = 'Y',
    last_updt_pnttm = CURRENT_TIMESTAMP
FROM reduction_menu source
WHERE menu.menu_code = source.menu_code;

WITH reduction_menu(menu_code, menu_nm, menu_url) AS (
    VALUES
        ('A105',     '감축 운영',          '/admin/emission/definition-studio'),
        ('A10501',   '목표·과제',          '/admin/emission/definition-studio'),
        ('A1050101', '감축 목표 관리',     '/admin/emission/definition-studio'),
        ('A1050102', '감축 과제 관리',     '/admin/emission/management'),
        ('A1050103', '과제 검토·승인',     '/admin/emission/approval-workflow'),
        ('A1050104', '감축 실적 관리',     '/admin/emission/result_list'),
        ('A1050105', '시나리오 관리',      '/admin/emission/calculation-rule'),
        ('A1050106', '감축계수·산정 기준', '/admin/emission/factor-management'),
        ('A1050107', '비용·투자 관리',     '/admin/emission/data_history'),
        ('A1050108', '감축 보고서',        '/admin/emission/survey-report')
)
UPDATE comtccmmndetailcode detail
SET code_nm = source.menu_nm,
    code_dc = source.menu_url,
    use_at = 'Y',
    last_updt_pnttm = CURRENT_TIMESTAMP,
    last_updusr_id = 'REDUCTION_MENU'
FROM reduction_menu source
WHERE detail.code_id = 'AMENU1'
  AND detail.code = source.menu_code;
