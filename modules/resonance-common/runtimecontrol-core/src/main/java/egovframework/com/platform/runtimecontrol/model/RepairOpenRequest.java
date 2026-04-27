package egovframework.com.platform.runtimecontrol.model;

import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Getter
@Setter
public class RepairOpenRequest {

    private String projectId;
    private String releaseUnitId;
    private String guidedStateId;
    private String templateLineId;
    private String screenFamilyRuleId;
    private String ownerLane;
    private String selectedScreenId;
    private List<String> selectedElementSet;
    private String compareBaseline;
    private String reasonCode;
    private List<String> existingAssetReuseSet;
    private String requestedBy;
    private String requestedByType;
    private String requestNote;
    private Map<String, Object> builderInput;
    private Map<String, Object> runtimeEvidence;
}
