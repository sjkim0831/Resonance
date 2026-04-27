package egovframework.com.platform.screenbuilder.model;

import lombok.Getter;
import lombok.Setter;

import java.util.LinkedHashMap;
import java.util.Map;

@Getter
@Setter
public class ScreenBuilderComponentRegistryItemVO {

    private String componentId;
    private String componentType;
    private String label;
    private String labelEn;
    private String description;
    private String status;
    private String replacementComponentId;
    private String sourceType;
    private String createdAt;
    private String updatedAt;
    private Integer usageCount;
    private Map<String, Object> propsTemplate = new LinkedHashMap<>();
}
