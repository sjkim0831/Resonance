package egovframework.com.platform.executiongate.bootstrap;

import egovframework.com.platform.executiongate.ExecutionGateRequestContext;

import java.util.Objects;

public record BootstrapGateRequest(
        ExecutionGateRequestContext context,
        String requestedPath,
        String requestedRoute,
        boolean admin
) {

    public BootstrapGateRequest {
        context = Objects.requireNonNull(context, "context");
        requestedPath = normalize(requestedPath);
        requestedRoute = normalize(requestedRoute);
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
