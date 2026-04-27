package egovframework.com.platform.screenbuilder.model;

import lombok.Getter;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
public class ScreenBuilderComponentRegistryUpdateRequestVO {

    private String componentId;
    private String componentType;
    private String label;
    private String labelEn;
    private String description;
    private String status;
    private String replacementComponentId;
    private String menuCode;
    private Map<String, Object> propsTemplate;
}
