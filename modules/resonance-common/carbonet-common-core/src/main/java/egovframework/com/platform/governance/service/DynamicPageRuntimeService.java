package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class DynamicPageRuntimeService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private static final Set<String> ALLOWED_COMPONENTS = Set.of("PAGE_HEADER", "KPI_GRID", "TIMELINE", "DATA_TABLE", "NOTICE");

    @Autowired
    public DynamicPageRuntimeService(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    /** Source-compatible constructor retained for existing tests and integrations. */
    public DynamicPageRuntimeService(JdbcTemplate jdbc) {
        this(jdbc, new ObjectMapper());
    }

    /** Retired source-writing endpoint contract; kept as a non-writing 410 response. */
    public Map<String, Object> compile(List<Map<String, Object>> ignoredPages, String ignoredActor) {
        return Map.of("httpStatus", 410, "status", "RETIRED",
                "activationPolicy", "SOURCE_IMMEDIATE_V1",
                "replacement", "/api/resonance-projects/design-assets/CCUS-PLATFORM/source");
    }

    public Map<String, Object> load(String pageId) {
        Map<String,Object> version = jdbc.queryForList(
                "select version_no as \"versionNo\",definition_json as definition from framework_dynamic_page_version where page_id=? and version_status='PUBLISHED' order by version_no desc limit 1",
                pageId).stream().findFirst().orElse(Map.of());
        if (version.containsKey("definition")) {
            try {
                Map<String,Object> snapshot = mapper.readValue(String.valueOf(version.get("definition")), new TypeReference<>() {});
                if (snapshot.containsKey("components") && snapshot.containsKey("pageId")) {
                    snapshot.put("version", Map.of("versionNo", version.get("versionNo")));
                    return snapshot;
                }
            } catch (Exception ignored) { /* migrate legacy snapshots through the current metadata tables */ }
        }
        return loadFromTables(pageId);
    }

    private Map<String,Object> loadFromTables(String pageId) {
        List<Map<String, Object>> pages = jdbc.queryForList(
                "select page_id as \"pageId\",page_name as \"pageName\",page_title as title,page_title_en as \"titleEn\",route_path as \"routePath\",domain_code as \"domainCode\",design_token_version as \"designTokenVersion\",component_schema as \"componentSchema\",version_status as \"versionStatus\",menu_code as \"menuCode\" from ui_page_manifest where page_id=? and active_yn='Y' and version_status in ('PUBLISHED','ACTIVE')",
                pageId);
        if (pages.isEmpty()) throw new IllegalArgumentException("DYNAMIC_PAGE_NOT_REGISTERED");
        Map<String, Object> out = new LinkedHashMap<>(pages.get(0));
        out.putIfAbsent("requiredAuthorities", List.of("AUTHENTICATED"));
        out.put("components", jdbc.queryForList("select m.map_id as \"mapId\",m.layout_zone as \"layoutZone\",m.instance_key as \"instanceKey\",m.display_order as \"displayOrder\",c.component_id as \"componentId\",c.component_name as \"componentName\",c.component_type as \"componentType\",c.design_reference as \"designReference\",case when m.instance_props='{}' then c.default_props else m.instance_props end as \"defaultProps\" from ui_page_component_map m join ui_component_registry c on c.component_id=m.component_id and c.active_yn='Y' where m.page_id=? order by m.display_order,m.map_id", pageId));
        out.put("dataContracts", jdbc.queryForList("select binding_key as \"bindingKey\",source_type as \"sourceType\",endpoint_path as endpoint,static_payload_json as \"staticPayload\",refresh_seconds as \"refreshSeconds\" from framework_page_data_contract where page_id=? and active_yn='Y' order by binding_key", pageId));
        out.put("actions", jdbc.queryForList("select action_code as \"actionCode\",action_type as \"actionType\",target_path as target,http_method as method,confirmation_text as confirmation,required_actor_codes as \"requiredActorCodes\" from framework_page_action_contract where page_id=? and active_yn='Y' order by action_code", pageId));
        out.put("version", jdbc.queryForList("select version_no as \"versionNo\",published_at as \"publishedAt\" from framework_dynamic_page_version where page_id=? and version_status='PUBLISHED' order by version_no desc limit 1", pageId).stream().findFirst().orElse(Map.of("versionNo", 0)));
        return out;
    }

    public Map<String,Object> loadByRoute(String routePath) {
        String route = normalizeRoute(routePath);
        List<String> ids = jdbc.queryForList("select page_id from ui_page_manifest where active_yn='Y' and version_status in ('PUBLISHED','ACTIVE') and lower(split_part(route_path,'?',1))=?", String.class, route);
        if(ids.size()!=1) throw new IllegalArgumentException(ids.isEmpty()?"DYNAMIC_PAGE_NOT_REGISTERED":"DYNAMIC_PAGE_ROUTE_CONFLICT");
        return load(ids.get(0));
    }

    @Transactional
    public Map<String,Object> publish(String pageId,String routePath,String menuCode,List<String> requiredAuthorities,Integer expectedVersion,String actor) throws Exception {
        String route=normalizeRoute(routePath);
        if(requiredAuthorities==null||requiredAuthorities.isEmpty()||requiredAuthorities.stream().anyMatch(v->v==null||v.isBlank()))
            throw new IllegalArgumentException("REQUIRED_AUTHORITIES_REQUIRED");
        for(String authority:requiredAuthorities){
            if(!"AUTHENTICATED".equals(authority)&&jdbc.queryForObject("select count(*) from comtnauthorinfo where upper(author_code)=upper(?) and use_at='Y'",Integer.class,authority)==0)
                throw new IllegalArgumentException("UNKNOWN_PAGE_AUTHORITY:"+authority);
        }
        if(jdbc.queryForObject("select count(*) from comtnmenuinfo where menu_code=? and use_at='Y' and expsr_at='Y' and lower(split_part(menu_url,'?',1))=?",Integer.class,menuCode,route)!=1)
            throw new IllegalArgumentException("ACTIVE_MENU_REQUIRED");
        if(jdbc.queryForObject("select count(*) from ui_page_manifest where active_yn='Y' and lower(split_part(route_path,'?',1))=? and page_id<>?",Integer.class,route,pageId)>0)
            throw new IllegalArgumentException("DUPLICATE_PAGE_ROUTE");
        if(jdbc.queryForObject("select count(*) from comtnmenuinfo where use_at='Y' and expsr_at='Y' and lower(split_part(menu_url,'?',1))=? and menu_code<>?",Integer.class,route,menuCode)>0)
            throw new IllegalArgumentException("ROUTE_MENU_COLLISION");
        Integer sourceRegistry=jdbc.queryForObject("select count(*) from information_schema.tables where table_schema=current_schema() and table_name='framework_design_asset_registry'",Integer.class);
        if(sourceRegistry==null||sourceRegistry==0)throw new IllegalStateException("STATIC_ROUTE_REGISTRY_UNAVAILABLE");
        int staticRouteCollision=jdbc.queryForObject("select count(*) from framework_design_asset_registry where active_yn='Y' and trim(source_path)<>'' and lower(split_part(route_path,'?',1))=?",Integer.class,route);
        if(staticRouteCollision>0)throw new IllegalArgumentException("STATIC_SOURCE_ROUTE_CONFLICT");
        if(jdbc.queryForObject("select count(*) from ui_page_manifest where page_id=? and active_yn='Y'",Integer.class,pageId)!=1)
            throw new IllegalArgumentException("DYNAMIC_PAGE_DEFINITION_REQUIRED");
        List<String> types=jdbc.queryForList("select c.component_type from ui_page_component_map m join ui_component_registry c on c.component_id=m.component_id where m.page_id=? and c.active_yn='Y'",String.class,pageId);
        if(types.isEmpty()||types.stream().anyMatch(type->!ALLOWED_COMPONENTS.contains(type)))
            throw new IllegalArgumentException("UNSUPPORTED_OR_EMPTY_COMPONENT_SET");
        Integer apiRegistry=jdbc.queryForObject("select count(*) from information_schema.tables where table_schema=current_schema() and table_name='framework_api_endpoint_registry'",Integer.class);
        if(apiRegistry==null||apiRegistry==0)throw new IllegalStateException("API_REGISTRY_UNAVAILABLE");
        int unsafeData=jdbc.queryForObject("select count(*) from framework_page_data_contract d where d.page_id=? and d.active_yn='Y' and (d.source_type not in ('HTTP_GET','STATIC') or (d.source_type='HTTP_GET' and (d.endpoint_path is null or d.endpoint_path not like '/%' or d.endpoint_path like '//%' or d.endpoint_path like '%\\%' or not exists(select 1 from framework_api_endpoint_registry a where a.active_yn='Y' and upper(a.http_method)='GET' and a.route_path=d.endpoint_path))))",Integer.class,pageId);
        int unsafeActions=jdbc.queryForObject("select count(*) from framework_page_action_contract c where c.page_id=? and c.active_yn='Y' and (c.action_type not in ('NAVIGATE','HTTP') or c.target_path is null or c.target_path not like '/%' or c.target_path like '//%' or c.target_path like '%\\%' or (c.action_type='HTTP' and (coalesce(c.http_method,'GET') not in ('GET','POST') or not exists(select 1 from framework_api_endpoint_registry a where a.active_yn='Y' and upper(a.http_method)=upper(coalesce(c.http_method,'GET')) and a.route_path=c.target_path))))",Integer.class,pageId);
        if(unsafeData>0||unsafeActions>0)throw new IllegalArgumentException("UNSAFE_RUNTIME_CONTRACT");
        int latest=jdbc.queryForObject("select coalesce(max(version_no),0) from framework_dynamic_page_version where page_id=?",Integer.class,pageId);
        int published=jdbc.queryForObject("select coalesce(max(version_no),0) from framework_dynamic_page_version where page_id=? and version_status='PUBLISHED'",Integer.class,pageId);
        if(expectedVersion!=null&&expectedVersion!=published)throw new IllegalStateException("PUBLISH_VERSION_CONFLICT");
        Map<String,Object> current=loadFromTables(pageId);
        current.put("routePath",route);current.put("menuCode",menuCode);current.put("requiredAuthorities",requiredAuthorities);
        String definition;
        try{definition=mapper.writeValueAsString(current);}catch(Exception e){throw new IllegalArgumentException("PAGE_DEFINITION_SERIALIZATION_FAILED",e);}
        jdbc.update("update framework_dynamic_page_version set version_status='ARCHIVED' where page_id=? and version_status='PUBLISHED'",pageId);
        jdbc.update("insert into framework_dynamic_page_version(page_id,version_no,definition_json,version_status,published_by,published_at) values(?,?,?,'PUBLISHED',?,current_timestamp)",pageId,latest+1,definition,actor);
        jdbc.update("update ui_page_manifest set route_path=?,page_url=?,menu_code=?,version_status='PUBLISHED',updated_at=current_timestamp where page_id=?",route,route,menuCode,pageId);
        return Map.of("success",true,"pageId",pageId,"routePath",route,"menuCode",menuCode,"versionNo",latest+1);
    }

    @Transactional
    public Map<String,Object> rollback(String pageId,int versionNo,String actor) throws Exception {
        Map<String,Object> target=jdbc.queryForMap("select definition_json from framework_dynamic_page_version where page_id=? and version_no=?",pageId,versionNo);
        Map<String,Object> snapshot;
        try{snapshot=mapper.readValue(String.valueOf(target.get("definition_json")),new TypeReference<>(){});}catch(Exception e){throw new IllegalArgumentException("PAGE_VERSION_INVALID");}
        if(!snapshot.containsKey("routePath")||!snapshot.containsKey("menuCode"))throw new IllegalArgumentException("LEGACY_VERSION_NOT_RESTORABLE");
        jdbc.update("update framework_dynamic_page_version set version_status=case when version_no=? then 'PUBLISHED' else 'ARCHIVED' end where page_id=?",versionNo,pageId);
        jdbc.update("update ui_page_manifest set route_path=?,page_url=?,menu_code=?,version_status='PUBLISHED',updated_at=current_timestamp where page_id=?",snapshot.get("routePath"),snapshot.get("routePath"),snapshot.get("menuCode"),pageId);
        return Map.of("success",true,"pageId",pageId,"versionNo",versionNo,"restoredBy",actor);
    }

    private String normalizeRoute(String value) {
        if(value==null||!value.startsWith("/")||value.startsWith("//")||value.contains("\\")||value.contains("?")||value.contains("#")||value.contains("..")||value.contains(" "))
            throw new IllegalArgumentException("INVALID_ROUTE_PATH");
        String normalized=value.replaceAll("/+$","").toLowerCase(Locale.ROOT);
        if(normalized.startsWith("/en/"))normalized=normalized.substring(3);
        return normalized.isEmpty()?"/":normalized;
    }
}
