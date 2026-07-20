-- One footer contract for the home and user portal page families.
INSERT INTO ui_component_registry
  (component_id,component_name,component_type,owner_domain,props_schema_json,design_reference,active_yn,category,default_props,asset_fingerprint,created_at,updated_at)
VALUES
  ('COMMON_PAGE_FOOTER','Common User Page Footer','NAVIGATION','COMMON',
   '{"properties":{"orgName":{"type":"string"},"addressLine":{"type":"string"},"serviceLine":{"type":"string"},"footerLinks":{"type":"array"},"copyright":{"type":"string"},"lastModifiedLabel":{"type":"string"}}}',
   'KRDS_GOV_DEFAULT','Y','COMMON','{}',md5('COMMON_PAGE_FOOTER|NAVIGATION|KRDS|v1'),current_timestamp,current_timestamp)
ON CONFLICT(component_id) DO UPDATE SET component_name=excluded.component_name,component_type=excluded.component_type,
  owner_domain='COMMON',props_schema_json=excluded.props_schema_json,design_reference='KRDS_GOV_DEFAULT',active_yn='Y',
  category='COMMON',default_props=excluded.default_props,asset_fingerprint=excluded.asset_fingerprint,updated_at=current_timestamp;

INSERT INTO ui_page_component_map
  (map_id,page_id,layout_zone,component_id,instance_key,display_order,conditional_rule_summary,created_at,updated_at)
SELECT 'HOME_COMMON_FOOTER','home','footer','COMMON_PAGE_FOOTER','home-footer',1000,'always',current_timestamp,current_timestamp
WHERE EXISTS (SELECT 1 FROM ui_page_manifest WHERE page_id='home')
ON CONFLICT(map_id) DO UPDATE SET page_id=excluded.page_id,layout_zone='footer',component_id='COMMON_PAGE_FOOTER',
  instance_key='home-footer',display_order=1000,conditional_rule_summary='always',updated_at=current_timestamp;

INSERT INTO comtncomponentinfo
  (component_id,component_nm,component_dc,component_type,category_cd,icon_nm,default_props,default_class_nm,is_container,is_reusable,sort_order,use_at,creat_pnttm,creat_user_id,asset_fingerprint)
VALUES ('COMMON_PAGE_FOOTER','Common User Page Footer','Reusable KRDS user portal footer','NAVIGATION','COMMON','vertical_align_bottom','{}','', 'Y','Y',999,'Y',current_timestamp,'COMMON_ASSET',md5('COMMON_PAGE_FOOTER|NAVIGATION|KRDS|v1'))
ON CONFLICT(component_id) DO UPDATE SET component_nm=excluded.component_nm,component_dc=excluded.component_dc,
  category_cd='COMMON',is_reusable='Y',use_at='Y',asset_fingerprint=excluded.asset_fingerprint,updt_pnttm=current_timestamp,updt_user_id='COMMON_ASSET';
