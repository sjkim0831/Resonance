package egovframework.com.feature.auth.dto.request;

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
public class LoginRequestDTO extends ComDefaultVO implements Serializable {

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
}
