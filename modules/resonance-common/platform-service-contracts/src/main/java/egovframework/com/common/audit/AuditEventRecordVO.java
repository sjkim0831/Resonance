package egovframework.com.common.audit;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AuditEventRecordVO {

    private String auditId;
    private String projectId;
    private String traceId;
    private String requestId;
    private String actorId;
    private String actorRole;
    private String menuCode;
    private String pageId;
    private String actionCode;
    private String entityType;
    private String entityId;
    private String beforeSummaryJson;
    private String afterSummaryJson;
    private String resultStatus;
    private String reasonSummary;
    private String ipAddress;
    private String userAgent;
    private String requestUri;
    private String httpMethod;
    private String createdAt;

    public String getBeforeSummaryJson() {
        return beforeSummaryJson;
    }

    public String getAfterSummaryJson() {
        return afterSummaryJson;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public String getActorId() {
        return actorId;
    }

    public String getActionCode() {
        return actionCode;
    }

    public String getAuditId() {
        return auditId;
    }

    public String getPageId() {
        return pageId;
    }

    public String getReasonSummary() {
        return reasonSummary;
    }

    public String getEntityId() {
        return entityId;
    }

    public String getResultStatus() {
        return resultStatus;
    }
}
