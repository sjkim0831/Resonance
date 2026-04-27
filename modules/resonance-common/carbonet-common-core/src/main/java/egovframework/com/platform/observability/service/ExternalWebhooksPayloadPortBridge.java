package egovframework.com.platform.observability.service;

import egovframework.com.platform.service.observability.ExternalWebhooksPayloadPort;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class ExternalWebhooksPayloadPortBridge implements ExternalWebhooksPayloadPort {

    private final PlatformObservabilityExternalWebhooksPayloadService delegate;

    public ExternalWebhooksPayloadPortBridge(PlatformObservabilityExternalWebhooksPayloadService delegate) {
        this.delegate = delegate;
    }

    @Override
    public Map<String, Object> buildExternalWebhooksPagePayload(String keyword, String syncMode, String status, boolean isEn) {
        return delegate.buildExternalWebhooksPagePayload(keyword, syncMode, status, isEn);
    }
}
