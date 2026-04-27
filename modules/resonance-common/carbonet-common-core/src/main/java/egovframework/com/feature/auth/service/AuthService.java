package egovframework.com.feature.auth.service;

import egovframework.com.feature.auth.domain.entity.PasswordResetHistory;
import egovframework.com.feature.auth.dto.internal.LoginIncorrectDTO;
import egovframework.com.feature.auth.dto.internal.LoginPolicyDTO;
import egovframework.com.feature.auth.dto.request.LoginRequestDTO;
import egovframework.com.feature.auth.dto.response.LoginResponseDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface AuthService {

    LoginResponseDTO actionLogin(LoginRequestDTO loginVO);

    LoginPolicyDTO loginPolicy(LoginPolicyDTO loginPolicyVO);

    LoginIncorrectDTO loginIncorrectList(LoginRequestDTO loginVO);

    String loginIncorrectProcess(LoginRequestDTO loginVO, LoginIncorrectDTO loginIncorrectVO, String lockCount);

    void updateAuthInfo(String userId, String userSe, String authTy, String authDn, String authCi, String authDi);

    LoginResponseDTO selectLoginUser(String userSe, String userId);

    LoginResponseDTO findLoginUserByExternalIdentity(String authCi, String authDi);

    boolean resetPassword(String userId, String newPassword);

    boolean resetPassword(String userId, String newPassword, String resetByUserId, String resetIp, String resetSource);

    List<PasswordResetHistory> findRecentPasswordResetHistories(String userId);

    Page<PasswordResetHistory> searchPasswordResetHistories(String searchKeyword, String resetSource, String insttId, Pageable pageable);

}
