package egovframework.com.platform.codex.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FeatureAssignmentStatVO {

    private String featureCode;
    private int assignedRoleCount;

    public String getFeatureCode() {
        return featureCode;
    }

    public int getAssignedRoleCount() {
        return assignedRoleCount;
    }
}
