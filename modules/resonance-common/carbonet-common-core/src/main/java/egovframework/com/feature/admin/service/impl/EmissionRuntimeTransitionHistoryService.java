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
class EmissionRuntimeTransitionHistoryService {

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final AdminEmissionManagementMapper adminEmissionManagementMapper;
    private final ObjectMapper objectMapper;
    private final Path historyPath = Paths.get("data", "admin", "emission-management", "runtime-transition-history.json");
    private final Path historyLogPath = Paths.get("data", "admin", "emission-management", "runtime-transition-history-log.json");

    @Autowired
    public EmissionRuntimeTransitionHistoryService(AdminEmissionManagementMapper adminEmissionManagementMapper, ObjectMapper objectMapper) {
        this.adminEmissionManagementMapper = adminEmissionManagementMapper;
        this.objectMapper = objectMapper;
    }

    EmissionRuntimeTransitionHistoryService(ObjectMapper objectMapper) {
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
                             String actorId,
                             Long sessionId,
                             Long resultId,
                             String runtimeMode,
                             String promotionStatus,
                             String promotionMessage,
                             boolean definitionFormulaAdopted,
                             Object legacyTotal,
                             Object definitionTotal,
                             Object delta) {
        String scope = normalizeScope(categoryCode, tier);
        if (scope.isEmpty()) {
            return;
        }
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("scope", scope);
        row.put("categoryCode", safe(categoryCode).toUpperCase(Locale.ROOT));
        row.put("tier", tier);
        row.put("transitionedAt", LocalDateTime.now().format(DATE_TIME_FORMATTER));
        row.put("transitionedBy", firstNonBlank(actorId, "system"));
        row.put("sessionId", sessionId == null ? null : sessionId);
        row.put("resultId", resultId == null ? null : resultId);
        row.put("runtimeMode", safe(runtimeMode).toUpperCase(Locale.ROOT));
        row.put("promotionStatus", safe(promotionStatus).toUpperCase(Locale.ROOT));
        row.put("promotionMessage", safe(promotionMessage));
        row.put("definitionFormulaAdopted", definitionFormulaAdopted);
        row.put("legacyTotal", legacyTotal);
        row.put("definitionTotal", definitionTotal);
        row.put("delta", delta);
        appendLogRow(new LinkedHashMap<>(row));
        if (persistToDatabase(new LinkedHashMap<>(row))) {
            return;
        }
        Map<String, Map<String, Object>> entries = loadAll();
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
        filtered.sort(Comparator.comparing((Map<String, Object> item) -> safe(item.get("transitionedAt"))).reversed());
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
            Map<String, Object> row = adminEmissionManagementMapper.selectLatestEmissionRuntimeTransitionHistory(params);
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
            params.put("transitionedBy", firstNonBlank(safe(row.get("transitionedBy")), "system"));
            params.put("sessionId", longValue(row.get("sessionId")));
            params.put("resultId", longValue(row.get("resultId")));
            params.put("runtimeMode", safe(row.get("runtimeMode")).toUpperCase(Locale.ROOT));
            params.put("promotionStatus", safe(row.get("promotionStatus")).toUpperCase(Locale.ROOT));
            params.put("promotionMessage", safe(row.get("promotionMessage")));
            params.put("definitionFormulaAdoptedYn", Boolean.TRUE.equals(row.get("definitionFormulaAdopted")) ? "Y" : "N");
            params.put("legacyTotal", doubleValue(row.get("legacyTotal")));
            params.put("definitionTotal", doubleValue(row.get("definitionTotal")));
            params.put("delta", doubleValue(row.get("delta")));
            adminEmissionManagementMapper.insertEmissionRuntimeTransitionHistory(params);
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
            throw new IllegalStateException("Failed to read emission runtime transition history.", e);
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
            throw new IllegalStateException("Failed to read emission runtime transition history log.", e);
        }
    }

    private void saveAll(Map<String, Map<String, Object>> entries) {
        try {
            Files.createDirectories(historyPath.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(historyPath.toFile(), entries == null ? Collections.emptyMap() : entries);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to write emission runtime transition history.", e);
        }
    }

    private void appendLogRow(Map<String, Object> row) {
        try {
            Files.createDirectories(historyLogPath.getParent());
            List<Map<String, Object>> items = loadLogRows();
            items.add(row);
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(historyLogPath.toFile(), items);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to write emission runtime transition history log.", e);
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

    private Long longValue(Object value) {
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        try {
            return Long.parseLong(safe(value));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private Double doubleValue(Object value) {
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        try {
            return Double.parseDouble(safe(value));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private String safe(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
