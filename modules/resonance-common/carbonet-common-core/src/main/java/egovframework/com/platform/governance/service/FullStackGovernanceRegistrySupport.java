package egovframework.com.platform.governance.service;

import egovframework.com.platform.governance.dto.FullStackGovernanceSaveRequest;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

@Component
public class FullStackGovernanceRegistrySupport {

    private static final Pattern MENU_CODE_PATTERN = Pattern.compile("^[A-Z0-9]{8}$");
    private static final Pattern PAGE_ID_PATTERN = Pattern.compile("^[a-z0-9][a-z0-9-]*$");
    private static final Pattern DB_NAME_PATTERN = Pattern.compile("^[A-Z][A-Z0-9_]*$");
    private static final Pattern COLUMN_REF_PATTERN = Pattern.compile("^[A-Z][A-Z0-9_]*\\.[A-Z][A-Z0-9_]*$");
    private static final Pattern UPPER_TOKEN_PATTERN = Pattern.compile("^[A-Z][A-Z0-9_]*$");

    public boolean isValidMenuCode(String menuCode) {
        return MENU_CODE_PATTERN.matcher(normalize(menuCode).toUpperCase(Locale.ROOT)).matches();
    }

    public boolean isValidPageId(String pageId) {
        return PAGE_ID_PATTERN.matcher(normalize(pageId)).matches();
    }

    public boolean isValidDbName(String value) {
        return DB_NAME_PATTERN.matcher(normalize(value).toUpperCase(Locale.ROOT)).matches();
    }

    public boolean isValidUpperToken(String value) {
        return UPPER_TOKEN_PATTERN.matcher(normalize(value).toUpperCase(Locale.ROOT)).matches();
    }

    public Map<String, Object> defaultEntry(String menuCode) {
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

    public Map<String, Object> normalizeEntry(Map<String, Object> source) {
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
        String normalizedSource = normalize(stringValue(source.get("source")));
        base.put("source", normalizedSource.isEmpty() ? "FILE" : normalizedSource);
        return base;
    }

    public List<String> validateRequest(FullStackGovernanceSaveRequest request, String menuCode) {
        List<String> errors = new ArrayList<>();
        if (menuCode.isEmpty()) {
            errors.add("menuCode is required.");
        } else if (!isValidMenuCode(menuCode)) {
            errors.add("menuCode must be an 8-character uppercase menu code.");
        }

        String pageId = normalize(request == null ? null : request.getPageId());
        if (!pageId.isEmpty() && !isValidPageId(pageId)) {
            errors.add("pageId must use lowercase letters, numbers, and hyphen only.");
        }

        validateUpperTokenList(request == null ? null : request.getTableNames(), "tableNames", DB_NAME_PATTERN, "TABLE_NAME", errors);
        validateUpperTokenList(request == null ? null : request.getColumnNames(), "columnNames", COLUMN_REF_PATTERN, "TABLE_NAME.COLUMN_NAME", errors);
        validateUpperTokenList(request == null ? null : request.getFeatureCodes(), "featureCodes", UPPER_TOKEN_PATTERN, "FEATURE_CODE", errors);
        validateUpperTokenList(request == null ? null : request.getCommonCodeGroups(), "commonCodeGroups", UPPER_TOKEN_PATTERN, "CODE_GROUP", errors);
        validateFieldSpecList(request == null ? null : request.getParameterSpecs(), "parameterSpecs", errors);
        validateFieldSpecList(request == null ? null : request.getResultSpecs(), "resultSpecs", errors);
        return errors;
    }

    public List<String> normalizeList(List<String> values) {
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

    public List<String> normalizeObjectList(Object value) {
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

    public List<String> normalizeDbNames(List<String> values) {
        return normalizeUpperTokenList(values, DB_NAME_PATTERN);
    }

    public List<String> normalizeTables(List<String> values, List<String> normalizedColumns) {
        LinkedHashSet<String> unique = new LinkedHashSet<>(normalizeDbNames(values));
        for (String column : normalizedColumns) {
            int index = column.indexOf('.');
            if (index > 0) {
                unique.add(column.substring(0, index));
            }
        }
        return unique.isEmpty() ? Collections.emptyList() : new ArrayList<>(unique);
    }

    public List<String> normalizeColumns(List<String> values) {
        return normalizeUpperTokenList(values, COLUMN_REF_PATTERN);
    }

    public List<String> normalizeUpperTokens(List<String> values) {
        return normalizeUpperTokenList(values, UPPER_TOKEN_PATTERN);
    }

    public List<String> normalizeFieldSpecs(List<String> values) {
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

    public List<Map<String, Object>> safeMapList(Object value) {
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
    public Map<String, Object> safeMap(Object value) {
        if (value instanceof Map) {
            return (Map<String, Object>) value;
        }
        return Collections.emptyMap();
    }

    public List<String> mergeLists(Object existing, List<String> collected) {
        LinkedHashSet<String> unique = new LinkedHashSet<>(normalizeObjectList(existing));
        unique.addAll(normalizeList(collected));
        return unique.isEmpty() ? Collections.emptyList() : new ArrayList<>(unique);
    }

    public List<String> mergeUpper(Object existing, List<String> collected) {
        LinkedHashSet<String> unique = new LinkedHashSet<>(normalizeUpperTokens(normalizeObjectList(existing)));
        unique.addAll(normalizeUpperTokens(collected));
        return unique.isEmpty() ? Collections.emptyList() : new ArrayList<>(unique);
    }

    public List<String> mergeFieldSpecs(Object existing, List<String> collected) {
        LinkedHashSet<String> unique = new LinkedHashSet<>(normalizeFieldSpecs(normalizeObjectList(existing)));
        unique.addAll(normalizeFieldSpecs(collected));
        return unique.isEmpty() ? Collections.emptyList() : new ArrayList<>(unique);
    }

    public String nowString() {
        return OffsetDateTime.now(ZoneId.of("Asia/Seoul")).toString();
    }

    public String stringValue(Object value) {
        return value == null ? "" : value.toString();
    }

    public String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    public String firstNonBlank(String... values) {
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
}
