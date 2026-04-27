package egovframework.com.framework.builder.model;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class FrameworkBuilderCompatibilityCheckResponseVO {

    private String compatibilityCheckRunId;
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
    private String compatibilityVerdict;
    private Integer blockingIssueCount;
    private Integer warningCount;
    private String requestedBy;
    private String startedAt;
    private String completedAt;
    private List<FrameworkBuilderCompatibilityResultItemVO> resultItems = new ArrayList<>();
}
