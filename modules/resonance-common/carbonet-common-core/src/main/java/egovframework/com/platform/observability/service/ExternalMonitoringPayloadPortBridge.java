package egovframework.com.platform.observability.service;

import egovframework.com.platform.service.observability.ExternalMonitoringPayloadPort;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class ExternalMonitoringPayloadPortBridge implements ExternalMonitoringPayloadPort {

    private final PlatformObservabilityExternalMonitoringPayloadService delegate;

    public ExternalMonitoringPayloadPortBridge(PlatformObservabilityExternalMonitoringPayloadService delegate) {
        this.delegate = delegate;
    }

    @Override
    public Map<String, Object> buildExternalMonitoringPagePayload(boolean isEn) {
        return delegate.buildExternalMonitoringPagePayload(isEn);
    }
}
