package egovframework.com.platform.runtimecontrol.service.port;

public interface RuntimeAuditPort {
    void record(
        String actorId,
        String actorRole,
        String featureArea,
        String pageKey,
        String actionKey,
        String resourceType,
        String resourceId,
        String resultCode,
        String message,
        String beforeSnapshot,
        String afterSnapshot,
        String requestIp,
        String userAgent
    );
}
