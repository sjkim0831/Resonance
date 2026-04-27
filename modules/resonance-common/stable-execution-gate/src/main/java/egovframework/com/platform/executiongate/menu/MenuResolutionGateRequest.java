package egovframework.com.platform.executiongate.menu;

import egovframework.com.platform.executiongate.ExecutionGateRequestContext;

import java.util.Objects;

public record MenuResolutionGateRequest(
        ExecutionGateRequestContext context,
        String menuCode,
        String requestUri,
        String authorCode,
        boolean admin
) {

    public MenuResolutionGateRequest {
        context = Objects.requireNonNull(context, "context");
        menuCode = normalize(menuCode);
        requestUri = normalize(requestUri);
        authorCode = normalize(authorCode);
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
