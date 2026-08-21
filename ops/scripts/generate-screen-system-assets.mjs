#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const positional = args.filter((arg) => arg !== "--check");
if (positional.length !== 1) {
  console.error("usage: generate-screen-system-assets.mjs [--check] <asset-contract.json>");
  process.exit(2);
}

const contractPath = path.resolve(positional[0]);
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const { page, theme, classSets, components, sections, instances, dataElements, backendFeature } = contract;

const required = (value, label) => {
  if (value === undefined || value === null || value === "") {
    throw new Error(`required value missing: ${label}`);
  }
  return value;
};
const unique = (values, label) => {
  const duplicate = values.find((value, index) => values.indexOf(value) !== index);
  if (duplicate) throw new Error(`duplicate ${label}: ${duplicate}`);
};

required(contract.schemaVersion, "schemaVersion");
required(page?.pageId, "page.pageId");
required(page?.routePath, "page.routePath");
required(page?.sourcePath, "page.sourcePath");
required(theme?.themeId, "theme.themeId");
required(backendFeature?.code, "backendFeature.code");
if (!Array.isArray(page.contractIds) || page.contractIds.length === 0) throw new Error("page.contractIds must not be empty");
if (!Array.isArray(page.steps) || page.steps.length === 0) throw new Error("page.steps must not be empty");
for (const [name, collection] of Object.entries({ classSets, components, sections, instances, dataElements })) {
  if (!Array.isArray(collection) || collection.length === 0) throw new Error(`${name} must not be empty`);
}
unique(classSets.map((item) => required(item.id, "classSets[].id")), "class set id");
unique(components.map((item) => required(item.id, "components[].id")), "component id");
unique(sections.map((item) => required(item.id, "sections[].id")), "section id");
unique(instances.map((item) => required(item.id, "instances[].id")), "instance id");
unique(dataElements.map((item) => required(item.code, "dataElements[].code")), "data element code");

const componentIds = new Set(components.map((item) => item.id));
const sectionIds = new Set(sections.map((item) => item.id));
for (const instance of instances) {
  if (!componentIds.has(instance.component)) throw new Error(`unknown instance component: ${instance.component}`);
  if (!sectionIds.has(instance.section)) throw new Error(`unknown instance section: ${instance.section}`);
}
for (const id of backendFeature.uiContract ?? []) {
  if (!componentIds.has(id)) throw new Error(`backendFeature.uiContract references unknown component: ${id}`);
}

const canonical = JSON.stringify(contract);
const contractFingerprint = crypto.createHash("sha256").update(canonical).digest("hex");
const fingerprint = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sql = (value) => value === null || value === undefined ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;
const jsonb = (value) => `${sql(JSON.stringify(value ?? {}))}::jsonb`;
const textJson = (value) => sql(JSON.stringify(value ?? {}));
const bool = (value) => value ? "true" : "false";
const list = (values) => values.map(sql).join(",");
const lines = [];
const emit = (line = "") => lines.push(line);

emit("\\set ON_ERROR_STOP on");
emit("BEGIN;");
emit();
emit(`INSERT INTO comtnthemedefinition(theme_id,theme_nm,theme_dc,theme_type,class_prefix,is_default,is_active,sort_order,use_at,creat_pnttm,creat_user_id,updt_pnttm,updt_user_id)`);
emit(`VALUES(${sql(theme.themeId)},${sql(theme.name)},${sql(theme.description)},'DESIGN_SYSTEM',${sql(theme.classPrefix)},'N','Y',100,'Y',CURRENT_TIMESTAMP,'ASSET_AUTOMATION',CURRENT_TIMESTAMP,'ASSET_AUTOMATION')`);
emit("ON CONFLICT (theme_id) DO UPDATE SET theme_nm=EXCLUDED.theme_nm,theme_dc=EXCLUDED.theme_dc,class_prefix=EXCLUDED.class_prefix,is_active='Y',use_at='Y',updt_pnttm=CURRENT_TIMESTAMP,updt_user_id='ASSET_AUTOMATION';");
emit();

classSets.forEach((item, index) => {
  emit("INSERT INTO comtnthemeclassset(class_set_id,theme_id,class_set_nm,class_set_dc,target_component,base_classes,responsive_classes,sort_order,use_at,creat_pnttm,creat_user_id,updt_pnttm,updt_user_id)");
  emit(`VALUES(${sql(item.id)},${sql(theme.themeId)},${sql(item.name)},${sql(`${item.target}: ${item.responsive}`)},${sql(item.target)},${sql(item.base)},${sql(item.responsive)},${(index + 1) * 10},'Y',CURRENT_TIMESTAMP,'ASSET_AUTOMATION',CURRENT_TIMESTAMP,'ASSET_AUTOMATION')`);
  emit("ON CONFLICT (class_set_id) DO UPDATE SET theme_id=EXCLUDED.theme_id,class_set_nm=EXCLUDED.class_set_nm,class_set_dc=EXCLUDED.class_set_dc,target_component=EXCLUDED.target_component,base_classes=EXCLUDED.base_classes,responsive_classes=EXCLUDED.responsive_classes,sort_order=EXCLUDED.sort_order,use_at='Y',updt_pnttm=CURRENT_TIMESTAMP,updt_user_id='ASSET_AUTOMATION';");
});
emit();

for (const component of components) {
  const propsSchema = {
    type: "object",
    properties: Object.fromEntries((component.props ?? []).map((prop) => [prop, {}])),
    additionalProperties: true,
  };
  const componentFingerprint = fingerprint(component);
  emit("INSERT INTO ui_component_registry(component_id,component_name,component_type,owner_domain,props_schema_json,design_reference,active_yn,created_at,updated_at,category,default_props,asset_fingerprint)");
  emit(`VALUES(${sql(component.id)},${sql(component.name)},${sql(component.type)},${sql(component.owner)},${textJson(propsSchema)},${sql(`asset-contract:${page.pageId}`)},'Y',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,${sql("SCREEN_ASSET")},'{}',${sql(componentFingerprint)})`);
  emit("ON CONFLICT (component_id) DO UPDATE SET component_name=EXCLUDED.component_name,component_type=EXCLUDED.component_type,owner_domain=EXCLUDED.owner_domain,props_schema_json=EXCLUDED.props_schema_json,design_reference=EXCLUDED.design_reference,active_yn='Y',updated_at=CURRENT_TIMESTAMP,category=EXCLUDED.category,default_props=EXCLUDED.default_props,asset_fingerprint=EXCLUDED.asset_fingerprint;");
  emit("INSERT INTO comtncomponentinfo(component_id,component_nm,component_dc,component_type,category_cd,default_props,data_attrs,is_container,is_reusable,sort_order,use_at,creat_pnttm,creat_user_id,updt_pnttm,updt_user_id,asset_fingerprint)");
  emit(`VALUES(${sql(component.id)},${sql(component.name)},${sql(`Registered by ${page.pageId}`)},${sql(component.type.toUpperCase())},${sql(component.owner)},${textJson({})},${textJson({ "data-ui-component": component.id })},${sql(component.container ? "Y" : "N")},'Y',100,'Y',CURRENT_TIMESTAMP,'ASSET_AUTOMATION',CURRENT_TIMESTAMP,'ASSET_AUTOMATION',${sql(componentFingerprint)})`);
  emit("ON CONFLICT (component_id) DO UPDATE SET component_nm=EXCLUDED.component_nm,component_dc=EXCLUDED.component_dc,component_type=EXCLUDED.component_type,category_cd=EXCLUDED.category_cd,default_props=EXCLUDED.default_props,data_attrs=EXCLUDED.data_attrs,is_container=EXCLUDED.is_container,is_reusable='Y',use_at='Y',updt_pnttm=CURRENT_TIMESTAMP,updt_user_id='ASSET_AUTOMATION',asset_fingerprint=EXCLUDED.asset_fingerprint;");
}
emit();

for (const section of sections) {
  emit("INSERT INTO ui_section_registry(section_id,section_name,section_type,layout_contract,responsive_contract,accessibility_contract,design_reference,asset_fingerprint,active_yn,created_at,updated_at)");
  emit(`VALUES(${sql(section.id)},${sql(section.name)},${sql(section.type)},${sql(section.layout)},${sql(section.responsive)},${sql(section.accessibility)},${sql(`asset-contract:${page.pageId}`)},${sql(fingerprint(section))},'Y',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);
  emit("ON CONFLICT (section_id) DO UPDATE SET section_name=EXCLUDED.section_name,section_type=EXCLUDED.section_type,layout_contract=EXCLUDED.layout_contract,responsive_contract=EXCLUDED.responsive_contract,accessibility_contract=EXCLUDED.accessibility_contract,design_reference=EXCLUDED.design_reference,asset_fingerprint=EXCLUDED.asset_fingerprint,active_yn='Y',updated_at=CURRENT_TIMESTAMP;");
}
emit();

const componentSchema = {
  sections: sections.map((item) => item.id),
  components: instances.map((item) => ({ instance: item.id, section: item.section, component: item.component })),
  classSets: classSets.map((item) => item.id),
};
const componentMapId = (instanceId) =>
  `ASSET_${fingerprint(`${page.pageId}:${instanceId}`).slice(0, 24)}`;
emit("INSERT INTO ui_page_manifest(page_id,page_name,route_path,domain_code,menu_code,layout_version,design_token_version,active_yn,created_at,updated_at,data_source_config,page_title,page_url,page_title_en,component_schema,version_status,version_id)");
const routeActiveExpression = `CASE WHEN EXISTS (SELECT 1 FROM ui_page_manifest existing WHERE existing.active_yn='Y' AND existing.page_id<>${sql(page.pageId)} AND lower(regexp_replace(split_part(trim(existing.route_path),'?',1),'/+$',''))=lower(regexp_replace(split_part(trim(${sql(page.routePath)}),'?',1),'/+$',''))) THEN 'N' ELSE 'Y' END`;
emit(`VALUES(${sql(page.pageId)},${sql(page.pageName)},${sql(page.routePath)},${sql(page.domainCode)},${sql(page.menuCode || null)},${sql(page.layoutVersion)},${sql(page.designTokenVersion)},${routeActiveExpression},CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,${textJson({ api: backendFeature.apiContract, table: backendFeature.dataContract })},${sql(page.pageName)},${sql(page.routePath)},${sql(page.pageNameEn)},${textJson(componentSchema)},'ACTIVE',${sql(contract.schemaVersion)})`);
emit("ON CONFLICT (page_id) DO UPDATE SET page_name=EXCLUDED.page_name,route_path=EXCLUDED.route_path,domain_code=EXCLUDED.domain_code,menu_code=EXCLUDED.menu_code,layout_version=EXCLUDED.layout_version,design_token_version=EXCLUDED.design_token_version,active_yn=EXCLUDED.active_yn,updated_at=CURRENT_TIMESTAMP,data_source_config=EXCLUDED.data_source_config,page_title=EXCLUDED.page_title,page_url=EXCLUDED.page_url,page_title_en=EXCLUDED.page_title_en,component_schema=EXCLUDED.component_schema,version_status='ACTIVE',version_id=EXCLUDED.version_id;");
emit(`DELETE FROM ui_page_component_map WHERE page_id=${sql(page.pageId)} AND map_id NOT IN (${list(instances.map((item) => componentMapId(item.id)))});`);
for (const instance of instances) {
  const instanceProps = { sectionId: instance.section, assetContract: page.pageId };
  emit("INSERT INTO ui_page_component_map(map_id,page_id,layout_zone,component_id,instance_key,display_order,conditional_rule_summary,created_at,updated_at,instance_props)");
  emit(`VALUES(${sql(componentMapId(instance.id))},${sql(page.pageId)},${sql(instance.zone)},${sql(instance.component)},${sql(instance.id)},${Number(instance.order)},NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,${textJson(instanceProps)})`);
  emit("ON CONFLICT (map_id) DO UPDATE SET page_id=EXCLUDED.page_id,layout_zone=EXCLUDED.layout_zone,component_id=EXCLUDED.component_id,instance_key=EXCLUDED.instance_key,display_order=EXCLUDED.display_order,updated_at=CURRENT_TIMESTAMP,instance_props=EXCLUDED.instance_props;");
}
emit();

const designAssetId = `SCREEN_${page.pageId.toUpperCase().replaceAll("-", "_")}`;
const composition = { schemaVersion: contract.schemaVersion, theme: theme.themeId, sections, instances, classSets, dataElements: dataElements.map((item) => item.code) };
emit("INSERT INTO framework_design_asset_registry(design_asset_id,page_id,route_path,menu_code,domain_code,layout_version,design_token_version,composition_json,source_path,asset_fingerprint,active_yn,created_at,updated_at)");
emit(`VALUES(${sql(designAssetId)},${sql(page.pageId)},${sql(page.routePath)},${sql(page.menuCode || null)},${sql(page.domainCode)},${sql(page.layoutVersion)},${sql(page.designTokenVersion)},${jsonb(composition)},${sql(page.sourcePath)},${sql(contractFingerprint)},'Y',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);
emit("ON CONFLICT (design_asset_id) DO UPDATE SET page_id=EXCLUDED.page_id,route_path=EXCLUDED.route_path,menu_code=EXCLUDED.menu_code,domain_code=EXCLUDED.domain_code,layout_version=EXCLUDED.layout_version,design_token_version=EXCLUDED.design_token_version,composition_json=EXCLUDED.composition_json,source_path=EXCLUDED.source_path,asset_fingerprint=EXCLUDED.asset_fingerprint,active_yn='Y',updated_at=CURRENT_TIMESTAMP;");
emit();

const layers = [
  ["THEME", { themeId: theme.themeId, classSets: classSets.map((item) => item.id) }, "/admin/system/theme-management", "REGISTERED"],
  ["SECTION", { sections: sections.map((item) => item.id) }, "/admin/system/section-management", "REGISTERED"],
  ["COMPONENT", { components: components.map((item) => item.id) }, "/admin/system/component-management", "REGISTERED"],
  ["DESIGN", { designAssetId, pageId: page.pageId }, "/admin/system/design-management", "REGISTERED"],
  ["FRONTEND", { sourcePath: page.sourcePath, pageId: page.pageId }, "/admin/system/page-development-master", "LINKED"],
  ["API", { contracts: backendFeature.apiContract }, "/admin/system/api-management", "LINKED"],
  ["BACKEND", { featureCode: backendFeature.code, strategy: backendFeature.installStrategy }, "/admin/system/package-governance", "REGISTERED"],
  ["DATABASE", { tables: backendFeature.dataContract, elements: dataElements.map((item) => item.code) }, "/admin/system/data-model-management", "LINKED"],
  ["TEST", { tests: backendFeature.testContract }, "/admin/system/verification-asset-management", "LINKED"],
];
for (const contractId of page.contractIds) {
  for (const [layer, ref, route, decision] of layers) {
    emit("INSERT INTO framework_screen_asset_assembly(contract_id,asset_layer,asset_ref,management_route,decision,evidence_ref,protected,updated_by,created_at,updated_at)");
    emit(`VALUES(${Number(contractId)},${sql(layer)},${textJson(ref)},${sql(route)},${sql(decision)},${sql(`sha256:${contractFingerprint}`)},true,'ASSET_AUTOMATION',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);
    emit("ON CONFLICT (contract_id,asset_layer) DO UPDATE SET asset_ref=EXCLUDED.asset_ref,management_route=EXCLUDED.management_route,decision=EXCLUDED.decision,evidence_ref=EXCLUDED.evidence_ref,protected=true,updated_by='ASSET_AUTOMATION',updated_at=CURRENT_TIMESTAMP;");
  }
}
emit();

for (const element of dataElements) {
  emit("INSERT INTO framework_data_element(data_element_code,domain_code,logical_name,data_type,semantic_definition,privacy_class,canonical_validation,created_at,updated_at)");
  emit(`VALUES(${sql(element.code)},${sql(page.domainCode)},${sql(element.name)},${sql(element.type)},${sql(`${element.name}; API ${element.field}; DB member_consent_history.${element.column}`)},${sql(element.privacy)},${jsonb({ required: element.required })},CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);
  emit("ON CONFLICT (data_element_code) DO UPDATE SET domain_code=EXCLUDED.domain_code,logical_name=EXCLUDED.logical_name,data_type=EXCLUDED.data_type,semantic_definition=EXCLUDED.semantic_definition,privacy_class=EXCLUDED.privacy_class,canonical_validation=EXCLUDED.canonical_validation,updated_at=CURRENT_TIMESTAMP;");
}
const screenIdQuery = `(SELECT screen_resource_id FROM framework_screen_resource WHERE route_key=${sql(page.routePath)} ORDER BY screen_resource_id DESC LIMIT 1)`;
emit(`DO $$ BEGIN IF ${screenIdQuery} IS NULL THEN RAISE EXCEPTION 'SCREEN_RESOURCE_NOT_FOUND:${page.routePath}'; END IF; END $$;`);
emit(`DELETE FROM framework_screen_data_binding WHERE screen_resource_id=${screenIdQuery} AND data_element_code NOT IN (${list(dataElements.map((item) => item.code))});`);
for (const element of dataElements) {
  emit("INSERT INTO framework_screen_data_binding(screen_resource_id,data_element_code,field_code,field_name,control_type,api_property,source_table,source_column,required,editable,validation_contract,lineage_status)");
  emit(`VALUES(${screenIdQuery},${sql(element.code)},${sql(element.field)},${sql(element.name)},${sql(element.control)},${sql(element.field)},'member_consent_history',${sql(element.column)},${bool(element.required)},false,${jsonb({ source: "asset-contract", privacy: element.privacy })},'IMPLEMENTATION_VERIFIED')`);
  emit("ON CONFLICT (screen_resource_id,data_element_code,field_code) DO UPDATE SET field_name=EXCLUDED.field_name,control_type=EXCLUDED.control_type,api_property=EXCLUDED.api_property,source_table=EXCLUDED.source_table,source_column=EXCLUDED.source_column,required=EXCLUDED.required,editable=false,validation_contract=EXCLUDED.validation_contract,lineage_status='IMPLEMENTATION_VERIFIED';");
}
emit();

emit("INSERT INTO framework_screen_capability(screen_resource_id,capability_code,capability_name,capability_type,command_contract,error_contract,evidence_contract,implementation_status,created_at,updated_at)");
emit(`VALUES(${screenIdQuery},${sql(backendFeature.code)},${sql(backendFeature.name)},'QUERY',${jsonb({ method: "GET", endpoint: backendFeature.apiContract[0] })},${jsonb({ states: ["ERROR", "FORBIDDEN"], retryable: true })},${jsonb({ table: backendFeature.dataContract[0], source: page.sourcePath })},'VERIFIED',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);
emit("ON CONFLICT (screen_resource_id,capability_code) DO UPDATE SET capability_name=EXCLUDED.capability_name,capability_type='QUERY',command_contract=EXCLUDED.command_contract,error_contract=EXCLUDED.error_contract,evidence_contract=EXCLUDED.evidence_contract,implementation_status='VERIFIED',updated_at=CURRENT_TIMESTAMP;");
emit();

emit("INSERT INTO framework_common_feature_package(feature_code,feature_name,feature_version,feature_category,description,api_contract,data_contract,ui_contract,event_contract,permission_contract,test_contract,install_strategy,active_yn,created_at,updated_at)");
emit(`VALUES(${sql(backendFeature.code)},${sql(backendFeature.name)},${sql(backendFeature.version)},${sql(backendFeature.category)},${sql(backendFeature.description)},${jsonb(backendFeature.apiContract)},${jsonb(backendFeature.dataContract)},${jsonb(backendFeature.uiContract)},${jsonb(backendFeature.eventContract)},${jsonb(backendFeature.permissionContract)},${jsonb(backendFeature.testContract)},${sql(backendFeature.installStrategy)},'Y',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);
emit("ON CONFLICT (feature_code) DO UPDATE SET feature_name=EXCLUDED.feature_name,feature_version=EXCLUDED.feature_version,feature_category=EXCLUDED.feature_category,description=EXCLUDED.description,api_contract=EXCLUDED.api_contract,data_contract=EXCLUDED.data_contract,ui_contract=EXCLUDED.ui_contract,event_contract=EXCLUDED.event_contract,permission_contract=EXCLUDED.permission_contract,test_contract=EXCLUDED.test_contract,install_strategy=EXCLUDED.install_strategy,active_yn='Y',updated_at=CURRENT_TIMESTAMP;");
for (const step of page.steps) {
  emit("INSERT INTO framework_screen_feature_binding(process_code,step_code,audience,route_path,feature_code,binding_options,required_yn,created_at,updated_at)");
  emit(`VALUES(${sql(page.processCode)},${sql(step.stepCode)},${sql(step.actorCode)},${sql(page.routePath)},${sql(backendFeature.code)},${jsonb({ strategy: backendFeature.installStrategy, assetContract: page.pageId })},'Y',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);
  emit("ON CONFLICT (process_code,step_code,audience,route_path,feature_code) DO UPDATE SET binding_options=EXCLUDED.binding_options,required_yn='Y',updated_at=CURRENT_TIMESTAMP;");
}
emit(`SELECT * FROM framework_install_common_feature(${sql(backendFeature.code)},${sql(backendFeature.projectScope)},'ASSET_AUTOMATION',${jsonb({ routePath: page.routePath, assetFingerprint: contractFingerprint, installStrategy: backendFeature.installStrategy })});`);
emit();

emit("DO $$");
emit("DECLARE v_count integer;");
emit("BEGIN");
emit(`  SELECT count(*) INTO v_count FROM ui_component_registry WHERE component_id IN (${list(components.map((item) => item.id))}) AND active_yn='Y';`);
emit(`  IF v_count <> ${components.length} THEN RAISE EXCEPTION 'COMPONENT_REGISTRATION_MISMATCH:%',v_count; END IF;`);
emit(`  SELECT count(*) INTO v_count FROM ui_section_registry WHERE section_id IN (${list(sections.map((item) => item.id))}) AND active_yn='Y';`);
emit(`  IF v_count <> ${sections.length} THEN RAISE EXCEPTION 'SECTION_REGISTRATION_MISMATCH:%',v_count; END IF;`);
emit(`  SELECT count(*) INTO v_count FROM ui_page_component_map WHERE page_id=${sql(page.pageId)};`);
emit(`  IF v_count <> ${instances.length} THEN RAISE EXCEPTION 'PAGE_COMPONENT_MAP_MISMATCH:%',v_count; END IF;`);
emit(`  SELECT count(*) INTO v_count FROM framework_screen_data_binding WHERE screen_resource_id=${screenIdQuery} AND lineage_status='IMPLEMENTATION_VERIFIED';`);
emit(`  IF v_count <> ${dataElements.length} THEN RAISE EXCEPTION 'DATA_LINEAGE_MISMATCH:%',v_count; END IF;`);
emit(`  SELECT count(*) INTO v_count FROM framework_screen_feature_binding WHERE route_path=${sql(page.routePath)} AND feature_code=${sql(backendFeature.code)};`);
emit(`  IF v_count <> ${page.steps.length} THEN RAISE EXCEPTION 'FEATURE_BINDING_MISMATCH:%',v_count; END IF;`);
emit(`  SELECT count(*) INTO v_count FROM framework_feature_installation WHERE project_scope=${sql(backendFeature.projectScope)} AND feature_code=${sql(backendFeature.code)} AND installation_status='INSTALLED';`);
emit("  IF v_count <> 1 THEN RAISE EXCEPTION 'FEATURE_INSTALLATION_MISSING'; END IF;");
emit("END $$;");
emit("COMMIT;");
emit(`\\echo SCREEN_SYSTEM_ASSETS_SYNCED page=${page.pageId} components=${components.length} sections=${sections.length} instances=${instances.length} data_elements=${dataElements.length} feature=${backendFeature.code} fingerprint=${contractFingerprint}`);

if (checkOnly) {
  console.log(`SCREEN_SYSTEM_ASSET_CONTRACT_OK page=${page.pageId} components=${components.length} sections=${sections.length} instances=${instances.length} data_elements=${dataElements.length} fingerprint=${contractFingerprint}`);
} else {
  process.stdout.write(`${lines.join("\n")}\n`);
}
