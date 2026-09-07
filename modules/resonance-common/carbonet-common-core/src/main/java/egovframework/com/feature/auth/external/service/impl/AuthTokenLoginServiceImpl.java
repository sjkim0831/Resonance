package egovframework.com.feature.auth.external.service.impl;

import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.feature.auth.dto.response.LoginResponseDTO;
import egovframework.com.feature.auth.external.service.AuthTokenLoginService;
import egovframework.com.feature.auth.service.AuthenticationExposureRollbackGuard;
import egovframework.com.feature.auth.service.AuthTokenStoreService;
import egovframework.com.feature.auth.service.AdminConsoleAccessPolicy;
import egovframework.com.feature.auth.service.CredentialMutationLockService;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.egovframe.boot.security.userdetails.util.EgovUserDetailsHelper;
import org.springframework.context.ApplicationContext;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.stereotype.Service;
import org.springframework.util.ObjectUtils;
import org.springframework.web.context.support.WebApplicationContextUtils;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthTokenLoginServiceImpl implements AuthTokenLoginService {

    private final JwtTokenProvider jwtProvider;
    private final AuthGroupManageService authGroupManageService;
    private final AuthTokenStoreService authTokenStoreService;
    private final CredentialMutationLockService credentialMutationLockService;
    private final AuthenticationExposureRollbackGuard authenticationExposureRollbackGuard;

    @Override
    public Map<String, Object> issueLogin(LoginResponseDTO loginResult, boolean autoLogin, HttpServletRequest request,
            HttpServletResponse response) {
        Map<String, Object> message = new HashMap<>();
        if (loginResult == null) {
            message.put("status", "loginFailure");
            message.put("errors", "No login result.");
            return message;
        }
        String credentialUserId = safeString(loginResult.getUserId());
        if (credentialUserId.isEmpty()) {
            message.put("status", "loginFailure");
            message.put("errors", "No canonical login identity.");
            return message;
        }
        return credentialMutationLockService.executeLocked(credentialUserId,
                () -> issueLoginWithinCredentialLock(loginResult, autoLogin, request, response));
    }

    private Map<String, Object> issueLoginWithinCredentialLock(LoginResponseDTO loginResult, boolean autoLogin,
            HttpServletRequest request, HttpServletResponse response) {
        Map<String, Object> message = new HashMap<>();
        authenticationExposureRollbackGuard.register(request, response);

        try {
            request.changeSessionId();
        } catch (IllegalStateException ignored) {
            request.getSession(true);
        }
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                loginResult.getUserId(),
                loginResult.getUserPw(),
                ObjectUtils.isEmpty(loginResult.getAuthorCode())
                        ? List.of()
                        : List.of(new SimpleGrantedAuthority(loginResult.getAuthorCode()))
        );
        // The account has already been validated above. Re-authenticating through the global
        // AuthenticationManager can fail when the login flow passes a stored password hash.
        SecurityContextHolder.getContext().setAuthentication(authentication);

        List<Map.Entry<String, String>> rolePatternList = EgovUserDetailsHelper.getRoleAndPatternList();
        List<String> authorList = EgovUserDetailsHelper.getAuthorities();
        String accessiblePatterns = EgovUserDetailsHelper.getAccessiblePatterns(rolePatternList, authorList);
        new SecurityContextLogoutHandler().logout(request, response, authentication);

        LoginResponseDTO tokenPayload = new LoginResponseDTO();
        tokenPayload.setUserId(loginResult.getUserId());
        tokenPayload.setName(loginResult.getName());
        tokenPayload.setUniqId(loginResult.getUniqId());
        tokenPayload.setAuthorList(accessiblePatterns);

        String accessToken = jwtProvider.createAccessToken(tokenPayload);
        String refreshToken = jwtProvider.createRefreshToken(tokenPayload);

        long accessCookieMaxAge = Duration.ofMillis(Long.parseLong(jwtProvider.getAccessExpiration())).getSeconds();
        long refreshCookieMaxAge = autoLogin
                ? 60L * 60L * 24L * 30L
                : Duration.ofMillis(Long.parseLong(jwtProvider.getRefreshExpiration())).getSeconds();

        ResponseCookie accessTokenCookie = jwtProvider.createCookie(request, "accessToken", accessToken,
                accessCookieMaxAge);
        ResponseCookie refreshTokenCookie = jwtProvider.createCookie(request, "refreshToken", refreshToken,
                refreshCookieMaxAge);
        authTokenStoreService.saveLoginToken(loginResult.getUserId(), loginResult.getUserSe(), accessToken,
                refreshToken, Duration.ofSeconds(refreshCookieMaxAge).toMillis(), request);
        response.addHeader(HttpHeaders.SET_COOKIE, accessTokenCookie.toString());
        response.addHeader(HttpHeaders.SET_COOKIE, refreshTokenCookie.toString());

        boolean certified = !ObjectUtils.isEmpty(loginResult.getAuthTy()) || !ObjectUtils.isEmpty(loginResult.getAuthDn());
        if ("ENT".equalsIgnoreCase(loginResult.getUserSe())) {
            String memberStatus = loginResult.getMemberStatus();
            if ("A".equalsIgnoreCase(memberStatus) || "R".equalsIgnoreCase(memberStatus)) {
                certified = false;
            }
        }

        message.put("status", "loginSuccess");
        message.put("userInfo", loginResult.getName() + "(" + loginResult.getUserId() + ")");
        message.put("userId", loginResult.getUserId());
        message.put("userSe", loginResult.getUserSe());
        message.put("canEnterAdminConsole", canEnterAdminConsole(loginResult));
        message.put("certified", certified);
        message.put("errors", "");
        log.debug("Issued external auth login token. userId={}, userSe={}", loginResult.getUserId(),
                loginResult.getUserSe());
        return message;
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }

    private boolean canEnterAdminConsole(LoginResponseDTO loginResult) {
        return loginResult != null && AdminConsoleAccessPolicy.allows(loginResult.getAuthorCode());
    }
}
