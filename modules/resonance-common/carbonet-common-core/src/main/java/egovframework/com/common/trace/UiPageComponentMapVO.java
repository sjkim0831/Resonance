package egovframework.com.common.trace;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UiPageComponentMapVO {

    private String mapId;
    private String pageId;
    private String layoutZone;
    private String componentId;
    private String instanceKey;
    private Integer displayOrder;
    private String conditionalRuleSummary;
}
