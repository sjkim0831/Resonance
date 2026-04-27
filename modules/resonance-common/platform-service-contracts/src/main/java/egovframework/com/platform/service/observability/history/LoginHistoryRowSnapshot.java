package egovframework.com.platform.service.observability.history;

public class LoginHistoryRowSnapshot {

    private String histId = "";
    private String userId = "";
    private String userNm = "";
    private String userSe = "";
    private String loginResult = "";
    private String loginIp = "";
    private String loginMessage = "";
    private String loginPnttm = "";
    private String insttId = "";
    private String companyName = "";

    public String getHistId() { return histId; }
    public void setHistId(String histId) { this.histId = histId == null ? "" : histId; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId == null ? "" : userId; }
    public String getUserNm() { return userNm; }
    public void setUserNm(String userNm) { this.userNm = userNm == null ? "" : userNm; }
    public String getUserSe() { return userSe; }
    public void setUserSe(String userSe) { this.userSe = userSe == null ? "" : userSe; }
    public String getLoginResult() { return loginResult; }
    public void setLoginResult(String loginResult) { this.loginResult = loginResult == null ? "" : loginResult; }
    public String getLoginIp() { return loginIp; }
    public void setLoginIp(String loginIp) { this.loginIp = loginIp == null ? "" : loginIp; }
    public String getLoginMessage() { return loginMessage; }
    public void setLoginMessage(String loginMessage) { this.loginMessage = loginMessage == null ? "" : loginMessage; }
    public String getLoginPnttm() { return loginPnttm; }
    public void setLoginPnttm(String loginPnttm) { this.loginPnttm = loginPnttm == null ? "" : loginPnttm; }
    public String getInsttId() { return insttId; }
    public void setInsttId(String insttId) { this.insttId = insttId == null ? "" : insttId; }
    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName == null ? "" : companyName; }
}
