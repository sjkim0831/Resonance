package egovframework.com.platform.versioncontrol.model;

import java.util.List;
import java.util.Map;

public class ProjectApplyUpgradeRequest {

    private String projectId;
    private List<Map<String, Object>> targetArtifactSet;
    private String operator;
    private String approvalNote;

    public String getProjectId() {
        return projectId;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }

    public List<Map<String, Object>> getTargetArtifactSet() {
        return targetArtifactSet;
    }

    public void setTargetArtifactSet(List<Map<String, Object>> targetArtifactSet) {
        this.targetArtifactSet = targetArtifactSet;
    }

    public String getOperator() {
        return operator;
    }

    public void setOperator(String operator) {
        this.operator = operator;
    }

    public String getApprovalNote() {
        return approvalNote;
    }

    public void setApprovalNote(String approvalNote) {
        this.approvalNote = approvalNote;
    }
}
