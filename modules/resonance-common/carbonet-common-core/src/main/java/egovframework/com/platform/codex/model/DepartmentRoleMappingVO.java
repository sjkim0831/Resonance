package egovframework.com.platform.codex.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DepartmentRoleMappingVO {

    private String insttId;
    private String cmpnyNm;
    private String deptNm;
    private int memberCount;
    private String authorCode;
    private String authorNm;
    private String useAt;

    public String getInsttId() {
        return insttId;
    }

    public String getCmpnyNm() {
        return cmpnyNm;
    }

    public String getDeptNm() {
        return deptNm;
    }

    public int getMemberCount() {
        return memberCount;
    }

    public String getAuthorCode() {
        return authorCode;
    }

    public String getAuthorNm() {
        return authorNm;
    }
}
