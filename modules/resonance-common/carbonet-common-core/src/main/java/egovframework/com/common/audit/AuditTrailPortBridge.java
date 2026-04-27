package egovframework.com.common.audit;

import egovframework.com.platform.service.audit.AuditTrailPort;
import org.springframework.stereotype.Component;

@Component
public class AuditTrailPortBridge implements AuditTrailPort {

    private final AuditTrailService auditTrailService;

    public AuditTrailPortBridge(AuditTrailService auditTrailService) {
        this.auditTrailService = auditTrailService;
    }

    @Override
    public void record(String actorId,
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
                       String userAgent) {
        auditTrailService.record(
                actorId,
                actorRole,
                menuCode,
                pageId,
                actionCode,
                entityType,
                entityId,
                resultStatus,
                reasonSummary,
                beforeSummaryJson,
                afterSummaryJson,
                ipAddress,
                userAgent);
    }
}
