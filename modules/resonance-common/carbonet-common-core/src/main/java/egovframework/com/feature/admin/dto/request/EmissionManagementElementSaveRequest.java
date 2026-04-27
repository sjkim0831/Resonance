package egovframework.com.feature.admin.dto.request;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class EmissionManagementElementSaveRequest {
    private String definitionId;
    private String elementKey;
    private String elementName;
    private String elementType;
    private String layoutZone;
    private String componentType;
    private String bindingTarget;
    private String defaultLabel;
    private String defaultLabelEn;
    private String description;
    private String variableScope;
    private String policyNote;
    private List<String> directRequiredCodes;
    private List<String> fallbackCodes;
    private List<String> autoCalculatedCodes;
    private String useYn;
    private List<String> tags;
}
