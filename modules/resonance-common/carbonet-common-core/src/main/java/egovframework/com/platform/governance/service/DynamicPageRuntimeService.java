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
        if (pages.isEmpty()) throw new IllegalArgumentException("발행된 동적 화면을 찾을 수 없습니다: " + pageId);
        Map<String, Object> out = new LinkedHashMap<>(pages.get(0));
        out.put("components", jdbc.queryForList("select m.map_id as \"mapId\",m.layout_zone as \"layoutZone\",m.instance_key as \"instanceKey\",m.display_order as \"displayOrder\",c.component_id as \"componentId\",c.component_name as \"componentName\",c.component_type as \"componentType\",c.design_reference as \"designReference\",c.default_props as \"defaultProps\" from ui_page_component_map m join ui_component_registry c on c.component_id=m.component_id and c.active_yn='Y' where m.page_id=? order by m.display_order,m.map_id", pageId));
        out.put("dataContracts", jdbc.queryForList("select binding_key as \"bindingKey\",source_type as \"sourceType\",endpoint_path as endpoint,static_payload_json as \"staticPayload\",refresh_seconds as \"refreshSeconds\" from framework_page_data_contract where page_id=? and active_yn='Y' order by binding_key", pageId));
        out.put("actions", jdbc.queryForList("select action_code as \"actionCode\",action_type as \"actionType\",target_path as target,http_method as method,confirmation_text as confirmation,required_actor_codes as \"requiredActorCodes\" from framework_page_action_contract where page_id=? and active_yn='Y' order by action_code", pageId));
        out.put("version", jdbc.queryForList("select version_no as \"versionNo\",published_at as \"publishedAt\" from framework_dynamic_page_version where page_id=? and version_status='PUBLISHED' order by version_no desc limit 1", pageId).stream().findFirst().orElse(Map.of("versionNo", 0)));
        return out;
    }

    @Transactional
    public Map<String, Object> compile(List<Map<String, Object>> pages, String actor) {
        if (pages.isEmpty() || pages.size() > MAX_BATCH_SIZE) throw new IllegalArgumentException("한 번에 1~1,000개 화면만 등록할 수 있습니다.");
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
                String componentId = pageId + "_" + String.format("%03d", ++order);
                String type = required(component, "type");
                String name = String.valueOf(component.getOrDefault("name", type));
                String props = json(component.getOrDefault("props", Map.of()));
                jdbc.update("insert into ui_component_registry(component_id,component_name,component_type,owner_domain,props_schema_json,design_reference,active_yn,created_at,updated_at,category,default_props,asset_fingerprint) values(?,?,?,?,?,?,'Y',current_timestamp,current_timestamp,'DYNAMIC',?,md5(?)) on conflict(component_id) do update set component_name=excluded.component_name,component_type=excluded.component_type,design_reference=excluded.design_reference,default_props=excluded.default_props,asset_fingerprint=excluded.asset_fingerprint,active_yn='Y',updated_at=current_timestamp",
                        componentId, name, type, domain, "{}", String.valueOf(component.getOrDefault("designReference", "KRDS_GOV_DEFAULT")), props, type + "|" + props);
                String mapId = stableId("DYN", pageId + "|" + order);
                jdbc.update("insert into ui_page_component_map(map_id,page_id,layout_zone,component_id,instance_key,display_order,conditional_rule_summary,created_at,updated_at) values(?,?,?,?,?,?,?,current_timestamp,current_timestamp)",
                        mapId, pageId, String.valueOf(component.getOrDefault("zone", "content")), componentId, String.valueOf(component.getOrDefault("instanceKey", "component-" + order)), order * 10, String.valueOf(component.getOrDefault("condition", "always")));
                componentCount++;
            }
            jdbc.update("delete from framework_page_data_contract where page_id=?", pageId);
            @SuppressWarnings("unchecked") List<Map<String, Object>> dataContracts = (List<Map<String, Object>>) page.getOrDefault("dataContracts", List.of());
            for (Map<String, Object> contract : dataContracts) {
                String bindingKey = required(contract, "bindingKey");
                String sourceType = String.valueOf(contract.getOrDefault("sourceType", "STATIC")).toUpperCase();
                if (!List.of("STATIC", "HTTP_GET").contains(sourceType)) throw new IllegalArgumentException("지원하지 않는 데이터 소스입니다: " + sourceType);
                jdbc.update("insert into framework_page_data_contract(contract_id,page_id,binding_key,source_type,endpoint_path,static_payload_json,refresh_seconds,active_yn,updated_at) values(?,?,?,?,?,?,?,'Y',current_timestamp)",
                        stableId("DAT", pageId + "|" + bindingKey), pageId, bindingKey, sourceType, relativePath(contract.get("endpoint")), json(contract.getOrDefault("staticPayload", Map.of())), integer(contract.get("refreshSeconds")));
                dataContractCount++;
            }
            jdbc.update("delete from framework_page_action_contract where page_id=?", pageId);
            @SuppressWarnings("unchecked") List<Map<String, Object>> actions = (List<Map<String, Object>>) page.getOrDefault("actions", List.of());
            for (Map<String, Object> action : actions) {
                String actionCode = required(action, "actionCode");
                String actionType = String.valueOf(action.getOrDefault("actionType", "NAVIGATE")).toUpperCase();
                if (!List.of("NAVIGATE", "HTTP").contains(actionType)) throw new IllegalArgumentException("지원하지 않는 액션입니다: " + actionType);
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
    private String required(Map<String, Object> row, String key) { String value = String.valueOf(row.getOrDefault(key, "")).trim(); if (value.isEmpty() || ("pageId".equals(key) && !value.matches("[A-Za-z0-9_-]+"))) throw new IllegalArgumentException(key + " 값이 올바르지 않습니다."); return value; }
    private String relativePath(Object value) { String path = value == null ? null : String.valueOf(value).trim(); if (path == null || path.isEmpty()) return null; if (!path.startsWith("/") || path.startsWith("//")) throw new IllegalArgumentException("내부 상대 경로만 사용할 수 있습니다: " + path); return path; }
    private int integer(Object value) { if (value == null) return 0; try { return Math.max(0, Integer.parseInt(String.valueOf(value))); } catch (Exception e) { throw new IllegalArgumentException("refreshSeconds는 0 이상의 정수여야 합니다."); } }
    private String stableId(String prefix, String value) { return prefix + "_" + UUID.nameUUIDFromBytes(value.getBytes(StandardCharsets.UTF_8)).toString().replace("-", ""); }
    private String json(Object value) { try { return objectMapper.writeValueAsString(value); } catch (Exception e) { throw new IllegalArgumentException("화면 정의를 JSON으로 변환하지 못했습니다.", e); } }
}
