package egovframework.com.platform.executiongate.download;

import java.util.Arrays;
import java.util.Objects;

public record BinaryDownloadGateResponse(
        String executionGateVersion,
        String downloadKey,
        String contentType,
        String fileName,
        byte[] content
) {

    public BinaryDownloadGateResponse {
        executionGateVersion = Objects.requireNonNull(executionGateVersion, "executionGateVersion");
        downloadKey = normalize(downloadKey);
        contentType = normalize(contentType);
        fileName = normalize(fileName);
        content = content == null ? new byte[0] : Arrays.copyOf(content, content.length);
    }

    @Override
    public byte[] content() {
        return Arrays.copyOf(content, content.length);
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
