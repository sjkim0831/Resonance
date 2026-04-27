package egovframework.com.platform.runtimecontrol.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ProjectPipelineRunRequest {

    private String projectId;
    private String scenarioId;
    private String guidedStateId;
    private String templateLineId;
    private String screenFamilyRuleId;
    private String ownerLane;
    private String menuRoot;
    private String runtimeClass;
    private String menuScope;
    private String releaseUnitId;
    private String runtimePackageId;
    private String releaseUnitPrefix;
    private String runtimePackagePrefix;
    private String artifactTargetSystem;
    private String deploymentTarget;
    private String operator;
}
