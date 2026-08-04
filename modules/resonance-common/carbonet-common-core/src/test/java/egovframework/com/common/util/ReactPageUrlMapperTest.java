package egovframework.com.common.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ReactPageUrlMapperTest {
    @Test
    void resolvesOrganizationalBoundaryUserAndAdminRoutes() {
        assertEquals("organizational_boundary",
                ReactPageUrlMapper.resolveRouteIdForPath("/emission/organizational-boundary?projectId=PRJ-1"));
        assertEquals("organizational_boundary",
                ReactPageUrlMapper.resolveRouteIdForPath("/en/emission/organizational-boundary"));
        assertEquals("organizational_boundary_admin",
                ReactPageUrlMapper.resolveRouteIdForPath("/admin/emission/organizational-boundary"));
        assertEquals("organizational_boundary_admin",
                ReactPageUrlMapper.resolveRouteIdForPath("/en/admin/emission/organizational-boundary"));
    }

    @Test
    void localizesOrganizationalBoundaryMenuRoutesWithoutDroppingQuery() {
        assertEquals("/emission/organizational-boundary?projectId=PRJ-1",
                ReactPageUrlMapper.toRuntimeUrl("/emission/organizational-boundary?projectId=PRJ-1", false));
        assertEquals("/en/emission/organizational-boundary?projectId=PRJ-1",
                ReactPageUrlMapper.toRuntimeUrl("/emission/organizational-boundary?projectId=PRJ-1", true));
    }

    @Test
    void resolvesEmissionProjectPortfolioWithoutFallingBackToHome() {
        assertEquals("emission_project_portfolio",
                ReactPageUrlMapper.resolveRouteIdForPath("/emission/project-portfolio"));
        assertEquals("emission_project_portfolio",
                ReactPageUrlMapper.resolveRouteIdForPath("/en/emission/project-portfolio"));
        assertEquals("/emission/project-portfolio",
                ReactPageUrlMapper.toRuntimeUrl("/emission/project-portfolio", false));
        assertEquals("/en/emission/project-portfolio",
                ReactPageUrlMapper.toRuntimeUrl("/emission/project-portfolio", true));
    }

    @Test
    void resolvesWorkAssignmentWithoutFallingBackToHome() {
        assertEquals("emission_work_assignment",
                ReactPageUrlMapper.resolveRouteIdForPath("/emission/work-assignment?projectId=PRJ-1"));
        assertEquals("emission_work_assignment",
                ReactPageUrlMapper.resolveRouteIdForPath("/en/emission/work-assignment"));
        assertEquals("/emission/work-assignment?projectId=PRJ-1",
                ReactPageUrlMapper.toRuntimeUrl("/emission/work-assignment?projectId=PRJ-1", false));
        assertEquals("/en/emission/work-assignment?projectId=PRJ-1",
                ReactPageUrlMapper.toRuntimeUrl("/emission/work-assignment?projectId=PRJ-1", true));
    }
}
