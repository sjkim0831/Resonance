package egovframework.com.framework.builder.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FrameworkBuilderCompatibilityCheckRequestVO {

    private String projectId;
    private String pageId;
    private String scenarioId;
    private String guidedStateId;
    private String screenFamilyRuleId;
    private String templateLineId;
    private String builderVersion;
    private String builderRulePackVersion;
    private String templatePackVersion;
    private String sourceContractVersion;
    private String overlaySchemaVersion;
    private String overlaySetId;
    private String migrationPlanId;
    private String checkScope;
    private String requestedBy;
}
