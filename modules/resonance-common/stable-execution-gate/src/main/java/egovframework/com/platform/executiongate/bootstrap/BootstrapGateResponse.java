package egovframework.com.platform.executiongate.bootstrap;

import java.util.Collections;
import java.util.Map;
import java.util.Objects;

public record BootstrapGateResponse(
        String executionGateVersion,
        String resolvedRoute,
        String requestedPath,
        boolean authenticated,
        Map<String, Object> payload
) {

    public BootstrapGateResponse {
        executionGateVersion = Objects.requireNonNull(executionGateVersion, "executionGateVersion");
        resolvedRoute = normalize(resolvedRoute);
        requestedPath = normalize(requestedPath);
        payload = payload == null ? Collections.emptyMap() : Collections.unmodifiableMap(payload);
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
