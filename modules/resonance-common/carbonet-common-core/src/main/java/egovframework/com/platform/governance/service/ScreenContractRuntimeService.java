package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class ScreenContractRuntimeService {
    private static final Set<String> REQUIRED_LAYERS = Set.of(
        "screen", "data", "ui", "action", "process", "permission", "test", "operations"
    );
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public ScreenContractRuntimeService(DataSource dataSource, ObjectMapper mapper) {
        this.jdbc = new JdbcTemplate(dataSource);
        this.mapper = mapper;
    }

    public Map<String,Object> load(String rawScreenKey) {
        String screenKey = screenKey(rawScreenKey);
        List<Map<String,Object>> rows = jdbc.queryForList("""
            select b.screen_key as "screenKey",b.route_path as "routePath",b.cache_epoch as "cacheEpoch",
                   v.version_id as "versionId",v.version_no as "versionNo",v.contract_hash as "contractHash",
                   v.contract_json::text as "contractJson",v.published_at as "publishedAt"
              from framework_screen_contract_binding b
              join framework_screen_contract_version v on v.version_id=b.active_version_id
             where b.screen_key=? and v.version_status='PUBLISHED'
            """, screenKey);
        if (rows.isEmpty()) {
            rows = recover(screenKey);
        }
        if (rows.isEmpty()) throw new IllegalArgumentException("발행된 화면 계약을 찾을 수 없습니다: " + screenKey);
        Map<String,Object> row = rows.get(0);
        Map<String,Object> result = new LinkedHashMap<>(row);
        result.remove("contractJson");
        result.put("contract", json(String.valueOf(row.get("contractJson"))));
        result.put("source", "DB_VERSIONED_CONTRACT");
        return result;
    }

    public Map<String,Object> loadByRoute(String rawRoute, String processCode, String stepCode, String audience) {
        String route = canonicalRoute(rawRoute);
        String process = optionalCode(processCode);
        String step = optionalCode(stepCode);
        String targetAudience = optionalCode(audience);
        List<Map<String,Object>> rows = jdbc.queryForList("""
            select b.screen_key as "screenKey",b.route_path as "routePath",b.cache_epoch as "cacheEpoch",
                   v.version_id as "versionId",v.version_no as "versionNo",v.contract_hash as "contractHash",
                   v.contract_json::text as "contractJson",v.published_at as "publishedAt"
              from framework_screen_contract_binding b
              join framework_screen_contract_version v on v.version_id=b.active_version_id
             where lower(split_part(b.route_path,'?',1))=?
               and v.version_status='PUBLISHED'
               and (?='' or upper(v.contract_json #>> '{process,processCode}')=?)
               and (?='' or upper(v.contract_json #>> '{process,stepCode}')=?)
               and (?='' or upper(v.contract_json #>> '{screen,audience}')=?
                            or upper(v.contract_json #>> '{permission,audience}')=?)
             order by b.updated_at desc,b.contract_id desc,b.screen_key
            """, route, process, process, step, step,
            targetAudience, targetAudience, targetAudience);
        if (rows.isEmpty()) throw new IllegalArgumentException("Published screen contract was not found for route: " + route);
        Map<String,Object> row = rows.get(0);
        Map<String,Object> result = new LinkedHashMap<>(row);
        result.remove("contractJson");
        result.put("contract", json(String.valueOf(row.get("contractJson"))));
        result.put("source", "DB_VERSIONED_CONTRACT");
        result.put("matchCount", rows.size());
        result.put("resolvedBy", "ROUTE_PROCESS_STEP_AUDIENCE");
        return result;
    }

    @Transactional
    public Map<String,Object> publish(String rawScreenKey, Map<String,Object> body, String actor) {
        String screenKey = screenKey(rawScreenKey);
        Map<String,Object> contract = object(body.get("contract"));
        validateContract(contract);
        String payload = write(contract);
        List<Map<String,Object>> bindings = jdbc.queryForList(
            "select contract_id,active_version_id,cache_epoch from framework_screen_contract_binding where screen_key=? for update",
            screenKey);
        if (bindings.isEmpty()) throw new IllegalArgumentException("화면 바인딩을 찾을 수 없습니다: " + screenKey);
        Map<String,Object> binding = bindings.get(0);
        long contractId = ((Number)binding.get("contract_id")).longValue();
        Number expected = number(body.get("expectedVersionId"));
        Number active = (Number)binding.get("active_version_id");
        if (expected != null && (active == null || expected.longValue() != active.longValue())) {
            throw new IllegalStateException("화면 계약이 다른 사용자에 의해 변경되었습니다. 새 버전을 다시 조회하세요.");
        }
        Integer next = jdbc.queryForObject(
            "select coalesce(max(version_no),0)+1 from framework_screen_contract_version where contract_id=?",
            Integer.class, contractId);
        Long versionId = jdbc.queryForObject("""
            insert into framework_screen_contract_version(
              contract_id,version_no,contract_json,contract_hash,version_status,created_by,published_at)
            values(?,?,?::jsonb,md5((?::jsonb)::text),'PUBLISHED',?,current_timestamp)
            returning version_id
            """, Long.class, contractId, next, payload, payload, actor);
        jdbc.update("""
            update framework_screen_contract_binding
               set previous_version_id=active_version_id,active_version_id=?,cache_epoch=cache_epoch+1,
                   updated_by=?,updated_at=current_timestamp
             where screen_key=?
            """, versionId, actor, screenKey);
        jdbc.update("insert into framework_screen_contract_event(screen_key,event_type,from_version_id,to_version_id,actor_id) values(?,'PUBLISH',?,?,?)",
            screenKey, active, versionId, actor);
        return load(screenKey);
    }

    @Transactional
    public Map<String,Object> rollback(String rawScreenKey, String actor) {
        String screenKey = screenKey(rawScreenKey);
        List<Map<String,Object>> rows = jdbc.queryForList(
            "select active_version_id,previous_version_id from framework_screen_contract_binding where screen_key=? for update",
            screenKey);
        if (rows.isEmpty() || rows.get(0).get("previous_version_id") == null) {
            throw new IllegalStateException("롤백할 이전 화면 계약이 없습니다: " + screenKey);
        }
        Number active = (Number)rows.get(0).get("active_version_id");
        Number previous = (Number)rows.get(0).get("previous_version_id");
        jdbc.update("""
            update framework_screen_contract_binding
               set active_version_id=?,previous_version_id=?,cache_epoch=cache_epoch+1,
                   updated_by=?,updated_at=current_timestamp
             where screen_key=?
            """, previous, active, actor, screenKey);
        jdbc.update("insert into framework_screen_contract_event(screen_key,event_type,from_version_id,to_version_id,actor_id) values(?,'ROLLBACK',?,?,?)",
            screenKey, active, previous, actor);
        return load(screenKey);
    }

    private List<Map<String,Object>> recover(String screenKey) {
        List<Map<String,Object>> candidates = jdbc.queryForList("""
            select b.screen_key as "screenKey",b.route_path as "routePath",b.cache_epoch as "cacheEpoch",
                   v.version_id as "versionId",v.version_no as "versionNo",v.contract_hash as "contractHash",
                   v.contract_json::text as "contractJson",v.published_at as "publishedAt"
              from framework_screen_contract_binding b
              join framework_screen_contract_version v on v.version_id=b.previous_version_id
             where b.screen_key=? and v.version_status='PUBLISHED'
            """, screenKey);
        if (candidates.isEmpty()) return candidates;
        Number recovered = (Number)candidates.get(0).get("versionId");
        jdbc.update("update framework_screen_contract_binding set active_version_id=?,cache_epoch=cache_epoch+1,updated_by='SELF_HEAL',updated_at=current_timestamp where screen_key=?", recovered, screenKey);
        jdbc.update("insert into framework_screen_contract_event(screen_key,event_type,to_version_id,actor_id,event_payload) values(?,'RECOVER',?,'SELF_HEAL','{\"reason\":\"active version unavailable\"}'::jsonb)", screenKey, recovered);
        return candidates;
    }

    static void validateContract(Map<String,Object> contract) {
        if (contract.isEmpty()) throw new IllegalArgumentException("contract는 필수입니다.");
        for (String layer : REQUIRED_LAYERS) {
            if (!(contract.get(layer) instanceof Map<?,?>)) throw new IllegalArgumentException(layer + " 계약 계층이 필요합니다.");
        }
        Map<String,Object> screen = object(contract.get("screen"));
        required(screen, "screenKey");
        required(screen, "name");
        required(screen, "route");
        Map<String,Object> process = object(contract.get("process"));
        required(process, "processCode");
        required(process, "stepCode");
        Map<String,Object> permission = object(contract.get("permission"));
        required(permission, "actorCode");
    }

    private static String screenKey(String raw) {
        String value = raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT);
        if (!value.matches("[A-Z0-9][A-Z0-9_-]{2,159}")) throw new IllegalArgumentException("유효하지 않은 screenKey입니다.");
        return value;
    }
    static String canonicalRoute(String raw) {
        String value = raw == null ? "" : raw.trim().split("\\?",2)[0].toLowerCase(Locale.ROOT);
        if (!value.startsWith("/") || value.length() > 400 || value.contains("..")) {
            throw new IllegalArgumentException("A valid absolute routePath is required.");
        }
        return value;
    }
    private static String optionalCode(String raw) {
        String value = raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT);
        if (!value.isEmpty() && !value.matches("[A-Z0-9][A-Z0-9_-]{1,159}")) {
            throw new IllegalArgumentException("Invalid route resolution code: " + value);
        }
        return value;
    }
    @SuppressWarnings("unchecked")
    private static Map<String,Object> object(Object value) {
        if (!(value instanceof Map<?,?> raw)) return Map.of();
        Map<String,Object> result = new LinkedHashMap<>();
        raw.forEach((key,item)->result.put(String.valueOf(key),item));
        return result;
    }
    private static void required(Map<String,Object> value, String key) {
        if (value.get(key) == null || String.valueOf(value.get(key)).isBlank()) throw new IllegalArgumentException(key + " 값은 필수입니다.");
    }
    private Number number(Object value) {
        if (value == null || String.valueOf(value).isBlank()) return null;
        return Long.parseLong(String.valueOf(value));
    }
    private Map<String,Object> json(String value) {
        try { return mapper.readValue(value, new TypeReference<>() {}); }
        catch (JsonProcessingException e) { throw new IllegalStateException("저장된 화면 계약 JSON이 올바르지 않습니다.", e); }
    }
    private String write(Map<String,Object> value) {
        try { return mapper.writeValueAsString(value); }
        catch (JsonProcessingException e) { throw new IllegalArgumentException("화면 계약을 JSON으로 변환할 수 없습니다.", e); }
    }
}
