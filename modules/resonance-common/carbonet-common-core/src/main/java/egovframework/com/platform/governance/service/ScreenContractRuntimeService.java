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
    public Map<String,Object> publishProfessionalContract(long contractId, String actor) {
        List<Map<String,Object>> source = jdbc.queryForList("""
            select c.process_code as "processCode",c.step_code as "stepCode",c.audience,
                   lower(split_part(c.route_path,'?',1)) as "routePath",
                   jsonb_build_object(
                     'schemaVersion','1.0',
                     'screen',jsonb_build_object(
                       'screenKey',upper(c.process_code||'__'||c.step_code||'__'||c.audience),
                       'name',c.screen_name,'route',lower(split_part(c.route_path,'?',1)),
                       'audience',c.audience),
                     'data',jsonb_build_object(
                       'fields',framework_try_jsonb(c.field_contract),
                       'contract',framework_try_jsonb(c.data_contract)),
                     'ui',jsonb_build_object(
                       'sections',framework_try_jsonb(c.section_contract),
                       'responsive',c.responsive_contract,
                       'accessibility',c.accessibility_contract),
                     'action',jsonb_build_object(
                       'commands',framework_try_jsonb(c.command_contract),
                       'apis',framework_try_jsonb(c.api_contract)),
                     'process',jsonb_build_object(
                       'processCode',c.process_code,'stepCode',c.step_code,
                       'entryCondition',c.entry_condition,'exitCondition',c.exit_condition,
                       'states',framework_try_jsonb(c.state_contract)),
                     'permission',jsonb_build_object(
                       'actorCode',c.actor_code,'audience',c.audience,
                       'security',c.security_contract),
                     'test',jsonb_build_object(
                       'evidence',framework_try_jsonb(c.evidence_contract),
                       'apiVerified',c.api_verified,'databaseVerified',c.database_verified,
                       'authorityVerified',c.authority_verified,
                       'responsiveVerified',c.responsive_verified,
                       'accessibilityVerified',c.accessibility_verified,
                       'exceptionStatesVerified',c.exception_states_verified),
                     'operations',jsonb_build_object(
                       'contractStatus',c.contract_status,'auditEvidenceRef',c.audit_evidence_ref,
                       'publicationSource','DESIGN_SAVE')
                   )::text as "payload"
              from framework_professional_screen_contract c
             where c.contract_id=?
             for update
            """, contractId);
        if (source.isEmpty()) throw new IllegalArgumentException("Screen design contract not found: " + contractId);
        Map<String,Object> row = source.get(0);
        String payload = String.valueOf(row.get("payload"));
        Map<String,Object> contract = json(payload);
        validateContract(contract);
        String hash = jdbc.queryForObject("select md5((?::jsonb)::text)", String.class, payload);
        List<Map<String,Object>> active = jdbc.queryForList("""
            select b.screen_key as "screenKey",v.version_id as "versionId",v.version_no as "versionNo",
                   v.contract_hash as "contractHash"
              from framework_screen_contract_binding b
              left join framework_screen_contract_version v on v.version_id=b.active_version_id
             where b.contract_id=?
             order by b.screen_key
             for update of b
            """, contractId);
        if (active.isEmpty()) {
            String stableKey = stableScreenKey(row, contractId);
            jdbc.update("""
                insert into framework_screen_contract_binding(screen_key,contract_id,route_path,updated_by)
                values(?,?,?,?)
                """,
                stableKey, contractId, row.get("routePath"), actor);
            active = jdbc.queryForList("select screen_key as \"screenKey\",null::bigint as \"versionId\",null::integer as \"versionNo\",null::varchar as \"contractHash\" from framework_screen_contract_binding where contract_id=? for update", contractId);
        }
        Map<String,Object> current = active.get(0);
        if (hash != null && hash.equals(current.get("contractHash"))) {
            Map<String,Object> unchanged = new LinkedHashMap<>();
            unchanged.put("published",false);unchanged.put("reason","UNCHANGED");unchanged.put("contractId",contractId);
            unchanged.put("versionId",current.get("versionId"));unchanged.put("versionNo",current.get("versionNo"));
            unchanged.put("bindingCount",active.size());unchanged.put("contractHash",hash);
            return unchanged;
        }
        List<Map<String,Object>> historical = jdbc.queryForList(
            "select version_id as \"versionId\",version_no as \"versionNo\" from framework_screen_contract_version where contract_id=? and contract_hash=? order by version_no desc limit 1",
            contractId, hash);
        int next;
        long versionId;
        String publicationReason;
        if (historical.isEmpty()) {
            next = jdbc.queryForObject(
                "select coalesce(max(version_no),0)+1 from framework_screen_contract_version where contract_id=?",
                Integer.class, contractId);
            versionId = jdbc.queryForObject("""
                insert into framework_screen_contract_version(
                  contract_id,version_no,contract_json,contract_hash,version_status,created_by,published_at)
                values(?,?,?::jsonb,?,'PUBLISHED',?,current_timestamp)
                returning version_id
                """, Long.class, contractId, next, payload, hash, actor);
            publicationReason = "DESIGN_CHANGED";
        } else {
            versionId = ((Number)historical.get(0).get("versionId")).longValue();
            next = ((Number)historical.get(0).get("versionNo")).intValue();
            jdbc.update("update framework_screen_contract_version set version_status='PUBLISHED',published_at=current_timestamp where version_id=?",versionId);
            publicationReason = "HISTORICAL_VERSION_REUSED";
        }
        jdbc.update("""
            update framework_screen_contract_binding
               set previous_version_id=active_version_id,active_version_id=?,cache_epoch=cache_epoch+1,
                   route_path=?,updated_by=?,updated_at=current_timestamp
             where contract_id=?
            """, versionId, row.get("routePath"), actor, contractId);
        jdbc.update("""
            insert into framework_screen_contract_event(screen_key,event_type,from_version_id,to_version_id,actor_id,event_payload)
            select screen_key,'PUBLISH',previous_version_id,?, ?,jsonb_build_object('source','DESIGN_SAVE','contractId',?)
              from framework_screen_contract_binding where contract_id=?
            """, versionId, actor, contractId, contractId);
        return Map.of("published",true,"reason",publicationReason,"contractId",contractId,
            "versionId",versionId,"versionNo",next,"bindingCount",active.size(),"contractHash",hash);
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
    private static String stableScreenKey(Map<String,Object> row, long contractId) {
        String process = optionalCode(String.valueOf(row.get("processCode")));
        String step = optionalCode(String.valueOf(row.get("stepCode")));
        String audience = optionalCode(String.valueOf(row.get("audience")));
        String routeHash = Integer.toUnsignedString(String.valueOf(row.get("routePath")).hashCode(), 36).toUpperCase(Locale.ROOT);
        return process.substring(0, Math.min(process.length(), 48)) + "__"
            + step.substring(0, Math.min(step.length(), 48)) + "__"
            + audience.substring(0, Math.min(audience.length(), 16)) + "__" + contractId + "__" + routeHash;
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
