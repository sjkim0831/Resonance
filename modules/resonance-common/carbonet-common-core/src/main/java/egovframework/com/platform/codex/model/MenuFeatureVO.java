package egovframework.com.platform.codex.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MenuFeatureVO {

    private String menuCode;
    private String menuNm;
    private String menuNmEn;
    private String menuUrl;
    private String featureCode;
    private String featureNm;
    private String featureNmEn;
    private String featureDc;
    private String useAt;
    private int assignedRoleCount;
    private boolean unassignedToRole;
}
