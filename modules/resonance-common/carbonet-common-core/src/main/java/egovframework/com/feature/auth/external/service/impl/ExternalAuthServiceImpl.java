package egovframework.com.feature.auth.external.service.impl;

import egovframework.com.feature.auth.dto.response.LoginResponseDTO;
import egovframework.com.feature.auth.external.dto.request.ExternalAuthCompleteRequest;
import egovframework.com.feature.auth.external.dto.request.ExternalAuthStartRequest;
import egovframework.com.feature.auth.external.dto.response.ExternalAuthMethodResponse;
import egovframework.com.feature.auth.external.dto.response.ExternalAuthStartResponse;
import egovframework.com.feature.auth.external.model.ExternalAuthIdentity;
import egovframework.com.feature.auth.external.model.ExternalAuthMethodDescriptor;
import egovframework.com.feature.auth.external.model.ExternalAuthSession;
import egovframework.com.feature.auth.external.service.AuthTokenLoginService;
import egovframework.com.feature.auth.external.service.ExternalAuthProvider;
import egovframework.com.feature.auth.external.service.ExternalAuthService;
import egovframework.com.feature.auth.service.AuthService;
import egovframework.com.feature.member.model.vo.EntrprsManageVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.ObjectUtils;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class ExternalAuthServiceImpl implements ExternalAuthService {

    private static final int SESSION_TTL_MINUTES = 10;

    private final List<ExternalAuthProvider> providers;
    private final AuthService authService;
    private final AuthTokenLoginService authTokenLoginService;
    private final Map<String, ExternalAuthSession> sessions = new ConcurrentHashMap<>();

    @Override
    public List<ExternalAuthMethodResponse> getAvailableMethods(boolean english) {
        List<ExternalAuthMethodResponse> response = new ArrayList<>();
        for (ExternalAuthProvider provider : providers) {
            List<ExternalAuthMethodDescriptor> descriptors = provider.getMethodDescriptors(english);
            for (ExternalAuthMethodDescriptor descriptor : descriptors) {
                ExternalAuthMethodResponse item = new ExternalAuthMethodResponse();
                item.setProviderCode(descriptor.getProviderCode());
                item.setMethodCode(descriptor.getMethodCode());
                item.setDisplayName(english ? descriptor.getDisplayNameEn() : descriptor.getDisplayName());
                item.setDescription(english ? descriptor.getDescriptionEn() : descriptor.getDescription());
                item.setIcon(descriptor.getIcon());
                item.setAvailable(descriptor.isAvailable());
                item.setStatus(descriptor.getStatus());
                item.setStatusMessage(descriptor.getStatusMessage());
                item.setPublicKeyJwk(descriptor.getPublicKeyJwk());
                response.add(item);
            }
        }
        return response;
    }

    @Override
    public ExternalAuthStartResponse start(ExternalAuthStartRequest request, HttpServletRequest servletRequest) {
        cleanupExpiredSessions();
        LoginResponseDTO linkAccount = null;
        if ("ACCOUNT_LINK".equals(request.getPurpose())) {
            linkAccount = currentAccount();
            if (linkAccount == null) throw new IllegalArgumentException("기존 계정으로 로그인한 후 인증을 연결해 주세요.");
            if (!"PORTONE_UNIFIED".equals(request.getMethodCode())) throw new IllegalArgumentException("실 연동 통합인증을 선택해 주세요.");
        }
        // User/account selectors are not an authorization source.
        request.setUserId(null);
        request.setUserSe(null);
        ExternalAuthProvider provider = findProvider(request.getMethodCode());
        ExternalAuthSession session = provider.start(request, servletRequest);
        session.setLinkedUserId(linkAccount == null ? null : linkAccount.getUserId());
        session.setLinkedUserSe(linkAccount == null ? null : linkAccount.getUserSe());
        session.setLinkHttpSessionId(linkAccount == null ? null : servletRequest.getSession(true).getId());
        sessions.put(session.getTxId(), session);

        ExternalAuthStartResponse response = new ExternalAuthStartResponse();
        response.setStatus("ready");
        response.setProviderCode(session.getProviderCode());
        response.setMethodCode(session.getMethodCode());
        response.setTxId(session.getTxId());
        response.setStoreId(session.getStoreId());
        response.setChannelKey(session.getChannelKey());
        response.setAppScheme(session.getAppScheme());
        response.setQrScheme(session.getQrScheme());
        response.setUrlScheme(session.getUrlScheme());
        response.setMessage(session.getMessage());
        response.setMock(session.getUrlScheme() != null && session.getUrlScheme().startsWith("mock://"));
        boolean hasExternalRoute = !ObjectUtils.isEmpty(session.getAppScheme())
                || !ObjectUtils.isEmpty(session.getQrScheme())
                || !ObjectUtils.isEmpty(session.getUrlScheme());
        response.setNextAction("PORTONE_UNIFIED".equals(session.getMethodCode())
                ? "PORTONE_SDK"
                : response.isMock() ? "COMPLETE" : (hasExternalRoute ? "REDIRECT" : "CONFIGURE"));
        return response;
    }

    @Override
    public Map<String, Object> complete(ExternalAuthCompleteRequest request, HttpServletRequest servletRequest,
            HttpServletResponse servletResponse) {
        cleanupExpiredSessions();
        ExternalAuthSession session = sessions.get(request.getTxId());
        if (session == null) {
            return failure("AUTH_SESSION_NOT_FOUND", "인증 세션을 찾을 수 없습니다.");
        }

        String requestedMethod = normalize(request.getMethodCode());
        String sessionMethod = normalize(session.getMethodCode());
        if (requestedMethod.isEmpty() || !sessionMethod.equalsIgnoreCase(requestedMethod)) {
            return failure("AUTH_SESSION_METHOD_MISMATCH", "인증 시작 시 선택한 인증수단과 완료 요청이 일치하지 않습니다.");
        }
        String boundClientIp = normalize(session.getRequestClientIp());
        String completingClientIp = servletRequest == null ? "" : normalize(servletRequest.getRemoteAddr());
        if (!boundClientIp.isEmpty() && !boundClientIp.equals(completingClientIp)) {
            return failure("AUTH_SESSION_CLIENT_MISMATCH", "인증을 시작한 브라우저에서 다시 진행해 주세요.");
        }

        // Consume before contacting the provider so concurrent completion cannot issue two sessions.
        if (!sessions.remove(request.getTxId(), session)) {
            return failure("AUTH_SESSION_USED", "이미 처리한 인증 요청입니다.");
        }
        ExternalAuthProvider provider = findProvider(request.getMethodCode());
        ExternalAuthIdentity identity = provider.complete(session, request, servletRequest);

        Map<String, Object> joinResult = session.getLinkHttpSessionId() == null
                ? completePendingJoinIdentity(servletRequest, identity) : null;
        if (joinResult != null) {
            return joinResult;
        }

        if (!ObjectUtils.isEmpty(request.getUserId()) || !ObjectUtils.isEmpty(request.getUserSe())) {
            return failure("ACCOUNT_LINK_LOGIN_REQUIRED", "계정 연결은 해당 계정으로 로그인한 후 진행해 주세요.");
        }
        if (session.getLinkHttpSessionId() != null) {
            LoginResponseDTO current = currentAccount();
            HttpSession http = servletRequest.getSession(false);
            if (current == null || http == null || !session.getLinkHttpSessionId().equals(http.getId())
                    || !session.getLinkedUserId().equals(current.getUserId())
                    || !session.getLinkedUserSe().equals(current.getUserSe())) {
                return failure("ACCOUNT_LINK_SESSION_CHANGED", "인증을 시작한 로그인 계정과 세션이 달라졌습니다. 다시 진행해 주세요.");
            }
            authService.linkExternalIdentity(current.getUserId(), current.getUserSe(), identity.getAuthTy(),
                    identity.getAuthDn(), identity.getAuthCi(), identity.getAuthDi());
            // Linking never issues tokens, bypasses MFA, or changes roles.
            Map<String, Object> linked = new java.util.HashMap<>();
            linked.put("status", "accountLinkSuccess");
            linked.put("message", "통합인증을 현재 계정에 연결했습니다. 다음 로그인부터 이용할 수 있습니다.");
            return linked;
        }

        LoginResponseDTO loginResult = authService.findLoginUserByExternalIdentity(identity.getAuthCi(), identity.getAuthDi());
        if (loginResult == null) {
            if (authService.countExternalIdentityMatches(identity.getAuthCi()) > 0) {
                return failure("ACCOUNT_LINK_AMBIGUOUS", "인증은 완료됐지만 계정 연결을 확정할 수 없습니다. 관리자에게 중복 연결 또는 계정 상태 확인을 요청해 주세요.");
            }
            Map<String, Object> pending = failure("LINK_REQUIRED", "인증 성공 후 연결된 계정을 찾지 못했습니다. 기존 계정으로 로그인해 인증을 연결해 주세요.");
            pending.put("linkRequired", true);
            putIfPresent(pending, "authTy", identity.getAuthTy());
            putIfPresent(pending, "providerCode", identity.getProviderCode());
            putIfPresent(pending, "methodCode", identity.getMethodCode());
            return pending;
        }

        return withExternalIdentity(authTokenLoginService.issueLogin(loginResult, false, servletRequest, servletResponse),
                identity, false);
    }

    private LoginResponseDTO currentAccount() {
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()
                || auth instanceof org.springframework.security.authentication.AnonymousAuthenticationToken) return null;
        return authService.resolveAuthenticatedLoginUser(auth.getName());
    }

    /**
     * A registration identity check belongs to the existing join HTTP session,
     * not to an already persisted login account. Keep the two flows separate and
     * only enrich a session that already passed the member-type and consent steps.
     */
    private Map<String, Object> completePendingJoinIdentity(HttpServletRequest request,
            ExternalAuthIdentity identity) {
        HttpSession httpSession = request == null ? null : request.getSession(false);
        if (httpSession == null) {
            return null;
        }
        Object pending = httpSession.getAttribute("joinVO");
        if (!(pending instanceof EntrprsManageVO)) {
            return null;
        }
        Object stepValue = httpSession.getAttribute("joinStep");
        int joinStep = stepValue instanceof Number ? ((Number) stepValue).intValue() : 0;
        if (joinStep < 2 || ObjectUtils.isEmpty(identity.getAuthCi()) || ObjectUtils.isEmpty(identity.getAuthDi())) {
            return failure("JOIN_IDENTITY_STATE_INVALID", "회원가입 동의 단계와 본인확인 결과를 다시 확인해 주세요.");
        }

        EntrprsManageVO joinVO = (EntrprsManageVO) pending;
        joinVO.setAuthTy(identity.getAuthTy());
        joinVO.setAuthDn(identity.getAuthDn());
        joinVO.setAuthCi(identity.getAuthCi());
        joinVO.setAuthDi(identity.getAuthDi());
        httpSession.setAttribute("joinVO", joinVO);
        httpSession.setAttribute("joinStep", 3);

        Map<String, Object> payload = withExternalIdentity(new ConcurrentHashMap<>(), identity, false);
        payload.put("status", "joinVerificationSuccess");
        payload.put("success", true);
        payload.put("certified", true);
        payload.put("nextUrl", "/join/step4");
        return payload;
    }

    private Map<String, Object> withExternalIdentity(Map<String, Object> payload, ExternalAuthIdentity identity,
            boolean linkRequired) {
        payload.put("linkRequired", linkRequired);
        putIfPresent(payload, "providerCode", identity.getProviderCode());
        putIfPresent(payload, "methodCode", identity.getMethodCode());
        putIfPresent(payload, "authTy", identity.getAuthTy());
        // PortOne identity claims stay on the server; browser responses need no CI/DI.
        if (!"PORTONE_UNIFIED".equals(identity.getMethodCode())) {
            putIfPresent(payload, "authCi", identity.getAuthCi());
            putIfPresent(payload, "authDi", identity.getAuthDi());
        }
        return payload;
    }

    private void putIfPresent(Map<String, Object> payload, String key, String value) {
        if (value != null) {
            payload.put(key, value);
        }
    }

    private ExternalAuthProvider findProvider(String methodCode) {
        for (ExternalAuthProvider provider : providers) {
            if (provider.supports(methodCode)) {
                return provider;
            }
        }
        throw new IllegalArgumentException("Unsupported external auth method: " + methodCode);
    }

    private void cleanupExpiredSessions() {
        if (sessions.isEmpty()) {
            return;
        }
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(SESSION_TTL_MINUTES);
        for (Map.Entry<String, ExternalAuthSession> entry : new ArrayList<>(sessions.entrySet())) {
            if (entry.getValue() == null || entry.getValue().getRequestedAt() == null
                    || entry.getValue().getRequestedAt().isBefore(threshold)) {
                sessions.remove(entry.getKey());
            }
        }
    }

    private Map<String, Object> failure(String code, String message) {
        Map<String, Object> payload = new ConcurrentHashMap<>();
        payload.put("status", "fail");
        payload.put("code", code);
        payload.put("errors", message);
        return payload;
    }

    private String firstNonBlank(String first, String second) {
        if (!ObjectUtils.isEmpty(first) && !first.trim().isEmpty()) {
            return first.trim();
        }
        if (!ObjectUtils.isEmpty(second) && !second.trim().isEmpty()) {
            return second.trim();
        }
        return "";
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
