package egovframework.com.platform.observability.service;

import egovframework.com.platform.service.observability.ExternalLogsPayloadPort;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class ExternalLogsPayloadPortBridge implements ExternalLogsPayloadPort {

    private final PlatformObservabilityExternalLogsPayloadService delegate;

    public ExternalLogsPayloadPortBridge(PlatformObservabilityExternalLogsPayloadService delegate) {
        this.delegate = delegate;
    }

    @Override
    public Map<String, Object> buildExternalLogsPagePayload(boolean isEn) {
        return delegate.buildExternalLogsPagePayload(isEn);
    }
}
