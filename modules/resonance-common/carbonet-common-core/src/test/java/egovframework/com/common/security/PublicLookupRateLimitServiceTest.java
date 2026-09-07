package egovframework.com.common.security;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PublicLookupRateLimitServiceTest {

    @Test
    void springContextSelectsTheExplicitDataSourceConstructor() {
        DataSource dataSource = mock(DataSource.class);
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.registerBean(DataSource.class, () -> dataSource);
            context.register(PublicLookupRateLimitService.class);
            context.refresh();

            PublicLookupRateLimitService service = context.getBean(PublicLookupRateLimitService.class);

            assertNotNull(service);
            assertSame(dataSource, context.getBean(DataSource.class));
        }
    }

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
