-- Normalize generated page-specific assets into a reusable KRDS common design system.
UPDATE ui_page_manifest SET design_token_version = 'KRDS_GOV_DEFAULT', updated_at = current_timestamp WHERE active_yn = 'Y';
UPDATE ui_component_registry SET design_reference = 'KRDS_GOV_DEFAULT', updated_at = current_timestamp WHERE active_yn = 'Y';
UPDATE ui_section_registry SET design_reference = 'KRDS_GOV_DEFAULT', updated_at = current_timestamp WHERE active_yn = 'Y';
UPDATE framework_design_preflight SET theme_id = 'KRDS_GOV_DEFAULT' WHERE theme_id IS NOT NULL;

INSERT INTO ui_component_registry
  (component_id, component_name, component_type, owner_domain, props_schema_json, design_reference, active_yn, category, default_props, asset_fingerprint, created_at, updated_at)
VALUES
  ('COMMON_PAGE_HEADER','Common Page Header','NAVIGATION','COMMON','{"properties":{"title":{"type":"string"},"breadcrumb":{"type":"array"},"primaryAction":{"type":"object"}}}','KRDS_GOV_DEFAULT','Y','COMMON','{}',md5('COMMON_PAGE_HEADER|NAVIGATION|KRDS'),current_timestamp,current_timestamp),
  ('COMMON_BREADCRUMB','Common Breadcrumb','NAVIGATION','COMMON','{"properties":{"items":{"type":"array"}}}','KRDS_GOV_DEFAULT','Y','COMMON','{}',md5('COMMON_BREADCRUMB|NAVIGATION|KRDS'),current_timestamp,current_timestamp),
  ('COMMON_HERO','Common Hero','SECTION','COMMON','{"properties":{"eyebrow":{"type":"string"},"title":{"type":"string"},"description":{"type":"string"}}}','KRDS_GOV_DEFAULT','Y','COMMON','{}',md5('COMMON_HERO|SECTION|KRDS'),current_timestamp,current_timestamp),
  ('COMMON_SUMMARY_METRIC','Common Summary Metric','DATA_DISPLAY','COMMON','{"properties":{"label":{"type":"string"},"value":{"type":"string"},"status":{"type":"string"}}}','KRDS_GOV_DEFAULT','Y','COMMON','{}',md5('COMMON_SUMMARY_METRIC|DATA_DISPLAY|KRDS'),current_timestamp,current_timestamp),
  ('COMMON_SEARCH_FILTER','Common Search Filter','FORM','COMMON','{"properties":{"keyword":{"type":"string"},"filters":{"type":"array"}}}','KRDS_GOV_DEFAULT','Y','COMMON','{}',md5('COMMON_SEARCH_FILTER|FORM|KRDS'),current_timestamp,current_timestamp),
  ('COMMON_FORM_FIELD','Common Form Field','FORM_CONTROL','COMMON','{"properties":{"label":{"type":"string"},"value":{"type":"string"},"required":{"type":"boolean"},"error":{"type":"string"}}}','KRDS_GOV_DEFAULT','Y','COMMON','{}',md5('COMMON_FORM_FIELD|FORM_CONTROL|KRDS'),current_timestamp,current_timestamp),
  ('COMMON_FORM_SECTION','Common Form Section','FORM','COMMON','{"properties":{"title":{"type":"string"},"fields":{"type":"array"}}}','KRDS_GOV_DEFAULT','Y','COMMON','{}',md5('COMMON_FORM_SECTION|FORM|KRDS'),current_timestamp,current_timestamp),
  ('COMMON_DATA_TABLE','Common Data Table','DATA_TABLE','COMMON','{"properties":{"columns":{"type":"array"},"rows":{"type":"array"},"pagination":{"type":"object"}}}','KRDS_GOV_DEFAULT','Y','COMMON','{}',md5('COMMON_DATA_TABLE|DATA_TABLE|KRDS'),current_timestamp,current_timestamp),
  ('COMMON_CONTENT_CARD','Common Content Card','SECTION','COMMON','{"properties":{"title":{"type":"string"},"body":{"type":"object"},"actions":{"type":"array"}}}','KRDS_GOV_DEFAULT','Y','COMMON','{}',md5('COMMON_CONTENT_CARD|SECTION|KRDS'),current_timestamp,current_timestamp),
  ('COMMON_STATUS_BADGE','Common Status Badge','FEEDBACK','COMMON','{"properties":{"label":{"type":"string"},"status":{"type":"string"}}}','KRDS_GOV_DEFAULT','Y','COMMON','{}',md5('COMMON_STATUS_BADGE|FEEDBACK|KRDS'),current_timestamp,current_timestamp),
  ('COMMON_TABS','Common Tabs','NAVIGATION','COMMON','{"properties":{"items":{"type":"array"},"activeId":{"type":"string"}}}','KRDS_GOV_DEFAULT','Y','COMMON','{}',md5('COMMON_TABS|NAVIGATION|KRDS'),current_timestamp,current_timestamp),
  ('COMMON_CHART','Common Chart','DATA_DISPLAY','COMMON','{"properties":{"type":{"type":"string"},"series":{"type":"array"},"unit":{"type":"string"}}}','KRDS_GOV_DEFAULT','Y','COMMON','{}',md5('COMMON_CHART|DATA_DISPLAY|KRDS'),current_timestamp,current_timestamp),
  ('COMMON_ACTION_BAR','Common Action Bar','ACTIONS','COMMON','{"properties":{"primary":{"type":"object"},"secondary":{"type":"array"}}}','KRDS_GOV_DEFAULT','Y','COMMON','{}',md5('COMMON_ACTION_BAR|ACTIONS|KRDS'),current_timestamp,current_timestamp),
  ('COMMON_MODAL','Common Modal','FEEDBACK','COMMON','{"properties":{"title":{"type":"string"},"content":{"type":"object"},"actions":{"type":"array"}}}','KRDS_GOV_DEFAULT','Y','COMMON','{}',md5('COMMON_MODAL|FEEDBACK|KRDS'),current_timestamp,current_timestamp),
  ('COMMON_EMPTY_STATE','Common Empty State','FEEDBACK','COMMON','{"properties":{"title":{"type":"string"},"description":{"type":"string"},"action":{"type":"object"}}}','KRDS_GOV_DEFAULT','Y','COMMON','{}',md5('COMMON_EMPTY_STATE|FEEDBACK|KRDS'),current_timestamp,current_timestamp),
  ('COMMON_PAGINATION','Common Pagination','NAVIGATION','COMMON','{"properties":{"page":{"type":"number"},"totalPages":{"type":"number"}}}','KRDS_GOV_DEFAULT','Y','COMMON','{}',md5('COMMON_PAGINATION|NAVIGATION|KRDS'),current_timestamp,current_timestamp),
  ('COMMON_FILE_UPLOAD','Common File Upload','FORM_CONTROL','COMMON','{"properties":{"accept":{"type":"string"},"multiple":{"type":"boolean"},"files":{"type":"array"}}}','KRDS_GOV_DEFAULT','Y','COMMON','{}',md5('COMMON_FILE_UPLOAD|FORM_CONTROL|KRDS'),current_timestamp,current_timestamp),
  ('COMMON_STEP_FLOW','Common Step Flow','NAVIGATION','COMMON','{"properties":{"steps":{"type":"array"},"currentStep":{"type":"string"}}}','KRDS_GOV_DEFAULT','Y','COMMON','{}',md5('COMMON_STEP_FLOW|NAVIGATION|KRDS'),current_timestamp,current_timestamp),
  ('COMMON_DETAIL_PANEL','Common Detail Panel','SECTION','COMMON','{"properties":{"summary":{"type":"object"},"sections":{"type":"array"},"history":{"type":"array"}}}','KRDS_GOV_DEFAULT','Y','COMMON','{}',md5('COMMON_DETAIL_PANEL|SECTION|KRDS'),current_timestamp,current_timestamp),
  ('COMMON_HELP_PANEL','Common Help Panel','FEEDBACK','COMMON','{"properties":{"title":{"type":"string"},"content":{"type":"string"},"target":{"type":"string"}}}','KRDS_GOV_DEFAULT','Y','COMMON','{}',md5('COMMON_HELP_PANEL|FEEDBACK|KRDS'),current_timestamp,current_timestamp)
ON CONFLICT (component_id) DO UPDATE SET
  component_name = excluded.component_name, component_type = excluded.component_type, owner_domain = 'COMMON',
  props_schema_json = excluded.props_schema_json, design_reference = 'KRDS_GOV_DEFAULT', active_yn = 'Y',
  category = 'COMMON', default_props = excluded.default_props, asset_fingerprint = excluded.asset_fingerprint,
  updated_at = current_timestamp;

UPDATE ui_page_component_map m
SET component_id = CASE
  WHEN c.component_name ~* '(chart|graph)' THEN 'COMMON_CHART'
  WHEN c.component_name ~* '(table|grid|list)' THEN 'COMMON_DATA_TABLE'
  WHEN c.component_name ~* '(search|filter)' THEN 'COMMON_SEARCH_FILTER'
  WHEN c.component_name ~* '(upload|file)' THEN 'COMMON_FILE_UPLOAD'
  WHEN c.component_name ~* '(modal|dialog)' THEN 'COMMON_MODAL'
  WHEN c.component_name ~* '(tabs?)' THEN 'COMMON_TABS'
  WHEN c.component_name ~* '(step|flow|timeline)' THEN 'COMMON_STEP_FLOW'
  WHEN c.component_name ~* '(header|breadcrumb|nav)' THEN 'COMMON_PAGE_HEADER'
  WHEN c.component_name ~* '(metric|summary|kpi|status)' THEN 'COMMON_SUMMARY_METRIC'
  WHEN c.component_name ~* '(action|button|control)' THEN 'COMMON_ACTION_BAR'
  WHEN c.component_type = 'DATA_TABLE' THEN 'COMMON_DATA_TABLE'
  WHEN c.component_type = 'FORM' THEN 'COMMON_FORM_SECTION'
  WHEN c.component_type = 'DATA_DISPLAY' THEN 'COMMON_SUMMARY_METRIC'
  WHEN c.component_type = 'NAVIGATION' THEN 'COMMON_PAGE_HEADER'
  WHEN c.component_type = 'FEEDBACK' THEN 'COMMON_STATUS_BADGE'
  ELSE 'COMMON_DETAIL_PANEL'
END
FROM ui_component_registry c
WHERE c.component_id = m.component_id AND c.category = 'MANIFEST';

DELETE FROM ui_component_registry WHERE category = 'MANIFEST';
DELETE FROM comtncomponentinfo WHERE creat_user_id = 'ASSET_SYNC';
INSERT INTO comtncomponentinfo
  (component_id, component_nm, component_dc, component_type, category_cd, icon_nm, default_props, default_class_nm, is_container, is_reusable, sort_order, use_at, creat_pnttm, creat_user_id, asset_fingerprint)
SELECT left(component_id,50), left(component_name,100), 'Reusable KRDS common design asset', left(component_type,30),
  'COMMON', 'widgets', props_schema_json, '', CASE WHEN component_type IN ('SECTION','FORM') THEN 'Y' ELSE 'N' END,
  'Y', row_number() OVER (ORDER BY component_id), 'Y', current_timestamp, 'COMMON_ASSET', asset_fingerprint
FROM ui_component_registry WHERE category = 'COMMON'
ON CONFLICT (component_id) DO UPDATE SET
  component_nm = excluded.component_nm, component_dc = excluded.component_dc, component_type = excluded.component_type,
  category_cd = 'COMMON', default_props = excluded.default_props, is_reusable = 'Y', use_at = 'Y',
  asset_fingerprint = excluded.asset_fingerprint, updt_pnttm = current_timestamp, updt_user_id = 'COMMON_ASSET';

DELETE FROM ui_section_registry;
INSERT INTO ui_section_registry
  (section_id, section_name, section_type, layout_contract, responsive_contract, accessibility_contract, design_reference, asset_fingerprint, active_yn)
VALUES
  ('PAGE_HEADER','Page Header','HEADER','breadcrumb,title,description,primary action','mobile stack; desktop inline actions','heading hierarchy and labelled actions','KRDS_GOV_DEFAULT',md5('PAGE_HEADER|COMMON'),'Y'),
  ('HERO_SECTION','Hero Section','HEADER','eyebrow,title,description,visual','mobile text first; fluid visual','one h1 and meaningful alternative text','KRDS_GOV_DEFAULT',md5('HERO_SECTION|COMMON'),'Y'),
  ('SUMMARY_METRICS','Summary Metrics','METRIC_GRID','2-4 labelled metrics','1/2/4 responsive columns','label every value; status not color-only','KRDS_GOV_DEFAULT',md5('SUMMARY_METRICS|COMMON'),'Y'),
  ('SEARCH_FILTER','Search Filter','FILTER','keyword,filters,search,reset','wrap controls without page overflow','labelled controls and keyboard submit','KRDS_GOV_DEFAULT',md5('SEARCH_FILTER|COMMON'),'Y'),
  ('WORK_TABLE','Work Table','DATA_GRID','caption,thead,tbody,pagination','table-local horizontal scroll','caption,headers,keyboard actions,status text','KRDS_GOV_DEFAULT',md5('WORK_TABLE|COMMON'),'Y'),
  ('FORM_SECTION','Form Section','FORM','title,description,fields,error summary','two columns to single column','labels,required state,field errors,summary focus','KRDS_GOV_DEFAULT',md5('FORM_SECTION|COMMON'),'Y'),
  ('DETAIL_WORKSPACE','Detail Workspace','WORKSPACE','summary,tabs,detail,history,actions','single column mobile','logical focus order and action confirmation','KRDS_GOV_DEFAULT',md5('DETAIL_WORKSPACE|COMMON'),'Y'),
  ('CHART_SECTION','Chart Section','DATA_VISUAL','title,legend,plot,data summary','fluid plot and stacked legend','text/table alternative and explicit units','KRDS_GOV_DEFAULT',md5('CHART_SECTION|COMMON'),'Y'),
  ('ACTION_BAR','Action Bar','ACTIONS','primary,secondary,danger actions','sticky mobile bottom; inline desktop','descriptive labels and disabled reason','KRDS_GOV_DEFAULT',md5('ACTION_BAR|COMMON'),'Y'),
  ('TAB_SECTION','Tab Section','NAVIGATION','tab list,tab panels','scrollable tab list on mobile','ARIA tab contract and keyboard arrows','KRDS_GOV_DEFAULT',md5('TAB_SECTION|COMMON'),'Y'),
  ('EMPTY_STATE','Empty State','FEEDBACK','title,description,next action','centered fluid content','clear status and actionable recovery','KRDS_GOV_DEFAULT',md5('EMPTY_STATE|COMMON'),'Y'),
  ('MODAL_SECTION','Modal Section','OVERLAY','title,content,actions','viewport-safe scroll container','focus trap,escape,return focus','KRDS_GOV_DEFAULT',md5('MODAL_SECTION|COMMON'),'Y');

DELETE FROM framework_design_asset_registry;
INSERT INTO framework_design_asset_registry
  (design_asset_id,page_id,route_path,menu_code,domain_code,layout_version,design_token_version,composition_json,source_path,asset_fingerprint,active_yn)
VALUES
  ('DESIGN_LIST','COMMON_LIST','*','','COMMON','1.0.0','KRDS_GOV_DEFAULT','["PAGE_HEADER","SUMMARY_METRICS","SEARCH_FILTER","WORK_TABLE","ACTION_BAR"]','common-design-system',md5('DESIGN_LIST|COMMON'),'Y'),
  ('DESIGN_DETAIL','COMMON_DETAIL','*','','COMMON','1.0.0','KRDS_GOV_DEFAULT','["PAGE_HEADER","DETAIL_WORKSPACE","TAB_SECTION","ACTION_BAR"]','common-design-system',md5('DESIGN_DETAIL|COMMON'),'Y'),
  ('DESIGN_FORM','COMMON_FORM','*','','COMMON','1.0.0','KRDS_GOV_DEFAULT','["PAGE_HEADER","FORM_SECTION","ACTION_BAR"]','common-design-system',md5('DESIGN_FORM|COMMON'),'Y'),
  ('DESIGN_DASHBOARD','COMMON_DASHBOARD','*','','COMMON','1.0.0','KRDS_GOV_DEFAULT','["PAGE_HEADER","SUMMARY_METRICS","CHART_SECTION","WORK_TABLE"]','common-design-system',md5('DESIGN_DASHBOARD|COMMON'),'Y'),
  ('DESIGN_WORKFLOW','COMMON_WORKFLOW','*','','COMMON','1.0.0','KRDS_GOV_DEFAULT','["PAGE_HEADER","SUMMARY_METRICS","DETAIL_WORKSPACE","ACTION_BAR"]','common-design-system',md5('DESIGN_WORKFLOW|COMMON'),'Y'),
  ('DESIGN_MODAL','COMMON_MODAL','*','','COMMON','1.0.0','KRDS_GOV_DEFAULT','["MODAL_SECTION","FORM_SECTION","ACTION_BAR"]','common-design-system',md5('DESIGN_MODAL|COMMON'),'Y');

DELETE FROM comtnthemeclassset;
INSERT INTO comtnthemeclassset
  (class_set_id,theme_id,class_set_nm,class_set_dc,target_component,base_classes,hover_classes,focus_classes,active_classes,disabled_classes,responsive_classes,sort_order,use_at,creat_pnttm,creat_user_id)
VALUES
  ('KRDS_PAGE_CONTAINER','KRDS_GOV_DEFAULT','Page Container','Common maximum width and spacing',null,'mx-auto w-full max-w-7xl px-4','','','','','sm:px-6 lg:px-8',1,'Y',current_timestamp,'COMMON_ASSET'),
  ('KRDS_CONTENT_CARD','KRDS_GOV_DEFAULT','Content Card','Common section card','COMMON_CONTENT_CARD','rounded-xl border border-slate-200 bg-white p-5 shadow-sm','hover:border-blue-200','focus-within:ring-2 focus-within:ring-blue-100','','','p-4 sm:p-5 lg:p-6',2,'Y',current_timestamp,'COMMON_ASSET'),
  ('KRDS_BUTTON_PRIMARY','KRDS_GOV_DEFAULT','Primary Button','Primary action','COMMON_ACTION_BAR','inline-flex min-h-11 items-center justify-center rounded-lg bg-[#246beb] px-4 font-bold text-white','hover:bg-[#174ea6]','focus:outline-none focus:ring-2 focus:ring-blue-300','','disabled:opacity-50','w-full sm:w-auto',3,'Y',current_timestamp,'COMMON_ASSET'),
  ('KRDS_BUTTON_SECONDARY','KRDS_GOV_DEFAULT','Secondary Button','Secondary action','COMMON_ACTION_BAR','inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 font-bold text-slate-800','hover:bg-slate-50','focus:outline-none focus:ring-2 focus:ring-blue-200','','disabled:opacity-50','w-full sm:w-auto',4,'Y',current_timestamp,'COMMON_ASSET'),
  ('KRDS_FORM_CONTROL','KRDS_GOV_DEFAULT','Form Control','Common input and selector','COMMON_FORM_FIELD','min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3','hover:border-slate-400','focus:border-[#246beb] focus:outline-none focus:ring-2 focus:ring-blue-100','','disabled:bg-slate-100','text-sm sm:text-base',5,'Y',current_timestamp,'COMMON_ASSET'),
  ('KRDS_DATA_TABLE','KRDS_GOV_DEFAULT','Data Table','Common data table','COMMON_DATA_TABLE','w-full min-w-[760px] text-left text-sm','','focus-within:outline-none','','','',6,'Y',current_timestamp,'COMMON_ASSET'),
  ('KRDS_STATUS_BADGE','KRDS_GOV_DEFAULT','Status Badge','Status with visible text','COMMON_STATUS_BADGE','inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold','','','','','',7,'Y',current_timestamp,'COMMON_ASSET'),
  ('KRDS_MODAL','KRDS_GOV_DEFAULT','Modal','Common overlay','COMMON_MODAL','max-h-[90vh] w-[min(720px,calc(100vw-32px))] overflow-auto rounded-xl bg-white p-6 shadow-2xl','','focus:outline-none','','','',8,'Y',current_timestamp,'COMMON_ASSET');

UPDATE comtnscrncfg SET theme_id = 'KRDS_GOV_DEFAULT' WHERE theme_id IS NOT NULL AND theme_id <> 'KRDS_GOV_DEFAULT';
DELETE FROM comtnthemedefinition WHERE theme_id <> 'KRDS_GOV_DEFAULT';
UPDATE comtnthemedefinition SET is_default='Y', is_active='Y', use_at='Y', updt_pnttm=current_timestamp, updt_user_id='COMMON_ASSET' WHERE theme_id='KRDS_GOV_DEFAULT';

INSERT INTO comtccmmndetailcode(code_id,code,code_nm,code_dc,use_at,frst_regist_pnttm,frst_register_id,last_updt_pnttm,last_updusr_id)
VALUES('AMENU1','A1110111','CSS 관리','공통 CSS 자산 관리','Y',current_timestamp,'COMMON_ASSET',current_timestamp,'COMMON_ASSET')
ON CONFLICT(code_id,code) DO UPDATE SET code_nm=excluded.code_nm,code_dc=excluded.code_dc,use_at='Y',last_updt_pnttm=current_timestamp,last_updusr_id='COMMON_ASSET';
INSERT INTO comtnmenuinfo(menu_code,menu_nm,menu_nm_en,menu_url,menu_icon,use_at,frst_regist_pnttm,last_updt_pnttm,expsr_at)
VALUES('A1110111','CSS 관리','CSS Management','/admin/system/css-management','css','Y',current_timestamp,current_timestamp,'Y')
ON CONFLICT(menu_code) DO UPDATE SET menu_nm=excluded.menu_nm,menu_nm_en=excluded.menu_nm_en,menu_url=excluded.menu_url,menu_icon=excluded.menu_icon,use_at='Y',expsr_at='Y',last_updt_pnttm=current_timestamp;
INSERT INTO comtnmenuorder(menu_code,sort_ordr,frst_regist_pnttm,last_updt_pnttm)
VALUES('A1110111',290,current_timestamp,current_timestamp)
ON CONFLICT(menu_code) DO UPDATE SET sort_ordr=excluded.sort_ordr,last_updt_pnttm=current_timestamp;
UPDATE comtnmenuorder SET sort_ordr=291,last_updt_pnttm=current_timestamp WHERE menu_code='A1110109';

INSERT INTO framework_asset_sync_run(asset_type,source_path,discovered_count,registered_count,duplicate_count,sync_status,executed_by,executed_at)
VALUES('COMMON_DESIGN_SYSTEM','common-design-normalization',47,47,0,'COMPLETED','FLYWAY',current_timestamp);
