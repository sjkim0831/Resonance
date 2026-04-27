package egovframework.com.feature.admin.dto.request;

public class AdminDeptRoleMemberSaveRequestDTO {

    private String insttId;
    private String entrprsMberId;
    private String authorCode;

    public String getInsttId() {
        return insttId;
    }

    public void setInsttId(String insttId) {
        this.insttId = insttId;
    }

    public String getEntrprsMberId() {
        return entrprsMberId;
    }

    public void setEntrprsMberId(String entrprsMberId) {
        this.entrprsMberId = entrprsMberId;
    }

    public String getAuthorCode() {
        return authorCode;
    }

    public void setAuthorCode(String authorCode) {
        this.authorCode = authorCode;
    }
}
