package egovframework.com.feature.auth.domain.entity;

import java.time.LocalDateTime;

public interface CommonEntity {

    void setLockAt(String lockAt);

    void setLockCnt(Integer lockCnt);

    void setLockLastPnttm(LocalDateTime lockLastPnttm);

    void setAuthTy(String authTy);

    void setAuthDn(String authDn);

    void setAuthCi(String authCi);

    void setAuthDi(String authDi);

}
