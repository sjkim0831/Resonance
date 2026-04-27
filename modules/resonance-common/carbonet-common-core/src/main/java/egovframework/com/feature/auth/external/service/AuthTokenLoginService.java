package egovframework.com.feature.auth.external.service;

import egovframework.com.feature.auth.dto.response.LoginResponseDTO;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;

public interface AuthTokenLoginService {

    Map<String, Object> issueLogin(LoginResponseDTO loginResult, boolean autoLogin, HttpServletRequest request,
            HttpServletResponse response);
}
