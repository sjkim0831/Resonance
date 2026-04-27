package egovframework.com.platform.executiongate.operations;

import egovframework.com.platform.executiongate.ExecutionGateRequestContext;

import java.util.Collections;
import java.util.Map;
import java.util.Objects;

public record OperationsActionGateRequest(
        ExecutionGateRequestContext context,
        String actionKey,
        String targetId,
        Map<String, Object> parameters
) {

    public OperationsActionGateRequest {
        context = Objects.requireNonNull(context, "context");
        actionKey = normalize(actionKey);
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
