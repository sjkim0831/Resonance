package egovframework.com.platform.codex.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminRoleAssignmentVO {

    private String emplyrId;
    private String userNm;
    private String orgnztId;
    private String emplyrSttusCode;
    private String authorCode;
    private String authorNm;

    public String getEmplyrId() {
        return emplyrId;
    }

    public String getAuthorCode() {
        return authorCode;
    }

    public String getAuthorNm() {
        return authorNm;
    }
}
