package egovframework.com.feature.admin.dto.request;

public class AdminAuthGroupCreateRequestDTO {

    private String authorCode;
    private String authorNm;
    private String authorDc;
    private String roleCategory;
    private String insttId;

    public String getAuthorCode() {
        return authorCode;
    }

    public void setAuthorCode(String authorCode) {
        this.authorCode = authorCode;
    }

    public String getAuthorNm() {
        return authorNm;
    }

    public void setAuthorNm(String authorNm) {
        this.authorNm = authorNm;
    }

    public String getAuthorDc() {
        return authorDc;
    }

    public void setAuthorDc(String authorDc) {
        this.authorDc = authorDc;
    }

    public String getRoleCategory() {
        return roleCategory;
    }

    public void setRoleCategory(String roleCategory) {
        this.roleCategory = roleCategory;
    }

    public String getInsttId() {
        return insttId;
    }

    public void setInsttId(String insttId) {
        this.insttId = insttId;
    }
}
