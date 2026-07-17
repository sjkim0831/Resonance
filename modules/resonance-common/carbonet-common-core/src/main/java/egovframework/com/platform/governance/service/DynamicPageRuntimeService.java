package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DynamicPageRuntimeService {
    private static final int MAX_BATCH_SIZE = 1000;
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public Map<String, Object> load(String pageId) {
        List<Map<String, Object>> pages = jdbc.queryForList(
                "select page_id as \"pageId\",page_name as \"pageName\",page_title as title,page_title_en as \"titleEn\",route_path as \"routePath\",domain_code as \"domainCode\",design_token_version as \"designTokenVersion\",component_schema as \"componentSchema\",version_status as \"versionStatus\" from ui_page_manifest where page_id=? and active_yn='Y' and version_status='PUBLISHED'",
                pageId);
        if (pages.isEmpty()) throw new IllegalArgumentException("Published dynamic page not found: " + pageId);
        Map<String, Object> out = new LinkedHashMap<>(pages.get(0));
        out.put("components", jdbc.queryForList("select m.map_id as \"mapId\",m.layout_zone as \"layoutZone\",m.instance_key as \"instanceKey\",m.display_order as \"displayOrder\",c.component_id as \"componentId\",c.component_name as \"componentName\",c.component_type as \"componentType\",c.design_reference as \"designReference\",case when m.instance_props='{}' then c.default_props else m.instance_props end as \"defaultProps\" from ui_page_component_map m join ui_component_registry c on c.component_id=m.component_id and c.active_yn='Y' where m.page_id=? order by m.display_order,m.map_id", pageId));
        out.put("dataContracts", jdbc.queryForList("select binding_key as \"bindingKey\",source_type as \"sourceType\",endpoint_path as endpoint,static_payload_json as \"staticPayload\",refresh_seconds as \"refreshSeconds\" from framework_page_data_contract where page_id=? and active_yn='Y' order by binding_key", pageId));
        out.put("actions", jdbc.queryForList("select action_code as \"actionCode\",action_type as \"actionType\",target_path as target,http_method as method,confirmation_text as confirmation,required_actor_codes as \"requiredActorCodes\" from framework_page_action_contract where page_id=? and active_yn='Y' order by action_code", pageId));
        out.put("version", jdbc.queryForList("select version_no as \"versionNo\",published_at as \"publishedAt\" from framework_dynamic_page_version where page_id=? and version_status='PUBLISHED' order by version_no desc limit 1", pageId).stream().findFirst().orElse(Map.of("versionNo", 0)));
        return out;
    }

    @Transactional
    public Map<String, Object> compile(List<Map<String, Object>> pages, String actor) {
        if (pages.isEmpty() || pages.size() > MAX_BATCH_SIZE) throw new IllegalArgumentException("Only 1 to 1,000 pages can be compiled at once.");
        int componentCount = 0, dataContractCount = 0, actionCount = 0;
        for (Map<String, Object> page : pages) {
            String pageId = required(page, "pageId");
            String title = required(page, "title");
            String route = String.valueOf(page.getOrDefault("routePath", "/runtime/page?pageId=" + pageId));
            String domain = String.valueOf(page.getOrDefault("domainCode", "HOME"));
            @SuppressWarnings("unchecked") List<Map<String, Object>> components = (List<Map<String, Object>>) page.getOrDefault("components", List.of());
            int version = nextVersion(pageId);
            jdbc.update("insert into ui_page_manifest(page_id,page_name,route_path,domain_code,layout_version,design_token_version,active_yn,created_at,updated_at,page_title,page_url,page_title_en,component_schema,version_status,version_id) values(?,?,?,?,'1.0.0',?,'Y',current_timestamp,current_timestamp,?,?,?,?, 'PUBLISHED',?) on conflict(page_id) do update set page_name=excluded.page_name,route_path=excluded.route_path,domain_code=excluded.domain_code,design_token_version=excluded.design_token_version,page_title=excluded.page_title,page_url=excluded.page_url,page_title_en=excluded.page_title_en,component_schema=excluded.component_schema,version_status='PUBLISHED',active_yn='Y',updated_at=current_timestamp",
                    pageId, title, route, domain, String.valueOf(page.getOrDefault("themeId", "KRDS_GOV_DEFAULT")), title, route, String.valueOf(page.getOrDefault("titleEn", title)), json(page.getOrDefault("schema", Map.of("pageType", page.getOrDefault("pageType", "LIST")))), String.valueOf(version));
            jdbc.update("delete from ui_page_component_map where page_id=?", pageId);
            int order = 0;
            for (Map<String, Object> component : components) {
                ++order;
                String type = required(component, "type");
                String name = String.valueOf(component.getOrDefault("name", type));
                @SuppressWarnings("unchecked") Map<String, Object> propValues = component.get("props") instanceof Map<?, ?> value ? (Map<String, Object>) value : Map.of();
                String props = json(propValues);
                String propsSchema = json(propertySchema(propValues));
                String designReference = String.valueOf(component.getOrDefault("designReference", "KRDS_GOV_DEFAULT"));
                String signature = type + "|" + propsSchema + "|" + designReference;
                jdbc.queryForObject("select pg_advisory_xact_lock(hashtext(?))", Long.class, signature);
                List<String> existing = jdbc.queryForList("select component_id from ui_component_registry where active_yn='Y' and component_type=? and props_schema_json::jsonb=cast(? as jsonb) and design_reference=? order by component_id limit 1", String.class, type, propsSchema, designReference);
                String componentId = existing.isEmpty() ? "CMP_" + stableId("", signature).replace("_", "").substring(0, 24).toUpperCase() : existing.get(0);
                if (existing.isEmpty()) {
                    jdbc.update("insert into ui_component_registry(component_id,component_name,component_type,owner_domain,props_schema_json,design_reference,active_yn,created_at,updated_at,category,default_props,asset_fingerprint) values(?,?,?,?,?,?,'Y',current_timestamp,current_timestamp,'COMMON','{}',md5(?))",
                            componentId, name, type, "COMMON", propsSchema, designReference, signature);
                }
                syncCommonProperties(componentId, propValues);
                String mapId = stableId("DYN", pageId + "|" + order);
                jdbc.update("insert into ui_page_component_map(map_id,page_id,layout_zone,component_id,instance_key,display_order,conditional_rule_summary,instance_props,created_at,updated_at) values(?,?,?,?,?,?,?,?,current_timestamp,current_timestamp)",
                        mapId, pageId, String.valueOf(component.getOrDefault("zone", "content")), componentId, String.valueOf(component.getOrDefault("instanceKey", "component-" + order)), order * 10, String.valueOf(component.getOrDefault("condition", "always")), props);
                componentCount++;
            }
            jdbc.update("delete from framework_page_data_contract where page_id=?", pageId);
            @SuppressWarnings("unchecked") List<Map<String, Object>> dataContracts = (List<Map<String, Object>>) page.getOrDefault("dataContracts", List.of());
            for (Map<String, Object> contract : dataContracts) {
                String bindingKey = required(contract, "bindingKey");
                String sourceType = String.valueOf(contract.getOrDefault("sourceType", "STATIC")).toUpperCase();
                if (!List.of("STATIC", "HTTP_GET").contains(sourceType)) throw new IllegalArgumentException("Unsupported data source: " + sourceType);
                jdbc.update("insert into framework_page_data_contract(contract_id,page_id,binding_key,source_type,endpoint_path,static_payload_json,refresh_seconds,active_yn,updated_at) values(?,?,?,?,?,?,?,'Y',current_timestamp)",
                        stableId("DAT", pageId + "|" + bindingKey), pageId, bindingKey, sourceType, relativePath(contract.get("endpoint")), json(contract.getOrDefault("staticPayload", Map.of())), integer(contract.get("refreshSeconds")));
                dataContractCount++;
            }
            jdbc.update("delete from framework_page_action_contract where page_id=?", pageId);
            @SuppressWarnings("unchecked") List<Map<String, Object>> actions = (List<Map<String, Object>>) page.getOrDefault("actions", List.of());
            for (Map<String, Object> action : actions) {
                String actionCode = required(action, "actionCode");
                String actionType = String.valueOf(action.getOrDefault("actionType", "NAVIGATE")).toUpperCase();
                if (!List.of("NAVIGATE", "HTTP").contains(actionType)) throw new IllegalArgumentException("Unsupported action: " + actionType);
                jdbc.update("insert into framework_page_action_contract(action_id,page_id,action_code,action_type,target_path,http_method,confirmation_text,required_actor_codes,active_yn,updated_at) values(?,?,?,?,?,?,?,?,'Y',current_timestamp)",
                        stableId("ACT", pageId + "|" + actionCode), pageId, actionCode, actionType, relativePath(action.get("target")), String.valueOf(action.getOrDefault("method", "GET")).toUpperCase(), String.valueOf(action.getOrDefault("confirmation", "")), String.valueOf(action.getOrDefault("requiredActorCodes", "")));
                actionCount++;
            }
            jdbc.update("insert into framework_dynamic_page_version(page_id,version_no,definition_json,published_by) values(?,?,?,?)", pageId, version, json(page), actor);
            jdbc.update("update ui_page_manifest set version_id=? where page_id=?", String.valueOf(version), pageId);
        }
        return Map.of("success", true, "pageCount", pages.size(), "componentCount", componentCount, "dataContractCount", dataContractCount, "actionCount", actionCount, "runtimePath", "/runtime/page?pageId={pageId}");
    }

    private int nextVersion(String pageId) { Integer value = jdbc.queryForObject("select coalesce(max(version_no),0)+1 from framework_dynamic_page_version where page_id=?", Integer.class, pageId); return value == null ? 1 : value; }
    private Map<String, Object> propertySchema(Map<String, Object> values) {
        Map<String, Object> properties = new LinkedHashMap<>();
        values.entrySet().stream().sorted(Map.Entry.comparingByKey()).forEach(entry -> properties.put(entry.getKey(), Map.of("type", jsonType(entry.getValue()))));
        return Map.of("type", "object", "properties", properties, "additionalProperties", false);
    }
    private String jsonType(Object value) {
        if (value instanceof Boolean) return "boolean";
        if (value instanceof Number) return "number";
        if (value instanceof List<?>) return "array";
        if (value instanceof Map<?, ?>) return "object";
        return value == null ? "null" : "string";
    }
    private void syncCommonProperties(String componentId, Map<String, Object> values) {
        jdbc.update("delete from ui_component_property_map where component_id=?", componentId);
        int order = 0;
        for (Map.Entry<String, Object> entry : values.entrySet().stream().sorted(Map.Entry.comparingByKey()).toList()) {
            String schema = json(Map.of("type", jsonType(entry.getValue())));
            String fingerprint = jdbc.queryForObject("select md5(lower(?)||'|'||cast(? as jsonb)::text)", String.class, entry.getKey(), schema);
            String propertyId = "PROP_" + fingerprint.substring(0, 16).toUpperCase();
            jdbc.update("insert into ui_common_property_registry(property_id,property_name,data_type,schema_json,asset_fingerprint,active_yn) values(?,?,?,cast(? as jsonb),?,'Y') on conflict(asset_fingerprint) do update set active_yn='Y',updated_at=current_timestamp",
                    propertyId, entry.getKey(), jsonType(entry.getValue()), schema, fingerprint);
            jdbc.update("insert into ui_component_property_map(component_id,property_id,required_yn,display_order) values(?,?,'N',?) on conflict(component_id,property_id) do update set display_order=excluded.display_order",
                    componentId, propertyId, ++order);
        }
    }
    private String required(Map<String, Object> row, String key) { String value = String.valueOf(row.getOrDefault(key, "")).trim(); if (value.isEmpty() || ("pageId".equals(key) && !value.matches("[A-Za-z0-9_-]+"))) throw new IllegalArgumentException("Invalid value: " + key); return value; }
    private String relativePath(Object value) { String path = value == null ? null : String.valueOf(value).trim(); if (path == null || path.isEmpty()) return null; if (!path.startsWith("/") || path.startsWith("//")) throw new IllegalArgumentException("Only relative internal paths are allowed: " + path); return path; }
    private int integer(Object value) { if (value == null) return 0; try { return Math.max(0, Integer.parseInt(String.valueOf(value))); } catch (Exception e) { throw new IllegalArgumentException("refreshSeconds must be a non-negative integer."); } }
    private String stableId(String prefix, String value) { return prefix + "_" + UUID.nameUUIDFromBytes(value.getBytes(StandardCharsets.UTF_8)).toString().replace("-", ""); }
    private String json(Object value) { try { return objectMapper.writeValueAsString(value); } catch (Exception e) { throw new IllegalArgumentException("Failed to convert page definition to JSON.", e); } }
}
