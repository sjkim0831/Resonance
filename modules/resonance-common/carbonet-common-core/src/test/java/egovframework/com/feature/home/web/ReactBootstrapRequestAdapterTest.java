package egovframework.com.feature.home.web;

import egovframework.com.platform.executiongate.ExecutionGateRequestContext;
import egovframework.com.platform.executiongate.bootstrap.BootstrapGateRequest;
import egovframework.com.platform.executiongate.bootstrap.BootstrapGateResponse;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ReactBootstrapRequestAdapterTest {

    private final ReactBootstrapRequestAdapter adapter =
            new ReactBootstrapRequestAdapter(new ReactBootstrapAdapterProperties());

    @Test
    void unmappedConcreteAdminPathUsesNeutralShellInsteadOfAdminHome() {
        BootstrapGateResponse response = resolve(
                "/admin/emission/survey-report-print",
                null,
                true,
                "/api/admin/app/bootstrap");

        assertEquals("/admin/emission/survey-report-print", response.requestedPath());
        assertEquals(ReactBootstrapRequestAdapter.UNMAPPED_ADMIN_SHELL_ROUTE, response.resolvedRoute());
    }

    @Test
    void mappedActorProcessPathKeepsItsExactRoute() {
        BootstrapGateResponse response = resolve(
                "/admin/system/actor-process",
                null,
                true,
                "/api/admin/app/bootstrap");

        assertEquals("actor-process-governance", response.resolvedRoute());
    }

    @Test
    void omittedPathStillUsesEndpointAdminHomeDefault() {
        BootstrapGateResponse response = resolve(
                null,
                null,
                true,
                "/api/admin/app/bootstrap");

        assertEquals("/admin/", response.requestedPath());
        assertEquals("admin-home", response.resolvedRoute());
    }

    @Test
    void explicitRouteStillWinsForAnUnmappedPath() {
        BootstrapGateResponse response = resolve(
                "/admin/emission/survey-report-print",
                "admin-home",
                true,
                "/api/admin/app/bootstrap");

        assertEquals("admin-home", response.resolvedRoute());
    }

    private BootstrapGateResponse resolve(String path, String route, boolean admin, String requestUri) {
        return adapter.resolve(new BootstrapGateRequest(
                ExecutionGateRequestContext.of(null, null, null, "bootstrap.resolve", null, null, null),
                path,
                route,
                admin), requestUri);
    }
}
