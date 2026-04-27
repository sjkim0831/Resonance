package egovframework.com.platform.observability.service;

import egovframework.com.platform.service.observability.ExternalUsagePayloadPort;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class ExternalUsagePayloadPortBridge implements ExternalUsagePayloadPort {

    private final PlatformObservabilityExternalUsagePayloadService delegate;

    public ExternalUsagePayloadPortBridge(PlatformObservabilityExternalUsagePayloadService delegate) {
        this.delegate = delegate;
    }

    @Override
    public Map<String, Object> buildExternalUsagePagePayload(boolean isEn) {
        return delegate.buildExternalUsagePagePayload(isEn);
    }
}
