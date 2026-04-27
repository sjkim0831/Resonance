package egovframework.com.platform.observability.service;

import egovframework.com.platform.service.observability.ExternalSchemaPayloadPort;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class ExternalSchemaPayloadPortBridge implements ExternalSchemaPayloadPort {

    private final PlatformObservabilityExternalSchemaPayloadService delegate;

    public ExternalSchemaPayloadPortBridge(PlatformObservabilityExternalSchemaPayloadService delegate) {
        this.delegate = delegate;
    }

    @Override
    public Map<String, Object> buildExternalSchemaPagePayload(boolean isEn) {
        return delegate.buildExternalSchemaPagePayload(isEn);
    }
}
