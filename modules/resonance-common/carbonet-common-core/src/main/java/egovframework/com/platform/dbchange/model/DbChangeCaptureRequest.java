package egovframework.com.platform.dbchange.model;

public class DbChangeCaptureRequest {

    private String projectId;
    private String menuCode;
    private String pageId;
    private String apiPath;
    private String httpMethod;
    private String actorId;
    private String actorRole;
    private String actorScopeId;
    private String targetTableName;
    private String targetPkJson;
    private String entityType;
    private String entityId;
    private String changeType;
    private String beforeSummaryJson;
    private String afterSummaryJson;
    private String changeSummary;
    private String patchFormatCode;
    private String patchKindCode;
    private String targetEnv;
    private String targetKeysJson;
    private String patchPayloadJson;
    private String renderedSqlPreview;
    private String riskLevel;
    private String logicalObjectId;
    private String sourceEnv;
    private String baseRevision;
    private String renameFromKeyJson;
    private String renameToKeyJson;
    private String captureSequence;

    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getMenuCode() { return menuCode; }
    public void setMenuCode(String menuCode) { this.menuCode = menuCode; }
    public String getPageId() { return pageId; }
    public void setPageId(String pageId) { this.pageId = pageId; }
    public String getApiPath() { return apiPath; }
    public void setApiPath(String apiPath) { this.apiPath = apiPath; }
    public String getHttpMethod() { return httpMethod; }
    public void setHttpMethod(String httpMethod) { this.httpMethod = httpMethod; }
    public String getActorId() { return actorId; }
    public void setActorId(String actorId) { this.actorId = actorId; }
    public String getActorRole() { return actorRole; }
    public void setActorRole(String actorRole) { this.actorRole = actorRole; }
    public String getActorScopeId() { return actorScopeId; }
    public void setActorScopeId(String actorScopeId) { this.actorScopeId = actorScopeId; }
    public String getTargetTableName() { return targetTableName; }
    public void setTargetTableName(String targetTableName) { this.targetTableName = targetTableName; }
    public String getTargetPkJson() { return targetPkJson; }
    public void setTargetPkJson(String targetPkJson) { this.targetPkJson = targetPkJson; }
    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }
    public String getEntityId() { return entityId; }
    public void setEntityId(String entityId) { this.entityId = entityId; }
    public String getChangeType() { return changeType; }
    public void setChangeType(String changeType) { this.changeType = changeType; }
    public String getBeforeSummaryJson() { return beforeSummaryJson; }
    public void setBeforeSummaryJson(String beforeSummaryJson) { this.beforeSummaryJson = beforeSummaryJson; }
    public String getAfterSummaryJson() { return afterSummaryJson; }
    public void setAfterSummaryJson(String afterSummaryJson) { this.afterSummaryJson = afterSummaryJson; }
    public String getChangeSummary() { return changeSummary; }
    public void setChangeSummary(String changeSummary) { this.changeSummary = changeSummary; }
    public String getPatchFormatCode() { return patchFormatCode; }
    public void setPatchFormatCode(String patchFormatCode) { this.patchFormatCode = patchFormatCode; }
    public String getPatchKindCode() { return patchKindCode; }
    public void setPatchKindCode(String patchKindCode) { this.patchKindCode = patchKindCode; }
    public String getTargetEnv() { return targetEnv; }
    public void setTargetEnv(String targetEnv) { this.targetEnv = targetEnv; }
    public String getTargetKeysJson() { return targetKeysJson; }
    public void setTargetKeysJson(String targetKeysJson) { this.targetKeysJson = targetKeysJson; }
    public String getPatchPayloadJson() { return patchPayloadJson; }
    public void setPatchPayloadJson(String patchPayloadJson) { this.patchPayloadJson = patchPayloadJson; }
    public String getRenderedSqlPreview() { return renderedSqlPreview; }
    public void setRenderedSqlPreview(String renderedSqlPreview) { this.renderedSqlPreview = renderedSqlPreview; }
    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }
    public String getLogicalObjectId() { return logicalObjectId; }
    public void setLogicalObjectId(String logicalObjectId) { this.logicalObjectId = logicalObjectId; }
    public String getSourceEnv() { return sourceEnv; }
    public void setSourceEnv(String sourceEnv) { this.sourceEnv = sourceEnv; }
    public String getBaseRevision() { return baseRevision; }
    public void setBaseRevision(String baseRevision) { this.baseRevision = baseRevision; }
    public String getRenameFromKeyJson() { return renameFromKeyJson; }
    public void setRenameFromKeyJson(String renameFromKeyJson) { this.renameFromKeyJson = renameFromKeyJson; }
    public String getRenameToKeyJson() { return renameToKeyJson; }
    public void setRenameToKeyJson(String renameToKeyJson) { this.renameToKeyJson = renameToKeyJson; }
    public String getCaptureSequence() { return captureSequence; }
    public void setCaptureSequence(String captureSequence) { this.captureSequence = captureSequence; }
}
