package egovframework.com.platform.observability.service;

import egovframework.com.platform.service.observability.ExternalKeysPayloadPort;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class ExternalKeysPayloadPortBridge implements ExternalKeysPayloadPort {

    private final PlatformObservabilityExternalKeysPayloadService delegate;

    public ExternalKeysPayloadPortBridge(PlatformObservabilityExternalKeysPayloadService delegate) {
        this.delegate = delegate;
    }

    @Override
    public Map<String, Object> buildExternalKeysPagePayload(boolean isEn) {
        return delegate.buildExternalKeysPagePayload(isEn);
    }
}
