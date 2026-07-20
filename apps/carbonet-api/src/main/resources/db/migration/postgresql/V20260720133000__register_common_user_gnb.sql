-- Register the global KRDS user GNB once and map it to every active non-admin page.
INSERT INTO ui_component_registry
  (component_id,component_name,component_type,owner_domain,props_schema_json,design_reference,active_yn,category,default_props,asset_fingerprint,created_at,updated_at)
VALUES
  ('COMMON_USER_GNB','Common User Global Navigation','NAVIGATION','COMMON',
   '{"properties":{"homeMenu":{"type":"array"},"isLoggedIn":{"type":"boolean"},"language":{"type":"string"},"mobileMenuOpen":{"type":"boolean"}}}',
   'KRDS_GOV_DEFAULT','Y','COMMON','{}',md5('COMMON_USER_GNB|NAVIGATION|KRDS|v1'),current_timestamp,current_timestamp)
ON CONFLICT(component_id) DO UPDATE SET component_name=excluded.component_name,component_type=excluded.component_type,
  owner_domain='COMMON',props_schema_json=excluded.props_schema_json,design_reference='KRDS_GOV_DEFAULT',active_yn='Y',
  category='COMMON',default_props=excluded.default_props,asset_fingerprint=excluded.asset_fingerprint,updated_at=current_timestamp;

INSERT INTO ui_page_component_map
  (map_id,page_id,layout_zone,component_id,instance_key,display_order,conditional_rule_summary,created_at,updated_at)
SELECT md5('COMMON_USER_GNB|' || page.page_id),page.page_id,'header','COMMON_USER_GNB','global-user-gnb',1,
       'active non-admin route',current_timestamp,current_timestamp
FROM ui_page_manifest page
WHERE page.active_yn='Y'
  AND COALESCE(page.route_path,'') NOT LIKE '/admin%'
  AND COALESCE(page.route_path,'') NOT LIKE '/signin/%'
  AND COALESCE(page.route_path,'') NOT LIKE '/join/%'
  AND COALESCE(page.route_path,'') NOT LIKE '/find/%'
  AND COALESCE(page.route_path,'') NOT LIKE '/error/%'
ON CONFLICT(map_id) DO UPDATE SET page_id=excluded.page_id,layout_zone='header',component_id='COMMON_USER_GNB',
  instance_key='global-user-gnb',display_order=1,conditional_rule_summary=excluded.conditional_rule_summary,updated_at=current_timestamp;

INSERT INTO comtncomponentinfo
  (component_id,component_nm,component_dc,component_type,category_cd,icon_nm,default_props,default_class_nm,is_container,is_reusable,sort_order,use_at,creat_pnttm,creat_user_id,asset_fingerprint)
VALUES ('COMMON_USER_GNB','Common User Global Navigation','Reusable KRDS mega menu, session actions, mobile navigation, and task guidance','NAVIGATION','COMMON','menu','{}','', 'Y','Y',10,'Y',current_timestamp,'COMMON_ASSET',md5('COMMON_USER_GNB|NAVIGATION|KRDS|v1'))
ON CONFLICT(component_id) DO UPDATE SET component_nm=excluded.component_nm,component_dc=excluded.component_dc,
  category_cd='COMMON',is_reusable='Y',use_at='Y',asset_fingerprint=excluded.asset_fingerprint,updt_pnttm=current_timestamp,updt_user_id='COMMON_ASSET';
