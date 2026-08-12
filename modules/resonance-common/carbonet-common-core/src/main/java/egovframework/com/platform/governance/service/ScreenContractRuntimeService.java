package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

@Service
public class ScreenContractRuntimeService {
    private static final Set<String> REQUIRED_LAYERS = Set.of(
        "screen", "data", "ui", "action", "process", "permission", "test", "operations"
    );
    private static final Set<String> PROFESSIONAL_PREDICTION_FIELDS = Set.of(
        "businessPurpose", "entryCondition", "exitCondition", "sectionContract", "fieldContract",
        "commandContract", "stateContract", "apiContract", "dataContract", "evidenceContract",
        "responsiveContract", "accessibilityContract", "securityContract", "apiVerified",
        "databaseVerified", "authorityVerified", "responsiveVerified", "accessibilityVerified",
        "exceptionStatesVerified", "auditEvidenceRef", "contractStatus"
    );
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    @Autowired
    public ScreenContractRuntimeService(DataSource dataSource, ObjectMapper mapper) {
        this(new JdbcTemplate(dataSource), mapper);
    }

    ScreenContractRuntimeService(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
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
        PreparedProfessionalContract prepared = prepareProfessionalContract(contractId, Map.of(), true);
        Map<String,Object> row = prepared.source();
        String payload = prepared.payload();
        String hash = prepared.hash();
        List<Map<String,Object>> active = activeProfessionalContractBindings(contractId, true);
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
            return publicationResult(false, "UNCHANGED", contractId, current.get("versionId"),
                current.get("versionNo"), active.size(), hash, false);
        }
        List<Map<String,Object>> historical = historicalProfessionalContractVersions(contractId, hash);
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
        return publicationResult(true, publicationReason, contractId, versionId, next,
            active.size(), hash, false);
    }

    /**
     * Builds and validates the exact production runtime payload, then predicts
     * publication from current bindings and version history without acquiring
     * write locks or executing INSERT, UPDATE, DELETE, or nextval.
     */
    @Transactional(readOnly = true)
    public Map<String,Object> predictProfessionalContract(long contractId, Map<String,Object> proposedValues) {
        Map<String,Object> validatedValues = validateProfessionalPredictionValues(proposedValues);
        PreparedProfessionalContract prepared = prepareProfessionalContract(contractId, validatedValues, false);
        String hash = prepared.hash();
        List<Map<String,Object>> active = activeProfessionalContractBindings(contractId, false);
        if (active.isEmpty()) {
            Map<String,Object> synthetic = new LinkedHashMap<>();
            synthetic.put("screenKey", stableScreenKey(prepared.source(), contractId));
            synthetic.put("versionId", null);
            synthetic.put("versionNo", null);
            synthetic.put("contractHash", null);
            active = List.of(synthetic);
        }
        Map<String,Object> current = active.get(0);
        if (hash != null && hash.equals(current.get("contractHash"))) {
            return publicationResult(false, "UNCHANGED", contractId, current.get("versionId"),
                current.get("versionNo"), active.size(), hash, true);
        }
        List<Map<String,Object>> historical = historicalProfessionalContractVersions(contractId, hash);
        if (!historical.isEmpty()) {
            Map<String,Object> reusable = historical.get(0);
            return publicationResult(true, "HISTORICAL_VERSION_REUSED", contractId,
                reusable.get("versionId"), reusable.get("versionNo"), active.size(), hash, true);
        }
        Integer next = jdbc.queryForObject(
            "select coalesce(max(version_no),0)+1 from framework_screen_contract_version where contract_id=?",
            Integer.class, contractId);
        return publicationResult(true, "DESIGN_CHANGED", contractId, null, next,
            active.size(), hash, true);
    }

    private static Map<String,Object> validateProfessionalPredictionValues(Map<String,Object> proposedValues) {
        if (proposedValues == null || proposedValues.isEmpty()) return Map.of();
        Set<String> unsupported = new TreeSet<>();
        for (String key : proposedValues.keySet()) {
            if (key == null || !PROFESSIONAL_PREDICTION_FIELDS.contains(key)) {
                unsupported.add(String.valueOf(key));
            }
        }
        if (!unsupported.isEmpty()) {
            throw new IllegalArgumentException("Unsupported professional contract prediction fields: "
                + String.join(", ", unsupported));
        }
        return new LinkedHashMap<>(proposedValues);
    }

    private PreparedProfessionalContract prepareProfessionalContract(
            long contractId, Map<String,Object> proposedValues, boolean lockForPublish) {
        String sql = """
            select c.process_code as "processCode",c.step_code as "stepCode",c.audience,
                   lower(split_part(c.route_path,'?',1)) as "routePath",c.screen_name as "screenName",
                   c.actor_code as "actorCode",c.business_purpose as "businessPurpose",
                   c.entry_condition as "entryCondition",c.exit_condition as "exitCondition",
                   c.section_contract as "sectionContract",c.field_contract as "fieldContract",
                   c.command_contract as "commandContract",c.state_contract as "stateContract",
                   c.api_contract as "apiContract",c.data_contract as "dataContract",
                   c.evidence_contract as "evidenceContract",c.responsive_contract as "responsiveContract",
                   c.accessibility_contract as "accessibilityContract",c.security_contract as "securityContract",
                   c.api_verified as "apiVerified",c.database_verified as "databaseVerified",
                   c.authority_verified as "authorityVerified",c.responsive_verified as "responsiveVerified",
                   c.accessibility_verified as "accessibilityVerified",
                   c.exception_states_verified as "exceptionStatesVerified",
                   c.audit_evidence_ref as "auditEvidenceRef",c.contract_status as "contractStatus"
              from framework_professional_screen_contract c
             where c.contract_id=?
            """ + (lockForPublish ? " for update" : "");
        List<Map<String,Object>> source = jdbc.queryForList(sql, contractId);
        if (source.isEmpty()) throw new IllegalArgumentException("Screen design contract not found: " + contractId);
        Map<String,Object> row = new LinkedHashMap<>(source.get(0));
        if (proposedValues != null) row.putAll(proposedValues);

        Map<String,Object> contract = new LinkedHashMap<>();
        contract.put("schemaVersion", "1.0");
        contract.put("screen", linkedMap(
            "screenKey", text(row, "processCode").toUpperCase(Locale.ROOT) + "__"
                + text(row, "stepCode").toUpperCase(Locale.ROOT) + "__"
                + text(row, "audience").toUpperCase(Locale.ROOT),
            "name", row.get("screenName"), "route", row.get("routePath"), "audience", row.get("audience")));
        contract.put("data", linkedMap(
            "fields", jsonValue(text(row, "fieldContract")),
            "contract", jsonValue(text(row, "dataContract"))));
        contract.put("ui", linkedMap(
            "sections", jsonValue(text(row, "sectionContract")),
            "responsive", row.get("responsiveContract"), "accessibility", row.get("accessibilityContract")));
        contract.put("action", linkedMap(
            "commands", jsonValue(text(row, "commandContract")),
            "apis", jsonValue(text(row, "apiContract"))));
        contract.put("process", linkedMap(
            "processCode", row.get("processCode"), "stepCode", row.get("stepCode"),
            "entryCondition", row.get("entryCondition"), "exitCondition", row.get("exitCondition"),
            "states", jsonValue(text(row, "stateContract"))));
        contract.put("permission", linkedMap(
            "actorCode", row.get("actorCode"), "audience", row.get("audience"),
            "security", row.get("securityContract")));
        contract.put("test", linkedMap(
            "evidence", jsonValue(text(row, "evidenceContract")),
            "apiVerified", booleanValue(row.get("apiVerified")),
            "databaseVerified", booleanValue(row.get("databaseVerified")),
            "authorityVerified", booleanValue(row.get("authorityVerified")),
            "responsiveVerified", booleanValue(row.get("responsiveVerified")),
            "accessibilityVerified", booleanValue(row.get("accessibilityVerified")),
            "exceptionStatesVerified", booleanValue(row.get("exceptionStatesVerified"))));
        contract.put("operations", linkedMap(
            "contractStatus", row.get("contractStatus"), "auditEvidenceRef", row.get("auditEvidenceRef"),
            "publicationSource", "DESIGN_SAVE"));
        validateContract(contract);
        String payload = write(contract);
        String hash = jdbc.queryForObject("select md5((?::jsonb)::text)", String.class, payload);
        return new PreparedProfessionalContract(row, payload, hash);
    }

    private List<Map<String,Object>> activeProfessionalContractBindings(long contractId, boolean lockForPublish) {
        String sql = """
            select b.screen_key as "screenKey",v.version_id as "versionId",v.version_no as "versionNo",
                   v.contract_hash as "contractHash"
              from framework_screen_contract_binding b
              left join framework_screen_contract_version v on v.version_id=b.active_version_id
             where b.contract_id=?
             order by b.screen_key
            """ + (lockForPublish ? " for update of b" : "");
        return jdbc.queryForList(sql, contractId);
    }

    private List<Map<String,Object>> historicalProfessionalContractVersions(long contractId, String hash) {
        return jdbc.queryForList(
            "select version_id as \"versionId\",version_no as \"versionNo\" from framework_screen_contract_version where contract_id=? and contract_hash=? order by version_no desc limit 1",
            contractId, hash);
    }

    private Map<String,Object> publicationResult(boolean published, String reason, long contractId,
            Object versionId, Object versionNo, int bindingCount, String hash, boolean predicted) {
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("published", predicted ? false : published);
        result.put("reason", reason);
        result.put("contractId", contractId);
        result.put("versionId", versionId);
        result.put("versionNo", versionNo);
        result.put("bindingCount", bindingCount);
        result.put("contractHash", hash);
        if (predicted) {
            result.put("predicted", true);
            result.put("applied", false);
            result.put("wouldPublish", published);
            result.put("publicationMode", "PREDICTED_READ_ONLY");
        }
        return result;
    }

    private static Map<String,Object> linkedMap(Object... entries) {
        Map<String,Object> result = new LinkedHashMap<>();
        for (int index = 0; index < entries.length; index += 2) {
            result.put(String.valueOf(entries[index]), entries[index + 1]);
        }
        return result;
    }

    private static String text(Map<String,Object> row, String key) {
        Object value = row.get(key);
        return value == null ? "" : String.valueOf(value);
    }

    private static boolean booleanValue(Object value) {
        return value instanceof Boolean flag ? flag : Boolean.parseBoolean(String.valueOf(value));
    }

    private Object jsonValue(String value) {
        try { return mapper.readValue(value, Object.class); }
        catch (JsonProcessingException e) { throw new IllegalArgumentException("화면 계약 JSON이 올바르지 않습니다.", e); }
    }

    private record PreparedProfessionalContract(Map<String,Object> source, String payload, String hash) {}

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
