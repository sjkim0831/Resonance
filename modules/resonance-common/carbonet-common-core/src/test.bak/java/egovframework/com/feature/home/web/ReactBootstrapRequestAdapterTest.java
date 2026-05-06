package egovframework.com.feature.home.web;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ReactBootstrapRequestAdapterTest {

    private final ReactBootstrapRequestAdapter adapter = new ReactBootstrapRequestAdapter(new ReactBootstrapAdapterProperties());

    @Test
    void adminLoginBootstrapFallsBackToCanonicalLoginRouteWithoutExplicitPath() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/admin/login/api/app/bootstrap");

        ReactBootstrapRequestAdapter.BootstrapRequestResolution resolution =
                adapter.adapt("", "", request, true);

        assertEquals("/admin/login/loginView", resolution.requestedPath());
        assertEquals("admin-login", resolution.resolvedRoute());
    }

    @Test
    void publicSigninBootstrapFallsBackToCanonicalSigninRouteWithoutExplicitPath() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/signin/api/app/bootstrap");

        ReactBootstrapRequestAdapter.BootstrapRequestResolution resolution =
                adapter.adapt(null, null, request, false);

        assertEquals("/signin/loginView", resolution.requestedPath());
        assertEquals("signin-login", resolution.resolvedRoute());
    }

    @Test
    void explicitHeaderPathOverridesEndpointFallback() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/admin/app/bootstrap");
        request.addHeader("X-Carbonet-Path", "/admin/system/role");

        ReactBootstrapRequestAdapter.BootstrapRequestResolution resolution =
                adapter.adapt("", "", request, true);

        assertEquals("/admin/system/role", resolution.requestedPath());
        assertEquals("auth_group", resolution.resolvedRoute());
    }

    @Test
    void explicitRouteOverridesDefaultEndpointRouteWhileKeepingRequestedPath() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/admin/app/bootstrap");

        ReactBootstrapRequestAdapter.BootstrapRequestResolution resolution =
                adapter.adapt("security-monitoring", "", request, true);

        assertEquals("/admin/", resolution.requestedPath());
        assertEquals("security-monitoring", resolution.resolvedRoute());
    }

    @Test
    void configuredBindingsOverrideDefaultEndpointRegistry() {
        ReactBootstrapAdapterProperties properties = new ReactBootstrapAdapterProperties();
        ReactBootstrapAdapterProperties.Binding binding = new ReactBootstrapAdapterProperties.Binding();
        binding.setBootstrapEndpoint("/custom/admin/bootstrap");
        binding.setRequestedPath("/admin/login/loginView");
        binding.setDefaultRoute("admin-login");
        binding.setAdmin(true);
        properties.getBindings().add(binding);

        ReactBootstrapRequestAdapter configuredAdapter = new ReactBootstrapRequestAdapter(properties);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/custom/admin/bootstrap");

        ReactBootstrapRequestAdapter.BootstrapRequestResolution resolution =
                configuredAdapter.adapt("", "", request, true);

        assertEquals("/admin/login/loginView", resolution.requestedPath());
        assertEquals("admin-login", resolution.resolvedRoute());
    }
}
