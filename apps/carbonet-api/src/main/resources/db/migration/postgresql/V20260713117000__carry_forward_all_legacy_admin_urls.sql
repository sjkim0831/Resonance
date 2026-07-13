-- Carry every legacy administrator URL into the approved navigation without guessing.
CREATE TEMP TABLE legacy_admin_url ON COMMIT DROP AS
SELECT DISTINCT ON (menu_url) menu_code AS legacy_code,menu_nm,menu_nm_en,menu_url
FROM comtnmenuinfo
WHERE menu_code ~ '^A0[0-9]+'
  AND menu_url IS NOT NULL AND btrim(menu_url) NOT IN ('','#','/')
ORDER BY menu_url,menu_code;

-- Reuse a current leaf only when its normalized name has one unambiguous legacy match.
CREATE TEMP TABLE exact_legacy_match ON COMMIT DROP AS
WITH legacy AS (
  SELECT *,regexp_replace(regexp_replace(lower(menu_nm),'[[:space:]·ㆍ_-]','','g'),'(관리|목록|설정|값)$','','g') norm
  FROM legacy_admin_url
), current_leaf AS (
  SELECT menu_code,regexp_replace(regexp_replace(lower(menu_nm),'[[:space:]·ㆍ_-]','','g'),'(관리|목록|설정|값)$','','g') norm
  FROM comtnmenuinfo
  WHERE menu_code ~ '^A1(0[1-9]|1[0-1])[0-9]{4}$'
    AND use_at='Y' AND expsr_at='Y' AND coalesce(menu_url,'#') IN ('','#')
), candidates AS (
  SELECT c.menu_code,l.menu_url,
         count(*) over(partition by c.menu_code) current_matches,
         count(*) over(partition by l.menu_url) legacy_matches
  FROM current_leaf c JOIN legacy l USING(norm)
)
SELECT menu_code,menu_url FROM candidates WHERE current_matches=1 AND legacy_matches=1;

UPDATE comtnmenuinfo m SET menu_url=x.menu_url,last_updt_pnttm=CURRENT_TIMESTAMP
FROM exact_legacy_match x WHERE m.menu_code=x.menu_code;

-- Archive every URL that is still absent from A101-A111.
CREATE TEMP TABLE legacy_archive ON COMMIT DROP AS
SELECT row_number() over(order by l.legacy_code,l.menu_url)::integer seq,l.*
FROM legacy_admin_url l
WHERE NOT EXISTS (
  SELECT 1 FROM comtnmenuinfo n
  WHERE n.menu_code ~ '^A1(0[1-9]|1[0-1])[0-9]*$'
    AND n.use_at='Y' AND n.expsr_at='Y' AND n.menu_url=l.menu_url
);

INSERT INTO comtnmenuinfo(menu_code,menu_nm,menu_nm_en,menu_url,menu_icon,use_at,frst_regist_pnttm,last_updt_pnttm,expsr_at) VALUES
('A112','기존 화면 보관함','Legacy Screen Archive','#','folder','Y',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'Y'),
('A11201','기존 관리자 화면','Legacy Administrator Screens','#','folder','Y',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'Y')
ON CONFLICT(menu_code) DO UPDATE SET menu_nm=EXCLUDED.menu_nm,menu_nm_en=EXCLUDED.menu_nm_en,menu_url='#',menu_icon=EXCLUDED.menu_icon,use_at='Y',expsr_at='Y',last_updt_pnttm=CURRENT_TIMESTAMP;

INSERT INTO comtnmenuinfo(menu_code,menu_nm,menu_nm_en,menu_url,menu_icon,use_at,frst_regist_pnttm,last_updt_pnttm,expsr_at)
SELECT 'A11201'||lpad(seq::text,2,'0'),menu_nm,coalesce(menu_nm_en,menu_nm),menu_url,'article','Y',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'Y'
FROM legacy_archive
ON CONFLICT(menu_code) DO UPDATE SET menu_nm=EXCLUDED.menu_nm,menu_nm_en=EXCLUDED.menu_nm_en,menu_url=EXCLUDED.menu_url,menu_icon='article',use_at='Y',expsr_at='Y',last_updt_pnttm=CURRENT_TIMESTAMP;

INSERT INTO comtnmenuorder(menu_code,sort_ordr,frst_regist_pnttm,last_updt_pnttm) VALUES
('A112',112,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),('A11201',11201,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT(menu_code) DO UPDATE SET sort_ordr=EXCLUDED.sort_ordr,last_updt_pnttm=CURRENT_TIMESTAMP;

INSERT INTO comtnmenuorder(menu_code,sort_ordr,frst_regist_pnttm,last_updt_pnttm)
SELECT 'A11201'||lpad(seq::text,2,'0'),1120100+seq,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM legacy_archive
ON CONFLICT(menu_code) DO UPDATE SET sort_ordr=EXCLUDED.sort_ordr,last_updt_pnttm=CURRENT_TIMESTAMP;

INSERT INTO comtccmmndetailcode(code_id,code,code_nm,code_dc,use_at,frst_regist_pnttm,frst_register_id,last_updt_pnttm,last_updusr_id)
SELECT 'AMENU1',menu_code,menu_nm,menu_nm,'Y',CURRENT_TIMESTAMP,'MENU_LEGACY_URL',CURRENT_TIMESTAMP,'MENU_LEGACY_URL'
FROM comtnmenuinfo WHERE menu_code='A112' OR menu_code LIKE 'A11201%'
ON CONFLICT(code_id,code) DO UPDATE SET code_nm=EXCLUDED.code_nm,code_dc=EXCLUDED.code_dc,use_at='Y',last_updt_pnttm=CURRENT_TIMESTAMP,last_updusr_id='MENU_LEGACY_URL';
