package egovframework.com.common.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.concurrent.atomic.AtomicLong;

@Service
@Slf4j
public class PublicLookupRateLimitService {

    static final int MAX_LEDGER_ROWS = 100_000;
    private static final long CLEANUP_INTERVAL = 64L;
    private static final String UPSERT_SQL = """
            INSERT INTO framework_public_lookup_rate_limit(
              project_id,remote_addr_hash,endpoint_code,window_bucket,request_count,expires_at,updated_at)
            VALUES(?,?,?,?,1,to_timestamp(?),current_timestamp)
            ON CONFLICT(project_id,remote_addr_hash,endpoint_code,window_bucket)
            DO UPDATE SET request_count=framework_public_lookup_rate_limit.request_count+1,
                          expires_at=excluded.expires_at,updated_at=current_timestamp
            RETURNING request_count
            """;
    private static final String CLEANUP_SQL = """
            DELETE FROM framework_public_lookup_rate_limit
            WHERE ctid IN (
              SELECT ctid FROM framework_public_lookup_rate_limit
              WHERE expires_at < current_timestamp
                 OR (SELECT count(*) FROM framework_public_lookup_rate_limit) > ?
              ORDER BY expires_at,updated_at
              LIMIT 1000
            )
            """;

    private final JdbcTemplate jdbc;
    private final AtomicLong requestCounter = new AtomicLong();

    public PublicLookupRateLimitService(DataSource dataSource) {
        this(new JdbcTemplate(dataSource));
    }

    PublicLookupRateLimitService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Decision check(String projectId, String endpointCode, String remoteAddress,
            int maxAttempts, long windowSeconds) {
        String project = safe(projectId, 100);
        String endpoint = safe(endpointCode, 64);
        String remote = safe(remoteAddress, 128);
        if (project.isEmpty() || endpoint.isEmpty() || remote.isEmpty() || maxAttempts <= 0 || windowSeconds <= 0) {
            return Decision.unavailable(Math.max(1L, windowSeconds));
        }
        long now = Instant.now().getEpochSecond();
        long windowBucket = now / windowSeconds;
        long expiresAt = (windowBucket + 1L) * windowSeconds;
        long retryAfter = Math.max(1L, expiresAt - now);
        try {
            if ((requestCounter.incrementAndGet() % CLEANUP_INTERVAL) == 0L) {
                jdbc.update(CLEANUP_SQL, MAX_LEDGER_ROWS);
            }
            Integer count = jdbc.queryForObject(UPSERT_SQL, Integer.class,
                    project, sha256(remote), endpoint, windowBucket, expiresAt);
            int attempts = count == null ? maxAttempts + 1 : count;
            return attempts <= maxAttempts
                    ? Decision.allowed(attempts)
                    : Decision.limited(retryAfter, attempts);
        } catch (Exception exception) {
            log.error("Public lookup limiter unavailable. project={} endpoint={}", project, endpoint, exception);
            return Decision.unavailable(retryAfter);
        }
    }

    static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private String safe(String value, int maxLength) {
        String normalized = value == null ? "" : value.trim();
        return normalized.length() <= maxLength ? normalized : "";
    }

    public static final class Decision {
        private final boolean allowed;
        private final boolean limiterUnavailable;
        private final long retryAfterSeconds;
        private final int currentCount;

        private Decision(boolean allowed, boolean limiterUnavailable, long retryAfterSeconds, int currentCount) {
            this.allowed = allowed;
            this.limiterUnavailable = limiterUnavailable;
            this.retryAfterSeconds = retryAfterSeconds;
            this.currentCount = currentCount;
        }

        public static Decision allowed(int count) { return new Decision(true, false, 0L, count); }
        public static Decision limited(long retryAfter, int count) { return new Decision(false, false, retryAfter, count); }
        public static Decision unavailable(long retryAfter) { return new Decision(false, true, retryAfter, 0); }
        public boolean isAllowed() { return allowed; }
        public boolean isLimiterUnavailable() { return limiterUnavailable; }
        public long getRetryAfterSeconds() { return retryAfterSeconds; }
        public int getCurrentCount() { return currentCount; }
    }
}
