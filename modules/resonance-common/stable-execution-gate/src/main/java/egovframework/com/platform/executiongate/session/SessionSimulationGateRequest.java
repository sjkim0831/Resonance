package egovframework.com.platform.executiongate.session;

import egovframework.com.platform.executiongate.ExecutionGateRequestContext;

import java.util.Collections;
import java.util.Map;
import java.util.Objects;

public record SessionSimulationGateRequest(
        ExecutionGateRequestContext context,
        String actionKey,
        String insttId,
        Map<String, Object> payload
) {

    public SessionSimulationGateRequest {
        context = Objects.requireNonNull(context, "context");
        actionKey = normalize(actionKey);
        insttId = normalize(insttId);
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
