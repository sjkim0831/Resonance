package egovframework.com.platform.service.observability;

import egovframework.com.common.logging.RequestExecutionLogVO;
import egovframework.com.platform.observability.model.EmissionResultFilterSnapshot;
import egovframework.com.platform.observability.model.SecurityAuditSnapshot;

import java.util.List;
import java.util.Map;

public interface PlatformObservabilitySummaryReadPort {

    EmissionResultFilterSnapshot buildEmissionResultFilterSnapshot(boolean isEn,
                                                                  String keyword,
                                                                  String normalizedResultStatus,
                                                                  String normalizedVerificationStatus);

    List<Map<String, String>> getSecurityMonitoringCards(boolean isEn);

    List<Map<String, String>> getSecurityMonitoringTargets(boolean isEn);

    List<Map<String, String>> getSecurityMonitoringIps(boolean isEn);

    List<Map<String, String>> getSecurityMonitoringEvents(boolean isEn);

    List<Map<String, String>> mergeSecurityMonitoringEventState(List<Map<String, String>> rows, boolean isEn);

    List<Map<String, String>> getSecurityMonitoringActivityRows(boolean isEn);

    List<Map<String, String>> getSecurityMonitoringBlockCandidateRows(boolean isEn);

    List<Map<String, String>> getBlocklistSummary(boolean isEn);

    List<Map<String, String>> getBlocklistRows(boolean isEn);

    List<Map<String, String>> getBlocklistReleaseQueue(boolean isEn);

    List<Map<String, String>> getBlocklistReleaseHistory(boolean isEn);

    List<Map<String, String>> getSecurityHistoryActionRows(boolean isEn);

    SecurityAuditSnapshot loadSecurityAuditSnapshot();

    List<Map<String, String>> getSecurityAuditSummary(SecurityAuditSnapshot auditSnapshot, boolean isEn);

    List<Map<String, String>> buildSecurityAuditRows(List<RequestExecutionLogVO> auditLogs, boolean isEn);
}
