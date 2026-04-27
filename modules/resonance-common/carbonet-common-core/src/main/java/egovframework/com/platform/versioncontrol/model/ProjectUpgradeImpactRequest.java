package egovframework.com.platform.versioncontrol.model;

import java.util.List;
import java.util.Map;

public class ProjectUpgradeImpactRequest {

    private String projectId;
    private List<Map<String, Object>> targetArtifactSet;
    private String operator;

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
}
