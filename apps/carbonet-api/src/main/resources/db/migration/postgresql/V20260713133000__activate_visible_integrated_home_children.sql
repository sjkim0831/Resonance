-- Exposure toggles performed before the transactional visibility fix could
-- leave H101 children visible but inactive. Align the integrated-home branch.
UPDATE comtnmenuinfo
SET use_at='Y', last_updt_pnttm=CURRENT_TIMESTAMP
WHERE menu_code LIKE 'H101%' AND expsr_at='Y';

UPDATE comtccmmndetailcode d
SET use_at='Y', last_updt_pnttm=CURRENT_TIMESTAMP, last_updusr_id='MENU_EXPOSURE'
WHERE d.code_id='HMENU1' AND d.code LIKE 'H101%'
  AND EXISTS (SELECT 1 FROM comtnmenuinfo m WHERE m.menu_code=d.code AND m.expsr_at='Y');
