package egovframework.com.feature.admin.dto.request;

import lombok.Getter;
import lombok.Setter;

import java.util.Map;
import java.util.List;

@Getter
@Setter
public class EmissionDefinitionDraftSaveRequest {

    private String draftId;
    private String categoryCode;
    private String categoryName;
    private String tierLabel;
    private String formula;
    private List<Map<String, Object>> formulaTree;
    private String inputMode;
    private List<String> policies;
    private List<String> directRequiredCodes;
    private List<String> fallbackCodes;
    private List<String> autoCalculatedCodes;
    private List<String> supplementalCodes;
    private List<Map<String, Object>> sections;
    private List<Map<String, Object>> variableDefinitions;
    private String runtimeMode;
    private String note;
}
