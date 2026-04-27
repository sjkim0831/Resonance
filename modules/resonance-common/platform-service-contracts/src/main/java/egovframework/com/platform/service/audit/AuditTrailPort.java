package egovframework.com.platform.service.audit;

public interface AuditTrailPort {

    void record(String actorId,
                String actorRole,
                String menuCode,
                String pageId,
                String actionCode,
                String entityType,
                String entityId,
                String resultStatus,
                String reasonSummary,
                String beforeSummaryJson,
                String afterSummaryJson,
                String ipAddress,
                String userAgent);
}
