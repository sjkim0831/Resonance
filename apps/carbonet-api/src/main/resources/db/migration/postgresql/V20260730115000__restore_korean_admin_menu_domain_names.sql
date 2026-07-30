-- comtnmenuinfo already contains the correct Korean names. The GNB resolves
-- the visible domain label from the authority detail catalog; restore that
-- catalog only. Updating comtnmenuinfo would invoke the semantic-binding
-- trigger and is unrelated to this display repair.
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
