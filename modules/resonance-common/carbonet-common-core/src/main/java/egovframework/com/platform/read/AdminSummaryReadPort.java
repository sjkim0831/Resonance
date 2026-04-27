package egovframework.com.platform.read;

import egovframework.com.common.logging.RequestExecutionLogVO;
import egovframework.com.feature.admin.model.vo.EmissionResultFilterSnapshot;
import egovframework.com.platform.governance.model.vo.FeatureCatalogSectionVO;
import egovframework.com.platform.governance.model.vo.FeatureCatalogSummarySnapshot;
import egovframework.com.feature.admin.model.vo.SecurityAuditSnapshot;

import java.util.List;
import java.util.Map;

public interface AdminSummaryReadPort {

    FeatureCatalogSummarySnapshot summarizeFeatureCatalog(List<FeatureCatalogSectionVO> featureSections);

    EmissionResultFilterSnapshot buildEmissionResultFilterSnapshot(boolean isEn,
            String keyword,
            String normalizedResultStatus,
            String normalizedVerificationStatus);

    List<Map<String, String>> getIpWhitelistSummary(boolean isEn);

    List<Map<String, String>> getSecurityPolicySummary(boolean isEn);

    List<Map<String, String>> getSecurityMonitoringCards(boolean isEn);

    List<Map<String, String>> getSecurityMonitoringTargets(boolean isEn);

    List<Map<String, String>> getSecurityMonitoringIps(boolean isEn);

    List<Map<String, String>> getSecurityMonitoringEvents(boolean isEn);

    List<Map<String, String>> mergeSecurityMonitoringEventState(List<Map<String, String>> rows, boolean isEn);

    List<Map<String, String>> getSecurityMonitoringActivityRows(boolean isEn);

    List<Map<String, String>> getSecurityMonitoringBlockCandidateRows(boolean isEn);

    List<Map<String, String>> getSecurityHistoryActionRows(boolean isEn);

    List<Map<String, String>> getBlocklistSummary(boolean isEn);

    List<Map<String, String>> getBlocklistRows(boolean isEn);

    List<Map<String, String>> getBlocklistReleaseQueue(boolean isEn);

    List<Map<String, String>> getBlocklistReleaseHistory(boolean isEn);

    SecurityAuditSnapshot loadSecurityAuditSnapshot();

    List<Map<String, String>> getSecurityAuditSummary(SecurityAuditSnapshot auditSnapshot, boolean isEn);

    List<Map<String, String>> buildSecurityAuditRows(List<RequestExecutionLogVO> auditLogs, boolean isEn);

    List<Map<String, String>> getSchedulerSummary(boolean isEn);

    Map<String, Object> buildMenuPermissionDiagnosticSummary(boolean isEn);
}
