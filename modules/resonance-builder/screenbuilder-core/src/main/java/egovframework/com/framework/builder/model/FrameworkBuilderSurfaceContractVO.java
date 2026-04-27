package egovframework.com.framework.builder.model;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class FrameworkBuilderSurfaceContractVO {

    private String componentId;
    private String instanceKey;
    private String layoutZone;
    private Integer displayOrder;
    private List<String> propsSummary = new ArrayList<>();
    private String conditionalRuleSummary;
}

