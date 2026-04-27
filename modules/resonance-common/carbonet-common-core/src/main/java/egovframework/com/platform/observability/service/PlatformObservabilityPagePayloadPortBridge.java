package egovframework.com.platform.observability.service;

import egovframework.com.platform.service.observability.PlatformObservabilityPagePayloadPort;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;

@Service
public class PlatformObservabilityPagePayloadPortBridge implements PlatformObservabilityPagePayloadPort {

    private final PlatformObservabilityPagePayloadService delegate;

    public PlatformObservabilityPagePayloadPortBridge(PlatformObservabilityPagePayloadService delegate) {
        this.delegate = delegate;
    }

    @Override
    public Map<String, Object> buildNotificationPagePayload(boolean isEn, String deliveryChannel, String deliveryStatus,
                                                            String deliveryKeyword, String deliveryPage,
                                                            String activityAction, String activityKeyword, String activityPage) {
        return delegate.buildNotificationPagePayload(isEn, deliveryChannel, deliveryStatus, deliveryKeyword, deliveryPage,
                activityAction, activityKeyword, activityPage);
    }

    @Override
    public Map<String, Object> buildPerformancePagePayload(HttpServletRequest request, boolean isEn) {
        return delegate.buildPerformancePagePayload(request, isEn);
    }

    @Override
    public Map<String, Object> buildOperationsCenterPagePayload(HttpServletRequest request, boolean isEn) {
        return delegate.buildOperationsCenterPagePayload(request, isEn);
    }

    @Override
    public Map<String, Object> buildSensorListPagePayload(boolean isEn) {
        return delegate.buildSensorListPagePayload(isEn);
    }

    @Override
    public Map<String, Object> buildSecurityMonitoringPagePayload(boolean isEn) {
        return delegate.buildSecurityMonitoringPagePayload(isEn);
    }
}
