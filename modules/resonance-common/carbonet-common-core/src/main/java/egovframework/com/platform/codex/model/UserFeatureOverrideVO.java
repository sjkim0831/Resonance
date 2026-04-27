package egovframework.com.platform.codex.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UserFeatureOverrideVO {

    private String scrtyDtrmnTrgetId;
    private String mberTyCode;
    private String featureCode;
    private String overrideType;
    private String useAt;

    public String getFeatureCode() {
        return featureCode;
    }

    public String getOverrideType() {
        return overrideType;
    }
}
