package egovframework.com.platform.executiongate.menu;

import java.util.Collections;
import java.util.Map;
import java.util.Objects;

public record MenuResolutionGateResponse(
        String executionGateVersion,
        String menuCode,
        String menuPath,
        Map<String, Object> menuDescriptor
) {

    public MenuResolutionGateResponse {
        executionGateVersion = Objects.requireNonNull(executionGateVersion, "executionGateVersion");
        menuCode = normalize(menuCode);
        menuPath = normalize(menuPath);
        menuDescriptor = menuDescriptor == null ? Collections.emptyMap() : Collections.unmodifiableMap(menuDescriptor);
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
