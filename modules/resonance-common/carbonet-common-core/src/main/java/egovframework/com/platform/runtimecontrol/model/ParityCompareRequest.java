package egovframework.com.platform.runtimecontrol.model;

import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Getter
@Setter
public class ParityCompareRequest {

    private String projectId;
    private String guidedStateId;
    private String templateLineId;
    private String screenFamilyRuleId;
    private String ownerLane;
    private String selectedScreenId;
    private String releaseUnitId;
    private String compareBaseline;
    private String requestedBy;
    private String requestedByType;
    private List<String> selectedElementSet;
    private Map<String, Object> builderInput;
    private Map<String, Object> runtimeEvidence;
}
