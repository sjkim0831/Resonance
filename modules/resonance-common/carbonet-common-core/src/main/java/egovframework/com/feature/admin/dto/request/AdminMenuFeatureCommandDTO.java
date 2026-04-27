package egovframework.com.feature.admin.dto.request;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminMenuFeatureCommandDTO {

    private String codeId;
    private String menuCode;
    private String featureCode;
    private String featureNm;
    private String featureNmEn;
    private String featureDc;
    private String searchKeyword;
    private String useAt;
}
