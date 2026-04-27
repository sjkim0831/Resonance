package egovframework.com.platform.screenbuilder.model;

import lombok.Getter;
import lombok.Setter;

import java.util.LinkedHashMap;
import java.util.Map;

@Getter
@Setter
public class ScreenBuilderComponentRegistrySaveRequestVO {

    private String menuCode;
    private String pageId;
    private String nodeId;
    private String componentId;
    private String componentType;
    private String label;
    private String labelEn;
    private String description;
    private Map<String, Object> propsTemplate = new LinkedHashMap<>();
}
