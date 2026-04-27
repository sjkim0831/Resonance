package egovframework.com.feature.admin.dto.response;

public class AdminAccessHistoryRowResponse {

    private final String executedAt;
    private final String insttId;
    private final String companyName;
    private final String actorUserId;
    private final String actorType;
    private final String actorAuthorCode;
    private final String requestUri;
    private final String httpMethod;
    private final Object responseStatus;
    private final Object durationMs;
    private final String remoteAddr;
    private final String featureType;
    private final String companyScopeDecision;
    private final String pageId;
    private final String apiId;

    public AdminAccessHistoryRowResponse(
            String executedAt,
            String insttId,
            String companyName,
            String actorUserId,
            String actorType,
            String actorAuthorCode,
            String requestUri,
            String httpMethod,
            Object responseStatus,
            Object durationMs,
            String remoteAddr,
            String featureType,
            String companyScopeDecision,
            String pageId,
            String apiId) {
        this.executedAt = executedAt;
        this.insttId = insttId;
        this.companyName = companyName;
        this.actorUserId = actorUserId;
        this.actorType = actorType;
        this.actorAuthorCode = actorAuthorCode;
        this.requestUri = requestUri;
        this.httpMethod = httpMethod;
        this.responseStatus = responseStatus;
        this.durationMs = durationMs;
        this.remoteAddr = remoteAddr;
        this.featureType = featureType;
        this.companyScopeDecision = companyScopeDecision;
        this.pageId = pageId;
        this.apiId = apiId;
    }

    public String getExecutedAt() { return executedAt; }
    public String getInsttId() { return insttId; }
    public String getCompanyName() { return companyName; }
    public String getActorUserId() { return actorUserId; }
    public String getActorType() { return actorType; }
    public String getActorAuthorCode() { return actorAuthorCode; }
    public String getRequestUri() { return requestUri; }
    public String getHttpMethod() { return httpMethod; }
    public Object getResponseStatus() { return responseStatus; }
    public Object getDurationMs() { return durationMs; }
    public String getRemoteAddr() { return remoteAddr; }
    public String getFeatureType() { return featureType; }
    public String getCompanyScopeDecision() { return companyScopeDecision; }
    public String getPageId() { return pageId; }
    public String getApiId() { return apiId; }
}
