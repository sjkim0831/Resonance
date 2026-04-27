package egovframework.com.platform.governance.service;

import egovframework.com.platform.codex.service.ScreenCommandCenterService;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.governance.dto.FullStackGovernanceAutoCollectRequest;
import egovframework.com.platform.governance.dto.FullStackGovernanceSaveRequest;
import egovframework.com.platform.read.FullStackGovernanceRegistryReadPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

@Service
public class FullStackGovernanceRegistryService implements FullStackGovernanceRegistryReadPort, FullStackGovernanceRegistryCommandService {

    private static final Logger log = LoggerFactory.getLogger(FullStackGovernanceRegistryService.class);

    private static final DateTimeFormatter DB_TIME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final String TABLE_NAME = "FULL_STACK_GOVERNANCE_REGISTRY";

    private final ObjectMapper objectMapper;
    private final ScreenCommandCenterService screenCommandCenterService;
    private final FullStackGovernanceRegistrySupport support;
    private final DataSource dataSource;
    private final Path registryPath = Paths.get("data", "full-stack-management", "registry.json");

    private volatile Boolean dbTableAvailable;

    public FullStackGovernanceRegistryService(ObjectMapper objectMapper,
                                              ScreenCommandCenterService screenCommandCenterService,
                                              FullStackGovernanceRegistrySupport support,
                                              DataSource dataSource) {
        this.objectMapper = objectMapper;
        this.screenCommandCenterService = screenCommandCenterService;
        this.support = support;
        this.dataSource = dataSource;
    }

    public synchronized Map<String, Object> getEntry(String menuCode) {
        String normalizedMenuCode = support.normalize(menuCode).toUpperCase(Locale.ROOT);
        if (normalizedMenuCode.isEmpty()) {
            return support.defaultEntry("");
        }
        Map<String, Object> dbEntry = loadDbEntry(normalizedMenuCode);
        if (dbEntry != null) {
            return dbEntry;
        }
        Map<String, Object> entry = loadAll().get(normalizedMenuCode);
        if (entry == null) {
            return support.defaultEntry(normalizedMenuCode);
        }
        Map<String, Object> normalized = support.normalizeEntry(entry);
        normalized.put("source", "FILE");
        return normalized;
    }

    public synchronized Map<String, Map<String, Object>> getAllEntries() {
        return loadAll();
    }

    public synchronized Map<String, Object> saveEntry(FullStackGovernanceSaveRequest request) {
        String menuCode = support.normalize(request == null ? null : request.getMenuCode()).toUpperCase(Locale.ROOT);
        List<String> errors = support.validateRequest(request, menuCode);
        if (!errors.isEmpty()) {
            throw new IllegalArgumentException(String.join(" ", errors));
        }

        Map<String, Object> entry = buildEntryFromRequest(request, menuCode, "MANUAL");
        saveEntryInternal(entry);
        return support.normalizeEntry(entry);
    }

    public synchronized Map<String, Object> autoCollectEntry(FullStackGovernanceAutoCollectRequest request) throws Exception {
        String menuCode = support.normalize(request == null ? null : request.getMenuCode()).toUpperCase(Locale.ROOT);
        if (menuCode.isEmpty() || !support.isValidMenuCode(menuCode)) {
            throw new IllegalArgumentException("menuCode must be an 8-character uppercase menu code.");
        }
        String pageId = support.normalize(request == null ? null : request.getPageId());
        if (pageId.isEmpty()) {
            throw new IllegalArgumentException("pageId is required for auto collect.");
        }
        if (!support.isValidPageId(pageId)) {
            throw new IllegalArgumentException("pageId must use lowercase letters, numbers, and hyphen only.");
        }

        Map<String, Object> commandResponse = screenCommandCenterService.getScreenCommandPage(pageId);
        Map<String, Object> page = support.safeMap(commandResponse.get("page"));
        if (page.isEmpty()) {
            throw new IllegalArgumentException("screen command metadata not found.");
        }

        Map<String, Object> existing = request != null && request.isMergeExisting() ? getEntry(menuCode) : support.defaultEntry(menuCode);
        Map<String, Object> collected = buildEntryFromCommandMetadata(menuCode, pageId, support.normalize(request == null ? null : request.getMenuUrl()), page, existing);

        if (request == null || request.isSave()) {
            saveEntryInternal(collected);
        }
        return support.normalizeEntry(collected);
    }

    private Map<String, Object> buildEntryFromRequest(FullStackGovernanceSaveRequest request, String menuCode, String sourceType) {
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("menuCode", menuCode);
        entry.put("pageId", support.normalize(request == null ? null : request.getPageId()));
        entry.put("menuUrl", support.normalize(request == null ? null : request.getMenuUrl()));
        entry.put("summary", support.normalize(request == null ? null : request.getSummary()));
        entry.put("ownerScope", support.normalize(request == null ? null : request.getOwnerScope()));
        entry.put("notes", support.normalize(request == null ? null : request.getNotes()));
        entry.put("frontendSources", support.normalizeList(request == null ? null : request.getFrontendSources()));
        entry.put("componentIds", support.normalizeList(request == null ? null : request.getComponentIds()));
        entry.put("eventIds", support.normalizeList(request == null ? null : request.getEventIds()));
        entry.put("functionIds", support.normalizeList(request == null ? null : request.getFunctionIds()));
        entry.put("parameterSpecs", support.normalizeFieldSpecs(request == null ? null : request.getParameterSpecs()));
        entry.put("resultSpecs", support.normalizeFieldSpecs(request == null ? null : request.getResultSpecs()));
        entry.put("apiIds", support.normalizeList(request == null ? null : request.getApiIds()));
        entry.put("controllerActions", support.normalizeList(request == null ? null : request.getControllerActions()));
        entry.put("serviceMethods", support.normalizeList(request == null ? null : request.getServiceMethods()));
        entry.put("mapperQueries", support.normalizeList(request == null ? null : request.getMapperQueries()));
        entry.put("schemaIds", support.normalizeList(request == null ? null : request.getSchemaIds()));
        List<String> normalizedColumns = support.normalizeColumns(request == null ? null : request.getColumnNames());
        List<String> normalizedTables = support.normalizeTables(request == null ? null : request.getTableNames(), normalizedColumns);
        entry.put("tableNames", normalizedTables);
        entry.put("columnNames", normalizedColumns);
        entry.put("featureCodes", support.normalizeUpperTokens(request == null ? null : request.getFeatureCodes()));
        entry.put("commonCodeGroups", support.normalizeUpperTokens(request == null ? null : request.getCommonCodeGroups()));
        entry.put("tags", support.normalizeList(request == null ? null : request.getTags()));
        entry.put("updatedAt", support.nowString());
        entry.put("source", sourceType);
        return entry;
    }

    private Map<String, Object> buildEntryFromCommandMetadata(String menuCode,
                                                              String pageId,
                                                              String requestedMenuUrl,
                                                              Map<String, Object> page,
                                                              Map<String, Object> existing) {
        Map<String, Object> entry = new LinkedHashMap<>();
        List<Map<String, Object>> surfaces = support.safeMapList(page.get("surfaces"));
        List<Map<String, Object>> events = support.safeMapList(page.get("events"));
        List<Map<String, Object>> apis = support.safeMapList(page.get("apis"));
        List<Map<String, Object>> schemas = support.safeMapList(page.get("schemas"));
        List<Map<String, Object>> commonCodeGroups = support.safeMapList(page.get("commonCodeGroups"));
        Map<String, Object> menuPermission = support.safeMap(page.get("menuPermission"));
        Map<String, Object> manifestRegistry = support.safeMap(page.get("manifestRegistry"));

        List<String> frontendSources = support.mergeLists(existing.get("frontendSources"), List.of(support.stringValue(page.get("source"))));
        List<String> componentIds = support.mergeLists(existing.get("componentIds"), collectComponentIds(surfaces, manifestRegistry));
        List<String> eventIds = support.mergeLists(existing.get("eventIds"), collectSimpleValues(events, "eventId"));
        List<String> functionIds = support.mergeLists(existing.get("functionIds"), collectSimpleValues(events, "frontendFunction"));
        List<String> parameterSpecs = support.mergeFieldSpecs(existing.get("parameterSpecs"), collectFieldSpecs(events, apis, true));
        List<String> resultSpecs = support.mergeFieldSpecs(existing.get("resultSpecs"), collectFieldSpecs(events, apis, false));
        List<String> apiIds = support.mergeLists(existing.get("apiIds"), collectSimpleValues(apis, "apiId"));
        List<String> controllerActions = support.mergeLists(existing.get("controllerActions"), collectChainValues(apis, "controllerActions", "controllerAction"));
        List<String> serviceMethods = support.mergeLists(existing.get("serviceMethods"), collectChainValues(apis, "serviceMethods", "serviceMethod"));
        List<String> mapperQueries = support.mergeLists(existing.get("mapperQueries"), collectChainValues(apis, "mapperQueries", "mapperQuery"));
        List<String> schemaIds = support.mergeLists(existing.get("schemaIds"), collectSimpleValues(schemas, "schemaId"));
        List<String> tableNames = support.mergeUpper(existing.get("tableNames"), collectTables(apis, schemas, menuPermission));
        List<String> columnNames = support.mergeUpper(existing.get("columnNames"), collectColumns(schemas));
        List<String> featureCodes = support.mergeUpper(existing.get("featureCodes"), collectFeatureCodes(menuPermission));
        List<String> codeGroups = support.mergeUpper(existing.get("commonCodeGroups"), collectSimpleValues(commonCodeGroups, "codeGroupId"));
        List<String> tags = support.mergeLists(existing.get("tags"), buildAutoTags(page, manifestRegistry, menuPermission, events, apis, schemas, componentIds, controllerActions, serviceMethods, mapperQueries));

        entry.put("menuCode", menuCode);
        entry.put("pageId", pageId);
        entry.put("menuUrl", support.firstNonBlank(requestedMenuUrl, support.stringValue(page.get("menuLookupUrl")), support.normalize(support.stringValue(existing.get("menuUrl")))));
        entry.put("summary", support.firstNonBlank(
                support.normalize(support.stringValue(existing.get("summary"))),
                buildAutoSummary(page, events, apis, schemas),
                support.normalize(support.stringValue(page.get("summary")))
        ));
        entry.put("ownerScope", support.firstNonBlank(support.normalize(support.stringValue(existing.get("ownerScope"))), "PAGE"));
        entry.put("notes", support.firstNonBlank(support.normalize(support.stringValue(existing.get("notes"))), "자동 수집: Screen Command Center metadata"));
        entry.put("frontendSources", frontendSources);
        entry.put("componentIds", componentIds);
        entry.put("eventIds", eventIds);
        entry.put("functionIds", functionIds);
        entry.put("parameterSpecs", parameterSpecs);
        entry.put("resultSpecs", resultSpecs);
        entry.put("apiIds", apiIds);
        entry.put("controllerActions", controllerActions);
        entry.put("serviceMethods", serviceMethods);
        entry.put("mapperQueries", mapperQueries);
        entry.put("schemaIds", schemaIds);
        entry.put("tableNames", support.normalizeTables(tableNames, support.normalizeColumns(columnNames)));
        entry.put("columnNames", support.normalizeColumns(columnNames));
        entry.put("featureCodes", featureCodes);
        entry.put("commonCodeGroups", codeGroups);
        entry.put("tags", tags);
        entry.put("updatedAt", support.nowString());
        entry.put("source", isDbTableAvailable() ? "AUTO_DB" : "AUTO_FILE");
        return support.normalizeEntry(entry);
    }

    private List<String> collectComponentIds(List<Map<String, Object>> surfaces, Map<String, Object> manifestRegistry) {
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (Map<String, Object> surface : surfaces) {
            unique.add(support.normalize(support.stringValue(surface.get("componentId"))));
            unique.add(support.normalize(support.stringValue(surface.get("surfaceId"))));
        }
        for (Map<String, Object> component : support.safeMapList(manifestRegistry.get("components"))) {
            unique.add(support.normalize(support.stringValue(component.get("componentId"))));
            unique.add(support.normalize(support.stringValue(component.get("componentName"))));
            unique.add(support.normalize(support.stringValue(component.get("instanceKey"))));
        }
        unique.remove("");
        return new ArrayList<>(unique);
    }

    private List<String> collectChainValues(List<Map<String, Object>> rows, String arrayKey, String singleKey) {
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (Map<String, Object> row : rows) {
            unique.addAll(support.normalizeObjectList(row.get(arrayKey)));
            String single = support.normalize(support.stringValue(row.get(singleKey)));
            if (!single.isEmpty()) {
                unique.add(single);
            }
        }
        return new ArrayList<>(unique);
    }

    private List<String> collectSimpleValues(List<Map<String, Object>> rows, String key) {
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (Map<String, Object> row : rows) {
            String value = support.normalize(support.stringValue(row.get(key)));
            if (!value.isEmpty()) {
                unique.add(value);
            }
        }
        return new ArrayList<>(unique);
    }

    private List<String> collectFieldSpecs(List<Map<String, Object>> events, List<Map<String, Object>> apis, boolean input) {
        LinkedHashSet<String> specs = new LinkedHashSet<>();
        for (Map<String, Object> event : events) {
            String source = input ? "function" : "function";
            List<Map<String, Object>> fields = support.safeMapList(event.get(input ? "functionInputs" : "functionOutputs"));
            for (Map<String, Object> field : fields) {
                String spec = buildFieldSpec(field, source);
                if (!spec.isEmpty()) {
                    specs.add(spec);
                }
            }
        }
        for (Map<String, Object> api : apis) {
            String source = input ? "api" : "api";
            List<Map<String, Object>> fields = support.safeMapList(api.get(input ? "requestFields" : "responseFields"));
            for (Map<String, Object> field : fields) {
                String spec = buildFieldSpec(field, source);
                if (!spec.isEmpty()) {
                    specs.add(spec);
                }
            }
        }
        return new ArrayList<>(specs);
    }

    private String buildFieldSpec(Map<String, Object> field, String defaultSource) {
        String fieldId = support.normalize(support.stringValue(field.get("fieldId")));
        String type = support.normalize(support.stringValue(field.get("type")));
        String source = support.normalize(support.stringValue(field.get("source")));
        if (fieldId.isEmpty() || type.isEmpty()) {
            return "";
        }
        return fieldId + ":" + type + ":" + support.firstNonBlank(source, defaultSource);
    }

    private List<String> collectTables(List<Map<String, Object>> apis, List<Map<String, Object>> schemas, Map<String, Object> menuPermission) {
        LinkedHashSet<String> tables = new LinkedHashSet<>();
        for (Map<String, Object> api : apis) {
            tables.addAll(support.normalizeDbNames(support.normalizeObjectList(api.get("relatedTables"))));
        }
        for (Map<String, Object> schema : schemas) {
            String tableName = support.normalize(support.stringValue(schema.get("tableName"))).toUpperCase(Locale.ROOT);
            if (support.isValidDbName(tableName)) {
                tables.add(tableName);
            }
        }
        tables.addAll(support.normalizeDbNames(support.normalizeObjectList(menuPermission.get("relationTables"))));
        return new ArrayList<>(tables);
    }

    private List<String> collectFeatureCodes(Map<String, Object> menuPermission) {
        LinkedHashSet<String> featureCodes = new LinkedHashSet<>(support.normalizeUpperTokens(support.normalizeObjectList(menuPermission.get("featureCodes"))));
        String requiredViewFeatureCode = support.normalize(support.stringValue(menuPermission.get("requiredViewFeatureCode"))).toUpperCase(Locale.ROOT);
        if (support.isValidUpperToken(requiredViewFeatureCode)) {
            featureCodes.add(requiredViewFeatureCode);
        }
        for (Map<String, Object> featureRow : support.safeMapList(menuPermission.get("featureRows"))) {
            String featureCode = support.normalize(support.stringValue(featureRow.get("featureCode"))).toUpperCase(Locale.ROOT);
            if (support.isValidUpperToken(featureCode)) {
                featureCodes.add(featureCode);
            }
        }
        return featureCodes.isEmpty() ? Collections.emptyList() : new ArrayList<>(featureCodes);
    }

    private List<String> buildAutoTags(Map<String, Object> page,
                                       Map<String, Object> manifestRegistry,
                                       Map<String, Object> menuPermission,
                                       List<Map<String, Object>> events,
                                       List<Map<String, Object>> apis,
                                       List<Map<String, Object>> schemas,
                                       List<String> componentIds,
                                       List<String> controllerActions,
                                       List<String> serviceMethods,
                                       List<String> mapperQueries) {
        LinkedHashSet<String> tags = new LinkedHashSet<>();
        tags.add("AUTO_COLLECTED");
        tags.add("SCREEN_COMMAND_SYNC");
        if (!support.normalize(support.stringValue(page.get("pageId"))).isEmpty()) {
            tags.add("HAS_SCREEN_COMMAND");
        }
        if (!support.normalize(support.stringValue(manifestRegistry.get("pageId"))).isEmpty()) {
            tags.add("HAS_MANIFEST");
        }
        if (!componentIds.isEmpty()) {
            tags.add("HAS_COMPONENTS");
        }
        if (!events.isEmpty()) {
            tags.add("HAS_EVENTS");
        }
        if (!apis.isEmpty()) {
            tags.add("HAS_APIS");
        }
        if (!controllerActions.isEmpty()) {
            tags.add("HAS_CONTROLLER_CHAIN");
        }
        if (!serviceMethods.isEmpty()) {
            tags.add("HAS_SERVICE_CHAIN");
        }
        if (!mapperQueries.isEmpty()) {
            tags.add("HAS_MAPPER_CHAIN");
        }
        if (!schemas.isEmpty()) {
            tags.add("HAS_SCHEMAS");
        }
        if (!support.normalize(support.stringValue(menuPermission.get("requiredViewFeatureCode"))).isEmpty()) {
            tags.add("HAS_VIEW_FEATURE");
        }
        if (!support.normalizeObjectList(menuPermission.get("relationTables")).isEmpty()) {
            tags.add("HAS_RELATION_TABLES");
        }
        return new ArrayList<>(tags);
    }

    private List<String> collectColumns(List<Map<String, Object>> schemas) {
        LinkedHashSet<String> columns = new LinkedHashSet<>();
        for (Map<String, Object> schema : schemas) {
            String tableName = support.normalize(support.stringValue(schema.get("tableName"))).toUpperCase(Locale.ROOT);
            if (!support.isValidDbName(tableName)) {
                continue;
            }
            for (String column : support.normalizeObjectList(schema.get("columns"))) {
                String upperColumn = support.normalize(column).toUpperCase(Locale.ROOT);
                if (support.isValidDbName(upperColumn)) {
                    columns.add(tableName + "." + upperColumn);
                }
            }
        }
        return new ArrayList<>(columns);
    }

    private String buildAutoSummary(Map<String, Object> page,
                                    List<Map<String, Object>> events,
                                    List<Map<String, Object>> apis,
                                    List<Map<String, Object>> schemas) {
        String label = support.firstNonBlank(support.stringValue(page.get("label")), support.stringValue(page.get("pageId")));
        return label + " 자동 수집 레지스트리: 이벤트 " + events.size() + "건, API " + apis.size() + "건, 스키마 " + schemas.size() + "건";
    }

    private void saveEntryInternal(Map<String, Object> entry) {
        Map<String, Object> normalized = support.normalizeEntry(entry);
        saveToFile(normalized);
        saveToDb(normalized);
    }

    private void saveToFile(Map<String, Object> entry) {
        Map<String, Map<String, Object>> allEntries = loadAll();
        allEntries.put(support.stringValue(entry.get("menuCode")), entry);
        saveAll(allEntries);
    }

    private Map<String, Map<String, Object>> loadAll() {
        if (!Files.exists(registryPath)) {
            return new LinkedHashMap<>();
        }
        try (InputStream inputStream = Files.newInputStream(registryPath)) {
            Map<String, Map<String, Object>> raw = objectMapper.readValue(
                    inputStream,
                    new TypeReference<Map<String, Map<String, Object>>>() {
                    });
            Map<String, Map<String, Object>> normalized = new LinkedHashMap<>();
            if (raw == null) {
                return normalized;
            }
            for (Map.Entry<String, Map<String, Object>> entry : raw.entrySet()) {
                String menuCode = support.normalize(entry.getKey()).toUpperCase(Locale.ROOT);
                if (!menuCode.isEmpty()) {
                    normalized.put(menuCode, support.normalizeEntry(entry.getValue()));
                }
            }
            return normalized;
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read full-stack governance registry", e);
        }
    }

    private void saveAll(Map<String, Map<String, Object>> allEntries) {
        try {
            Files.createDirectories(registryPath.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(registryPath.toFile(), allEntries);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to write full-stack governance registry", e);
        }
    }

    private boolean isDbTableAvailable() {
        if (dbTableAvailable != null) {
            return dbTableAvailable;
        }
        synchronized (this) {
            if (dbTableAvailable != null) {
                return dbTableAvailable;
            }
            try (Connection connection = dataSource.getConnection()) {
                try (ResultSet rs = connection.getMetaData().getTables(null, null, TABLE_NAME, null)) {
                    dbTableAvailable = rs.next();
                }
            } catch (SQLException e) {
                dbTableAvailable = false;
            }
            return dbTableAvailable;
        }
    }

    private Map<String, Object> loadDbEntry(String menuCode) {
        if (!isDbTableAvailable()) {
            return null;
        }
        String sql = "SELECT * FROM " + TABLE_NAME + " WHERE MENU_CODE = ?";
        try (Connection connection = dataSource.getConnection();
             PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setString(1, menuCode);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                Map<String, Object> entry = defaultEntry(menuCode);
                entry.put("menuCode", menuCode);
                entry.put("pageId", normalize(rs.getString("PAGE_ID")));
                entry.put("menuUrl", normalize(rs.getString("MENU_URL")));
                entry.put("summary", normalize(rs.getString("SUMMARY")));
                entry.put("ownerScope", normalize(rs.getString("OWNER_SCOPE")));
                entry.put("notes", normalize(rs.getString("NOTES")));
                entry.put("frontendSources", readJsonList(rs.getString("FRONTEND_SOURCES_JSON")));
                entry.put("componentIds", readJsonList(rs.getString("COMPONENT_IDS_JSON")));
                entry.put("eventIds", readJsonList(rs.getString("EVENT_IDS_JSON")));
                entry.put("functionIds", readJsonList(rs.getString("FUNCTION_IDS_JSON")));
                entry.put("parameterSpecs", normalizeFieldSpecs(readJsonList(rs.getString("PARAMETER_SPECS_JSON"))));
                entry.put("resultSpecs", normalizeFieldSpecs(readJsonList(rs.getString("RESULT_SPECS_JSON"))));
                entry.put("apiIds", readJsonList(rs.getString("API_IDS_JSON")));
                entry.put("schemaIds", readJsonList(rs.getString("SCHEMA_IDS_JSON")));
                List<String> columnNames = normalizeColumns(readJsonList(rs.getString("COLUMN_NAMES_JSON")));
                entry.put("tableNames", normalizeTables(readJsonList(rs.getString("TABLE_NAMES_JSON")), columnNames));
                entry.put("columnNames", columnNames);
                entry.put("featureCodes", normalizeUpperTokens(readJsonList(rs.getString("FEATURE_CODES_JSON"))));
                entry.put("commonCodeGroups", normalizeUpperTokens(readJsonList(rs.getString("COMMON_CODE_GROUPS_JSON"))));
                entry.put("tags", readJsonList(rs.getString("TAGS_JSON")));
                entry.put("updatedAt", normalize(rs.getString("UPDATED_AT")));
                entry.put("source", "DB");
                return normalizeEntry(entry);
            }
        } catch (SQLException e) {
            disableDbRegistry("read", e);
            return null;
        }
    }

    private void saveToDb(Map<String, Object> entry) {
        if (!isDbTableAvailable()) {
            return;
        }
        String menuCode = stringValue(entry.get("menuCode"));
        String updateSql = "UPDATE " + TABLE_NAME + " SET PAGE_ID=?, MENU_URL=?, SUMMARY=?, OWNER_SCOPE=?, NOTES=?, "
                + "FRONTEND_SOURCES_JSON=?, COMPONENT_IDS_JSON=?, EVENT_IDS_JSON=?, FUNCTION_IDS_JSON=?, PARAMETER_SPECS_JSON=?, RESULT_SPECS_JSON=?, "
                + "API_IDS_JSON=?, SCHEMA_IDS_JSON=?, TABLE_NAMES_JSON=?, COLUMN_NAMES_JSON=?, FEATURE_CODES_JSON=?, COMMON_CODE_GROUPS_JSON=?, TAGS_JSON=?, UPDATED_AT=?, SOURCE_TYPE=? "
                + "WHERE MENU_CODE=?";
        String insertSql = "INSERT INTO " + TABLE_NAME + " (MENU_CODE, PAGE_ID, MENU_URL, SUMMARY, OWNER_SCOPE, NOTES, "
                + "FRONTEND_SOURCES_JSON, COMPONENT_IDS_JSON, EVENT_IDS_JSON, FUNCTION_IDS_JSON, PARAMETER_SPECS_JSON, RESULT_SPECS_JSON, "
                + "API_IDS_JSON, SCHEMA_IDS_JSON, TABLE_NAMES_JSON, COLUMN_NAMES_JSON, FEATURE_CODES_JSON, COMMON_CODE_GROUPS_JSON, TAGS_JSON, CREATED_AT, UPDATED_AT, SOURCE_TYPE) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATETIME, ?, ?)";
        try (Connection connection = dataSource.getConnection()) {
            int updated;
            try (PreparedStatement ps = connection.prepareStatement(updateSql)) {
                bindEntry(ps, entry, false);
                ps.setString(21, menuCode);
                updated = ps.executeUpdate();
            }
            if (updated == 0) {
                try (PreparedStatement ps = connection.prepareStatement(insertSql)) {
                    ps.setString(1, menuCode);
                    bindEntry(ps, entry, true);
                    ps.executeUpdate();
                }
            }
        } catch (SQLException e) {
            disableDbRegistry("save", e);
        }
    }

    private void disableDbRegistry(String operation, SQLException e) {
        dbTableAvailable = false;
        log.warn("Disabling DB full-stack governance registry after {} failure. Falling back to file registry only.", operation, e);
    }

    private void bindEntry(PreparedStatement ps, Map<String, Object> entry, boolean insertMode) throws SQLException {
        int offset = insertMode ? 2 : 1;
        ps.setString(offset, stringValue(entry.get("pageId")));
        ps.setString(offset + 1, stringValue(entry.get("menuUrl")));
        ps.setString(offset + 2, stringValue(entry.get("summary")));
        ps.setString(offset + 3, stringValue(entry.get("ownerScope")));
        ps.setString(offset + 4, stringValue(entry.get("notes")));
        ps.setString(offset + 5, writeJson(entry.get("frontendSources")));
        ps.setString(offset + 6, writeJson(entry.get("componentIds")));
        ps.setString(offset + 7, writeJson(entry.get("eventIds")));
        ps.setString(offset + 8, writeJson(entry.get("functionIds")));
        ps.setString(offset + 9, writeJson(entry.get("parameterSpecs")));
        ps.setString(offset + 10, writeJson(entry.get("resultSpecs")));
        ps.setString(offset + 11, writeJson(entry.get("apiIds")));
        ps.setString(offset + 12, writeJson(entry.get("schemaIds")));
        ps.setString(offset + 13, writeJson(entry.get("tableNames")));
        ps.setString(offset + 14, writeJson(entry.get("columnNames")));
        ps.setString(offset + 15, writeJson(entry.get("featureCodes")));
        ps.setString(offset + 16, writeJson(entry.get("commonCodeGroups")));
        ps.setString(offset + 17, writeJson(entry.get("tags")));
        ps.setString(offset + 18, dbTimeString());
        ps.setString(offset + 19, stringValue(entry.get("source")));
        if (!insertMode) {
            return;
        }
    }

    private String dbTimeString() {
        return LocalDateTime.now(ZoneId.of("Asia/Seoul")).format(DB_TIME_FORMAT);
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value == null ? Collections.emptyList() : value);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to serialize registry payload", e);
        }
    }

    private List<String> readJsonList(String value) {
        String normalized = normalize(value);
        if (normalized.isEmpty()) {
            return Collections.emptyList();
        }
        try {
            return normalizeObjectList(objectMapper.readValue(normalized, new TypeReference<List<Object>>() {
            }));
        } catch (IOException e) {
            return Collections.emptyList();
        }
    }

    private Map<String, Object> defaultEntry(String menuCode) {
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("menuCode", normalize(menuCode).toUpperCase(Locale.ROOT));
        entry.put("pageId", "");
        entry.put("menuUrl", "");
        entry.put("summary", "");
        entry.put("ownerScope", "");
        entry.put("notes", "");
        entry.put("frontendSources", Collections.emptyList());
        entry.put("componentIds", Collections.emptyList());
        entry.put("eventIds", Collections.emptyList());
        entry.put("functionIds", Collections.emptyList());
        entry.put("parameterSpecs", Collections.emptyList());
        entry.put("resultSpecs", Collections.emptyList());
        entry.put("apiIds", Collections.emptyList());
        entry.put("controllerActions", Collections.emptyList());
        entry.put("serviceMethods", Collections.emptyList());
        entry.put("mapperQueries", Collections.emptyList());
        entry.put("schemaIds", Collections.emptyList());
        entry.put("tableNames", Collections.emptyList());
        entry.put("columnNames", Collections.emptyList());
        entry.put("featureCodes", Collections.emptyList());
        entry.put("commonCodeGroups", Collections.emptyList());
        entry.put("tags", Collections.emptyList());
        entry.put("updatedAt", "");
        entry.put("source", "DEFAULT");
        return entry;
    }

    private Map<String, Object> normalizeEntry(Map<String, Object> source) {
        Map<String, Object> base = defaultEntry(stringValue(source == null ? null : source.get("menuCode")));
        if (source == null) {
            return base;
        }
        base.put("menuCode", normalize(stringValue(source.get("menuCode"))).toUpperCase(Locale.ROOT));
        base.put("pageId", normalize(stringValue(source.get("pageId"))));
        base.put("menuUrl", normalize(stringValue(source.get("menuUrl"))));
        base.put("summary", normalize(stringValue(source.get("summary"))));
        base.put("ownerScope", normalize(stringValue(source.get("ownerScope"))));
        base.put("notes", normalize(stringValue(source.get("notes"))));
        base.put("frontendSources", normalizeObjectList(source.get("frontendSources")));
        base.put("componentIds", normalizeObjectList(source.get("componentIds")));
        base.put("eventIds", normalizeObjectList(source.get("eventIds")));
        base.put("functionIds", normalizeObjectList(source.get("functionIds")));
        base.put("parameterSpecs", normalizeFieldSpecs(normalizeObjectList(source.get("parameterSpecs"))));
        base.put("resultSpecs", normalizeFieldSpecs(normalizeObjectList(source.get("resultSpecs"))));
        base.put("apiIds", normalizeObjectList(source.get("apiIds")));
        base.put("controllerActions", normalizeObjectList(source.get("controllerActions")));
        base.put("serviceMethods", normalizeObjectList(source.get("serviceMethods")));
        base.put("mapperQueries", normalizeObjectList(source.get("mapperQueries")));
        base.put("schemaIds", normalizeObjectList(source.get("schemaIds")));
        List<String> normalizedColumns = normalizeColumns(normalizeObjectList(source.get("columnNames")));
        base.put("tableNames", normalizeTables(normalizeObjectList(source.get("tableNames")), normalizedColumns));
        base.put("columnNames", normalizedColumns);
        base.put("featureCodes", normalizeUpperTokens(normalizeObjectList(source.get("featureCodes"))));
        base.put("commonCodeGroups", normalizeUpperTokens(normalizeObjectList(source.get("commonCodeGroups"))));
        base.put("tags", normalizeObjectList(source.get("tags")));
        base.put("updatedAt", normalize(stringValue(source.get("updatedAt"))));
        base.put("source", normalize(stringValue(source.get("source"))).isEmpty() ? "FILE" : normalize(stringValue(source.get("source"))));
        return base;
    }

    private List<String> validateRequest(FullStackGovernanceSaveRequest request, String menuCode) {
        return support.validateRequest(request, menuCode);
    }

    private List<String> normalizeList(List<String> values) {
        if (values == null || values.isEmpty()) {
            return Collections.emptyList();
        }
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String value : values) {
            String normalized = normalize(value);
            if (!normalized.isEmpty()) {
                unique.add(normalized);
            }
        }
        return unique.isEmpty() ? Collections.emptyList() : new ArrayList<>(unique);
    }

    private List<String> normalizeObjectList(Object value) {
        if (value instanceof List) {
            List<?> items = (List<?>) value;
            List<String> normalized = new ArrayList<>();
            for (Object item : items) {
                String text = normalize(stringValue(item));
                if (!text.isEmpty()) {
                    normalized.add(text);
                }
            }
            return normalized;
        }
        return Collections.emptyList();
    }

    private List<String> normalizeTables(List<String> values, List<String> normalizedColumns) {
        return support.normalizeTables(values, normalizedColumns);
    }

    private List<String> normalizeColumns(List<String> values) {
        return support.normalizeColumns(values);
    }

    private List<String> normalizeUpperTokens(List<String> values) {
        return support.normalizeUpperTokens(values);
    }

    private List<String> normalizeUpperTokenList(List<String> values, Pattern pattern) {
        if (values == null || values.isEmpty()) {
            return Collections.emptyList();
        }
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String value : values) {
            String normalized = normalize(value).toUpperCase(Locale.ROOT);
            if (!normalized.isEmpty() && pattern.matcher(normalized).matches()) {
                unique.add(normalized);
            }
        }
        return unique.isEmpty() ? Collections.emptyList() : new ArrayList<>(unique);
    }

    private List<String> normalizeFieldSpecs(List<String> values) {
        if (values == null || values.isEmpty()) {
            return Collections.emptyList();
        }
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String value : values) {
            String normalized = normalize(value);
            if (normalized.isEmpty()) {
                continue;
            }
            String[] parts = normalized.split(":");
            if (parts.length < 2 || parts.length > 3) {
                continue;
            }
            String fieldName = normalize(parts[0]);
            String type = normalize(parts[1]);
            String source = parts.length == 3 ? normalize(parts[2]) : "";
            if (fieldName.isEmpty() || type.isEmpty()) {
                continue;
            }
            unique.add(source.isEmpty() ? fieldName + ":" + type : fieldName + ":" + type + ":" + source);
        }
        return unique.isEmpty() ? Collections.emptyList() : new ArrayList<>(unique);
    }

    private void validateUpperTokenList(List<String> values,
                                        String fieldName,
                                        Pattern pattern,
                                        String example,
                                        List<String> errors) {
        if (values == null) {
            return;
        }
        for (String value : values) {
            String normalized = normalize(value).toUpperCase(Locale.ROOT);
            if (!normalized.isEmpty() && !pattern.matcher(normalized).matches()) {
                errors.add(fieldName + " must use " + example + " format: " + value);
                return;
            }
        }
    }

    private void validateFieldSpecList(List<String> values, String fieldName, List<String> errors) {
        if (values == null) {
            return;
        }
        for (String value : values) {
            String normalized = normalize(value);
            if (normalized.isEmpty()) {
                continue;
            }
            String[] parts = normalized.split(":");
            if (parts.length < 2 || parts.length > 3 || normalize(parts[0]).isEmpty() || normalize(parts[1]).isEmpty()) {
                errors.add(fieldName + " must use name:type or name:type:source format: " + value);
                return;
            }
        }
    }

    private List<Map<String, Object>> safeMapList(Object value) {
        if (!(value instanceof List)) {
            return Collections.emptyList();
        }
        List<?> items = (List<?>) value;
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Object item : items) {
            rows.add(safeMap(item));
        }
        return rows;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> safeMap(Object value) {
        if (value instanceof Map) {
            return (Map<String, Object>) value;
        }
        return Collections.emptyMap();
    }

    private List<String> mergeLists(Object existing, List<String> collected) {
        LinkedHashSet<String> unique = new LinkedHashSet<>(normalizeObjectList(existing));
        unique.addAll(normalizeList(collected));
        return unique.isEmpty() ? Collections.emptyList() : new ArrayList<>(unique);
    }

    private List<String> mergeUpper(Object existing, List<String> collected) {
        LinkedHashSet<String> unique = new LinkedHashSet<>(normalizeUpperTokens(normalizeObjectList(existing)));
        unique.addAll(normalizeUpperTokens(collected));
        return unique.isEmpty() ? Collections.emptyList() : new ArrayList<>(unique);
    }

    private List<String> mergeFieldSpecs(Object existing, List<String> collected) {
        LinkedHashSet<String> unique = new LinkedHashSet<>(normalizeFieldSpecs(normalizeObjectList(existing)));
        unique.addAll(normalizeFieldSpecs(collected));
        return unique.isEmpty() ? Collections.emptyList() : new ArrayList<>(unique);
    }

    private String nowString() {
        return OffsetDateTime.now(ZoneId.of("Asia/Seoul")).toString();
    }

    private String stringValue(Object value) {
        return value == null ? "" : value.toString();
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            String normalized = normalize(value);
            if (!normalized.isEmpty()) {
                return normalized;
            }
        }
        return "";
    }
}
