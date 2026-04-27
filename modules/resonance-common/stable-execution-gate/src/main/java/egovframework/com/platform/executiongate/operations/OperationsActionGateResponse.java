package egovframework.com.platform.executiongate.operations;

import java.util.Collections;
import java.util.Map;
import java.util.Objects;

public record OperationsActionGateResponse(
        String executionGateVersion,
        String actionKey,
        String resultStatus,
        Map<String, Object> payload
) {

    public OperationsActionGateResponse {
        executionGateVersion = Objects.requireNonNull(executionGateVersion, "executionGateVersion");
        actionKey = normalize(actionKey);
        resultStatus = normalize(resultStatus);
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
