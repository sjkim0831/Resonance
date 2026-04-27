package egovframework.com.feature.admin.dto.request;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminEmissionGwpValueSaveRequestDTO {

    private String rowId;
    private String sectionCode;
    private String commonName;
    private String formula;
    private String ar4Value;
    private String ar5Value;
    private String ar6Value;
    private String source;
    private String manualInputValue;
    private String note;
    private Integer sortOrder;
}
