package egovframework.com.feature.admin.dto.request;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminEmissionLciClassificationSaveRequestDTO {

    private String originalCode;
    private String code;
    private String label;
    private String tierLabel;
    private String aliases;
    private String useAt;
}
