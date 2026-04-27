package egovframework.com.framework.builder.model;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class FrameworkBuilderComponentContractVO {

    private String componentId;
    private String label;
    private String componentType;
    private String ownerDomain;
    private String status;
    private String sourceType;
    private String replacementComponentId;
    private String designReference;
    private String propsSchemaJson;
    private Integer usageCount;
    private Integer routeCount;
    private Integer instanceCount;
    private List<String> labels = new ArrayList<>();
    private Boolean builderReady;
}

