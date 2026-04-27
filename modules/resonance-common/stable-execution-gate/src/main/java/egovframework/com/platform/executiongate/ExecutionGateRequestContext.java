package egovframework.com.platform.executiongate;

public record ExecutionGateRequestContext(
        String executionGateVersion,
        String projectId,
        GateActorScope actorScope,
        GateRouteScope routeScope,
        String capabilityKey,
        String actorId,
        String traceId,
        String requestId
) {

    public ExecutionGateRequestContext {
        executionGateVersion = normalizeVersion(executionGateVersion);
        projectId = normalize(projectId);
        actorScope = actorScope == null ? GateActorScope.ANONYMOUS : actorScope;
        routeScope = routeScope == null ? GateRouteScope.SHARED_TRANSITION : routeScope;
        capabilityKey = normalize(capabilityKey);
        actorId = normalize(actorId);
        traceId = normalize(traceId);
        requestId = normalize(requestId);
    }

    public static ExecutionGateRequestContext of(String projectId,
                                                 GateActorScope actorScope,
                                                 GateRouteScope routeScope,
                                                 String capabilityKey,
                                                 String actorId,
                                                 String traceId,
                                                 String requestId) {
        return new ExecutionGateRequestContext(
                ExecutionGateVersion.CURRENT,
                projectId,
                actorScope,
                routeScope,
                capabilityKey,
                actorId,
                traceId,
                requestId
        );
    }

    private static String normalizeVersion(String value) {
        String normalized = normalize(value);
        return normalized == null ? ExecutionGateVersion.CURRENT : normalized;
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
