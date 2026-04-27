package egovframework.com.platform.observability.service;

import egovframework.com.platform.service.observability.ExternalConnectionFormPayloadPort;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class ExternalConnectionFormPayloadPortBridge implements ExternalConnectionFormPayloadPort {

    private final PlatformObservabilityExternalConnectionFormPayloadService delegate;

    public ExternalConnectionFormPayloadPortBridge(PlatformObservabilityExternalConnectionFormPayloadService delegate) {
        this.delegate = delegate;
    }

    @Override
    public Map<String, Object> buildExternalConnectionFormPagePayload(String mode, String connectionId, boolean isEn) {
        return delegate.buildExternalConnectionFormPagePayload(mode, connectionId, isEn);
    }
}
