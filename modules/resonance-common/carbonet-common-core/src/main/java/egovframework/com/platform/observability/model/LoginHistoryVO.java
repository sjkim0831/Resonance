package egovframework.com.platform.observability.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LoginHistoryVO {

    private String histId;
    private String userId;
    private String userNm;
    private String userSe;
    private String loginResult;
    private String loginIp;
    private String loginMessage;
    private String loginPnttm;
    private String insttId;
    private String companyName;

    public String getHistId() {
        return histId;
    }

    public String getUserId() {
        return userId;
    }

    public String getUserNm() {
        return userNm;
    }

    public String getUserSe() {
        return userSe;
    }

    public String getLoginResult() {
        return loginResult;
    }

    public String getLoginIp() {
        return loginIp;
    }

    public String getLoginMessage() {
        return loginMessage;
    }

    public String getLoginPnttm() {
        return loginPnttm;
    }

    public String getInsttId() {
        return insttId;
    }

    public String getCompanyName() {
        return companyName;
    }
}
