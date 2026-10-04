package egovframework.com.feature.auth.external.service.impl;

import egovframework.com.feature.auth.external.config.PortOneV2Properties;
import egovframework.com.feature.auth.external.dto.request.ExternalAuthCompleteRequest;
import egovframework.com.feature.auth.external.dto.request.ExternalAuthStartRequest;
import egovframework.com.feature.auth.external.model.ExternalAuthIdentity;
import egovframework.com.feature.auth.external.model.ExternalAuthMethodDescriptor;
import egovframework.com.feature.auth.external.model.ExternalAuthSession;
import egovframework.com.feature.auth.external.service.ExternalAuthProvider;
import egovframework.com.feature.auth.external.service.PortOneV2Gateway;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class PortOneV2ExternalAuthProvider implements ExternalAuthProvider {
    private static final String METHOD = "PORTONE_UNIFIED";
    private final PortOneV2Properties properties;
    private final PortOneV2Gateway gateway;

    @Override public String getProviderCode() { return "PORTONE_V2"; }
    @Override public boolean supports(String methodCode) { return METHOD.equalsIgnoreCase(methodCode); }

    @Override
    public List<ExternalAuthMethodDescriptor> getMethodDescriptors(boolean english) {
        if (!properties.isReady()) return List.of();
        ExternalAuthMethodDescriptor method = new ExternalAuthMethodDescriptor();
        method.setProviderCode(getProviderCode());
        method.setMethodCode(METHOD);
        method.setDisplayName("통합인증 로그인");
        method.setDisplayNameEn("Unified identity login");
        method.setDescription("포트원 V2·KG이니시스 본인인증");
        method.setDescriptionEn("PortOne V2 KG Inicis identity verification");
        method.setIcon("verified_user");
        method.setAvailable(true);
        method.setStatus("ready");
        return List.of(method);
    }

    @Override
    public ExternalAuthSession start(ExternalAuthStartRequest request, HttpServletRequest servletRequest) {
        if (!supports(request.getMethodCode()) || !properties.isReady())
            throw new IllegalStateException("PORTONE_LIVE_NOT_CONFIGURED");
        ExternalAuthSession session = new ExternalAuthSession();
        session.setProviderCode(getProviderCode());
        session.setMethodCode(METHOD);
        session.setTxId("ccus-live-" + UUID.randomUUID());
        session.setStoreId(properties.getStoreId());
        session.setChannelKey(properties.getChannelKey());
        session.setRequestClientIp(servletRequest.getRemoteAddr());
        session.setRequestedAt(LocalDateTime.now());
        return session;
    }

    @Override
    public ExternalAuthIdentity complete(ExternalAuthSession session, ExternalAuthCompleteRequest request,
            HttpServletRequest servletRequest) {
        if (!properties.isReady() || !METHOD.equals(session.getMethodCode())
                || !session.getTxId().equals(request.getTxId()))
            throw new IllegalStateException("PORTONE_SESSION_INVALID");
        ExternalAuthIdentity identity = new ExternalAuthIdentity();
        identity.setProviderCode(getProviderCode());
        identity.setMethodCode(METHOD);
        identity.setTxId(session.getTxId());
        identity.setAuthTy(METHOD);
        identity.setAuthCi(gateway.verifiedCi(session.getTxId()));
        // KG Inicis does not provide DI; never invent one or require it for login.
        return identity;
    }
}
