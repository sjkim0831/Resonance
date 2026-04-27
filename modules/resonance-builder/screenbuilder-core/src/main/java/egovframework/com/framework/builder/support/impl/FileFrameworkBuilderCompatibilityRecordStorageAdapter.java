package egovframework.com.framework.builder.support.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.framework.builder.support.FrameworkBuilderCompatibilityRecordStoragePort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.locks.ReentrantLock;

@Component
public class FileFrameworkBuilderCompatibilityRecordStorageAdapter implements FrameworkBuilderCompatibilityRecordStoragePort {

    private static final TypeReference<LinkedHashMap<String, Object>> MAP_TYPE =
            new TypeReference<LinkedHashMap<String, Object>>() {};

    private final ObjectMapper objectMapper;
    private final ReentrantLock fileLock = new ReentrantLock();

    @Value("${security.framework.builder.compatibility-check-file:/tmp/carbonet-framework-builder-compatibility-check.jsonl}")
    private String compatibilityCheckFilePath;

    public FileFrameworkBuilderCompatibilityRecordStorageAdapter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void appendRecord(Map<String, Object> payload) throws Exception {
        Path path = resolvePath(compatibilityCheckFilePath);
        fileLock.lock();
        try {
            Path parent = path.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            try (BufferedWriter writer = Files.newBufferedWriter(path,
                    StandardCharsets.UTF_8,
                    java.nio.file.StandardOpenOption.WRITE,
                    Files.exists(path)
                            ? java.nio.file.StandardOpenOption.APPEND
                            : java.nio.file.StandardOpenOption.CREATE)) {
                writer.write(objectMapper.writeValueAsString(payload == null ? Collections.emptyMap() : payload));
                writer.newLine();
            }
        } finally {
            fileLock.unlock();
        }
    }

    @Override
    public Map<String, Object> findLastRecord(String key, String value) throws Exception {
        Path path = resolvePath(compatibilityCheckFilePath);
        if (!Files.exists(path)) {
            return Collections.emptyMap();
        }
        Map<String, Object> matched = new LinkedHashMap<>();
        fileLock.lock();
        try (BufferedReader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.trim().isEmpty()) {
                    continue;
                }
                Map<String, Object> row = objectMapper.readValue(line, MAP_TYPE);
                String rowValue = row == null || row.get(key) == null ? "" : String.valueOf(row.get(key)).trim();
                if (value != null && value.trim().equals(rowValue)) {
                    matched = row;
                }
            }
        } finally {
            fileLock.unlock();
        }
        return matched;
    }

    private Path resolvePath(String filePath) {
        String path = filePath == null || filePath.trim().isEmpty()
                ? "/tmp/carbonet-framework-builder-compatibility-check.jsonl"
                : filePath.trim();
        return Paths.get(path);
    }
}
