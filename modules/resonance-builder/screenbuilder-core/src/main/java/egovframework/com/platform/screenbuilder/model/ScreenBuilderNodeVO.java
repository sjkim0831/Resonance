package egovframework.com.platform.screenbuilder.model;

import lombok.Getter;
import lombok.Setter;

import java.util.LinkedHashMap;
import java.util.Map;

@Getter
@Setter
public class ScreenBuilderNodeVO {

    private String nodeId;
    private String componentId;
    private String parentNodeId;
    private String componentType;
    private String slotName;
    private int sortOrder;
    private Map<String, Object> props = new LinkedHashMap<>();
}
