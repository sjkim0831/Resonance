package egovframework.com.common.security;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AdminActionRateLimitService {

    private final ConcurrentHashMap<String, RateLimitWindow> windows = new ConcurrentHashMap<>();

    public RateLimitDecision check(String scopeKey, int maxAttempts, long windowSeconds) {
        String normalizedKey = safe(scopeKey);
        if (normalizedKey.isEmpty() || maxAttempts <= 0 || windowSeconds <= 0) {
            return new RateLimitDecision(true, 0L, 0);
        }
        long now = Instant.now().getEpochSecond();
        long oldestAllowed = now - windowSeconds;
        RateLimitWindow window = windows.computeIfAbsent(normalizedKey, key -> new RateLimitWindow());
        if (window == null) {
            return new RateLimitDecision(true, 0L, 0);
        }
        synchronized (window) {
            window.evictBefore(oldestAllowed);
            int currentCount = window.timestamps.size();
            if (currentCount >= maxAttempts) {
                long retryAfter = window.oldestTimestamp() + windowSeconds - now;
                return new RateLimitDecision(false, Math.max(1L, retryAfter), currentCount);
            }
            window.timestamps.put(now + ":" + window.sequence++, now);
            return new RateLimitDecision(true, 0L, window.timestamps.size());
        }
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private static final class RateLimitWindow {
        private final ConcurrentHashMap<String, Long> timestamps = new ConcurrentHashMap<>();
        private long sequence = 0L;

        private void evictBefore(long oldestAllowed) {
            Iterator<Map.Entry<String, Long>> iterator = timestamps.entrySet().iterator();
            while (iterator.hasNext()) {
                Map.Entry<String, Long> entry = iterator.next();
                if (entry.getValue() < oldestAllowed) {
                    iterator.remove();
                }
            }
        }

        private long oldestTimestamp() {
            long oldest = Long.MAX_VALUE;
            for (Long value : timestamps.values()) {
                if (value != null && value < oldest) {
                    oldest = value;
                }
            }
            return oldest == Long.MAX_VALUE ? Instant.now().getEpochSecond() : oldest;
        }
    }

    public static final class RateLimitDecision {
        private final boolean allowed;
        private final long retryAfterSeconds;
        private final int currentCount;

        public RateLimitDecision(boolean allowed, long retryAfterSeconds, int currentCount) {
            this.allowed = allowed;
            this.retryAfterSeconds = retryAfterSeconds;
            this.currentCount = currentCount;
        }

        public boolean isAllowed() {
            return allowed;
        }

        public long getRetryAfterSeconds() {
            return retryAfterSeconds;
        }

        public int getCurrentCount() {
            return currentCount;
        }
    }
}
