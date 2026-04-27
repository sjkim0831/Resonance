package egovframework.com.platform.governance.service;

import java.util.List;
import java.util.Map;

public interface AdminSummaryCommandService {

    Map<String, Object> runMenuPermissionAutoCleanup(String actorUserId, boolean isEn, List<String> targetMenuUrls);

    Map<String, Object> updateSecurityInsightState(String actorUserId, boolean isEn, Map<String, Object> payload);

    Map<String, Object> updateSecurityMonitoringState(String actorUserId, boolean isEn, Map<String, Object> payload);

    Map<String, Object> registerSecurityMonitoringBlockCandidate(String actorUserId, boolean isEn, Map<String, Object> payload);

    Map<String, Object> updateSecurityMonitoringBlockCandidate(String actorUserId, boolean isEn, Map<String, Object> payload);

    Map<String, Object> dispatchSecurityMonitoringNotification(String actorUserId, boolean isEn, Map<String, Object> payload);

    Map<String, Object> executeSecurityHistoryAction(String actorUserId, boolean isEn, Map<String, Object> payload);

    Map<String, Object> clearSecurityInsightSuppressions(String actorUserId, boolean isEn);

    Map<String, Object> runSecurityInsightAutoFix(String actorUserId, boolean isEn, Map<String, Object> payload);

    Map<String, Object> runSecurityInsightBulkAutoFix(String actorUserId, boolean isEn, List<Map<String, Object>> findings);

    Map<String, Object> saveSecurityInsightNotificationConfig(String actorUserId, boolean isEn, Map<String, Object> payload);

    Map<String, Object> runSecurityInsightRollback(String actorUserId, boolean isEn, Map<String, Object> payload);

    Map<String, Object> dispatchSecurityInsightNotifications(String actorUserId, boolean isEn, Map<String, Object> payload);

    Map<String, Object> expireSecurityInsightSuppressions(boolean isEn);

    Map<String, Object> runScheduledSecurityInsightDigest(boolean isEn);
}
