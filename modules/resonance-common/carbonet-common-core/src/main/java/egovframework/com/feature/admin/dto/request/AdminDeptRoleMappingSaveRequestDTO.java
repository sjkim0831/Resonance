package egovframework.com.feature.admin.dto.request;

public class AdminDeptRoleMappingSaveRequestDTO {

    private String insttId;
    private String cmpnyNm;
    private String deptNm;
    private String authorCode;

    public String getInsttId() {
        return insttId;
    }

    public void setInsttId(String insttId) {
        this.insttId = insttId;
    }

    public String getCmpnyNm() {
        return cmpnyNm;
    }

    public void setCmpnyNm(String cmpnyNm) {
        this.cmpnyNm = cmpnyNm;
    }

    public String getDeptNm() {
        return deptNm;
    }

    public void setDeptNm(String deptNm) {
        this.deptNm = deptNm;
    }

    public String getAuthorCode() {
        return authorCode;
    }

    public void setAuthorCode(String authorCode) {
        this.authorCode = authorCode;
    }
}
