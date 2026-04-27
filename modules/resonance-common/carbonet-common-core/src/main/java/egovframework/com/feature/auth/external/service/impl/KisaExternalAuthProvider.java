package egovframework.com.feature.auth.external.service.impl;

import egovframework.com.feature.auth.external.config.ExternalAuthProperties;
import egovframework.com.feature.auth.external.dto.request.ExternalAuthCompleteRequest;
import egovframework.com.feature.auth.external.dto.request.ExternalAuthStartRequest;
import egovframework.com.feature.auth.external.model.ExternalAuthIdentity;
import egovframework.com.feature.auth.external.model.ExternalAuthMethodDescriptor;
import egovframework.com.feature.auth.external.model.ExternalAuthSession;
import egovframework.com.feature.auth.external.service.ExternalAuthAdapter;
import egovframework.com.feature.auth.external.service.ExternalAuthProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.ObjectUtils;

import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
public class KisaExternalAuthProvider implements ExternalAuthProvider {

    private static final String PROVIDER_CODE = "KISA_DAPC";

    private final ExternalAuthProperties properties;
    private final KisaSdkV1Adapter kisaSdkV1Adapter;

    @Override
    public String getProviderCode() {
        return PROVIDER_CODE;
    }

    @Override
    public List<ExternalAuthMethodDescriptor> getMethodDescriptors(boolean english) {
        List<ExternalAuthMethodDescriptor> methods = new ArrayList<>();
        if (!properties.isEnabled() || !properties.getKisa().isEnabled()) {
            return methods;
        }

        for (String methodCode : properties.getMethodOrder()) {
            methods.add(buildDescriptor(methodCode));
        }
        return methods;
    }

    @Override
    public boolean supports(String methodCode) {
        String normalized = normalize(methodCode);
        return "SIMPLE".equals(normalized) || "JOINT".equals(normalized) || "FINANCIAL".equals(normalized);
    }

    @Override
    public ExternalAuthSession start(ExternalAuthStartRequest request, HttpServletRequest servletRequest) {
        if (!supports(request.getMethodCode())) {
            throw new IllegalArgumentException("Unsupported external auth method: " + request.getMethodCode());
        }
        return resolveAdapter().prepare(PROVIDER_CODE, request, servletRequest);
    }

    @Override
    public ExternalAuthIdentity complete(ExternalAuthSession session, ExternalAuthCompleteRequest request,
            HttpServletRequest servletRequest) {
        return resolveAdapter().resolve(PROVIDER_CODE, session, request, servletRequest);
    }

    private ExternalAuthMethodDescriptor buildDescriptor(String methodCode) {
        String normalized = normalize(methodCode);
        ExternalAuthMethodDescriptor descriptor = new ExternalAuthMethodDescriptor();
        descriptor.setProviderCode(PROVIDER_CODE);
        descriptor.setMethodCode(normalized);
        descriptor.setIcon(resolveIcon(normalized));
        descriptor.setAvailable(properties.isMockSuccessEnabled() || kisaSdkV1Adapter.isReadyForLiveFlow());

        if ("SIMPLE".equals(normalized)) {
            descriptor.setDisplayName("간편인증");
            descriptor.setDisplayNameEn("Simple Authentication");
            descriptor.setDescription("카카오, 네이버, 토스 등 앱 기반 인증");
            descriptor.setDescriptionEn("App-based identity verification such as Kakao, Naver, and Toss");
        } else if ("JOINT".equals(normalized)) {
            descriptor.setDisplayName("공동인증서");
            descriptor.setDisplayNameEn("Joint Certificate");
            descriptor.setDescription("공동인증서를 통한 본인 확인");
            descriptor.setDescriptionEn("Identity verification using a joint certificate");
        } else {
            descriptor.setDisplayName("금융인증서");
            descriptor.setDisplayNameEn("Financial Certificate");
            descriptor.setDescription("금융결제원 기반 브라우저 인증");
            descriptor.setDescriptionEn("Browser-based KFTC certificate authentication");
        }

        if (properties.isMockSuccessEnabled()) {
            descriptor.setStatus("mock");
            descriptor.setStatusMessage("Mock adapter active");
        } else if (kisaSdkV1Adapter.isReadyForLiveFlow()) {
            descriptor.setStatus("ready");
            descriptor.setStatusMessage("SDK adapter and live endpoints ready");
        } else if (resolveAdapter().isAvailable()) {
            descriptor.setStatus("pending");
            descriptor.setStatusMessage("SDK loaded, but live endpoint configuration is missing");
        } else {
            descriptor.setStatus("pending");
            descriptor.setStatusMessage("SDK jar or live endpoint configuration required");
        }
        descriptor.setPublicKeyJwk(properties.getKisa().getPublicKeyJwk());

        return descriptor;
    }

    private ExternalAuthAdapter resolveAdapter() {
        String version = normalize(properties.getKisa().getAdapterVersion());
        if (ObjectUtils.isEmpty(version) || "V1".equalsIgnoreCase(version)) {
            return kisaSdkV1Adapter;
        }
        throw new IllegalStateException("Unsupported KISA adapter version: " + version);
    }

    private String resolveIcon(String methodCode) {
        if ("JOINT".equals(methodCode)) {
            return "badge";
        }
        if ("FINANCIAL".equals(methodCode)) {
            return "account_balance";
        }
        return "verified_user";
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase();
    }
}
