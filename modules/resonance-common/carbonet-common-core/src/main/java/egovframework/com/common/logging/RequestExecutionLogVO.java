package egovframework.com.common.logging;

public class RequestExecutionLogVO {

    private String logId;
    private String executedAt;
    private String requestUri;
    private String traceId;
    private String requestId;
    private String menuCode;
    private String featureCode;
    private String httpMethod;
    private String featureType;
    private String actorUserId;
    private String actorType;
    private String actorAuthorCode;
    private String actorInsttId;
    private String remoteAddr;
    private String companyContextId;
    private String targetCompanyContextId;
    private boolean companyContextRequired;
    private boolean companyContextIncluded;
    private boolean companyContextExplicit;
    private String companyScopeDecision;
    private String companyScopeReason;
    private int responseStatus;
    private long durationMs;
    private String requestContentType;
    private String queryString;
    private String parameterSummary;
    private String errorMessage;

    public String getLogId() { return logId; }
    public void setLogId(String logId) { this.logId = logId; }
    public String getExecutedAt() { return executedAt; }
    public void setExecutedAt(String executedAt) { this.executedAt = executedAt; }
    public String getRequestUri() { return requestUri; }
    public void setRequestUri(String requestUri) { this.requestUri = requestUri; }
    public String getTraceId() { return traceId; }
    public void setTraceId(String traceId) { this.traceId = traceId; }
    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public String getMenuCode() { return menuCode; }
    public void setMenuCode(String menuCode) { this.menuCode = menuCode; }
    public String getFeatureCode() { return featureCode; }
    public void setFeatureCode(String featureCode) { this.featureCode = featureCode; }
    public String getHttpMethod() { return httpMethod; }
    public void setHttpMethod(String httpMethod) { this.httpMethod = httpMethod; }
    public String getFeatureType() { return featureType; }
    public void setFeatureType(String featureType) { this.featureType = featureType; }
    public String getActorUserId() { return actorUserId; }
    public void setActorUserId(String actorUserId) { this.actorUserId = actorUserId; }
    public String getActorType() { return actorType; }
    public void setActorType(String actorType) { this.actorType = actorType; }
    public String getActorAuthorCode() { return actorAuthorCode; }
    public void setActorAuthorCode(String actorAuthorCode) { this.actorAuthorCode = actorAuthorCode; }
    public String getActorInsttId() { return actorInsttId; }
    public void setActorInsttId(String actorInsttId) { this.actorInsttId = actorInsttId; }
    public String getRemoteAddr() { return remoteAddr; }
    public void setRemoteAddr(String remoteAddr) { this.remoteAddr = remoteAddr; }
    public String getCompanyContextId() { return companyContextId; }
    public void setCompanyContextId(String companyContextId) { this.companyContextId = companyContextId; }
    public String getTargetCompanyContextId() { return targetCompanyContextId; }
    public void setTargetCompanyContextId(String targetCompanyContextId) { this.targetCompanyContextId = targetCompanyContextId; }
    public boolean isCompanyContextRequired() { return companyContextRequired; }
    public void setCompanyContextRequired(boolean companyContextRequired) { this.companyContextRequired = companyContextRequired; }
    public boolean isCompanyContextIncluded() { return companyContextIncluded; }
    public void setCompanyContextIncluded(boolean companyContextIncluded) { this.companyContextIncluded = companyContextIncluded; }
    public boolean isCompanyContextExplicit() { return companyContextExplicit; }
    public void setCompanyContextExplicit(boolean companyContextExplicit) { this.companyContextExplicit = companyContextExplicit; }
    public String getCompanyScopeDecision() { return companyScopeDecision; }
    public void setCompanyScopeDecision(String companyScopeDecision) { this.companyScopeDecision = companyScopeDecision; }
    public String getCompanyScopeReason() { return companyScopeReason; }
    public void setCompanyScopeReason(String companyScopeReason) { this.companyScopeReason = companyScopeReason; }
    public int getResponseStatus() { return responseStatus; }
    public void setResponseStatus(int responseStatus) { this.responseStatus = responseStatus; }
    public long getDurationMs() { return durationMs; }
    public void setDurationMs(long durationMs) { this.durationMs = durationMs; }
    public String getRequestContentType() { return requestContentType; }
    public void setRequestContentType(String requestContentType) { this.requestContentType = requestContentType; }
    public String getQueryString() { return queryString; }
    public void setQueryString(String queryString) { this.queryString = queryString; }
    public String getParameterSummary() { return parameterSummary; }
    public void setParameterSummary(String parameterSummary) { this.parameterSummary = parameterSummary; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
}
