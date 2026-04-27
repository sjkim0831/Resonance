package egovframework.com.platform.executiongate.runtimecontrol;

import egovframework.com.platform.executiongate.ExecutionGateRequestContext;

import java.util.Collections;
import java.util.Map;
import java.util.Objects;

public record RuntimeControlGateRequest(
        ExecutionGateRequestContext context,
        String operationKey,
        String targetId,
        Map<String, Object> parameters
) {

    public RuntimeControlGateRequest {
        context = Objects.requireNonNull(context, "context");
        operationKey = normalize(operationKey);
        targetId = normalize(targetId);
        parameters = parameters == null ? Collections.emptyMap() : Collections.unmodifiableMap(parameters);
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
