package egovframework.com.common.audit;

public class AuditEvent {

    private final String auditId;
    private final String projectId;
    private final String traceId;
    private final String requestId;
    private final String actorId;
    private final String actorRole;
    private final String menuCode;
    private final String pageId;
    private final String actionCode;
    private final String entityType;
    private final String entityId;
    private final String resultStatus;
    private final String reasonSummary;
    private final String beforeSummaryJson;
    private final String afterSummaryJson;
    private final String requestUri;
    private final String httpMethod;
    private final String ipAddress;
    private final String userAgent;

    private AuditEvent(Builder builder) {
        this.auditId = builder.auditId;
        this.projectId = builder.projectId;
        this.traceId = builder.traceId;
        this.requestId = builder.requestId;
        this.actorId = builder.actorId;
        this.actorRole = builder.actorRole;
        this.menuCode = builder.menuCode;
        this.pageId = builder.pageId;
        this.actionCode = builder.actionCode;
        this.entityType = builder.entityType;
        this.entityId = builder.entityId;
        this.resultStatus = builder.resultStatus;
        this.reasonSummary = builder.reasonSummary;
        this.beforeSummaryJson = builder.beforeSummaryJson;
        this.afterSummaryJson = builder.afterSummaryJson;
        this.requestUri = builder.requestUri;
        this.httpMethod = builder.httpMethod;
        this.ipAddress = builder.ipAddress;
        this.userAgent = builder.userAgent;
    }

    public static Builder builder() {
        return new Builder();
    }

    public String getAuditId() { return auditId; }
    public String getProjectId() { return projectId; }
    public String getTraceId() { return traceId; }
    public String getRequestId() { return requestId; }
    public String getActorId() { return actorId; }
    public String getActorRole() { return actorRole; }
    public String getMenuCode() { return menuCode; }
    public String getPageId() { return pageId; }
    public String getActionCode() { return actionCode; }
    public String getEntityType() { return entityType; }
    public String getEntityId() { return entityId; }
    public String getResultStatus() { return resultStatus; }
    public String getReasonSummary() { return reasonSummary; }
    public String getBeforeSummaryJson() { return beforeSummaryJson; }
    public String getAfterSummaryJson() { return afterSummaryJson; }
    public String getRequestUri() { return requestUri; }
    public String getHttpMethod() { return httpMethod; }
    public String getIpAddress() { return ipAddress; }
    public String getUserAgent() { return userAgent; }

    public static final class Builder {
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
        private String resultStatus;
        private String reasonSummary;
        private String beforeSummaryJson;
        private String afterSummaryJson;
        private String requestUri;
        private String httpMethod;
        private String ipAddress;
        private String userAgent;

        public Builder auditId(String auditId) { this.auditId = auditId; return this; }
        public Builder projectId(String projectId) { this.projectId = projectId; return this; }
        public Builder traceId(String traceId) { this.traceId = traceId; return this; }
        public Builder requestId(String requestId) { this.requestId = requestId; return this; }
        public Builder actorId(String actorId) { this.actorId = actorId; return this; }
        public Builder actorRole(String actorRole) { this.actorRole = actorRole; return this; }
        public Builder menuCode(String menuCode) { this.menuCode = menuCode; return this; }
        public Builder pageId(String pageId) { this.pageId = pageId; return this; }
        public Builder actionCode(String actionCode) { this.actionCode = actionCode; return this; }
        public Builder entityType(String entityType) { this.entityType = entityType; return this; }
        public Builder entityId(String entityId) { this.entityId = entityId; return this; }
        public Builder resultStatus(String resultStatus) { this.resultStatus = resultStatus; return this; }
        public Builder reasonSummary(String reasonSummary) { this.reasonSummary = reasonSummary; return this; }
        public Builder beforeSummaryJson(String beforeSummaryJson) { this.beforeSummaryJson = beforeSummaryJson; return this; }
        public Builder afterSummaryJson(String afterSummaryJson) { this.afterSummaryJson = afterSummaryJson; return this; }
        public Builder requestUri(String requestUri) { this.requestUri = requestUri; return this; }
        public Builder httpMethod(String httpMethod) { this.httpMethod = httpMethod; return this; }
        public Builder ipAddress(String ipAddress) { this.ipAddress = ipAddress; return this; }
        public Builder userAgent(String userAgent) { this.userAgent = userAgent; return this; }

        public AuditEvent build() {
            return new AuditEvent(this);
        }
    }
}
