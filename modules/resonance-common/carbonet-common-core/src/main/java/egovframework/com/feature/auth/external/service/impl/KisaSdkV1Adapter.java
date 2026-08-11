package egovframework.com.feature.auth.external.service.impl;

import egovframework.com.feature.auth.external.config.ExternalAuthProperties;
import egovframework.com.feature.auth.external.dto.request.ExternalAuthCompleteRequest;
import egovframework.com.feature.auth.external.dto.request.ExternalAuthStartRequest;
import egovframework.com.feature.auth.external.model.ExternalAuthIdentity;
import egovframework.com.feature.auth.external.model.ExternalAuthSession;
import egovframework.com.feature.auth.external.service.ExternalAuthAdapter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.ObjectUtils;

import jakarta.servlet.http.HttpServletRequest;
import java.io.File;
import java.io.FileInputStream;
import java.net.URL;
import java.net.URLClassLoader;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class KisaSdkV1Adapter implements ExternalAuthAdapter {

    private final ExternalAuthProperties properties;

    @Override
    public String getVersion() {
        return "v1";
    }

    @Override
    public boolean isAvailable() {
        return sdkJarExists() && hasTrustedSdkFingerprint() && canLoadSdkClasses();
    }

    public boolean isReadyForLiveFlow() {
        return isAvailable()
                && hasCompleteLiveConfiguration()
                && isLiveOrchestrationImplemented();
    }

    public boolean hasCompleteLiveConfiguration() {
        ExternalAuthProperties.Kisa kisa = properties.getKisa();
        return !ObjectUtils.isEmpty(kisa.getClientId())
                && !ObjectUtils.isEmpty(kisa.getServiceCode())
                && !ObjectUtils.isEmpty(kisa.getCaCode())
                && !ObjectUtils.isEmpty(kisa.getPrepareEndpoint())
                && !ObjectUtils.isEmpty(kisa.getResultEndpoint())
                && !ObjectUtils.isEmpty(kisa.getCallbackScheme());
    }

    /**
     * Fail closed until the provider-specific request signing, result polling,
     * signature verification, and CI/DI extraction contract is implemented.
     */
    public boolean isLiveOrchestrationImplemented() {
        return false;
    }

    @Override
    public ExternalAuthSession prepare(String providerCode, ExternalAuthStartRequest request, HttpServletRequest servletRequest) {
        ExternalAuthSession session = new ExternalAuthSession();
        session.setProviderCode(providerCode);
        session.setMethodCode(normalize(request.getMethodCode()));
        session.setTxId(UUID.randomUUID().toString().replace("-", ""));
        session.setLinkedUserId(normalize(request.getUserId()));
        session.setLinkedUserSe(normalize(request.getUserSe()));
        session.setRequestClientIp(servletRequest == null ? "" : normalize(servletRequest.getRemoteAddr()));
        session.setRequestedAt(LocalDateTime.now());

        if (properties.isMockSuccessEnabled()) {
            session.setMessage("KISA adapter mock mode is enabled.");
            session.setUrlScheme("mock://external-auth/" + session.getTxId());
            return session;
        }

        if (!isReadyForLiveFlow()) {
            if (!isAvailable()) {
                throw new IllegalStateException("KISA SDK jar is not available or could not be loaded.");
            }
            session.setMessage("KISA SDK is loaded, but the complete provider configuration and verified live orchestration are required.");
            return session;
        }

        session.setMessage("KISA SDK adapter is ready. Configure remote prepare/result orchestration for live authentication.");
        session.setUrlScheme(properties.getKisa().getPrepareEndpoint());
        return session;
    }

    @Override
    public ExternalAuthIdentity resolve(String providerCode, ExternalAuthSession session,
            ExternalAuthCompleteRequest request, HttpServletRequest servletRequest) {
        if (properties.isMockSuccessEnabled()) {
            ExternalAuthIdentity identity = new ExternalAuthIdentity();
            identity.setProviderCode(providerCode);
            identity.setMethodCode(session.getMethodCode());
            identity.setTxId(session.getTxId());
            identity.setAuthTy(session.getMethodCode());
            identity.setAuthCi("MOCK-CI-" + session.getTxId());
            identity.setAuthDi("MOCK-DI-" + session.getTxId());
            identity.setAuthDn("mock-user-" + session.getTxId());
            identity.setUserName("Mock External User");
            return identity;
        }

        validateLiveReadiness();
        throw new IllegalStateException("Live KISA result resolution is not fully configured yet. Set mock mode or complete endpoint binding.");
    }

    private boolean sdkJarExists() {
        String jarPath = properties.getKisa().getSdkJarPath();
        return !ObjectUtils.isEmpty(jarPath) && new File(jarPath).isFile();
    }

    private boolean canLoadSdkClasses() {
        String jarPath = properties.getKisa().getSdkJarPath();
        if (ObjectUtils.isEmpty(jarPath)) {
            return false;
        }
        File jarFile = new File(jarPath);
        if (!jarFile.isFile()) {
            return false;
        }
        try (URLClassLoader classLoader = new URLClassLoader(new URL[]{jarFile.toURI().toURL()},
                getClass().getClassLoader())) {
            classLoader.loadClass("kr.or.kisa.dapc.core.msg.PrepareRequest");
            classLoader.loadClass("kr.or.kisa.dapc.core.msg.ResultResponse");
            try {
                classLoader.loadClass("sdk.Library");
                return false;
            } catch (ClassNotFoundException expectedForOfficialSdk) {
                // Gradle's generated sdk.Library marks the placeholder archive.
            }
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean hasTrustedSdkFingerprint() {
        String expected = normalize(properties.getKisa().getSdkSha256()).toLowerCase();
        if (!expected.matches("[0-9a-f]{64}")) {
            return false;
        }
        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
            try (FileInputStream input = new FileInputStream(properties.getKisa().getSdkJarPath())) {
                byte[] buffer = new byte[8192];
                for (int read; (read = input.read(buffer)) >= 0;) {
                    digest.update(buffer, 0, read);
                }
            }
        } catch (Exception ignored) {
            return false;
        }
        return MessageDigest.isEqual(expected.getBytes(java.nio.charset.StandardCharsets.US_ASCII),
                HexFormat.of().formatHex(digest.digest()).getBytes(java.nio.charset.StandardCharsets.US_ASCII));
    }

    private void validateLiveReadiness() {
        if (!isAvailable()) {
            throw new IllegalStateException("KISA SDK jar is not available or could not be loaded.");
        }
        if (!isReadyForLiveFlow()) {
            throw new IllegalStateException("KISA live configuration or verified provider orchestration is incomplete.");
        }
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
