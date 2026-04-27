package egovframework.com.platform.runtimecontrol.model;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.util.List;
import java.util.Map;

@Getter
@Setter
public class ModuleBindingPreviewRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    private String traceId;
    private String projectId;
    private String scenarioFamilyId;
    private String scenarioId;
    private String guidedStateId;
    private String pageAssemblyId;
    private String templateLineId;
    private String screenFamilyRuleId;
    private String themeSetId;
    private String installableModuleId;
    private String modulePatternFamilyId;
    private String moduleDepthProfileId;
    private String selectionMode;
    private String operatorId;
    private String frontendImpactSummary;
    private String backendImpactSummary;
    private String dbImpactSummary;
    private String cssImpactSummary;
    private Map<String, Object> runtimePackageAttachPreview;
    private String rollbackPlanSummary;
    private Integer blockingIssueCount;
    private List<Map<String, Object>> blockingIssueSet;
    private Boolean readyForApplyYn;
    private Map<String, Object> previewPayload;
}
