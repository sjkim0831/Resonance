package egovframework.com.platform.observability.service;

import egovframework.com.common.security.AdminActionRateLimitService;
import egovframework.com.platform.service.observability.AdminActionRateLimitPort;
import org.springframework.stereotype.Service;

@Service
public class AdminActionRateLimitPortBridge implements AdminActionRateLimitPort {

    private final AdminActionRateLimitService delegate;

    public AdminActionRateLimitPortBridge(AdminActionRateLimitService delegate) {
        this.delegate = delegate;
    }

    @Override
    public RateLimitDecision check(String scopeKey, int maxAttempts, long windowSeconds) {
        AdminActionRateLimitService.RateLimitDecision decision = delegate.check(scopeKey, maxAttempts, windowSeconds);
        return new RateLimitDecision(decision.isAllowed(), decision.getRetryAfterSeconds(), decision.getCurrentCount());
    }
}
