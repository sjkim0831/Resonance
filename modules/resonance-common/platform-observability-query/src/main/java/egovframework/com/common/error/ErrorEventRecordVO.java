package egovframework.com.common.error;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ErrorEventRecordVO {

    private String errorId;
    private String projectId;
    private String traceId;
    private String requestId;
    private String pageId;
    private String apiId;
    private String sourceType;
    private String errorType;
    private String actorId;
    private String actorRole;
    private String actorInsttId;
    private String requestUri;
    private String remoteAddr;
    private String message;
    private String stackSummary;
    private String resultStatus;
    private String userAgent;
    private String createdAt;

    public String getErrorId() {
        return errorId;
    }

    public String getProjectId() {
        return projectId;
    }

    public String getTraceId() {
        return traceId;
    }

    public String getRequestId() {
        return requestId;
    }

    public String getPageId() {
        return pageId;
    }

    public String getApiId() {
        return apiId;
    }

    public String getSourceType() {
        return sourceType;
    }

    public String getErrorType() {
        return errorType;
    }

    public String getActorId() {
        return actorId;
    }

    public String getActorRole() {
        return actorRole;
    }

    public String getActorInsttId() {
        return actorInsttId;
    }

    public String getRequestUri() {
        return requestUri;
    }

    public String getRemoteAddr() {
        return remoteAddr;
    }

    public String getMessage() {
        return message;
    }

    public String getStackSummary() {
        return stackSummary;
    }

    public String getResultStatus() {
        return resultStatus;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setErrorId(String errorId) {
        this.errorId = errorId;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }

    public void setTraceId(String traceId) {
        this.traceId = traceId;
    }

    public void setRequestId(String requestId) {
        this.requestId = requestId;
    }

    public void setPageId(String pageId) {
        this.pageId = pageId;
    }

    public void setApiId(String apiId) {
        this.apiId = apiId;
    }

    public void setSourceType(String sourceType) {
        this.sourceType = sourceType;
    }

    public void setErrorType(String errorType) {
        this.errorType = errorType;
    }

    public void setActorId(String actorId) {
        this.actorId = actorId;
    }

    public void setActorRole(String actorRole) {
        this.actorRole = actorRole;
    }

    public void setActorInsttId(String actorInsttId) {
        this.actorInsttId = actorInsttId;
    }

    public void setRequestUri(String requestUri) {
        this.requestUri = requestUri;
    }

    public void setRemoteAddr(String remoteAddr) {
        this.remoteAddr = remoteAddr;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public void setStackSummary(String stackSummary) {
        this.stackSummary = stackSummary;
    }

    public void setResultStatus(String resultStatus) {
        this.resultStatus = resultStatus;
    }

    public void setUserAgent(String userAgent) {
        this.userAgent = userAgent;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }
}
