package egovframework.com.common.logging;

public class AccessEventRecordVO {

    private String eventId;
    private String projectId;
    private String traceId;
    private String requestId;
    private String pageId;
    private String apiId;
    private String requestUri;
    private String httpMethod;
    private String featureType;
    private String actorId;
    private String actorType;
    private String actorRole;
    private String actorInsttId;
    private String companyContextId;
    private String targetCompanyContextId;
    private String remoteAddr;
    private Integer responseStatus;
    private Integer durationMs;
    private String requestContentType;
    private String queryString;
    private String parameterSummary;
    private String errorMessage;
    private String companyScopeDecision;
    private String companyScopeReason;
    private String createdAt;

    public String getEventId() { return eventId; }
    public void setEventId(String eventId) { this.eventId = eventId; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getTraceId() { return traceId; }
    public void setTraceId(String traceId) { this.traceId = traceId; }
    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public String getPageId() { return pageId; }
    public void setPageId(String pageId) { this.pageId = pageId; }
    public String getApiId() { return apiId; }
    public void setApiId(String apiId) { this.apiId = apiId; }
    public String getRequestUri() { return requestUri; }
    public void setRequestUri(String requestUri) { this.requestUri = requestUri; }
    public String getHttpMethod() { return httpMethod; }
    public void setHttpMethod(String httpMethod) { this.httpMethod = httpMethod; }
    public String getFeatureType() { return featureType; }
    public void setFeatureType(String featureType) { this.featureType = featureType; }
    public String getActorId() { return actorId; }
    public void setActorId(String actorId) { this.actorId = actorId; }
    public String getActorType() { return actorType; }
    public void setActorType(String actorType) { this.actorType = actorType; }
    public String getActorRole() { return actorRole; }
    public void setActorRole(String actorRole) { this.actorRole = actorRole; }
    public String getActorInsttId() { return actorInsttId; }
    public void setActorInsttId(String actorInsttId) { this.actorInsttId = actorInsttId; }
    public String getCompanyContextId() { return companyContextId; }
    public void setCompanyContextId(String companyContextId) { this.companyContextId = companyContextId; }
    public String getTargetCompanyContextId() { return targetCompanyContextId; }
    public void setTargetCompanyContextId(String targetCompanyContextId) { this.targetCompanyContextId = targetCompanyContextId; }
    public String getRemoteAddr() { return remoteAddr; }
    public void setRemoteAddr(String remoteAddr) { this.remoteAddr = remoteAddr; }
    public Integer getResponseStatus() { return responseStatus; }
    public void setResponseStatus(Integer responseStatus) { this.responseStatus = responseStatus; }
    public Integer getDurationMs() { return durationMs; }
    public void setDurationMs(Integer durationMs) { this.durationMs = durationMs; }
    public String getRequestContentType() { return requestContentType; }
    public void setRequestContentType(String requestContentType) { this.requestContentType = requestContentType; }
    public String getQueryString() { return queryString; }
    public void setQueryString(String queryString) { this.queryString = queryString; }
    public String getParameterSummary() { return parameterSummary; }
    public void setParameterSummary(String parameterSummary) { this.parameterSummary = parameterSummary; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public String getCompanyScopeDecision() { return companyScopeDecision; }
    public void setCompanyScopeDecision(String companyScopeDecision) { this.companyScopeDecision = companyScopeDecision; }
    public String getCompanyScopeReason() { return companyScopeReason; }
    public void setCompanyScopeReason(String companyScopeReason) { this.companyScopeReason = companyScopeReason; }
    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
