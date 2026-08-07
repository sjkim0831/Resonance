package egovframework.com.common.security;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PublicLookupRateLimitServiceTest {

    @Test
    void distributedLedgerUsesOnlyRemoteAddressHashAndFailsClosedAfterLimit() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), any(Object[].class))).thenReturn(11);
        PublicLookupRateLimitService service = new PublicLookupRateLimitService(jdbc);

        PublicLookupRateLimitService.Decision decision = service.check(
                "P003", "company-status-detail", "203.0.113.7", 10, 300);

        assertFalse(decision.isAllowed());
        assertFalse(decision.isLimiterUnavailable());
        assertTrue(decision.getRetryAfterSeconds() >= 1 && decision.getRetryAfterSeconds() <= 300);
        assertEquals(64, PublicLookupRateLimitService.sha256("203.0.113.7").length());
        assertNotEquals("203.0.113.7", PublicLookupRateLimitService.sha256("203.0.113.7"));
    }

    @Test
    void databaseFailureDeniesRequest() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), any(Object[].class)))
                .thenThrow(new IllegalStateException("database unavailable"));
        PublicLookupRateLimitService.Decision decision = new PublicLookupRateLimitService(jdbc)
                .check("P003", "company-reapply-page", "127.0.0.1", 10, 300);
        assertFalse(decision.isAllowed());
        assertTrue(decision.isLimiterUnavailable());
    }
}
