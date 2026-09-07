package egovframework.com.common.logging;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.BufferedWriter;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FileRequestExecutionLogServiceTailTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @TempDir
    Path tempDir;

    @Test
    void largeHistoricalPrefixIsNotScannedWhenRecentSuffixSatisfiesLimit() throws Exception {
        Path logFile = tempDir.resolve("large-prefix.jsonl");
        List<String> recentIds = new ArrayList<>();
        try (BufferedWriter writer = Files.newBufferedWriter(logFile, StandardCharsets.UTF_8)) {
            String historicalLine = jsonLine(log("historical", "/health", "x".repeat(512)));
            for (int index = 0; index < 20_000; index++) {
                writer.write(historicalLine);
                writer.newLine();
            }
            for (int index = 0; index < 400; index++) {
                String id = "recent-" + index;
                recentIds.add(id);
                writer.write(jsonLine(log(id, "/admin/api/recent", "")));
                writer.newLine();
                if (index % 31 == 0) {
                    writer.write("{malformed-json");
                    writer.newLine();
                }
            }
        }

        FileRequestExecutionLogService service = configuredService(logFile);
        FileRequestExecutionLogService.TailReadResult result = service.readRecentTail(
                logFile,
                item -> item.getRequestUri().startsWith("/admin"),
                300);

        List<String> actualIds = result.items().stream().map(RequestExecutionLogVO::getLogId).toList();
        List<String> legacyIds = service.searchRecent(
                        item -> item.getRequestUri().startsWith("/admin"),
                        1,
                        300)
                .getItems().stream()
                .map(RequestExecutionLogVO::getLogId)
                .toList();
        List<String> expectedIds = new ArrayList<>(recentIds.subList(100, 400));
        java.util.Collections.reverse(expectedIds);
        assertEquals(expectedIds, actualIds);
        assertEquals(legacyIds, actualIds);
        assertTrue(result.bytesRead() < 512 * 1024,
                () -> "tail reader crossed large prefix bytesRead=" + result.bytesRead());
        assertTrue(result.bytesRead() * 10 < result.fileBytes(),
                () -> "tail reader work grew with historical prefix bytesRead=" + result.bytesRead()
                        + " fileBytes=" + result.fileBytes());
        assertTrue(result.linesExamined() < 340,
                () -> "tail reader examined unrelated prefix lines=" + result.linesExamined());
    }

    @Test
    void malformedAndOversizedTailLinesAreSkippedWithoutLosingOlderValidRows() throws Exception {
        Path logFile = tempDir.resolve("damaged-tail.jsonl");
        try (BufferedWriter writer = Files.newBufferedWriter(logFile, StandardCharsets.UTF_8)) {
            writer.write(jsonLine(log("valid-older", "/admin/older", "")));
            writer.newLine();
            writer.write("{" + "x".repeat(FileRequestExecutionLogService.MAX_REQUEST_LOG_LINE_BYTES + 1) + "}");
            writer.newLine();
            writer.write("not-json");
            writer.newLine();
            writer.write(jsonLine(log("valid-newer", "/admin/newer", "")));
            writer.newLine();
        }

        FileRequestExecutionLogService service = new FileRequestExecutionLogService(objectMapper);
        FileRequestExecutionLogService.TailReadResult result = service.readRecentTail(
                logFile,
                item -> true,
                2);

        assertEquals(List.of("valid-newer", "valid-older"),
                result.items().stream().map(RequestExecutionLogVO::getLogId).toList());
    }

    @Test
    void concurrentAppendsRemainCompleteAndReadableByTailSearch() throws Exception {
        Path logFile = tempDir.resolve("concurrent.jsonl");
        FileRequestExecutionLogService service = configuredService(logFile);
        int writers = 4;
        int rowsPerWriter = 50;
        ExecutorService executor = Executors.newFixedThreadPool(writers);
        for (int writer = 0; writer < writers; writer++) {
            int writerId = writer;
            executor.submit(() -> {
                for (int row = 0; row < rowsPerWriter; row++) {
                    service.append(log("writer-" + writerId + "-" + row, "/admin/concurrent", ""));
                }
            });
        }
        executor.shutdown();
        assertTrue(executor.awaitTermination(15, TimeUnit.SECONDS));

        List<RequestExecutionLogVO> rows = service.readRecentMatching(item -> true, writers * rowsPerWriter);
        Set<String> ids = new HashSet<>();
        for (RequestExecutionLogVO row : rows) {
            ids.add(row.getLogId());
        }
        assertEquals(writers * rowsPerWriter, rows.size());
        assertEquals(rows.size(), ids.size());
    }

    private FileRequestExecutionLogService configuredService(Path logFile) throws Exception {
        FileRequestExecutionLogService service = new FileRequestExecutionLogService(objectMapper);
        setField(service, "enabled", true);
        setField(service, "requestLogFile", logFile.toString());
        return service;
    }

    private void setField(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }

    private String jsonLine(RequestExecutionLogVO item) throws Exception {
        return objectMapper.writeValueAsString(item);
    }

    private RequestExecutionLogVO log(String id, String uri, String parameterSummary) {
        RequestExecutionLogVO item = new RequestExecutionLogVO();
        item.setLogId(id);
        item.setExecutedAt("2026-08-16 05:00:00");
        item.setRequestUri(uri);
        item.setHttpMethod("GET");
        item.setResponseStatus(200);
        item.setParameterSummary(parameterSummary);
        return item;
    }
}
