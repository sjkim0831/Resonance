package egovframework.com.feature.admin.dto.response;

public class SystemAccessHistoryRowResponse {

    private final String logId;
    private final String executedAt;
    private final String requestUri;
    private final String httpMethod;
    private final String featureType;
    private final String actorUserId;
    private final String actorType;
    private final String actorAuthorCode;
    private final String actorInsttId;
    private final String insttId;
    private final String companyContextId;
    private final String targetCompanyContextId;
    private final int responseStatus;
    private final long durationMs;
    private final String errorMessage;
    private final String remoteAddr;
    private final String companyName;

    public SystemAccessHistoryRowResponse(
            String logId,
            String executedAt,
            String requestUri,
            String httpMethod,
            String featureType,
            String actorUserId,
            String actorType,
            String actorAuthorCode,
            String actorInsttId,
            String insttId,
            String companyContextId,
            String targetCompanyContextId,
            int responseStatus,
            long durationMs,
            String errorMessage,
            String remoteAddr,
            String companyName) {
        this.logId = logId;
        this.executedAt = executedAt;
        this.requestUri = requestUri;
        this.httpMethod = httpMethod;
        this.featureType = featureType;
        this.actorUserId = actorUserId;
        this.actorType = actorType;
        this.actorAuthorCode = actorAuthorCode;
        this.actorInsttId = actorInsttId;
        this.insttId = insttId;
        this.companyContextId = companyContextId;
        this.targetCompanyContextId = targetCompanyContextId;
        this.responseStatus = responseStatus;
        this.durationMs = durationMs;
        this.errorMessage = errorMessage;
        this.remoteAddr = remoteAddr;
        this.companyName = companyName;
    }

    public String getLogId() { return logId; }
    public String getExecutedAt() { return executedAt; }
    public String getRequestUri() { return requestUri; }
    public String getHttpMethod() { return httpMethod; }
    public String getFeatureType() { return featureType; }
    public String getActorUserId() { return actorUserId; }
    public String getActorType() { return actorType; }
    public String getActorAuthorCode() { return actorAuthorCode; }
    public String getActorInsttId() { return actorInsttId; }
    public String getInsttId() { return insttId; }
    public String getCompanyContextId() { return companyContextId; }
    public String getTargetCompanyContextId() { return targetCompanyContextId; }
    public int getResponseStatus() { return responseStatus; }
    public long getDurationMs() { return durationMs; }
    public String getErrorMessage() { return errorMessage; }
    public String getRemoteAddr() { return remoteAddr; }
    public String getCompanyName() { return companyName; }
}
