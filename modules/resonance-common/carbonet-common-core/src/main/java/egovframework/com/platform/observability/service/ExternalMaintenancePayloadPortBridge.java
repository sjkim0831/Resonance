package egovframework.com.platform.observability.service;

import egovframework.com.platform.service.observability.ExternalMaintenancePayloadPort;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class ExternalMaintenancePayloadPortBridge implements ExternalMaintenancePayloadPort {

    private final PlatformObservabilityExternalMaintenancePayloadService delegate;

    public ExternalMaintenancePayloadPortBridge(PlatformObservabilityExternalMaintenancePayloadService delegate) {
        this.delegate = delegate;
    }

    @Override
    public Map<String, Object> buildExternalMaintenancePagePayload(boolean isEn) {
        return delegate.buildExternalMaintenancePagePayload(isEn);
    }
}
