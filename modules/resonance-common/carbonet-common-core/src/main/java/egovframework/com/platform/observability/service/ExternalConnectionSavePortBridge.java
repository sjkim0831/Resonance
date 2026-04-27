package egovframework.com.platform.observability.service;

import egovframework.com.platform.service.observability.ExternalConnectionSavePort;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class ExternalConnectionSavePortBridge implements ExternalConnectionSavePort {

    private final PlatformObservabilityExternalConnectionCommandService delegate;

    public ExternalConnectionSavePortBridge(PlatformObservabilityExternalConnectionCommandService delegate) {
        this.delegate = delegate;
    }

    @Override
    public Map<String, Object> saveExternalConnection(Map<String, String> payload, boolean isEn) {
        return delegate.saveExternalConnection(payload, isEn);
    }
}
