package egovframework.com.feature.home.web;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.http.ResponseEntity;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import org.mockito.invocation.InvocationOnMock;
import org.mockito.stubbing.Answer;

class EmissionProjectListV1ControllerTest {
    private static final String PROJECT_ID = "PRJ-TEST-PORTFOLIO-001";

    @Test
    void unauthenticatedRequestIsRejectedBeforeDatabaseAccess() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        CurrentUserContextService users = mock(CurrentUserContextService.class);
        CurrentUserContextService.CurrentUserContext anonymous = new CurrentUserContextService.CurrentUserContext();
        anonymous.setAuthenticated(false);
        when(users.resolve(any(HttpServletRequest.class))).thenReturn(anonymous);

        ResponseEntity<?> response = new EmissionProjectListV1Controller(jdbc, users)
                .list("", "", "", "", "", null, null, "UPDATED_DESC", new MockHttpServletRequest());

        assertEquals(401, response.getStatusCode().value());
        verifyNoInteractions(jdbc);
    }

    @Test
    void authenticatedPortfolioResponseCarriesTheSelectedProjectAndSiteBinding() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        CurrentUserContextService users = mock(CurrentUserContextService.class);
        CurrentUserContextService.CurrentUserContext actor = new CurrentUserContextService.CurrentUserContext();
        actor.setAuthenticated(true);
        actor.setUserId("test-company-manager");
        actor.setInsttId("TENANT-TEST");
        actor.setWebmaster(false);
        when(users.resolve(any(HttpServletRequest.class))).thenReturn(actor);

        Map<String, Object> project = new LinkedHashMap<>();
        project.put("id", PROJECT_ID);
        project.put("name", "Fixture emission project");
        project.put("periodStart", "2026-01-01");
        project.put("periodEnd", "2026-12-31");
        project.put("legacyPeriod", null);
        project.put("status", "IN_PROGRESS");
        project.put("calculatedStatus", "NOT_CALCULATED");
        project.put("updatedAt", null);

        doAnswer(invocation -> queryForListResult(invocation, project))
                .when(jdbc).queryForList(anyString(), any(Object[].class));
        doAnswer(invocation -> queryForObjectResult(invocation))
                .when(jdbc).queryForObject(anyString(), any(Class.class), any(Object[].class));
        Map<String, Object> aggregate = new LinkedHashMap<>();
        aggregate.put("projectCount", 1L);
        aggregate.put("completedCount", 0L);
        aggregate.put("calculatedCount", 0L);
        aggregate.put("notCalculatedCount", 1L);
        aggregate.put("approvedProjectCount", 0L);
        aggregate.put("approvedTotalEmission", 0L);
        aggregate.put("approvedUnitCount", 0L);
        aggregate.put("approvedResultUnit", null);
        aggregate.put("latestUnapprovedCalculationProjectCount", 0L);
        aggregate.put("latestUnapprovedCalculationTotalEmission", 0L);
        aggregate.put("latestUnapprovedCalculationUnitCount", 0L);
        aggregate.put("latestUnapprovedCalculationResultUnit", null);
        aggregate.put("requestedCount", 0L);
        aggregate.put("pendingAcceptanceCount", 0L);
        aggregate.put("correctionCount", 0L);
        aggregate.put("deadlineCount", 0L);
        aggregate.put("openCount", 0L);
        aggregate.put("overdueCount", 0L);
        aggregate.put("dueSoonCount", 0L);
        aggregate.put("approvalCount", 0L);
        aggregate.put("lockedCount", 0L);
        aggregate.put("complete", false);
        when(jdbc.queryForMap(anyString(), any(Object[].class))).thenReturn(aggregate);

        ResponseEntity<?> response = new EmissionProjectListV1Controller(jdbc, users)
                .list("", "", "", "", "", "1", "20", "UPDATED_DESC", new MockHttpServletRequest());

        assertEquals(200, response.getStatusCode().value());
        assertInstanceOf(Map.class, response.getBody());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals(1, body.get("contractVersion"));
        assertEquals(1L, body.get("totalCount"));
        assertEquals(1, body.get("page"));
        assertEquals(20, body.get("pageSize"));
        assertEquals(false, body.get("canCreate"));
        assertFalse(body.containsKey("tenantId"));
        Map<?, ?> summary = assertInstanceOf(Map.class, body.get("summary"));
        assertEquals(1L, summary.get("projectCount"));
        assertEquals(0L, summary.get("approvedProjectCount"));
        assertEquals(0, ((Number) summary.get("approvedTotalEmission")).intValue());
        verify(jdbc, atLeastOnce()).queryForMap(anyString(), any(Object[].class));

        List<?> items = assertInstanceOf(List.class, body.get("items"));
        Map<?, ?> returnedProject = assertInstanceOf(Map.class, items.get(0));
        assertEquals(PROJECT_ID, returnedProject.get("id"));
        assertEquals(List.of(Map.of("id", "9001", "name", "Fixture site")), returnedProject.get("sites"));
    }

    private static Object queryForListResult(InvocationOnMock invocation, Map<String, Object> project) {
        String sql = invocation.getArgument(0);
        if (sql.contains("SELECT e.project_id AS id")) return new ArrayList<>(List.of(project));
        if (sql.startsWith("SELECT ps.project_id")) {
            return List.of(Map.of("project_id", PROJECT_ID, "id", 9001L, "name", "Fixture site"));
        }
        if (sql.startsWith("SELECT DISTINCT s.site_id")) {
            return List.of(Map.of("id", "9001", "name", "Fixture site"));
        }
        return List.of();
    }

    private static Object queryForObjectResult(InvocationOnMock invocation) {
        String sql = invocation.getArgument(0);
        if (sql.startsWith("WITH permitted")) return 1L;
        if (sql.startsWith("SELECT EXISTS")) return false;
        throw new AssertionError("Unexpected SQL in portfolio controller test: " + sql);
    }
}
