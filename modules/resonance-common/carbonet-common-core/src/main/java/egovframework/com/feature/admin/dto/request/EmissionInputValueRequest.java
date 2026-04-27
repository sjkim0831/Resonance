package egovframework.com.feature.admin.dto.request;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class EmissionInputValueRequest {

    private String varCode;
    private Integer lineNo;
    private Double valueNum;
    private String valueText;
}
