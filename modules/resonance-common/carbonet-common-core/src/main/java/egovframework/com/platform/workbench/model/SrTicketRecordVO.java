package egovframework.com.platform.workbench.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SrTicketRecordVO {

    private String ticketId;
    private String status;
    private String createdAt;
    private String updatedAt;
    private String createdBy;
    private String lastActionBy;
    private String approvedBy;
    private String approvedAt;
    private String approvalComment;
    private String executionPreparedAt;
    private String executionPreparedBy;
    private String executionStatus;
    private String executionComment;
    private String queueStatus;
    private String queueMode;
    private String queueSubmittedAt;
    private String queueStartedAt;
    private String queueCompletedAt;
    private String queueRequestedBy;
    private String queueLaneId;
    private String queueTmuxSessionName;
    private String queueErrorMessage;
    private String pageId;
    private String pageLabel;
    private String routePath;
    private String menuCode;
    private String menuLookupUrl;
    private String surfaceId;
    private String surfaceLabel;
    private String eventId;
    private String eventLabel;
    private String targetId;
    private String targetLabel;
    private String summary;
    private String instruction;
    private String technicalContext;
    private String generatedDirection;
    private String commandPrompt;
    private String planRunId;
    private String planStartedAt;
    private String planCompletedAt;
    private String planLogPath;
    private String planStderrPath;
    private String planResultPath;
    private String executionRunId;
    private String executionStartedAt;
    private String executionStartedBy;
    private String executionCompletedAt;
    private String executionCompletedBy;
    private String executionLogPath;
    private String executionStderrPath;
    private String executionDiffPath;
    private String executionChangedFiles;
    private String executionWorktreePath;
    private String backendVerifyLogPath;
    private String backendVerifyStderrPath;
    private String frontendVerifyLogPath;
    private String frontendVerifyStderrPath;
    private String deployLogPath;
    private String deployStderrPath;
    private Integer backendVerifyExitCode;
    private Integer frontendVerifyExitCode;
    private Integer deployExitCode;
    private String deployCommand;
    private String healthCheckStatus;
    private String rollbackStatus;
    private String rollbackLogPath;
    private String rollbackStderrPath;

    public void setTicketId(String ticketId) { this.ticketId = ticketId; }
    public void setStatus(String status) { this.status = status; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public void setLastActionBy(String lastActionBy) { this.lastActionBy = lastActionBy; }
    public void setApprovedBy(String approvedBy) { this.approvedBy = approvedBy; }
    public void setApprovedAt(String approvedAt) { this.approvedAt = approvedAt; }
    public void setApprovalComment(String approvalComment) { this.approvalComment = approvalComment; }
    public void setExecutionPreparedAt(String executionPreparedAt) { this.executionPreparedAt = executionPreparedAt; }
    public void setExecutionPreparedBy(String executionPreparedBy) { this.executionPreparedBy = executionPreparedBy; }
    public void setExecutionStatus(String executionStatus) { this.executionStatus = executionStatus; }
    public void setExecutionComment(String executionComment) { this.executionComment = executionComment; }
    public void setQueueStatus(String queueStatus) { this.queueStatus = queueStatus; }
    public void setQueueMode(String queueMode) { this.queueMode = queueMode; }
    public void setQueueSubmittedAt(String queueSubmittedAt) { this.queueSubmittedAt = queueSubmittedAt; }
    public void setQueueStartedAt(String queueStartedAt) { this.queueStartedAt = queueStartedAt; }
    public void setQueueCompletedAt(String queueCompletedAt) { this.queueCompletedAt = queueCompletedAt; }
    public void setQueueRequestedBy(String queueRequestedBy) { this.queueRequestedBy = queueRequestedBy; }
    public void setQueueLaneId(String queueLaneId) { this.queueLaneId = queueLaneId; }
    public void setQueueTmuxSessionName(String queueTmuxSessionName) { this.queueTmuxSessionName = queueTmuxSessionName; }
    public void setQueueErrorMessage(String queueErrorMessage) { this.queueErrorMessage = queueErrorMessage; }
    public void setPageId(String pageId) { this.pageId = pageId; }
    public void setPageLabel(String pageLabel) { this.pageLabel = pageLabel; }
    public void setRoutePath(String routePath) { this.routePath = routePath; }
    public void setMenuCode(String menuCode) { this.menuCode = menuCode; }
    public void setMenuLookupUrl(String menuLookupUrl) { this.menuLookupUrl = menuLookupUrl; }
    public void setSurfaceId(String surfaceId) { this.surfaceId = surfaceId; }
    public void setSurfaceLabel(String surfaceLabel) { this.surfaceLabel = surfaceLabel; }
    public void setEventId(String eventId) { this.eventId = eventId; }
    public void setEventLabel(String eventLabel) { this.eventLabel = eventLabel; }
    public void setTargetId(String targetId) { this.targetId = targetId; }
    public void setTargetLabel(String targetLabel) { this.targetLabel = targetLabel; }
    public void setSummary(String summary) { this.summary = summary; }
    public void setInstruction(String instruction) { this.instruction = instruction; }
    public void setTechnicalContext(String technicalContext) { this.technicalContext = technicalContext; }
    public void setGeneratedDirection(String generatedDirection) { this.generatedDirection = generatedDirection; }
    public void setCommandPrompt(String commandPrompt) { this.commandPrompt = commandPrompt; }
    public void setPlanRunId(String planRunId) { this.planRunId = planRunId; }
    public void setPlanStartedAt(String planStartedAt) { this.planStartedAt = planStartedAt; }
    public void setPlanCompletedAt(String planCompletedAt) { this.planCompletedAt = planCompletedAt; }
    public void setPlanLogPath(String planLogPath) { this.planLogPath = planLogPath; }
    public void setPlanStderrPath(String planStderrPath) { this.planStderrPath = planStderrPath; }
    public void setPlanResultPath(String planResultPath) { this.planResultPath = planResultPath; }
    public void setExecutionRunId(String executionRunId) { this.executionRunId = executionRunId; }
    public void setExecutionStartedAt(String executionStartedAt) { this.executionStartedAt = executionStartedAt; }
    public void setExecutionStartedBy(String executionStartedBy) { this.executionStartedBy = executionStartedBy; }
    public void setExecutionCompletedAt(String executionCompletedAt) { this.executionCompletedAt = executionCompletedAt; }
    public void setExecutionCompletedBy(String executionCompletedBy) { this.executionCompletedBy = executionCompletedBy; }
    public void setExecutionLogPath(String executionLogPath) { this.executionLogPath = executionLogPath; }
    public void setExecutionStderrPath(String executionStderrPath) { this.executionStderrPath = executionStderrPath; }
    public void setExecutionDiffPath(String executionDiffPath) { this.executionDiffPath = executionDiffPath; }
    public void setExecutionChangedFiles(String executionChangedFiles) { this.executionChangedFiles = executionChangedFiles; }
    public void setExecutionWorktreePath(String executionWorktreePath) { this.executionWorktreePath = executionWorktreePath; }
    public void setBackendVerifyLogPath(String backendVerifyLogPath) { this.backendVerifyLogPath = backendVerifyLogPath; }
    public void setBackendVerifyStderrPath(String backendVerifyStderrPath) { this.backendVerifyStderrPath = backendVerifyStderrPath; }
    public void setFrontendVerifyLogPath(String frontendVerifyLogPath) { this.frontendVerifyLogPath = frontendVerifyLogPath; }
    public void setFrontendVerifyStderrPath(String frontendVerifyStderrPath) { this.frontendVerifyStderrPath = frontendVerifyStderrPath; }
    public void setDeployLogPath(String deployLogPath) { this.deployLogPath = deployLogPath; }
    public void setDeployStderrPath(String deployStderrPath) { this.deployStderrPath = deployStderrPath; }
    public void setBackendVerifyExitCode(Integer backendVerifyExitCode) { this.backendVerifyExitCode = backendVerifyExitCode; }
    public void setFrontendVerifyExitCode(Integer frontendVerifyExitCode) { this.frontendVerifyExitCode = frontendVerifyExitCode; }
    public void setDeployExitCode(Integer deployExitCode) { this.deployExitCode = deployExitCode; }
    public void setDeployCommand(String deployCommand) { this.deployCommand = deployCommand; }
    public void setHealthCheckStatus(String healthCheckStatus) { this.healthCheckStatus = healthCheckStatus; }
    public void setRollbackStatus(String rollbackStatus) { this.rollbackStatus = rollbackStatus; }
    public void setRollbackLogPath(String rollbackLogPath) { this.rollbackLogPath = rollbackLogPath; }
    public void setRollbackStderrPath(String rollbackStderrPath) { this.rollbackStderrPath = rollbackStderrPath; }
}
