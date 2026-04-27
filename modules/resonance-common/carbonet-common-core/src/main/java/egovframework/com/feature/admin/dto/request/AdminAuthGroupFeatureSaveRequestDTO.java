package egovframework.com.feature.admin.dto.request;

import java.util.ArrayList;
import java.util.List;

public class AdminAuthGroupFeatureSaveRequestDTO {

    private String authorCode;
    private String roleCategory;
    private List<String> featureCodes = new ArrayList<>();

    public String getAuthorCode() {
        return authorCode;
    }

    public void setAuthorCode(String authorCode) {
        this.authorCode = authorCode;
    }

    public String getRoleCategory() {
        return roleCategory;
    }

    public void setRoleCategory(String roleCategory) {
        this.roleCategory = roleCategory;
    }

    public List<String> getFeatureCodes() {
        return featureCodes;
    }

    public void setFeatureCodes(List<String> featureCodes) {
        this.featureCodes = featureCodes == null ? new ArrayList<>() : featureCodes;
    }
}
