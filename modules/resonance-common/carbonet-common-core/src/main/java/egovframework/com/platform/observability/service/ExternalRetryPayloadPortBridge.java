package egovframework.com.platform.observability.service;

import egovframework.com.platform.service.observability.ExternalRetryPayloadPort;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class ExternalRetryPayloadPortBridge implements ExternalRetryPayloadPort {

    private final PlatformObservabilityExternalRetryPayloadService delegate;

    public ExternalRetryPayloadPortBridge(PlatformObservabilityExternalRetryPayloadService delegate) {
        this.delegate = delegate;
    }

    @Override
    public Map<String, Object> buildExternalRetryPagePayload(boolean isEn) {
        return delegate.buildExternalRetryPagePayload(isEn);
    }
}
