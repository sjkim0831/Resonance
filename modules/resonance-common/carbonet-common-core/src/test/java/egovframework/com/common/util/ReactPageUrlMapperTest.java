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

    @Test
    void resolvesCompanyReapplicationWithoutFallingBackToHome() {
        assertEquals("join_company_reapply",
                ReactPageUrlMapper.resolveRouteIdForPath("/join/companyReapply"));
        assertEquals("join_company_reapply",
                ReactPageUrlMapper.resolveRouteIdForPath("/join/en/companyReapply"));
        assertEquals("/join/companyReapply",
                ReactPageUrlMapper.toRuntimeUrl("/join/companyReapply", false));
        assertEquals("/join/en/companyReapply",
                ReactPageUrlMapper.toRuntimeUrl("/join/companyReapply", true));
        assertEquals("/join/companyReapply",
                ReactPageUrlMapper.toCanonicalMenuUrl("/join/companyreapply"));
    }

    @Test
    void canonicalizesCaseOnlyJoinRouteVariantsFromDesignLedger() {
        assertEquals("join_company_register",
                ReactPageUrlMapper.resolveRouteIdForPath("/join/companyregister"));
        assertEquals("join_company_register_complete",
                ReactPageUrlMapper.resolveRouteIdForPath("/join/companyregistercomplete"));
        assertEquals("join_company_status",
                ReactPageUrlMapper.resolveRouteIdForPath("/join/companyjoinstatussearch"));
        assertEquals("join_company_status",
                ReactPageUrlMapper.resolveRouteIdForPath("/join/companyJoinStatus"));
        assertEquals("join_company_status_detail",
                ReactPageUrlMapper.resolveRouteIdForPath("/join/companyjoinstatusdetail"));

        assertEquals("/join/companyRegister",
                ReactPageUrlMapper.toCanonicalMenuUrl("/join/companyregister"));
        assertEquals("/join/companyRegisterComplete",
                ReactPageUrlMapper.toCanonicalMenuUrl("/join/companyregistercomplete"));
        assertEquals("/join/companyJoinStatusSearch?bizNo=1",
                ReactPageUrlMapper.toCanonicalMenuUrl("/join/companyjoinstatussearch?bizNo=1"));
        assertEquals("/join/companyJoinStatusSearch?bizNo=1",
                ReactPageUrlMapper.toCanonicalMenuUrl("/join/companyJoinStatus?bizNo=1"));
        assertEquals("/join/en/companyJoinStatusSearch?bizNo=1",
                ReactPageUrlMapper.toRuntimeUrl("/join/companyJoinStatus?bizNo=1", true));
        assertEquals("/join/companyJoinStatusDetail?bizNo=1",
                ReactPageUrlMapper.toCanonicalMenuUrl("/join/companyjoinstatusdetail?bizNo=1"));
    }

    @Test
    void caseInsensitiveAdminLookupDoesNotShadowHomeRoutes() {
        assertEquals("/emission/work-assignment?projectId=PRJ-1",
                ReactPageUrlMapper.toRuntimeUrl(
                        "/emission/work-assignment?projectId=PRJ-1", false));
        assertEquals("/join/companyRegister",
                ReactPageUrlMapper.toRuntimeUrl("/join/companyregister", false));
    }
}
