package egovframework.com.common.trace;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UiComponentRegistryVO {

    private String componentId;
    private String componentName;
    private String componentType;
    private String ownerDomain;
    private String propsSchemaJson;
    private String designReference;
    private String activeYn;
    private String createdAt;
    private String updatedAt;
}
