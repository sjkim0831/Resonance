package egovframework.com.feature.admin.model.vo;

import java.util.List;
import java.util.Map;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class EmissionVariableDefinitionVO {

    private Long variableId;
    private Long categoryId;
    private Integer tier;
    private String varCode;
    private String varName;
    private String varDesc;
    private String unit;
    private String inputType;
    private String sourceType;
    private String repeatable;
    private String required;
    private Integer sortOrder;
    private String useYn;
    private String commonCodeId;
    private List<Map<String, String>> options;
    private String displayName;
    private String displayCode;
    private String uiHint;
    private String derivedYn;
    private String supplementalYn;
    private String repeatGroupKey;
    private String sectionId;
    private Integer sectionOrder;
    private String sectionTitle;
    private String sectionDescription;
    private String sectionFormula;
    private String sectionPreviewType;
    private String sectionRelatedFactorCodes;
    private String visibleWhen;
    private String disabledWhen;
}
