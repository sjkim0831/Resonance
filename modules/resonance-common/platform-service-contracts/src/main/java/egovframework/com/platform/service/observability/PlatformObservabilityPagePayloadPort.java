package egovframework.com.platform.service.observability;

import java.util.Map;

public interface PlatformObservabilityPagePayloadPort {

    Map<String, Object> buildNotificationPagePayload(boolean isEn, String deliveryChannel, String deliveryStatus,
                                                     String deliveryKeyword, String deliveryPage,
                                                     String activityAction, String activityKeyword, String activityPage);

    Map<String, Object> buildPerformancePagePayload(jakarta.servlet.http.HttpServletRequest request, boolean isEn);

    Map<String, Object> buildOperationsCenterPagePayload(jakarta.servlet.http.HttpServletRequest request, boolean isEn);

    Map<String, Object> buildSensorListPagePayload(boolean isEn);

    Map<String, Object> buildSecurityMonitoringPagePayload(boolean isEn);
}
