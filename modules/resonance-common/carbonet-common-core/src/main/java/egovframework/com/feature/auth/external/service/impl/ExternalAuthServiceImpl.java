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
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.ObjectUtils;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
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
        ExternalAuthProvider provider = findProvider(request.getMethodCode());
        ExternalAuthSession session = provider.start(request, servletRequest);
        sessions.put(session.getTxId(), session);

        ExternalAuthStartResponse response = new ExternalAuthStartResponse();
        response.setStatus("ready");
        response.setProviderCode(session.getProviderCode());
        response.setMethodCode(session.getMethodCode());
        response.setTxId(session.getTxId());
        response.setAppScheme(session.getAppScheme());
        response.setQrScheme(session.getQrScheme());
        response.setUrlScheme(session.getUrlScheme());
        response.setMessage(session.getMessage());
        response.setMock(session.getUrlScheme() != null && session.getUrlScheme().startsWith("mock://"));
        response.setNextAction(response.isMock() ? "COMPLETE" : "REDIRECT");
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

        ExternalAuthProvider provider = findProvider(request.getMethodCode());
        ExternalAuthIdentity identity = provider.complete(session, request, servletRequest);
        sessions.remove(request.getTxId());

        String linkUserId = firstNonBlank(request.getUserId(), session.getLinkedUserId());
        String linkUserSe = firstNonBlank(request.getUserSe(), session.getLinkedUserSe());

        if (!ObjectUtils.isEmpty(linkUserId) && !ObjectUtils.isEmpty(linkUserSe)) {
            authService.updateAuthInfo(linkUserId, linkUserSe, identity.getAuthTy(), identity.getAuthDn(),
                    identity.getAuthCi(), identity.getAuthDi());
            LoginResponseDTO loginResult = authService.selectLoginUser(linkUserSe, linkUserId);
            if (loginResult == null) {
                return failure("ACCOUNT_NOT_FOUND", "인증 대상 계정을 찾을 수 없습니다.");
            }
            return withExternalIdentity(authTokenLoginService.issueLogin(loginResult, false, servletRequest, servletResponse),
                    identity, false);
        }

        LoginResponseDTO loginResult = authService.findLoginUserByExternalIdentity(identity.getAuthCi(), identity.getAuthDi());
        if (loginResult == null) {
            Map<String, Object> pending = failure("LINK_REQUIRED", "인증 성공 후 연결된 계정을 찾지 못했습니다. 기존 계정으로 로그인해 인증을 연결해 주세요.");
            pending.put("linkRequired", true);
            pending.put("authTy", identity.getAuthTy());
            pending.put("providerCode", identity.getProviderCode());
            pending.put("methodCode", identity.getMethodCode());
            return pending;
        }

        return withExternalIdentity(authTokenLoginService.issueLogin(loginResult, false, servletRequest, servletResponse),
                identity, false);
    }

    private Map<String, Object> withExternalIdentity(Map<String, Object> payload, ExternalAuthIdentity identity,
            boolean linkRequired) {
        payload.put("linkRequired", linkRequired);
        payload.put("providerCode", identity.getProviderCode());
        payload.put("methodCode", identity.getMethodCode());
        payload.put("authTy", identity.getAuthTy());
        payload.put("authCi", identity.getAuthCi());
        payload.put("authDi", identity.getAuthDi());
        return payload;
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
}
