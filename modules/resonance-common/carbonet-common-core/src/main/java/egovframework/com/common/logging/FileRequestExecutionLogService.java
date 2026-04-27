package egovframework.com.common.logging;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.BufferedReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.List;
import java.util.function.Predicate;
import java.util.concurrent.locks.ReentrantLock;

@Service("requestExecutionLogService")
public class FileRequestExecutionLogService implements RequestExecutionLogService {

    private static final Logger log = LoggerFactory.getLogger(FileRequestExecutionLogService.class);

    private final ObjectMapper objectMapper;

    @Value("${security.request-log.enabled:true}")
    private boolean enabled;

    @Value("${security.request-log.file:/tmp/carbonet-request-execution-history.jsonl}")
    private String requestLogFile;

    private final ReentrantLock lock = new ReentrantLock();

    public FileRequestExecutionLogService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void append(RequestExecutionLogVO item) {
        if (!enabled || item == null) {
            return;
        }

        Path file = Paths.get(requestLogFile == null || requestLogFile.trim().isEmpty()
                ? "/tmp/carbonet-request-execution-history.jsonl"
                : requestLogFile.trim());
        lock.lock();
        try {
            Path parent = file.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            try (BufferedWriter writer = Files.newBufferedWriter(file, StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.APPEND, StandardOpenOption.WRITE)) {
                writer.write(objectMapper.writeValueAsString(item));
                writer.newLine();
            }
        } catch (IOException e) {
            log.error("Failed to write request execution log.", e);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public List<RequestExecutionLogVO> readRecent(int limit) {
        if (!enabled || limit <= 0) {
            return Collections.emptyList();
        }
        Path file = Paths.get(requestLogFile == null || requestLogFile.trim().isEmpty()
                ? "/tmp/carbonet-request-execution-history.jsonl"
                : requestLogFile.trim());
        if (!Files.exists(file)) {
            return Collections.emptyList();
        }
        lock.lock();
        try {
            Deque<String> recentLines = new ArrayDeque<>(limit);
            try (BufferedReader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.trim().isEmpty()) {
                        continue;
                    }
                    if (recentLines.size() == limit) {
                        recentLines.removeFirst();
                    }
                    recentLines.addLast(line);
                }
            }
            List<RequestExecutionLogVO> items = new ArrayList<>(recentLines.size());
            while (!recentLines.isEmpty()) {
                RequestExecutionLogVO item = parseLine(recentLines.removeLast());
                if (item != null) {
                    items.add(item);
                }
            }
            return items;
        } catch (IOException e) {
            log.error("Failed to read request execution log.", e);
            return Collections.emptyList();
        } finally {
            lock.unlock();
        }
    }

    @Override
    public RequestExecutionLogPage searchRecent(Predicate<RequestExecutionLogVO> filter, int pageIndex, int pageSize) {
        if (!enabled || pageSize <= 0) {
            return new RequestExecutionLogPage(Collections.emptyList(), 0);
        }
        Path file = Paths.get(requestLogFile == null || requestLogFile.trim().isEmpty()
                ? "/tmp/carbonet-request-execution-history.jsonl"
                : requestLogFile.trim());
        if (!Files.exists(file)) {
            return new RequestExecutionLogPage(Collections.emptyList(), 0);
        }

        int safePageIndex = Math.max(pageIndex, 1);
        int offset = (safePageIndex - 1) * pageSize;
        int retainLimit = offset + pageSize;
        Predicate<RequestExecutionLogVO> safeFilter = filter == null ? item -> true : filter;

        lock.lock();
        try {
            Deque<RequestExecutionLogVO> retainedMatches = new ArrayDeque<>(Math.max(retainLimit, 1));
            int totalMatches = 0;
            try (BufferedReader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.trim().isEmpty()) {
                        continue;
                    }
                    RequestExecutionLogVO item = parseLine(line);
                    if (item == null || !safeFilter.test(item)) {
                        continue;
                    }
                    totalMatches++;
                    retainedMatches.addLast(item);
                    if (retainedMatches.size() > retainLimit) {
                        retainedMatches.removeFirst();
                    }
                }
            }

            List<RequestExecutionLogVO> newestFirst = new ArrayList<>(retainedMatches.size());
            while (!retainedMatches.isEmpty()) {
                newestFirst.add(retainedMatches.removeLast());
            }
            if (offset >= newestFirst.size()) {
                return new RequestExecutionLogPage(Collections.emptyList(), totalMatches);
            }
            int toIndex = Math.min(offset + pageSize, newestFirst.size());
            return new RequestExecutionLogPage(new ArrayList<>(newestFirst.subList(offset, toIndex)), totalMatches);
        } catch (IOException e) {
            log.error("Failed to search request execution log.", e);
            return new RequestExecutionLogPage(Collections.emptyList(), 0);
        } finally {
            lock.unlock();
        }
    }

    private RequestExecutionLogVO parseLine(String line) {
        try {
            return objectMapper.readValue(line, RequestExecutionLogVO.class);
        } catch (IOException e) {
            log.debug("Failed to parse request execution log line.", e);
            return null;
        }
    }
}
