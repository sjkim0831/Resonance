package egovframework.com.platform.observability.service;

import egovframework.com.platform.service.observability.AdminSecurityBootstrapReadPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PlatformObservabilitySecurityPolicyPayloadService {

    private final AdminSecurityBootstrapReadPort adminSecurityBootstrapReadService;

    public Map<String, Object> buildSecurityPolicyPagePayload(boolean isEn) {
        return new LinkedHashMap<>(adminSecurityBootstrapReadService.buildSecurityPolicyPageData(isEn));
    }
}
