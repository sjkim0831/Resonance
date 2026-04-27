package egovframework.com.platform.runtimecontrol.model;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.util.List;
import java.util.Map;

@Getter
@Setter
public class ModuleBindingResultRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    private String moduleBindingPreviewId;
    private String traceId;
    private String projectId;
    private String scenarioFamilyId;
    private String scenarioId;
    private String guidedStateId;
    private String pageAssemblyId;
    private String templateLineId;
    private String screenFamilyRuleId;
    private String themeSetId;
    private String releaseUnitId;
    private String runtimePackageId;
    private String generationRunId;
    private List<Map<String, Object>> jsonRevisionSet;
    private Boolean selectionAppliedYn;
    private List<String> appliedModuleSet;
    private List<String> attachedPageAssetSet;
    private List<String> attachedComponentAssetSet;
    private List<String> attachedBackendAssetSet;
    private List<String> attachedDbAssetSet;
    private String runtimePackageImpactSummary;
    private Map<String, Object> releaseBlockerDelta;
    private String followUpChecklistSummary;
    private Boolean repairNeededYn;
    private Integer repairQueueCount;
    private String repairSessionCandidateId;
    private String compareContextId;
    private List<String> publishedAssetTraceSet;
    private List<Map<String, Object>> traceLinkSet;
    private String nextRecommendedAction;
    private Boolean rollbackAnchorYn;
    private String operatorId;
    private Map<String, Object> resultPayload;
}
