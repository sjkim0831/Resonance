package egovframework.com.platform.runtimecontrol.model;

import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Getter
@Setter
public class RepairApplyRequest {

    private String repairSessionId;
    private String projectId;
    private String releaseUnitId;
    private String guidedStateId;
    private String templateLineId;
    private String screenFamilyRuleId;
    private String ownerLane;
    private String selectedScreenId;
    private List<String> selectedElementSet;
    private String compareBaseline;
    private Map<String, Object> builderInput;
    private Map<String, Object> runtimeEvidence;
    private List<String> updatedAssetSet;
    private List<String> updatedBindingSet;
    private List<String> updatedThemeOrLayoutSet;
    private List<String> sqlDraftSet;
    private String publishMode;
    private String requestedBy;
    private String requestedByType;
    private String changeSummary;
}
