package egovframework.com.common.trace;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UiPageComponentDetailVO {

    private String mapId;
    private String pageId;
    private String layoutZone;
    private String componentId;
    private String instanceKey;
    private Integer displayOrder;
    private String conditionalRuleSummary;
    private String componentName;
    private String componentType;
    private String ownerDomain;
    private String propsSchemaJson;
    private String designReference;
}
