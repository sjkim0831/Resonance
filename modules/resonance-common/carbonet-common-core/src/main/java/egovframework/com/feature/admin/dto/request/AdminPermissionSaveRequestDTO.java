package egovframework.com.feature.admin.dto.request;

import java.util.ArrayList;
import java.util.List;

public class AdminPermissionSaveRequestDTO {

    private String emplyrId;
    private String authorCode;
    private List<String> featureCodes = new ArrayList<>();

    public String getEmplyrId() {
        return emplyrId;
    }

    public void setEmplyrId(String emplyrId) {
        this.emplyrId = emplyrId;
    }

    public String getAuthorCode() {
        return authorCode;
    }

    public void setAuthorCode(String authorCode) {
        this.authorCode = authorCode;
    }

    public List<String> getFeatureCodes() {
        return featureCodes;
    }

    public void setFeatureCodes(List<String> featureCodes) {
        this.featureCodes = featureCodes == null ? new ArrayList<>() : featureCodes;
    }
}
