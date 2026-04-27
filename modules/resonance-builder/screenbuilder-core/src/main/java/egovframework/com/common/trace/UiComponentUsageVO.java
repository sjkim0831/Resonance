package egovframework.com.common.trace;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UiComponentUsageVO {

    private String pageId;
    private String pageName;
    private String routePath;
    private String menuCode;
    private String layoutZone;
    private String componentId;
    private String instanceKey;
    private Integer displayOrder;
    private String conditionalRuleSummary;
}
