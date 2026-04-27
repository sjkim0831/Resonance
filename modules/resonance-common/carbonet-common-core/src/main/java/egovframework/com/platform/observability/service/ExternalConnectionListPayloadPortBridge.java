package egovframework.com.platform.observability.service;

import egovframework.com.platform.service.observability.ExternalConnectionListPayloadPort;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class ExternalConnectionListPayloadPortBridge implements ExternalConnectionListPayloadPort {

    private final PlatformObservabilityExternalConnectionListPayloadService delegate;

    public ExternalConnectionListPayloadPortBridge(PlatformObservabilityExternalConnectionListPayloadService delegate) {
        this.delegate = delegate;
    }

    @Override
    public Map<String, Object> buildExternalConnectionListPagePayload(boolean isEn) {
        return delegate.buildExternalConnectionListPagePayload(isEn);
    }
}
