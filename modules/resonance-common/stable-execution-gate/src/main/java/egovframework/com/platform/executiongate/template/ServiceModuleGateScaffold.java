package egovframework.com.platform.executiongate.template;

import egovframework.com.platform.executiongate.ExecutionGateVersion;

import java.util.List;

public final class ServiceModuleGateScaffold {

    private ServiceModuleGateScaffold() {
    }

    public static GateCompatibilityMatrixRow row(String gateName,
                                                 String actionKeyPrefix,
                                                 String adapterVersion,
                                                 GateCompatibilityClass compatibilityClass,
                                                 boolean projectRewriteRequired,
                                                 String notes) {
        return new GateCompatibilityMatrixRow(
                gateName,
                actionKeyPrefix,
                ExecutionGateVersion.CURRENT,
                adapterVersion,
                compatibilityClass,
                projectRewriteRequired,
                notes
        );
    }

    public static List<GateCompatibilityMatrixRow> starterMatrix() {
        return List.of(
                row("operations-action", "system-builder", "1.0.0", GateCompatibilityClass.ADAPTER_SAFE, false, "summary command service hidden behind gate"),
                row("operations-action", "codex-admin.tickets", "1.0.0", GateCompatibilityClass.ADAPTER_SAFE, false, "SR ticket actions absorbed by gate adapter"),
                row("binary-download", "wbs", "1.0.0", GateCompatibilityClass.IMPLEMENTATION_SAFE, false, "binary download separated from controller"),
                row("session-simulation", "session-simulator", "1.0.0", GateCompatibilityClass.CONTRACT_AWARE, false, "transition servlet dependency remains behind gate")
        );
    }
}
