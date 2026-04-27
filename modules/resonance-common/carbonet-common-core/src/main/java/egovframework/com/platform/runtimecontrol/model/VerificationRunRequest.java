package egovframework.com.platform.runtimecontrol.model;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.util.List;
import java.util.Map;

@Getter
@Setter
public class VerificationRunRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    private String traceId;
    private String projectId;
    private String scenarioFamilyId;
    private String menuId;
    private String guidedStateId;
    private String templateLineId;
    private String ownerLane;
    private String targetRuntime;
    private String releaseUnitId;
    private String screenFamilyRuleId;
    private String selectedScreenId;
    private List<String> selectedElementSet;
    private String compareBaseline;
    private String pageId;
    private String routeId;
    private String shellProfileId;
    private String pageFrameId;
    private String componentCoverageState;
    private String bindingCoverageState;
    private String backendChainState;
    private String helpSecurityState;
    private String result;
    private Integer blockerCount;
    private Boolean verifyShellYn;
    private Boolean verifyComponentYn;
    private Boolean verifyBindingYn;
    private Boolean verifyBackendYn;
    private Boolean verifyHelpSecurityYn;
    private String requestedBy;
    private String requestedByType;
    private List<Map<String, Object>> blockerSet;
    private Map<String, Object> resultPayload;
}
