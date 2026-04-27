package egovframework.com.platform.service.observability;

public interface AdminActionRateLimitPort {

    RateLimitDecision check(String scopeKey, int maxAttempts, long windowSeconds);

    class RateLimitDecision {
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
