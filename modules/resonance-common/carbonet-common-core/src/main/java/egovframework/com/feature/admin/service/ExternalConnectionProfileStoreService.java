package egovframework.com.feature.admin.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class ExternalConnectionProfileStoreService {

    private static final TypeReference<List<Map<String, String>>> PROFILE_LIST_TYPE = new TypeReference<List<Map<String, String>>>() {};

    private final ObjectMapper objectMapper;
    private final Path profilePath = Paths.get("data", "external-connection", "profiles.json");

    public ExternalConnectionProfileStoreService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public synchronized List<Map<String, String>> listProfiles() {
        if (!Files.exists(profilePath)) {
            return Collections.emptyList();
        }
        try (InputStream inputStream = Files.newInputStream(profilePath)) {
            List<Map<String, String>> rows = objectMapper.readValue(inputStream, PROFILE_LIST_TYPE);
            if (rows == null || rows.isEmpty()) {
                return Collections.emptyList();
            }
            List<Map<String, String>> normalized = new ArrayList<>();
            for (Map<String, String> row : rows) {
                Map<String, String> safeRow = normalizeRow(row);
                if (!safe(safeRow.get("connectionId")).isEmpty()) {
                    normalized.add(safeRow);
                }
            }
            return normalized;
        } catch (Exception e) {
            throw new IllegalStateException("Failed to read external connection profiles.", e);
        }
    }

    public synchronized Map<String, String> getProfile(String connectionId) {
        String normalizedConnectionId = safe(connectionId).toUpperCase(Locale.ROOT);
        if (normalizedConnectionId.isEmpty()) {
            return null;
        }
        return listProfiles().stream()
                .filter(row -> normalizedConnectionId.equalsIgnoreCase(safe(row.get("connectionId"))))
                .findFirst()
                .map(LinkedHashMap::new)
                .orElse(null);
    }

    public synchronized boolean exists(String connectionId) {
        return getProfile(connectionId) != null;
    }

    public synchronized Map<String, String> saveProfile(Map<String, String> profile, String originalConnectionId) {
        Map<String, String> normalized = normalizeRow(profile);
        String connectionId = safe(normalized.get("connectionId")).toUpperCase(Locale.ROOT);
        String normalizedOriginalConnectionId = safe(originalConnectionId).toUpperCase(Locale.ROOT);
        if (connectionId.isEmpty()) {
            throw new IllegalArgumentException("connectionId is required.");
        }
        List<Map<String, String>> profiles = new ArrayList<>(listProfiles());
        profiles.removeIf(item -> connectionId.equalsIgnoreCase(safe(item.get("connectionId")))
                || (!normalizedOriginalConnectionId.isEmpty()
                && normalizedOriginalConnectionId.equalsIgnoreCase(safe(item.get("connectionId")))));
        normalized.put("connectionId", connectionId);
        profiles.add(normalized);
        profiles.sort((left, right) -> safe(left.get("connectionId")).compareToIgnoreCase(safe(right.get("connectionId"))));
        writeProfiles(profiles);
        return normalized;
    }

    private void writeProfiles(List<Map<String, String>> profiles) {
        try {
            Files.createDirectories(profilePath.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(profilePath.toFile(), profiles);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to write external connection profiles.", e);
        }
    }

    private Map<String, String> normalizeRow(Map<String, String> row) {
        Map<String, String> normalized = new LinkedHashMap<>();
        if (row == null || row.isEmpty()) {
            return normalized;
        }
        LinkedHashSet<String> keys = new LinkedHashSet<>(row.keySet());
        for (String key : keys) {
            normalized.put(safe(key), safe(row.get(key)));
        }
        return normalized;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
