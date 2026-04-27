package egovframework.com.feature.auth.dto.internal;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class LoginIncorrectDTO {

    private String userId;
    private String userPw;
    private String userNm;
    private String userSe;
    private String esntlId;
    private String lockAt;
    private int lockCnt;
}
