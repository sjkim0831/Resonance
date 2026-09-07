package egovframework.com.feature.auth.web;

import egovframework.com.platform.observability.service.AdminLoginHistoryService;
import egovframework.com.feature.auth.dto.internal.LoginIncorrectDTO;
import egovframework.com.feature.auth.dto.internal.LoginPolicyDTO;
import egovframework.com.feature.auth.dto.request.LoginRequestDTO;
import egovframework.com.feature.auth.dto.response.LoginResponseDTO;
import egovframework.com.feature.auth.service.AuthService;
import egovframework.com.feature.auth.service.AuthTokenStoreService;
import egovframework.com.feature.auth.service.AccountRecoveryService;
import egovframework.com.feature.auth.service.AdminConsoleAccessPolicy;
import egovframework.com.feature.auth.service.AuthenticationExposureRollbackGuard;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.feature.auth.service.MfaOtpDeliveryService;
import egovframework.com.feature.auth.service.CredentialMutationLockService;
import egovframework.com.feature.auth.util.ClientIpUtil;
import egovframework.com.feature.auth.util.JwtTokenProvider;
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
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.stereotype.Controller;
import org.springframework.util.ObjectUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.support.WebApplicationContextUtils;
import reactor.core.publisher.Mono;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.time.Duration;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;

@Controller("authApiController")
@RequestMapping({"/signin", "/en/signin", "/admin/login", "/en/admin/login"})
@Slf4j
public class AuthApiController {

    private static final String TEST_SWITCH_SESSION_ATTRIBUTE = "CARBONET_TEST_SWITCH_AUTHORIZED";
    private static final String MFA_PENDING_LOGIN = "CARBONET_MFA_PENDING_LOGIN";
    private static final String MFA_PENDING_AUTO_LOGIN = "CARBONET_MFA_PENDING_AUTO_LOGIN";
    private static final SecureRandom MFA_RANDOM = new SecureRandom();
    private static final Set<String> TEST_SWITCH_ACCOUNTS = Set.of(
            "qaowner26", "qadata26", "qacalc26", "qaverify26", "qaapprove26", "qaassign26");

    @Value("${carbonet.test-account-switch.enabled:false}")
    private boolean testAccountSwitchEnabled;

    @Value("${carbonet.test-account-switch.password:}")
    private String testAccountSwitchPassword;

    @Value("${egov.login.lock}")
    private String lock;

    @Value("${egov.login.lockCount}")
    private String lockCount;

    @Value("${server.port:18000}")
    private int serverPort;

    @Value("${carbonet.mfa.development-code-enabled:false}")
    private boolean mfaDevelopmentCodeEnabled;

    private final AuthService service;
    private final AdminLoginHistoryService adminLoginHistoryService;
    private final JwtTokenProvider jwtProvider;
    private final AuthTokenStoreService authTokenStoreService;
    private final AccountRecoveryService accountRecoveryService;
    private final CurrentUserContextService currentUserContextService;
    private final ReloadableResourceBundleMessageSource messageSource;
    private final CredentialMutationLockService credentialMutationLockService;
    private final AuthenticationExposureRollbackGuard authenticationExposureRollbackGuard;
    private final EgovReloadableFilterInvocationSecurityMetadataSource securityMetadataSource;
    private final JdbcTemplate jdbcTemplate;
    private final MfaOtpDeliveryService mfaOtpDeliveryService;

    @Autowired
    public AuthApiController(
            AuthService service,
            AdminLoginHistoryService adminLoginHistoryService,
            JwtTokenProvider jwtProvider,
            AuthTokenStoreService authTokenStoreService,
            AccountRecoveryService accountRecoveryService,
            CurrentUserContextService currentUserContextService,
            @Qualifier("messageSource") ReloadableResourceBundleMessageSource messageSource,
            CredentialMutationLockService credentialMutationLockService,
            AuthenticationExposureRollbackGuard authenticationExposureRollbackGuard,
            EgovReloadableFilterInvocationSecurityMetadataSource securityMetadataSource,
            JdbcTemplate jdbcTemplate,
            MfaOtpDeliveryService mfaOtpDeliveryService) {
        this.service = service;
        this.adminLoginHistoryService = adminLoginHistoryService;
        this.jwtProvider = jwtProvider;
        this.authTokenStoreService = authTokenStoreService;
        this.accountRecoveryService = accountRecoveryService;
        this.currentUserContextService = currentUserContextService;
        this.messageSource = messageSource;
        this.credentialMutationLockService = credentialMutationLockService;
        this.authenticationExposureRollbackGuard = authenticationExposureRollbackGuard;
        this.securityMetadataSource = securityMetadataSource;
        this.jdbcTemplate = jdbcTemplate;
        this.mfaOtpDeliveryService = mfaOtpDeliveryService;
    }

    @PostMapping("/actionLogin")
    public ResponseEntity<?> actionLogin(@RequestBody LoginRequestDTO loginVO, HttpServletRequest request,
            HttpServletResponse response) {
        if (ObjectUtils.isEmpty(loginVO)) {
            return ResponseEntity.ok(messageSource.getMessage("fail.common.login", null, request.getLocale()));
        }
        if ("STATUS".equalsIgnoreCase(safeString(loginVO.getUserSe()))) {
            return serverPort == 18000
                    ? developmentMemberStatusOpen(Map.of("memberId", safeString(loginVO.getUserId())))
                    : ResponseEntity.notFound().build();
        }
        String credentialUserId = safeString(loginVO.getUserId());
        if (credentialUserId.isEmpty()) {
            return actionLoginWithinCredentialLock(loginVO, request, response);
        }
        return credentialMutationLockService.executeLocked(credentialUserId,
                () -> actionLoginWithinCredentialLock(loginVO, request, response));
    }

    private ResponseEntity<?> actionLoginWithinCredentialLock(LoginRequestDTO loginVO,
            HttpServletRequest request, HttpServletResponse response) {

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
            Map<String, Object> registrationState = registrationStateResponse(normalizedUserId, normalizedUserSe, request);
            if (!registrationState.isEmpty()) {
                recordLoginHistory(normalizedUserId, "", normalizedUserSe, "PENDING", clientIp,
                        String.valueOf(registrationState.getOrDefault("errors", "")));
                return ResponseEntity.ok(registrationState);
            }
            message.put("status", "loginFailure");
            message.put("errors", messageSource.getMessage("fail.common.login", null, request.getLocale()));
            recordLoginHistory(normalizedUserId, "", normalizedUserSe, "FAIL", clientIp,
                    String.valueOf(message.get("errors")));
            return ResponseEntity.ok(message);
        } else {
            if (isMfaEnabled(loginResult.getUserId())) {
                return beginMfaLogin(loginResult, loginVO.isAutoLogin(), request);
            }
            return completeLogin(loginResult, loginVO.isAutoLogin(), request, response, clientIp);
        }
    }

    private Map<String, Object> registrationStateResponse(String userId, String userSe, HttpServletRequest request) {
        if (!"ENT".equalsIgnoreCase(userSe) || userId.isBlank()) return Map.of();
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT ENTRPRS_MBER_STTUS, APPLCNT_EMAIL_ADRES FROM COMTNENTRPRSMBER WHERE lower(ENTRPRS_MBER_ID)=lower(?) LIMIT 1",
                userId);
        if (rows.isEmpty()) return Map.of();
        String memberStatus = safeString(String.valueOf(rows.get(0).get("entrprs_mber_sttus"))).toUpperCase(Locale.ROOT);
        boolean english = request.getRequestURI().startsWith("/en/");
        if ("A".equals(memberStatus) || "R".equals(memberStatus) || "D".equals(memberStatus)) {
            String handle = UUID.randomUUID().toString();
            HttpSession session = request.getSession(true);
            @SuppressWarnings("unchecked")
            Map<String, Map<String, Object>> grants = (Map<String, Map<String, Object>>) session
                    .getAttribute("memberStatusLookupGrants");
            if (grants == null) {
                grants = new java.util.LinkedHashMap<>();
                session.setAttribute("memberStatusLookupGrants", grants);
            }
            Map<String, Object> grant = new java.util.LinkedHashMap<>();
            grant.put("memberId", userId);
            grant.put("email", safeString(String.valueOf(rows.get(0).get("applcnt_email_adres"))).toLowerCase(Locale.ROOT));
            grant.put("expiresAt", System.currentTimeMillis() + 5L * 60L * 1000L);
            if (grants.size() >= 20) grants.remove(grants.keySet().iterator().next());
            grants.put(handle, grant);
            String redirectUrl = (english ? "/join/en/memberStatusDetail" : "/join/memberStatusDetail")
                    + (serverPort == 18000
                            ? "?devOpen=1&memberId=" + java.net.URLEncoder.encode(userId, StandardCharsets.UTF_8)
                            : "?lookupHandle=" + handle);
            if ("A".equals(memberStatus)) {
            return Map.of(
                    "status", "registrationPending",
                    "memberId", userId,
                    "redirectUrl", redirectUrl,
                    "errors", english ? "Your registration is pending approval." : "가입 신청이 승인 대기 중입니다.");
            }
            return Map.of(
                    "status", "registrationRejected",
                    "memberId", userId,
                    "redirectUrl", redirectUrl,
                    "errors", english ? "Your registration was rejected. Check the application status." : "가입 신청이 반려되었습니다. 신청 현황을 확인해 주세요.");
        }
        return Map.of();
    }

    @PostMapping("/member-status-open")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> developmentMemberStatusOpen(
            @RequestBody Map<String, String> lookup) {
        if (serverPort != 18000) return ResponseEntity.notFound().build();
        String memberId = safeString(lookup == null ? "" : lookup.get("memberId"));
        if (memberId.isBlank() || memberId.length() > 50) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "아이디를 입력해 주세요."));
        }
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT ENTRPRS_MBER_ID, APPLCNT_NM, CMPNY_NM,
                       TO_CHAR(SBSCRB_DE, 'YYYY-MM-DD HH24:MI:SS') AS SBSCRB_DE,
                       ENTRPRS_MBER_STTUS, COALESCE(RJCT_RSN, '') AS RJCT_RSN
                  FROM COMTNENTRPRSMBER
                 WHERE lower(ENTRPRS_MBER_ID)=lower(?)
                 LIMIT 1
                """, memberId);
        if (rows.isEmpty()) return ResponseEntity.notFound().build();
        Map<String, Object> row = rows.get(0);
        String code = safeString(String.valueOf(row.get("entrprs_mber_sttus"))).toUpperCase(Locale.ROOT);
        String status = "P".equals(code) ? "APPROVED"
                : ("R".equals(code) || "D".equals(code)) ? "REJECTED"
                : "A".equals(code) ? "PENDING" : "WITHDRAWN";
        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("memberId", safeString(String.valueOf(row.get("entrprs_mber_id"))));
        result.put("memberName", safeString(String.valueOf(row.get("applcnt_nm"))));
        result.put("organization", safeString(String.valueOf(row.get("cmpny_nm"))));
        result.put("submittedAt", safeString(String.valueOf(row.get("sbscrb_de"))));
        result.put("status", status);
        result.put("rejectionReason", "REJECTED".equals(status)
                ? safeString(String.valueOf(row.get("rjct_rsn"))) : "");
        return ResponseEntity.ok(Map.of("success", true, "developmentOpen", true, "result", result));
    }

    private ResponseEntity<?> completeLogin(LoginResponseDTO loginResult, boolean autoLogin,
            HttpServletRequest request, HttpServletResponse response, String clientIp) {
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
            log.debug("AuthApiController actionLogin isAuthenticated >>> {}",
                    EgovUserDetailsHelper.isAuthenticated());

            String accessiblePatterns = resolveAccessiblePatternsSafely(loginResult);
            log.debug("AuthApiController actionLogin accessiblePatterns >>> {}", accessiblePatterns);
            LoginResponseDTO dtoToVo = new LoginResponseDTO();
            dtoToVo.setUserId(loginResult.getUserId());
            dtoToVo.setName(loginResult.getName());
            dtoToVo.setUniqId(loginResult.getUniqId());
            dtoToVo.setAuthorList(accessiblePatterns);

            String accessToken;
            try {
                accessToken = jwtProvider.createAccessToken(dtoToVo);
            } catch (Exception e) {
                log.error("Failed to create access token during login. userId={}, userSe={}",
                        safeString(loginResult.getUserId()), safeString(loginResult.getUserSe()), e);
                throw e;
            }
            String refreshToken;
            try {
                refreshToken = jwtProvider.createRefreshToken(dtoToVo);
            } catch (Exception e) {
                log.error("Failed to create refresh token during login. userId={}, userSe={}",
                        safeString(loginResult.getUserId()), safeString(loginResult.getUserSe()), e);
                throw e;
            }

            long accessCookieMaxAge = Duration.ofMillis(Long.parseLong(jwtProvider.getAccessExpiration())).getSeconds();
            long refreshCookieMaxAge;
            if (autoLogin) {
                refreshCookieMaxAge = 60 * 60 * 24 * 30; // 30 days
            } else {
                refreshCookieMaxAge = Duration.ofMillis(Long.parseLong(jwtProvider.getRefreshExpiration()))
                        .getSeconds();
            }

            ResponseCookie accessTokenCookie = jwtProvider.createCookie(request, "accessToken", accessToken, accessCookieMaxAge);
            ResponseCookie refreshTokenCookie = jwtProvider.createCookie(request, "refreshToken", refreshToken,
                    refreshCookieMaxAge);
            authTokenStoreService.saveLoginToken(loginResult.getUserId(), loginResult.getUserSe(), accessToken,
                    refreshToken, Duration.ofSeconds(refreshCookieMaxAge).toMillis(), request);
            // Persist the session and expose cookies only after the shared token-store row
            // exists. A failed store write must never create a JWT-only authenticated session.
            new HttpSessionSecurityContextRepository().saveContext(
                    SecurityContextHolder.getContext(), request, response);
            response.addHeader(HttpHeaders.SET_COOKIE, accessTokenCookie.toString());
            response.addHeader(HttpHeaders.SET_COOKIE, refreshTokenCookie.toString());

            message.put("status", "loginSuccess");
            message.put("userInfo", loginResult.getName() + "(" + loginResult.getUserId() + ")");
            message.put("userId", loginResult.getUserId());
            message.put("userSe", loginResult.getUserSe());
            message.put("canEnterAdminConsole", canEnterAdminConsole(loginResult));
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

    private boolean isMfaEnabled(String userId) {
        if (mfaDevelopmentCodeEnabled) return false;
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT count(*) FROM member_mfa_setting WHERE user_id=? AND enabled=TRUE",
                    Integer.class, safeString(userId));
            return count != null && count > 0;
        } catch (DataAccessException exception) {
            if (!mfaDevelopmentCodeEnabled) throw exception;
            log.info("Development MFA settings are unavailable; continuing with MFA disabled for login.");
            return false;
        }
    }

    private ResponseEntity<?> beginMfaLogin(LoginResponseDTO loginResult, boolean autoLogin,
            HttpServletRequest request) {
        String challengeId = UUID.randomUUID().toString();
        String code = String.format("%06d", MFA_RANDOM.nextInt(1_000_000));
        jdbcTemplate.update("DELETE FROM member_mfa_challenge WHERE user_id=? AND purpose='LOGIN' AND verified_at IS NULL",
                loginResult.getUserId());
        jdbcTemplate.update("""
                INSERT INTO member_mfa_challenge
                  (challenge_id,user_id,purpose,code_hash,expires_at,attempt_count,created_at)
                VALUES (?,?,'LOGIN',?,CURRENT_TIMESTAMP + INTERVAL '10 minutes',0,CURRENT_TIMESTAMP)
                """, UUID.fromString(challengeId), loginResult.getUserId(), mfaDigest(challengeId, code));
        String destination = findAccountEmail(loginResult.getUserId());
        boolean english = request.getLocale().getLanguage().toLowerCase(Locale.ROOT).startsWith("en");
        if (!mfaOtpDeliveryService.deliver(challengeId, loginResult.getUserId(), destination, code, "LOGIN", english)) {
            jdbcTemplate.update("DELETE FROM member_mfa_challenge WHERE challenge_id=?", UUID.fromString(challengeId));
            SecurityContextHolder.clearContext();
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                    "status", "mfaDeliveryFailure",
                    "errors", english ? "The verification code could not be delivered."
                            : "인증번호를 발송하지 못했습니다. 잠시 후 다시 시도해 주세요."));
        }
        HttpSession session = request.getSession(true);
        session.setAttribute(MFA_PENDING_LOGIN, loginResult);
        session.setAttribute(MFA_PENDING_AUTO_LOGIN, autoLogin);
        SecurityContextHolder.clearContext();
        Map<String, Object> body = new HashMap<>();
        body.put("status", "mfaRequired");
        body.put("challengeId", challengeId);
        body.put("expiresInSeconds", 600);
        body.put("destinationMasked", jdbcTemplate.queryForObject(
                "SELECT destination_masked FROM member_mfa_setting WHERE user_id=? AND enabled=TRUE",
                String.class, loginResult.getUserId()));
        if (mfaDevelopmentCodeEnabled) body.put("developmentCode", code);
        return ResponseEntity.ok(body);
    }

    private String findAccountEmail(String userId) {
        List<String> emails = jdbcTemplate.queryForList("""
                SELECT email FROM (
                  SELECT MBER_ID AS user_id,MBER_EMAIL_ADRES AS email FROM COMTNGNRLMBER
                  UNION ALL SELECT ENTRPRS_MBER_ID,APPLCNT_EMAIL_ADRES FROM COMTNENTRPRSMBER
                  UNION ALL SELECT EMPLYR_ID,EMAIL_ADRES FROM COMTNEMPLYRINFO
                ) account WHERE lower(user_id)=lower(?) AND coalesce(email,'')<>'' LIMIT 1
                """, String.class, safeString(userId));
        return emails.isEmpty() ? "" : emails.get(0);
    }

    @PostMapping("/actionLogin/mfa")
    @Transactional
    public ResponseEntity<?> verifyMfaLogin(@RequestBody Map<String, Object> requestBody,
            HttpServletRequest request, HttpServletResponse response) {
        HttpSession session = request.getSession(false);
        LoginResponseDTO pending = session == null ? null : (LoginResponseDTO) session.getAttribute(MFA_PENDING_LOGIN);
        String challengeId = safeString(String.valueOf(requestBody.getOrDefault("challengeId", "")));
        String code = safeString(String.valueOf(requestBody.getOrDefault("verificationCode", "")));
        if (pending == null || !challengeId.matches("[0-9a-fA-F-]{36}") || !code.matches("\\d{6}")) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("status", "mfaFailure", "errors", "MFA 인증 요청이 유효하지 않습니다."));
        }
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT code_hash,attempt_count,expires_at>CURRENT_TIMESTAMP AS valid
                  FROM member_mfa_challenge
                 WHERE challenge_id=? AND user_id=? AND purpose='LOGIN' AND verified_at IS NULL
                 FOR UPDATE
                """, UUID.fromString(challengeId), pending.getUserId());
        boolean valid = !rows.isEmpty() && Boolean.TRUE.equals(rows.get(0).get("valid"));
        int attempts = rows.isEmpty() ? 5 : ((Number) rows.get(0).getOrDefault("attempt_count", 0)).intValue();
        boolean matched = valid && attempts < 5 && MessageDigest.isEqual(
                safeString(String.valueOf(rows.get(0).get("code_hash"))).getBytes(StandardCharsets.UTF_8),
                mfaDigest(challengeId, code).getBytes(StandardCharsets.UTF_8));
        if (!matched) {
            if (!rows.isEmpty()) jdbcTemplate.update("UPDATE member_mfa_challenge SET attempt_count=attempt_count+1 WHERE challenge_id=?", UUID.fromString(challengeId));
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("status", "mfaFailure", "errors", "인증번호가 일치하지 않거나 만료됐습니다."));
        }
        jdbcTemplate.update("UPDATE member_mfa_challenge SET verified_at=CURRENT_TIMESTAMP WHERE challenge_id=?", UUID.fromString(challengeId));
        boolean autoLogin = Boolean.TRUE.equals(session.getAttribute(MFA_PENDING_AUTO_LOGIN));
        session.removeAttribute(MFA_PENDING_LOGIN);
        session.removeAttribute(MFA_PENDING_AUTO_LOGIN);
        return completeLogin(pending, autoLogin, request, response, resolveClientIp(request));
    }

    private String mfaDigest(String challengeId, String code) {
        try {
            return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest((challengeId + ":" + code).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    @PostMapping("/testAccountSwitch")
    public ResponseEntity<?> testAccountSwitch(@RequestBody Map<String, Object> requestBody,
            @RequestHeader(value = "X-Carbonet-Test-Mode", required = false) String testMode,
            HttpServletRequest request, HttpServletResponse response) {
        String targetUserId = safeString(String.valueOf(requestBody.getOrDefault("userId", ""))).toLowerCase();
        if (!testAccountSwitchEnabled || safeString(testAccountSwitchPassword).isEmpty()
                || !"1".equals(safeString(testMode)) || !TEST_SWITCH_ACCOUNTS.contains(targetUserId)) {
            return ResponseEntity.status(404).body(Map.of("status", "loginFailure", "errors", "TEST_ACCOUNT_SWITCH_UNAVAILABLE"));
        }

        HttpSession session = request.getSession(false);
        Authentication current = SecurityContextHolder.getContext().getAuthentication();
        CurrentUserContextService.CurrentUserContext currentContext = currentUserContextService.resolve(request);
        String effectiveUserId = safeString(currentContext.getUserId()).toLowerCase();
        String actualUserId = safeString(currentContext.getActualUserId()).toLowerCase();
        boolean currentAdmin = currentContext.isWebmaster()
                || AdminConsoleAccessPolicy.allows(currentContext.getAuthorCode())
                || (current != null && current.isAuthenticated()
                && current.getAuthorities().stream().anyMatch(authority -> AdminConsoleAccessPolicy.allows(authority.getAuthority())));
        boolean currentTestAccount = TEST_SWITCH_ACCOUNTS.contains(effectiveUserId)
                || TEST_SWITCH_ACCOUNTS.contains(actualUserId)
                || (current != null && TEST_SWITCH_ACCOUNTS.contains(safeString(current.getName()).toLowerCase()));
        boolean authorizedSession = session != null && Boolean.TRUE.equals(session.getAttribute(TEST_SWITCH_SESSION_ATTRIBUTE));
        if (!currentAdmin && !currentTestAccount && !authorizedSession) {
            log.warn("Rejected test account switch. principal={}, actualUserId={}, effectiveUserId={}, authorCode={}, sessionAuthorized={}",
                    current == null ? "" : safeString(current.getName()), actualUserId, effectiveUserId,
                    safeString(currentContext.getAuthorCode()), authorizedSession);
            return ResponseEntity.status(403).body(Map.of("status", "loginFailure", "errors", "TEST_ACCOUNT_SWITCH_ADMIN_REQUIRED"));
        }

        String initiatedBy = current == null ? "" : safeString(current.getName());
        request.getSession(true).setAttribute(TEST_SWITCH_SESSION_ATTRIBUTE, Boolean.TRUE);
        LoginRequestDTO login = new LoginRequestDTO();
        login.setUserId(targetUserId);
        login.setUserPw(testAccountSwitchPassword);
        login.setUserSe("USR");
        login.setAutoLogin(false);
        ResponseEntity<?> result = actionLogin(login, request, response);
        log.warn("Authorized test account switch. initiatedBy={}, targetUserId={}, clientIp={}",
                initiatedBy, targetUserId, resolveClientIp(request));
        recordLoginHistory(targetUserId, "", "USR", "TEST_SWITCH", resolveClientIp(request),
                "Authorized test account switch initiated by " + initiatedBy);
        return result;
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

    private String resolveAccessiblePatternsSafely(LoginResponseDTO loginResult) {
        try {
            List<Map.Entry<String, String>> rolePatternList = EgovUserDetailsHelper.getRoleAndPatternList();
            List<String> authorList = EgovUserDetailsHelper.getAuthorities();
            return safeString(EgovUserDetailsHelper.getAccessiblePatterns(rolePatternList, authorList));
        } catch (Exception e) {
            log.warn("Falling back to empty accessible patterns after login. userId={}, authorCode={}",
                    loginResult == null ? "" : safeString(loginResult.getUserId()),
                    loginResult == null ? "" : safeString(loginResult.getAuthorCode()),
                    e);
            return "";
        }
    }

    private boolean canEnterAdminConsole(LoginResponseDTO loginResult) {
        return loginResult != null && AdminConsoleAccessPolicy.allows(loginResult.getAuthorCode());
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
            if (jwtProvider.refreshValidateToken(refreshToken) != 200) {
                return ResponseEntity.badRequest().body("Refresh token not found or invalid");
            }
            String username = jwtProvider.decrypt(jwtProvider.extractUserId(refreshToken));
            if (ObjectUtils.isEmpty(username)) {
                return ResponseEntity.badRequest().body("Refresh token not found or invalid");
            }

            LoginResponseDTO tokenPayload = new LoginResponseDTO();
            tokenPayload.setUserId(username);
            tokenPayload.setName(jwtProvider.decrypt(jwtProvider.extractUserNm(refreshToken)));
            tokenPayload.setUniqId(jwtProvider.decrypt(jwtProvider.extractUniqId(refreshToken)));
            tokenPayload.setAuthorList(jwtProvider.decrypt(jwtProvider.extractAuthorList(refreshToken)));
            String accessToken = jwtProvider.createAccessToken(tokenPayload);
            if (!authTokenStoreService.rotateLoginToken(username, "", refreshToken, accessToken, refreshToken,
                    Long.parseLong(jwtProvider.getRefreshExpiration()), request)) {
                return ResponseEntity.badRequest().body("Refresh token not found or invalid");
            }

            Map<String, Object> message = new HashMap<>();
            message.put("status", "success");
            message.put("accessToken", accessToken);
            return ResponseEntity.ok(message);
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Access token recreation failed.", e);
            return ResponseEntity.badRequest().body("Invalid or expired refresh token");
        } catch (DataAccessException e) {
            log.error("Access token recreation failed because the token store is unavailable.", e);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body("Token store unavailable");
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
        if (refreshStatus != 200 || ObjectUtils.isEmpty(username)) {
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

        final boolean rotated;
        try {
            rotated = authTokenStoreService.rotateLoginToken(loginVO.getUserId(), "", refreshToken,
                    newAccessToken, newRefreshToken, Duration.ofSeconds(refreshCookieMaxAge).toMillis(), request);
        } catch (DataAccessException e) {
            log.error("Session refresh failed because the token store is unavailable.", e);
            jwtProvider.deleteCookie(request, response, "accessToken");
            jwtProvider.deleteCookie(request, response, "refreshToken");
            Map<String, Object> unavailable = new HashMap<>();
            unavailable.put("status", "fail");
            unavailable.put("errors", "Token store unavailable.");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(unavailable);
        }
        if (!rotated) {
            jwtProvider.deleteCookie(request, response, "accessToken");
            jwtProvider.deleteCookie(request, response, "refreshToken");
            Map<String, Object> denied = new HashMap<>();
            denied.put("status", "fail");
            denied.put("errors", "Refresh token is invalid.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(denied);
        }
        response.addHeader(HttpHeaders.SET_COOKIE,
                jwtProvider.createCookie(request, "accessToken", newAccessToken, accessCookieMaxAge).toString());
        response.addHeader(HttpHeaders.SET_COOKIE,
                jwtProvider.createCookie(request, "refreshToken", newRefreshToken, refreshCookieMaxAge).toString());

        Map<String, Object> message = new HashMap<>();
        message.put("status", "success");
        message.put("accessExpiresIn", Long.parseLong(jwtProvider.getAccessExpiration()));
        message.put("refreshExpiresIn", Long.parseLong(jwtProvider.getRefreshExpiration()));
        return ResponseEntity.ok(message);
    }

    @PostMapping("/reload")
    public ResponseEntity<String> reloadSecurityMetadata(HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.GONE)
                .body("Public security metadata reload is disabled.");
    }

    @PostMapping("/account-recovery/requests")
    @ResponseBody
    public ResponseEntity<?> requestAccountRecovery(@RequestBody Map<String, String> params,
            HttpServletRequest request) {
        boolean isEn = "en".equalsIgnoreCase(params.getOrDefault("language", ""));
        AccountRecoveryService.RequestResult result = accountRecoveryService.requestCode(
                params.getOrDefault("userId", ""), params.getOrDefault("email", ""),
                resolveClientIp(request), request.getHeader("User-Agent"), isEn);
        Map<String, Object> body = new HashMap<>();
        body.put("status", result.status());
        body.put("requestId", result.requestId());
        body.put("message", result.message());
        if (!ObjectUtils.isEmpty(result.developmentCode())) {
            body.put("developmentCode", result.developmentCode());
        }
        return ResponseEntity.accepted().body(body);
    }

    @PostMapping("/account-recovery/requests/{requestId}/verify")
    @ResponseBody
    public ResponseEntity<?> verifyAccountRecovery(@PathVariable String requestId,
            @RequestBody Map<String, String> params, HttpServletRequest request) {
        boolean isEn = "en".equalsIgnoreCase(params.getOrDefault("language", ""));
        AccountRecoveryService.VerifyResult result = accountRecoveryService.verifyCode(
                requestId, params.getOrDefault("code", ""), resolveClientIp(request), isEn);
        Map<String, Object> body = new HashMap<>();
        body.put("status", result.status());
        body.put("message", result.message());
        if (!ObjectUtils.isEmpty(result.recoveryProof())) {
            body.put("recoveryProof", result.recoveryProof());
        }
        return ResponseEntity.ok(body);
    }

    @PostMapping("/resetPassword")
    @ResponseBody
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> params, HttpServletRequest request) {
        String newPassword = params.getOrDefault("newPassword", "").trim();
        String language = params.getOrDefault("language", "").trim();
        boolean isEn = "en".equalsIgnoreCase(language);

        Map<String, Object> message = new HashMap<>();

        if (ObjectUtils.isEmpty(newPassword)) {
            message.put("status", "fail");
            message.put("errors", isEn ? "Required values are missing." : "필수 값이 누락되었습니다.");
            return ResponseEntity.ok(message);
        }

        if (!validatePasswordPolicy(newPassword)) {
            message.put("status", "fail");
            message.put("errors", isEn
                    ? "Please meet the password policy (at least 9 chars and 3 character types)."
                    : "비밀번호 정책(9자리 이상, 3종류 조합)을 충족해 주세요.");
            return ResponseEntity.ok(message);
        }

        AccountRecoveryService.CompleteResult recoveryResult = accountRecoveryService.complete(
                params.getOrDefault("requestId", ""), params.getOrDefault("recoveryProof", ""),
                newPassword, resolveClientIp(request), isEn);
        boolean updated = "success".equals(recoveryResult.status());
        if (!updated) {
            message.put("status", "fail");
            message.put("errors", isEn ? "No matching user was found." : "일치하는 사용자를 찾을 수 없습니다.");
            return ResponseEntity.ok(message);
        }

        AccountRecoveryResultSession.rotateAndGrant(request);
        message.put("status", "success");
        return ResponseEntity.ok(message);
    }

    @PostMapping("/actionLogout")
    public ResponseEntity<?> actionLogout(HttpServletRequest request, HttpServletResponse response) {
        log.debug("##### AuthApiController logout started #####");
        String accessToken = jwtProvider.getCookie(request, "accessToken");
        String refreshToken = jwtProvider.getCookie(request, "refreshToken");
        Map<String, Object> message = new HashMap<>();
        HttpStatus status;
        try {
            AuthTokenStoreService.LogoutRevocationResult result =
                    authTokenStoreService.revokeLogoutTokens(accessToken, refreshToken);
            if (result == AuthTokenStoreService.LogoutRevocationResult.REVOKED) {
                status = HttpStatus.OK;
                message.put("status", "success");
                message.put("error", "");
            } else {
                status = HttpStatus.UNAUTHORIZED;
                message.put("status", "logoutFailure");
                message.put("error", "INVALID_OR_STALE_LOGOUT_TOKEN");
            }
        } catch (IllegalStateException e) {
            log.error("Logout token revocation failed closed.", e);
            status = HttpStatus.SERVICE_UNAVAILABLE;
            message.put("status", "logoutFailure");
            message.put("error", "TOKEN_REVOCATION_UNAVAILABLE");
        } finally {
            jwtProvider.deleteCookie(request, response, "accessToken");
            jwtProvider.deleteCookie(request, response, "refreshToken");
            HttpSession session = request.getSession(false);
            if (session != null) {
                session.removeAttribute(TEST_SWITCH_SESSION_ATTRIBUTE);
            }
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            new SecurityContextLogoutHandler().logout(request, response, authentication);
        }
        return ResponseEntity.status(status).body(message);
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
        Map<String, Object> message = new HashMap<>();
        message.put("status", "fail");
        message.put("errors", "Verified identity updates are accepted only from the server-side authentication flow.");
        return ResponseEntity.status(HttpStatus.GONE).body(message);
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

}
