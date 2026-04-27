package egovframework.com.platform.executiongate.runtimecontrol;

import java.util.Collections;
import java.util.Map;
import java.util.Objects;

public record RuntimeControlGateResponse(
        String executionGateVersion,
        String operationKey,
        String resultStatus,
        Map<String, Object> payload
) {

    public RuntimeControlGateResponse {
        executionGateVersion = Objects.requireNonNull(executionGateVersion, "executionGateVersion");
        operationKey = normalize(operationKey);
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
