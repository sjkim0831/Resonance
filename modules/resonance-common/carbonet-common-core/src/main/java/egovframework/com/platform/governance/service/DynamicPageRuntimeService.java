package egovframework.com.platform.governance.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class DynamicPageRuntimeService {
    private final JdbcTemplate jdbc;

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
        return Map.of("success",false,"status","RETIRED","httpStatus",410,
                "activationPolicy","SOURCE_IMMEDIATE_V1",
                "message","Use the globally authorized common-design source endpoint.");
    }
}
