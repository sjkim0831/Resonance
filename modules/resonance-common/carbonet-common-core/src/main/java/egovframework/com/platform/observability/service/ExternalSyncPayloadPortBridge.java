package egovframework.com.platform.observability.service;

import egovframework.com.platform.service.observability.ExternalSyncPayloadPort;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class ExternalSyncPayloadPortBridge implements ExternalSyncPayloadPort {

    private final PlatformObservabilityExternalSyncPayloadService delegate;

    public ExternalSyncPayloadPortBridge(PlatformObservabilityExternalSyncPayloadService delegate) {
        this.delegate = delegate;
    }

    @Override
    public Map<String, Object> buildExternalSyncPagePayload(boolean isEn) {
        return delegate.buildExternalSyncPagePayload(isEn);
    }
}
