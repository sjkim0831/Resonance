package egovframework.com.common.logging;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.BufferedReader;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
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
    static final int RECENT_TAIL_BLOCK_BYTES = 64 * 1024;
    static final int MAX_RECENT_TAIL_MATCHES = 10_000;
    static final int MAX_REQUEST_LOG_LINE_BYTES = 1024 * 1024;
    private static final byte[] EMPTY_BYTES = new byte[0];

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
        return readRecentMatching(item -> true, limit);
    }

    @Override
    public List<RequestExecutionLogVO> readRecentMatching(
            Predicate<RequestExecutionLogVO> filter,
            int limit) {
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
            Predicate<RequestExecutionLogVO> safeFilter = filter == null ? item -> true : filter;
            int safeLimit = Math.min(limit, MAX_RECENT_TAIL_MATCHES);
            return new ArrayList<>(readRecentTail(file, safeFilter, safeLimit).items());
        } catch (IOException e) {
            log.error("Failed to read recent request execution log tail.", e);
            return Collections.emptyList();
        } finally {
            lock.unlock();
        }
    }

    TailReadResult readRecentTail(
            Path file,
            Predicate<RequestExecutionLogVO> filter,
            int requestedLimit) throws IOException {
        // Appends and tail reads share the service lock, so the captured file
        // length is a stable snapshot. Read fixed-size blocks backwards and
        // stop as soon as every row the caller can observe has been found.
        int limit = Math.min(Math.max(requestedLimit, 0), MAX_RECENT_TAIL_MATCHES);
        if (limit == 0 || file == null || !Files.exists(file)) {
            return new TailReadResult(Collections.emptyList(), 0L, 0L, 0L);
        }

        Predicate<RequestExecutionLogVO> safeFilter = filter == null ? item -> true : filter;
        List<RequestExecutionLogVO> matches = new ArrayList<>(Math.min(limit, 512));
        long bytesRead = 0L;
        long linesExamined = 0L;
        long fileBytes;
        byte[] newerLineBytes = EMPTY_BYTES;
        boolean discardingOversizedLine = false;

        try (FileChannel channel = FileChannel.open(file, StandardOpenOption.READ)) {
            fileBytes = channel.size();
            long position = fileBytes;
            ByteBuffer buffer = ByteBuffer.allocate(RECENT_TAIL_BLOCK_BYTES);
            while (position > 0 && matches.size() < limit) {
                int blockSize = (int) Math.min(RECENT_TAIL_BLOCK_BYTES, position);
                position -= blockSize;
                buffer.clear();
                buffer.limit(blockSize);
                channel.position(position);
                while (buffer.hasRemaining()) {
                    int count = channel.read(buffer);
                    if (count < 0) {
                        break;
                    }
                    if (count == 0) {
                        break;
                    }
                }
                int actualBytes = buffer.position();
                if (actualBytes != blockSize) {
                    throw new IOException("Request execution log changed during tail read.");
                }
                bytesRead += actualBytes;
                byte[] block = buffer.array();
                int lineEnd = actualBytes;

                for (int index = actualBytes - 1; index >= 0 && matches.size() < limit; index--) {
                    if (block[index] != '\n') {
                        continue;
                    }
                    int segmentStart = index + 1;
                    int segmentLength = lineEnd - segmentStart;
                    linesExamined++;
                    if (!discardingOversizedLine) {
                        RequestExecutionLogVO item = parseTailLine(block, segmentStart, segmentLength, newerLineBytes);
                        if (item != null && safeFilter.test(item)) {
                            matches.add(item);
                        }
                    }
                    discardingOversizedLine = false;
                    newerLineBytes = EMPTY_BYTES;
                    lineEnd = index;
                }

                if (matches.size() >= limit) {
                    break;
                }
                int prefixLength = lineEnd;
                if (prefixLength > 0 && !discardingOversizedLine) {
                    if ((long) prefixLength + newerLineBytes.length > MAX_REQUEST_LOG_LINE_BYTES) {
                        newerLineBytes = EMPTY_BYTES;
                        discardingOversizedLine = true;
                    } else {
                        newerLineBytes = joinLineBytes(block, 0, prefixLength, newerLineBytes);
                    }
                }
            }

            if (position == 0 && matches.size() < limit
                    && (newerLineBytes.length > 0 || discardingOversizedLine)) {
                linesExamined++;
                if (!discardingOversizedLine) {
                    RequestExecutionLogVO item = parseTailLine(EMPTY_BYTES, 0, 0, newerLineBytes);
                    if (item != null && safeFilter.test(item)) {
                        matches.add(item);
                    }
                }
            }
        }
        return new TailReadResult(matches, bytesRead, linesExamined, fileBytes);
    }

    private RequestExecutionLogVO parseTailLine(
            byte[] segment,
            int segmentStart,
            int segmentLength,
            byte[] newerLineBytes) {
        long combinedLength = (long) segmentLength + newerLineBytes.length;
        if (combinedLength <= 0 || combinedLength > MAX_REQUEST_LOG_LINE_BYTES) {
            return null;
        }
        byte[] lineBytes = joinLineBytes(segment, segmentStart, segmentLength, newerLineBytes);
        int contentLength = lineBytes.length;
        if (contentLength > 0 && lineBytes[contentLength - 1] == '\r') {
            contentLength--;
        }
        if (contentLength == 0) {
            return null;
        }
        return parseLine(new String(lineBytes, 0, contentLength, StandardCharsets.UTF_8));
    }

    private byte[] joinLineBytes(
            byte[] segment,
            int segmentStart,
            int segmentLength,
            byte[] newerLineBytes) {
        byte[] joined = new byte[segmentLength + newerLineBytes.length];
        if (segmentLength > 0) {
            System.arraycopy(segment, segmentStart, joined, 0, segmentLength);
        }
        if (newerLineBytes.length > 0) {
            System.arraycopy(newerLineBytes, 0, joined, segmentLength, newerLineBytes.length);
        }
        return joined;
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

    record TailReadResult(
            List<RequestExecutionLogVO> items,
            long bytesRead,
            long linesExamined,
            long fileBytes) {
    }
}
