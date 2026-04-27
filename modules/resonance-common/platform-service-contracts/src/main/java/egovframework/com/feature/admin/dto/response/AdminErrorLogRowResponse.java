package egovframework.com.feature.admin.dto.response;

public class AdminErrorLogRowResponse {

    private final String createdAt;
    private final String insttId;
    private final String companyName;
    private final String sourceType;
    private final String errorType;
    private final String actorId;
    private final String actorRole;
    private final String requestUri;
    private final String pageId;
    private final String apiId;
    private final String remoteAddr;
    private final String message;
    private final String resultStatus;

    public AdminErrorLogRowResponse(
            String createdAt,
            String insttId,
            String companyName,
            String sourceType,
            String errorType,
            String actorId,
            String actorRole,
            String requestUri,
            String pageId,
            String apiId,
            String remoteAddr,
            String message,
            String resultStatus) {
        this.createdAt = createdAt;
        this.insttId = insttId;
        this.companyName = companyName;
        this.sourceType = sourceType;
        this.errorType = errorType;
        this.actorId = actorId;
        this.actorRole = actorRole;
        this.requestUri = requestUri;
        this.pageId = pageId;
        this.apiId = apiId;
        this.remoteAddr = remoteAddr;
        this.message = message;
        this.resultStatus = resultStatus;
    }

    public String getCreatedAt() { return createdAt; }
    public String getInsttId() { return insttId; }
    public String getCompanyName() { return companyName; }
    public String getSourceType() { return sourceType; }
    public String getErrorType() { return errorType; }
    public String getActorId() { return actorId; }
    public String getActorRole() { return actorRole; }
    public String getRequestUri() { return requestUri; }
    public String getPageId() { return pageId; }
    public String getApiId() { return apiId; }
    public String getRemoteAddr() { return remoteAddr; }
    public String getMessage() { return message; }
    public String getResultStatus() { return resultStatus; }
}
