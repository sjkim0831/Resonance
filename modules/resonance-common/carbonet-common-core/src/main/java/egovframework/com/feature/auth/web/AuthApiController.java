package egovframework.com.feature.auth.web;

import egovframework.com.platform.observability.service.AdminLoginHistoryService;
import egovframework.com.feature.auth.dto.internal.LoginIncorrectDTO;
import egovframework.com.feature.auth.dto.internal.LoginPolicyDTO;
import egovframework.com.feature.auth.dto.request.LoginRequestDTO;
import egovframework.com.feature.auth.dto.response.LoginResponseDTO;
import egovframework.com.feature.auth.service.AuthService;
import egovframework.com.feature.auth.service.AuthTokenStoreService;
import egovframework.com.feature.auth.util.ClientIpUtil;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.egovframe.boot.security.bean.EgovReloadableFilterInvocationSecurityMetadataSource;
import org.egovframe.boot.security.userdetails.util.EgovUserDetailsHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.ApplicationContext;
import org.springframework.context.support.ReloadableResourceBundleMessageSource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.stereotype.Controller;
import org.springframework.util.ObjectUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.support.WebApplicationContextUtils;
import reactor.core.publisher.Mono;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Controller("authApiController")
@RequestMapping({"/signin", "/en/signin", "/admin/login", "/en/admin/login"})
@Slf4j
public class AuthApiController {

    @Value("${egov.login.lock}")
    private String lock;

    @Value("${egov.login.lockCount}")
    private String lockCount;

    private final AuthService service;
    private final AdminLoginHistoryService adminLoginHistoryService;
    private final JwtTokenProvider jwtProvider;
    private final AuthTokenStoreService authTokenStoreService;
    private final ReloadableResourceBundleMessageSource messageSource;
    private final EgovReloadableFilterInvocationSecurityMetadataSource securityMetadataSource;

    @Autowired
    public AuthApiController(
            AuthService service,
            AdminLoginHistoryService adminLoginHistoryService,
            JwtTokenProvider jwtProvider,
            AuthTokenStoreService authTokenStoreService,
            @Qualifier("messageSource") ReloadableResourceBundleMessageSource messageSource,
            EgovReloadableFilterInvocationSecurityMetadataSource securityMetadataSource) {
        this.service = service;
        this.adminLoginHistoryService = adminLoginHistoryService;
        this.jwtProvider = jwtProvider;
        this.authTokenStoreService = authTokenStoreService;
        this.messageSource = messageSource;
        this.securityMetadataSource = securityMetadataSource;
    }

    @PostMapping("/actionLogin")
    public ResponseEntity<?> actionLogin(@RequestBody LoginRequestDTO loginVO, HttpServletRequest request,
            HttpServletResponse response) {
        if (ObjectUtils.isEmpty(loginVO)) {
            return ResponseEntity.ok(messageSource.getMessage("fail.common.login", null, request.getLocale()));
        }

        Map<String, Object> message = new HashMap<>();
        String normalizedUserId = safeString(loginVO.getUserId());
        String normalizedUserSe = safeString(loginVO.getUserSe()).toUpperCase();
        String clientIp = resolveClientIp(request);

        Map<String, Object> incorrect = loginIncorrect(loginVO, request);
        if (!incorrect.isEmpty()) {
            recordLoginHistory(normalizedUserId, "", normalizedUserSe, "FAIL", clientIp,
                    String.valueOf(incorrect.getOrDefault("errors", "")));
            return ResponseEntity.ok(incorrect);
        }

        LoginResponseDTO loginResult = service.actionLogin(loginVO);

        if (ObjectUtils.isEmpty(loginResult)) {
            message.put("status", "loginFailure");
            message.put("errors", messageSource.getMessage("fail.common.login", null, request.getLocale()));
            recordLoginHistory(normalizedUserId, "", normalizedUserSe, "FAIL", clientIp,
                    String.valueOf(message.get("errors")));
            return ResponseEntity.ok(message);
        } else {
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
            log.debug("AuthApiController actionLogin isAuthenticated >>> {}",
                    EgovUserDetailsHelper.isAuthenticated());

            List<Map.Entry<String, String>> rolePatternList = EgovUserDetailsHelper.getRoleAndPatternList();
            List<String> authorList = EgovUserDetailsHelper.getAuthorities();
            // 沅뚰븳???대떦?섎뒗 Role ?뺣낫瑜?臾몄옄???뺥깭濡??ㅼ젙
            String accessiblePatterns = EgovUserDetailsHelper.getAccessiblePatterns(rolePatternList, authorList);
            log.debug("AuthApiController actionLogin accessiblePatterns >>> {}", accessiblePatterns);
            // SecurityContextHolder ??젣
            new SecurityContextLogoutHandler().logout(request, response, authentication);

            LoginResponseDTO dtoToVo = new LoginResponseDTO();
            dtoToVo.setUserId(loginResult.getUserId());
            dtoToVo.setName(loginResult.getName());
            dtoToVo.setUniqId(loginResult.getUniqId());
            dtoToVo.setAuthorList(accessiblePatterns);

            String accessToken = jwtProvider.createAccessToken(dtoToVo);
            String refreshToken = jwtProvider.createRefreshToken(dtoToVo);

            long accessCookieMaxAge = Duration.ofMillis(Long.parseLong(jwtProvider.getAccessExpiration())).getSeconds();
            long refreshCookieMaxAge;
            if (loginVO.isAutoLogin()) {
                refreshCookieMaxAge = 60 * 60 * 24 * 30; // 30 days
            } else {
                refreshCookieMaxAge = Duration.ofMillis(Long.parseLong(jwtProvider.getRefreshExpiration()))
                        .getSeconds();
            }

            ResponseCookie accessTokenCookie = jwtProvider.createCookie(request, "accessToken", accessToken, accessCookieMaxAge);
            response.addHeader(HttpHeaders.SET_COOKIE, accessTokenCookie.toString());

            ResponseCookie refreshTokenCookie = jwtProvider.createCookie(request, "refreshToken", refreshToken,
                    refreshCookieMaxAge);
            response.addHeader(HttpHeaders.SET_COOKIE, refreshTokenCookie.toString());
            authTokenStoreService.saveLoginToken(loginResult.getUserId(), loginResult.getUserSe(), accessToken,
                    refreshToken, Duration.ofSeconds(refreshCookieMaxAge).toMillis(), request);

            message.put("status", "loginSuccess");
            message.put("userInfo", loginResult.getName() + "(" + loginResult.getUserId() + ")");
            message.put("userId", loginResult.getUserId());
            message.put("userSe", loginResult.getUserSe());
            // ?몄쬆 ?뺣낫 議댁옱 ?щ? ?뺤씤 (Check if authentication info exists)
            boolean isCertified = !ObjectUtils.isEmpty(loginResult.getAuthTy())
                    || !ObjectUtils.isEmpty(loginResult.getAuthDn());
            // Enterprise A/R??濡쒓렇??吏곹썑?먮뒗 ?몄쬆???좏깮 ?붾㈃?쇰줈 ?좊룄
            if ("ENT".equalsIgnoreCase(loginResult.getUserSe())) {
                String memberStatus = loginResult.getMemberStatus();
                if ("A".equalsIgnoreCase(memberStatus) || "R".equalsIgnoreCase(memberStatus)) {
                    isCertified = false;
                }
            }
            message.put("certified", isCertified);

            message.put("errors", "");
            recordLoginHistory(loginResult.getUserId(), loginResult.getName(), loginResult.getUserSe(), "SUCCESS",
                    clientIp, request.getLocale().getLanguage().toLowerCase().startsWith("en")
                            ? "Login succeeded."
                            : "Login succeeded.");
            return ResponseEntity.ok(message);
        }
    }

    public Map<String, Object> loginIncorrect(LoginRequestDTO loginVO, HttpServletRequest request) {
        Map<String, Object> response = new HashMap<>();

        if (!Boolean.parseBoolean(this.lock)) {
            return response;
        }

        String clientIp = ClientIpUtil.getClientIp();
        LoginPolicyDTO loginPolicyVO = new LoginPolicyDTO();
        loginPolicyVO.setEmployerId(loginVO.getUserId());
        loginPolicyVO = service.loginPolicy(loginPolicyVO);
        if (!ObjectUtils.isEmpty(loginPolicyVO)) {
            if ("Y".equals(loginPolicyVO.getLmttAt()) && clientIp.equals(loginPolicyVO.getIpInfo())) {
                response.put("status", "loginFailure");
                response.put("errors", messageSource.getMessage("fail.common.login.ip", null, request.getLocale()));
                return response;
            }
        }

        LoginIncorrectDTO loginIncorrectVO = service.loginIncorrectList(loginVO);
        if (ObjectUtils.isEmpty(loginIncorrectVO)) {
            response.put("status", "loginFailure");
            response.put("errors", messageSource.getMessage("fail.common.login", null, request.getLocale()));
            return response;
        }

        String incorrectCode = service.loginIncorrectProcess(loginVO, loginIncorrectVO, lockCount);
        if (!"E".equals(incorrectCode)) {
            if ("L".equals(incorrectCode)) {
                response.put("status", "loginFailure");
                response.put("errors", messageSource.getMessage("fail.common.loginIncorrect",
                        new Object[] { lockCount, request.getLocale() }, request.getLocale()));
            } else if ("C".equals(incorrectCode)) {
                response.put("status", "loginFailure");
                response.put("errors", messageSource.getMessage("fail.common.login", null, request.getLocale()));
            }
        }

        return response;
    }

    private void recordLoginHistory(String userId, String userNm, String userSe, String loginResult, String loginIp,
            String loginMessage) {
        try {
            adminLoginHistoryService.insertLoginHistory(userId, userNm, userSe, loginResult, loginIp, loginMessage);
        } catch (Exception e) {
            log.error("Failed to save login history. userId={}, userSe={}, loginResult={}",
                    userId, userSe, loginResult, e);
        }
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) {
            return ClientIpUtil.getClientIp();
        }
        String forwardedFor = safeString(request.getHeader("X-Forwarded-For"));
        if (!forwardedFor.isEmpty()) {
            String[] values = forwardedFor.split(",");
            if (values.length > 0 && !safeString(values[0]).isEmpty()) {
                return safeString(values[0]);
            }
        }
        String realIp = safeString(request.getHeader("X-Real-IP"));
        if (!realIp.isEmpty()) {
            return realIp;
        }
        String remoteAddr = safeString(request.getRemoteAddr());
        if (!remoteAddr.isEmpty()) {
            return remoteAddr;
        }
        return ClientIpUtil.getClientIp();
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }

    @GetMapping("/validateRefreshToken")
    @ResponseBody
    public Mono<Boolean> validateRefreshToken(@RequestHeader String refreshToken, HttpServletRequest request,
            HttpServletResponse response) {
        try {
            String username = jwtProvider.decrypt(jwtProvider.extractUserId(refreshToken));
            boolean accepted = !ObjectUtils.isEmpty(username)
                    && authTokenStoreService.isRefreshTokenAccepted(username, refreshToken);
            if (accepted) {
                return Mono.just(true);
            }
            jwtProvider.deleteCookie(request, response, "accessToken");
            jwtProvider.deleteCookie(request, response, "refreshToken");
            return Mono.just(false);
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Refresh token validation failed.", e);
            jwtProvider.deleteCookie(request, response, "accessToken");
            jwtProvider.deleteCookie(request, response, "refreshToken");
            return Mono.just(false);
        }
    }

    @GetMapping("/recreateAccessToken")
    @ResponseBody
    public ResponseEntity<?> recreateAccessToken(@RequestHeader String refreshToken, HttpServletRequest request) {
        try {
            String username = jwtProvider.decrypt(jwtProvider.extractUserId(refreshToken));
            if (ObjectUtils.isEmpty(username)
                    || !authTokenStoreService.isRefreshTokenAccepted(username, refreshToken)) {
                return ResponseEntity.badRequest().body("Refresh token not found or invalid");
            }

            LoginResponseDTO tokenPayload = new LoginResponseDTO();
            tokenPayload.setUserId(username);
            tokenPayload.setName(jwtProvider.decrypt(jwtProvider.extractUserNm(refreshToken)));
            tokenPayload.setUniqId(jwtProvider.decrypt(jwtProvider.extractUniqId(refreshToken)));
            tokenPayload.setAuthorList(jwtProvider.decrypt(jwtProvider.extractAuthorList(refreshToken)));
            String accessToken = jwtProvider.createAccessToken(tokenPayload);
            authTokenStoreService.saveLoginToken(username, "", accessToken, refreshToken,
                    Long.parseLong(jwtProvider.getRefreshExpiration()), request);

            Map<String, Object> message = new HashMap<>();
            message.put("status", "success");
            message.put("accessToken", accessToken);
            return ResponseEntity.ok(message);
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Access token recreation failed.", e);
            return ResponseEntity.badRequest().body("Invalid or expired refresh token");
        }
    }

    @RequestMapping(value = "/refreshSession", method = { RequestMethod.GET, RequestMethod.POST })
    public ResponseEntity<?> refreshSession(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = jwtProvider.getCookie(request, "refreshToken");
        if (ObjectUtils.isEmpty(refreshToken)) {
            jwtProvider.deleteCookie(request, response, "accessToken");
            jwtProvider.deleteCookie(request, response, "refreshToken");
            Map<String, Object> denied = new HashMap<>();
            denied.put("status", "fail");
            denied.put("errors", "Refresh token is missing.");
            return ResponseEntity.status(401).body(denied);
        }

        int refreshStatus = jwtProvider.refreshValidateToken(refreshToken);
        String username = refreshStatus == 200 ? jwtProvider.decrypt(jwtProvider.extractUserId(refreshToken)) : "";
        if (refreshStatus != 200 || !authTokenStoreService.isRefreshTokenAccepted(username, refreshToken)) {
            jwtProvider.deleteCookie(request, response, "accessToken");
            jwtProvider.deleteCookie(request, response, "refreshToken");
            Map<String, Object> denied = new HashMap<>();
            denied.put("status", "fail");
            denied.put("errors", "Refresh token is invalid.");
            return ResponseEntity.status(401).body(denied);
        }

        LoginResponseDTO loginVO = new LoginResponseDTO();
        loginVO.setUserId(username);
        loginVO.setName(jwtProvider.decrypt(jwtProvider.extractUserNm(refreshToken)));
        loginVO.setUniqId(jwtProvider.decrypt(jwtProvider.extractUniqId(refreshToken)));
        loginVO.setAuthorList(jwtProvider.decrypt(jwtProvider.extractAuthorList(refreshToken)));

        String newAccessToken = jwtProvider.createAccessToken(loginVO);
        String newRefreshToken = jwtProvider.createRefreshToken(loginVO);

        long accessCookieMaxAge = Duration.ofMillis(Long.parseLong(jwtProvider.getAccessExpiration())).getSeconds();
        long refreshCookieMaxAge = Duration.ofMillis(Long.parseLong(jwtProvider.getRefreshExpiration())).getSeconds();

        response.addHeader(HttpHeaders.SET_COOKIE,
                jwtProvider.createCookie(request, "accessToken", newAccessToken, accessCookieMaxAge).toString());
        response.addHeader(HttpHeaders.SET_COOKIE,
                jwtProvider.createCookie(request, "refreshToken", newRefreshToken, refreshCookieMaxAge).toString());
        authTokenStoreService.saveLoginToken(loginVO.getUserId(), "", newAccessToken, newRefreshToken,
                Duration.ofSeconds(refreshCookieMaxAge).toMillis(), request);

        Map<String, Object> message = new HashMap<>();
        message.put("status", "success");
        message.put("accessExpiresIn", Long.parseLong(jwtProvider.getAccessExpiration()));
        message.put("refreshExpiresIn", Long.parseLong(jwtProvider.getRefreshExpiration()));
        return ResponseEntity.ok(message);
    }

    @PostMapping("/reload")
    public ResponseEntity<String> reloadSecurityMetadata(HttpServletRequest request) {
        if (!isAuthenticatedRequest(request)) {
            return ResponseEntity.status(403).body("Forbidden");
        }
        EgovUserDetailsHelper.reloadSecurityMetadata(securityMetadataSource);
        return ResponseEntity.ok("Success");
    }

    @PostMapping("/resetPassword")
    @ResponseBody
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> params, HttpServletRequest request) {
        String userId = params.getOrDefault("userId", "").trim();
        String newPassword = params.getOrDefault("newPassword", "").trim();
        String language = params.getOrDefault("language", "").trim();
        boolean isEn = "en".equalsIgnoreCase(language);

        Map<String, Object> message = new HashMap<>();

        if (ObjectUtils.isEmpty(userId) || ObjectUtils.isEmpty(newPassword)) {
            message.put("status", "fail");
            message.put("errors", isEn ? "Required values are missing." : "?꾩닔 媛믪씠 ?꾨씫?섏뿀?듬땲??");
            return ResponseEntity.ok(message);
        }

        if (!validatePasswordPolicy(newPassword)) {
            message.put("status", "fail");
            message.put("errors", isEn
                    ? "Please meet the password policy (at least 9 chars and 3 character types)."
                    : "鍮꾨?踰덊샇 ?뺤콉(9?먮━ ?댁긽, 3醫낅쪟 議고빀)??異⑹”??二쇱꽭??");
            return ResponseEntity.ok(message);
        }

        boolean updated = service.resetPassword(userId, newPassword);
        if (!updated) {
            message.put("status", "fail");
            message.put("errors", isEn ? "No matching user was found." : "?쇱튂?섎뒗 ?ъ슜?먮? 李얠쓣 ???놁뒿?덈떎.");
            return ResponseEntity.ok(message);
        }

        message.put("status", "success");
        return ResponseEntity.ok(message);
    }

    @PostMapping("/actionLogout")
    public ResponseEntity<?> actionLogout(HttpServletRequest request, HttpServletResponse response) {
        log.debug("##### AuthApiController logout started #####");

        String refreshToken = jwtProvider.getCookie(request, "refreshToken");
        if (!ObjectUtils.isEmpty(refreshToken)) {
            try {
                String username = jwtProvider.decrypt(jwtProvider.extractUserId(refreshToken));
                authTokenStoreService.revokeByRefreshToken(username, refreshToken);
            } catch (JwtException | IllegalArgumentException e) {
                log.warn("Failed to resolve refresh token during logout.", e);
            }
        }
        jwtProvider.deleteCookie(request, response, "accessToken");
        jwtProvider.deleteCookie(request, response, "refreshToken");

        Map<String, Object> message = new HashMap<>();
        message.put("status", "success");
        message.put("error", "");
        return ResponseEntity.ok(message);
    }

    @RequestMapping("/loginFailure")
    public String loginFailure(HttpServletRequest request) {
        return buildLoginRedirect(request, "error=login");
    }

    @RequestMapping("/accessDenied")
    public String accessDenied(HttpServletRequest request) {
        return buildLoginRedirect(request, "error=denied");
    }

    @RequestMapping("/consurentExpired")
    public String consurentExpired(HttpServletRequest request) {
        return buildLoginRedirect(request, "error=expired");
    }

    @RequestMapping("/defaultTarget")
    public String defaultTarget() {
        return "redirect:/main";
    }

    @RequestMapping("/csrfAccessDenied")
    public String csrfAccessDenied(HttpServletRequest request) {
        return buildLoginRedirect(request, "error=csrf");
    }

    @PostMapping("/updateAuthInfo")
    public ResponseEntity<?> updateAuthInfo(@RequestBody Map<String, String> params, HttpServletRequest request) {
        if (!isAuthenticatedRequest(request)) {
            Map<String, Object> denied = new HashMap<>();
            denied.put("status", "fail");
            denied.put("errors", "Forbidden");
            return ResponseEntity.status(403).body(denied);
        }
        String userId = params.get("userId");
        String userSe = params.get("userSe");
        String authTy = params.get("authTy");
        String authDn = params.get("authDn");
        String authCi = params.get("authCi");
        String authDi = params.get("authDi");

        service.updateAuthInfo(userId, userSe, authTy, authDn, authCi, authDi);

        Map<String, Object> message = new HashMap<>();
        message.put("status", "success");
        return ResponseEntity.ok(message);
    }

    private boolean validatePasswordPolicy(String password) {
        if (ObjectUtils.isEmpty(password) || password.length() < 9) {
            return false;
        }

        int categoryCount = 0;
        if (password.matches(".*[a-z].*")) {
            categoryCount++;
        }
        if (password.matches(".*[A-Z].*")) {
            categoryCount++;
        }
        if (password.matches(".*[0-9].*")) {
            categoryCount++;
        }
        if (password.matches(".*[^A-Za-z0-9].*")) {
            categoryCount++;
        }

        return categoryCount >= 3;
    }

    private String buildLoginRedirect(HttpServletRequest request, String query) {
        String requestUri = request == null ? null : request.getRequestURI();
        String loginPath;
        if (!ObjectUtils.isEmpty(requestUri) && requestUri.startsWith("/en/admin/login")) {
            loginPath = "/en/admin/login/loginView";
        } else if (!ObjectUtils.isEmpty(requestUri) && requestUri.startsWith("/admin/login")) {
            loginPath = "/admin/login/loginView";
        } else {
            loginPath = "/signin/loginView";
        }
        return "redirect:" + loginPath + "?" + query;
    }

    private boolean isAuthenticatedRequest(HttpServletRequest request) {
        try {
            String accessToken = jwtProvider.getCookie(request, "accessToken");
            if (ObjectUtils.isEmpty(accessToken)) {
                return false;
            }
            Claims claims = jwtProvider.accessExtractClaims(accessToken);
            return claims != null && !ObjectUtils.isEmpty(claims.get("userId"));
        } catch (Exception ex) {
            return false;
        }
    }

}
