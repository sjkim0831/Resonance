UPDATE comtnmenuinfo
SET menu_nm = CASE menu_code
                  WHEN 'A106' THEN '기준정보'
                  WHEN 'A110' THEN '외부 연계'
                  ELSE menu_nm
              END,
    menu_nm_en = CASE menu_code
                     WHEN 'A106' THEN 'Master Data'
                     WHEN 'A110' THEN 'External Integration'
                     ELSE menu_nm_en
                 END,
    use_at = 'Y',
    expsr_at = 'Y',
    last_updt_pnttm = CURRENT_TIMESTAMP
WHERE menu_code IN ('A106', 'A110');

UPDATE comtccmmndetailcode
SET code_nm = CASE code
                  WHEN 'A106' THEN '기준정보'
                  WHEN 'A110' THEN '외부 연계'
                  ELSE code_nm
              END,
    code_dc = CASE code
                  WHEN 'A106' THEN '/admin/system/code'
                  WHEN 'A110' THEN '/admin/external/connection_list'
                  ELSE code_dc
              END,
    use_at = 'Y',
    last_updt_pnttm = CURRENT_TIMESTAMP
WHERE code IN ('A106', 'A110');
