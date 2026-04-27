package egovframework.com.feature.auth.dto.response;

import egovframework.com.common.model.ComDefaultVO;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class LoginResponseDTO extends ComDefaultVO implements Serializable {

    private static final long serialVersionUID = -4749750948688396671L;

    private String userId;
    private String name;
    private String ihidNum;
    private String email;
    private String userPw;
    private String passwordHint;
    private String passwordCnsr;
    private String userSe;
    private String orgnztId;
    private String orgnztNm;
    private String uniqId;
    private String url;
    private String userInfo;
    private String ip;
    private String authorList;
    private String authorCode;
    private String authTy;
    private String authDn;
    private String authCi;
    private String authDi;
    private String memberStatus;
    private boolean autoLogin;

    public LoginResponseDTO(String userId, String name, String userPw, String ihidNum, String email, String userSe,
            String orgnztId, String uniqId, String ip, String authorCode) {
        this.userId = userId;
        this.name = name;
        this.userPw = userPw;
        this.ihidNum = ihidNum;
        this.email = email;
        this.userSe = userSe;
        this.orgnztId = orgnztId;
        this.uniqId = uniqId;
        this.ip = ip;
        this.authorCode = authorCode;
    }

    public String getUserId() {
        return userId;
    }

    public String getName() {
        return name;
    }

    public String getUniqId() {
        return uniqId;
    }

    public String getAuthorList() {
        return authorList;
    }
}
