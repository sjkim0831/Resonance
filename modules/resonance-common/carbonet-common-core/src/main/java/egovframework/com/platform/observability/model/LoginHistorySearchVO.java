package egovframework.com.platform.observability.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LoginHistorySearchVO {

    private int firstIndex;
    private int recordCountPerPage;
    private String searchKeyword;
    private String userSe;
    private String loginResult;
    private String blockedOnly;
    private String insttId;
    private String projectId;

    public int getFirstIndex() {
        return firstIndex;
    }

    public void setFirstIndex(int firstIndex) {
        this.firstIndex = firstIndex;
    }

    public int getRecordCountPerPage() {
        return recordCountPerPage;
    }

    public void setRecordCountPerPage(int recordCountPerPage) {
        this.recordCountPerPage = recordCountPerPage;
    }

    public String getSearchKeyword() {
        return searchKeyword;
    }

    public void setSearchKeyword(String searchKeyword) {
        this.searchKeyword = searchKeyword;
    }

    public String getUserSe() {
        return userSe;
    }

    public void setUserSe(String userSe) {
        this.userSe = userSe;
    }

    public String getLoginResult() {
        return loginResult;
    }

    public void setLoginResult(String loginResult) {
        this.loginResult = loginResult;
    }

    public String getBlockedOnly() {
        return blockedOnly;
    }

    public void setBlockedOnly(String blockedOnly) {
        this.blockedOnly = blockedOnly;
    }

    public String getInsttId() {
        return insttId;
    }

    public void setInsttId(String insttId) {
        this.insttId = insttId;
    }

    public String getProjectId() {
        return projectId;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }
}
