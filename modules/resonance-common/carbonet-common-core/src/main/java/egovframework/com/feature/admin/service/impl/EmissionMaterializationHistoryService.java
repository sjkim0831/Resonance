package egovframework.com.feature.admin.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.feature.admin.mapper.AdminEmissionManagementMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.ArrayList;
import java.util.Comparator;

@Service
class EmissionMaterializationHistoryService {

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final AdminEmissionManagementMapper adminEmissionManagementMapper;
    private final ObjectMapper objectMapper;
    private final Path historyPath = Paths.get("data", "admin", "emission-management", "materialization-history.json");
    private final Path historyLogPath = Paths.get("data", "admin", "emission-management", "materialization-history-log.json");

    @Autowired
    public EmissionMaterializationHistoryService(AdminEmissionManagementMapper adminEmissionManagementMapper, ObjectMapper objectMapper) {
        this.adminEmissionManagementMapper = adminEmissionManagementMapper;
        this.objectMapper = objectMapper;
    }

    EmissionMaterializationHistoryService(ObjectMapper objectMapper) {
        this(null, objectMapper);
    }

    synchronized Map<String, Object> findLatest(String categoryCode, int tier) {
        String scope = normalizeScope(categoryCode, tier);
        if (scope.isEmpty()) {
            return new LinkedHashMap<>();
        }
        Map<String, Object> databaseRow = loadLatestFromDatabase(categoryCode, tier);
        if (!databaseRow.isEmpty()) {
            return databaseRow;
        }
        Map<String, Map<String, Object>> entries = loadAll();
        Map<String, Object> item = entries.get(scope);
        return item == null ? new LinkedHashMap<>() : new LinkedHashMap<>(item);
    }

    synchronized void record(String categoryCode,
                             int tier,
                             String draftId,
                             String publishedVersionId,
                             String actorId,
                             boolean createdCategory,
                             int insertedVariableCount,
                             int updatedVariableCount) {
        String scope = normalizeScope(categoryCode, tier);
        if (scope.isEmpty()) {
            return;
        }
        Map<String, Map<String, Object>> entries = loadAll();
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("scope", scope);
        row.put("categoryCode", safe(categoryCode).toUpperCase(Locale.ROOT));
        row.put("tier", tier);
        row.put("draftId", safe(draftId));
        row.put("publishedVersionId", safe(publishedVersionId));
        row.put("materializedAt", LocalDateTime.now().format(DATE_TIME_FORMATTER));
        row.put("materializedBy", firstNonBlank(actorId, "system"));
        row.put("createdCategory", createdCategory);
        row.put("insertedVariableCount", insertedVariableCount);
        row.put("updatedVariableCount", updatedVariableCount);
        appendLogRow(new LinkedHashMap<>(row));
        if (persistToDatabase(new LinkedHashMap<>(row))) {
            return;
        }
        entries.put(scope, row);
        saveAll(entries);
    }

    synchronized List<Map<String, Object>> findRecent(String categoryCode, int tier, int limit) {
        String scope = normalizeScope(categoryCode, tier);
        if (scope.isEmpty() || limit <= 0) {
            return Collections.emptyList();
        }
        List<Map<String, Object>> items = loadLogRows();
        List<Map<String, Object>> filtered = new ArrayList<>();
        for (Map<String, Object> item : items) {
            if (scope.equalsIgnoreCase(safe(item.get("scope")))) {
                filtered.add(new LinkedHashMap<>(item));
            }
        }
        filtered.sort(Comparator.comparing((Map<String, Object> item) -> safe(item.get("materializedAt"))).reversed());
        return filtered.size() <= limit ? filtered : new ArrayList<>(filtered.subList(0, limit));
    }

    private Map<String, Object> loadLatestFromDatabase(String categoryCode, int tier) {
        if (adminEmissionManagementMapper == null) {
            return new LinkedHashMap<>();
        }
        try {
            Map<String, Object> params = new LinkedHashMap<>();
            params.put("categoryCode", safe(categoryCode).toUpperCase(Locale.ROOT));
            params.put("tier", tier);
            Map<String, Object> row = adminEmissionManagementMapper.selectLatestEmissionMaterializationHistory(params);
            return row == null ? new LinkedHashMap<>() : new LinkedHashMap<>(row);
        } catch (DataAccessException ignored) {
            return new LinkedHashMap<>();
        }
    }

    private boolean persistToDatabase(Map<String, Object> row) {
        if (adminEmissionManagementMapper == null || row == null || row.isEmpty()) {
            return false;
        }
        try {
            Map<String, Object> params = new LinkedHashMap<>();
            params.put("scope", safe(row.get("scope")));
            params.put("categoryCode", safe(row.get("categoryCode")).toUpperCase(Locale.ROOT));
            params.put("tier", intValue(row.get("tier")));
            params.put("draftId", safe(row.get("draftId")));
            params.put("publishedVersionId", safe(row.get("publishedVersionId")));
            params.put("materializedBy", firstNonBlank(safe(row.get("materializedBy")), "system"));
            params.put("createdCategoryYn", Boolean.TRUE.equals(row.get("createdCategory")) ? "Y" : "N");
            params.put("insertedVariableCount", intValue(row.get("insertedVariableCount")));
            params.put("updatedVariableCount", intValue(row.get("updatedVariableCount")));
            adminEmissionManagementMapper.insertEmissionMaterializationHistory(params);
            return true;
        } catch (DataAccessException ignored) {
            return false;
        }
    }

    private Map<String, Map<String, Object>> loadAll() {
        if (!Files.exists(historyPath)) {
            return new LinkedHashMap<>();
        }
        try (InputStream inputStream = Files.newInputStream(historyPath)) {
            Map<String, Map<String, Object>> result = objectMapper.readValue(inputStream, new TypeReference<LinkedHashMap<String, Map<String, Object>>>() {});
            return result == null ? new LinkedHashMap<>() : new LinkedHashMap<>(result);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read emission materialization history.", e);
        }
    }

    private List<Map<String, Object>> loadLogRows() {
        if (!Files.exists(historyLogPath)) {
            return new ArrayList<>();
        }
        try (InputStream inputStream = Files.newInputStream(historyLogPath)) {
            List<Map<String, Object>> result = objectMapper.readValue(inputStream, new TypeReference<ArrayList<Map<String, Object>>>() {});
            return result == null ? new ArrayList<>() : new ArrayList<>(result);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read emission materialization history log.", e);
        }
    }

    private void saveAll(Map<String, Map<String, Object>> entries) {
        try {
            Files.createDirectories(historyPath.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(historyPath.toFile(), entries == null ? Collections.emptyMap() : entries);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to write emission materialization history.", e);
        }
    }

    private void appendLogRow(Map<String, Object> row) {
        try {
            Files.createDirectories(historyLogPath.getParent());
            List<Map<String, Object>> items = loadLogRows();
            items.add(row);
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(historyLogPath.toFile(), items);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to write emission materialization history log.", e);
        }
    }

    private String normalizeScope(String categoryCode, int tier) {
        String normalizedCode = safe(categoryCode).toUpperCase(Locale.ROOT);
        if (normalizedCode.isEmpty() || tier <= 0) {
            return "";
        }
        return normalizedCode + ":" + tier;
    }

    private String firstNonBlank(String left, String right) {
        return safe(left).isEmpty() ? safe(right) : safe(left);
    }

    private int intValue(Object value) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        try {
            return Integer.parseInt(safe(value));
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private String safe(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
