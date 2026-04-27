package egovframework.com.feature.auth.external.service.impl;

import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.feature.auth.dto.response.LoginResponseDTO;
import egovframework.com.feature.auth.external.service.AuthTokenLoginService;
import egovframework.com.feature.auth.service.AuthTokenStoreService;
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

    @Override
    public Map<String, Object> issueLogin(LoginResponseDTO loginResult, boolean autoLogin, HttpServletRequest request,
            HttpServletResponse response) {
        Map<String, Object> message = new HashMap<>();
        if (loginResult == null) {
            message.put("status", "loginFailure");
            message.put("errors", "No login result.");
            return message;
        }

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
        response.addHeader(HttpHeaders.SET_COOKIE, accessTokenCookie.toString());

        ResponseCookie refreshTokenCookie = jwtProvider.createCookie(request, "refreshToken", refreshToken,
                refreshCookieMaxAge);
        response.addHeader(HttpHeaders.SET_COOKIE, refreshTokenCookie.toString());
        authTokenStoreService.saveLoginToken(loginResult.getUserId(), loginResult.getUserSe(), accessToken,
                refreshToken, Duration.ofSeconds(refreshCookieMaxAge).toMillis(), request);

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
        String authorCode = safeString(loginResult == null ? null : loginResult.getAuthorCode()).toUpperCase();
        if (authorCode.isEmpty()) {
            return false;
        }
        if ("ROLE_SYSTEM_MASTER".equals(authorCode)
                || "ROLE_SYSTEM_ADMIN".equals(authorCode)
                || "ROLE_ADMIN".equals(authorCode)
                || "ROLE_OPERATION_ADMIN".equals(authorCode)
                || "ROLE_COMPANY_ADMIN".equals(authorCode)
                || "ROLE_CS_ADMIN".equals(authorCode)) {
            return true;
        }
        try {
            List<String> featureCodes = authGroupManageService.selectAuthorFeatureCodes(authorCode);
            return featureCodes != null && !featureCodes.isEmpty();
        } catch (Exception e) {
            log.warn("Failed to resolve admin console entry permission. userId={}, authorCode={}",
                    loginResult == null ? "" : loginResult.getUserId(), authorCode, e);
            return false;
        }
    }
}

