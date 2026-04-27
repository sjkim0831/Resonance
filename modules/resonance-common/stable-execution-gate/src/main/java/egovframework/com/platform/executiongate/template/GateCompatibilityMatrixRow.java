package egovframework.com.platform.executiongate.template;

import java.util.Objects;

public record GateCompatibilityMatrixRow(
        String gateName,
        String actionKeyPrefix,
        String executionGateVersion,
        String adapterVersion,
        GateCompatibilityClass compatibilityClass,
        boolean projectRewriteRequired,
        String notes
) {

    public GateCompatibilityMatrixRow {
        gateName = normalize(gateName);
        actionKeyPrefix = normalize(actionKeyPrefix);
        executionGateVersion = normalize(executionGateVersion);
        adapterVersion = normalize(adapterVersion);
        compatibilityClass = Objects.requireNonNull(compatibilityClass, "compatibilityClass");
        notes = normalize(notes);
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
