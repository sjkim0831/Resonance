package egovframework.com.platform.versioncontrol.model;

public class ProjectRollbackRequest {

    private String projectId;
    private String targetReleaseUnitId;
    private String operator;
    private String reason;

    public String getProjectId() {
        return projectId;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }

    public String getTargetReleaseUnitId() {
        return targetReleaseUnitId;
    }

    public void setTargetReleaseUnitId(String targetReleaseUnitId) {
        this.targetReleaseUnitId = targetReleaseUnitId;
    }

    public String getOperator() {
        return operator;
    }

    public void setOperator(String operator) {
        this.operator = operator;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
