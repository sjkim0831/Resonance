package egovframework.com.feature.home.web;

import egovframework.com.common.util.ReactPageUrlMapper;
import egovframework.com.platform.executiongate.ExecutionGateRequestContext;
import egovframework.com.platform.executiongate.ExecutionGateVersion;
import egovframework.com.platform.executiongate.bootstrap.BootstrapExecutionGate;
import egovframework.com.platform.executiongate.bootstrap.BootstrapGateRequest;
import egovframework.com.platform.executiongate.bootstrap.BootstrapGateResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ReactBootstrapRequestAdapter implements BootstrapExecutionGate {

    private static final List<BootstrapEndpointBinding> DEFAULT_BOOTSTRAP_ENDPOINT_BINDINGS = List.of(
            new BootstrapEndpointBinding("/en/admin/login/api/app/bootstrap", "/en/admin/login/loginView", "admin-login", true),
            new BootstrapEndpointBinding("/admin/login/api/app/bootstrap", "/admin/login/loginView", "admin-login", true),
            new BootstrapEndpointBinding("/en/signin/api/app/bootstrap", "/en/signin/loginView", "signin-login", false),
            new BootstrapEndpointBinding("/signin/api/app/bootstrap", "/signin/loginView", "signin-login", false),
            new BootstrapEndpointBinding("/en/admin/api/admin/app/bootstrap", "/en/admin/", "admin-home", true),
            new BootstrapEndpointBinding("/admin/api/admin/app/bootstrap", "/admin/", "admin-home", true),
            new BootstrapEndpointBinding("/en/api/admin/app/bootstrap", "/en/admin/", "admin-home", true),
            new BootstrapEndpointBinding("/api/admin/app/bootstrap", "/admin/", "admin-home", true),
            new BootstrapEndpointBinding("/en/api/app/bootstrap", "/en/home", "home", false),
            new BootstrapEndpointBinding("/api/app/bootstrap", "/home", "home", false)
    );

    private final ReactBootstrapAdapterProperties properties;

    public BootstrapRequestResolution adapt(String route, String path, HttpServletRequest request, boolean admin) {
        String requestUri = request == null ? "" : safe(request.getRequestURI());
        String explicitPath = safe(path);
        String headerPath = request == null ? "" : safe(request.getHeader("X-Carbonet-Path"));
        BootstrapGateResponse response = resolve(new BootstrapGateRequest(
                ExecutionGateRequestContext.of(null, null, null, "bootstrap.resolve", null, null, null),
                !explicitPath.isEmpty() ? explicitPath : headerPath,
                route,
                admin
        ), requestUri);
        return new BootstrapRequestResolution(response.requestedPath(), response.resolvedRoute());
    }

    @Override
    public BootstrapGateResponse resolve(BootstrapGateRequest request) {
        return resolve(request, "");
    }

    BootstrapGateResponse resolve(BootstrapGateRequest request, String requestUri) {
        ExecutionGateRequestContext context = request.context();
        BootstrapEndpointBinding binding = findBinding(safe(requestUri), request.admin());

        String requestedPath = safe(request.requestedPath());
        if (requestedPath.isEmpty() && binding != null) {
            requestedPath = binding.requestedPath();
        }

        String initialRoute = safe(request.requestedRoute());
        if (initialRoute.isEmpty() && !requestedPath.isEmpty()) {
            initialRoute = ReactPageUrlMapper.resolveRouteIdForPath(requestedPath).replace('_', '-');
        }
        if (initialRoute.isEmpty()) {
            initialRoute = binding == null ? (request.admin() ? "auth-group" : "mypage") : binding.defaultRoute();
        }

        String resolvedRoute = ReactRouteSupport.resolveBootstrapRoute(initialRoute, requestedPath, request.admin());
        return new BootstrapGateResponse(
                context == null ? ExecutionGateVersion.CURRENT : context.executionGateVersion(),
                resolvedRoute,
                requestedPath,
                false,
                Map.of(
                        "requestedPath", requestedPath,
                        "reactRoute", resolvedRoute,
                        "admin", request.admin()
                )
        );
    }

    private BootstrapEndpointBinding findBinding(String requestUri, boolean admin) {
        for (BootstrapEndpointBinding binding : configuredBindings()) {
            if (binding.admin() == admin && binding.bootstrapEndpoint().equals(requestUri)) {
                return binding;
            }
        }
        return null;
    }

    private List<BootstrapEndpointBinding> configuredBindings() {
        List<BootstrapEndpointBinding> configured = new ArrayList<>();
        if (properties != null && properties.getBindings() != null) {
            for (ReactBootstrapAdapterProperties.Binding binding : properties.getBindings()) {
                String endpoint = safe(binding.getBootstrapEndpoint());
                String requestedPath = safe(binding.getRequestedPath());
                String defaultRoute = safe(binding.getDefaultRoute());
                if (endpoint.isEmpty() || requestedPath.isEmpty() || defaultRoute.isEmpty()) {
                    continue;
                }
                configured.add(new BootstrapEndpointBinding(endpoint, requestedPath, defaultRoute, binding.isAdmin()));
            }
        }
        return configured.isEmpty() ? DEFAULT_BOOTSTRAP_ENDPOINT_BINDINGS : configured;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    public record BootstrapRequestResolution(String requestedPath, String resolvedRoute) {
    }

    private record BootstrapEndpointBinding(String bootstrapEndpoint, String requestedPath, String defaultRoute, boolean admin) {
    }
}
