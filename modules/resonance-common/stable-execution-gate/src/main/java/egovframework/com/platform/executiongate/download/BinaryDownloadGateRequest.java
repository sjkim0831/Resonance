package egovframework.com.platform.executiongate.download;

import egovframework.com.platform.executiongate.ExecutionGateRequestContext;

import java.util.Collections;
import java.util.Map;
import java.util.Objects;

public record BinaryDownloadGateRequest(
        ExecutionGateRequestContext context,
        String downloadKey,
        String targetId,
        Map<String, Object> parameters
) {

    public BinaryDownloadGateRequest {
        context = Objects.requireNonNull(context, "context");
        downloadKey = normalize(downloadKey);
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
