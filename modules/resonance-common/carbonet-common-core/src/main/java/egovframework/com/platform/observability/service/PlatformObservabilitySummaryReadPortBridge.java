package egovframework.com.platform.observability.service;

import egovframework.com.common.logging.RequestExecutionLogVO;
import egovframework.com.platform.observability.model.EmissionResultFilterSnapshot;
import egovframework.com.platform.observability.model.EmissionResultSummaryView;
import egovframework.com.platform.observability.model.SecurityAuditAggregate;
import egovframework.com.platform.observability.model.SecurityAuditSnapshot;
import egovframework.com.platform.read.AdminSummaryReadPort;
import egovframework.com.platform.service.observability.PlatformObservabilitySummaryReadPort;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class PlatformObservabilitySummaryReadPortBridge implements PlatformObservabilitySummaryReadPort {

    private final AdminSummaryReadPort delegate;

    public PlatformObservabilitySummaryReadPortBridge(AdminSummaryReadPort delegate) {
        this.delegate = delegate;
    }

    @Override
    public EmissionResultFilterSnapshot buildEmissionResultFilterSnapshot(boolean isEn,
                                                                         String keyword,
                                                                         String normalizedResultStatus,
                                                                         String normalizedVerificationStatus) {
        egovframework.com.feature.admin.model.vo.EmissionResultFilterSnapshot snapshot =
                delegate.buildEmissionResultFilterSnapshot(isEn, keyword, normalizedResultStatus, normalizedVerificationStatus);
        List<EmissionResultSummaryView> items = snapshot.getItems().stream()
                .map(item -> new EmissionResultSummaryView(
                        item.getResultId(),
                        item.getProjectName(),
                        item.getCompanyName(),
                        item.getCalculatedAt(),
                        item.getTotalEmission(),
                        item.getResultStatusCode(),
                        item.getResultStatusLabel(),
                        item.getVerificationStatusCode(),
                        item.getVerificationStatusLabel(),
                        item.getDetailUrl()))
                .collect(Collectors.toList());
        return new EmissionResultFilterSnapshot(items, snapshot.getReviewCount(), snapshot.getVerifiedCount());
    }

    @Override
    public List<Map<String, String>> getSecurityMonitoringCards(boolean isEn) {
        return delegate.getSecurityMonitoringCards(isEn);
    }

    @Override
    public List<Map<String, String>> getSecurityMonitoringTargets(boolean isEn) {
        return delegate.getSecurityMonitoringTargets(isEn);
    }

    @Override
    public List<Map<String, String>> getSecurityMonitoringIps(boolean isEn) {
        return delegate.getSecurityMonitoringIps(isEn);
    }

    @Override
    public List<Map<String, String>> getSecurityMonitoringEvents(boolean isEn) {
        return delegate.getSecurityMonitoringEvents(isEn);
    }

    @Override
    public List<Map<String, String>> mergeSecurityMonitoringEventState(List<Map<String, String>> rows, boolean isEn) {
        return delegate.mergeSecurityMonitoringEventState(rows, isEn);
    }

    @Override
    public List<Map<String, String>> getSecurityMonitoringActivityRows(boolean isEn) {
        return delegate.getSecurityMonitoringActivityRows(isEn);
    }

    @Override
    public List<Map<String, String>> getSecurityMonitoringBlockCandidateRows(boolean isEn) {
        return delegate.getSecurityMonitoringBlockCandidateRows(isEn);
    }

    @Override
    public List<Map<String, String>> getBlocklistSummary(boolean isEn) {
        return delegate.getBlocklistSummary(isEn);
    }

    @Override
    public List<Map<String, String>> getBlocklistRows(boolean isEn) {
        return delegate.getBlocklistRows(isEn);
    }

    @Override
    public List<Map<String, String>> getBlocklistReleaseQueue(boolean isEn) {
        return delegate.getBlocklistReleaseQueue(isEn);
    }

    @Override
    public List<Map<String, String>> getBlocklistReleaseHistory(boolean isEn) {
        return delegate.getBlocklistReleaseHistory(isEn);
    }

    @Override
    public List<Map<String, String>> getSecurityHistoryActionRows(boolean isEn) {
        return delegate.getSecurityHistoryActionRows(isEn);
    }

    @Override
    public SecurityAuditSnapshot loadSecurityAuditSnapshot() {
        egovframework.com.feature.admin.model.vo.SecurityAuditSnapshot snapshot = delegate.loadSecurityAuditSnapshot();
        SecurityAuditAggregate aggregate = new SecurityAuditAggregate();
        for (RequestExecutionLogVO auditLog : snapshot.getAuditLogs()) {
            aggregate.accept(auditLog);
        }
        return new SecurityAuditSnapshot(snapshot.getAuditLogs(), aggregate);
    }

    @Override
    public List<Map<String, String>> getSecurityAuditSummary(SecurityAuditSnapshot auditSnapshot, boolean isEn) {
        egovframework.com.feature.admin.model.vo.SecurityAuditAggregate aggregate =
                new egovframework.com.feature.admin.model.vo.SecurityAuditAggregate();
        for (RequestExecutionLogVO auditLog : auditSnapshot.getAuditLogs()) {
            aggregate.accept(auditLog);
        }
        egovframework.com.feature.admin.model.vo.SecurityAuditSnapshot legacySnapshot =
                new egovframework.com.feature.admin.model.vo.SecurityAuditSnapshot(auditSnapshot.getAuditLogs(), aggregate);
        return delegate.getSecurityAuditSummary(legacySnapshot, isEn);
    }

    @Override
    public List<Map<String, String>> buildSecurityAuditRows(List<RequestExecutionLogVO> auditLogs, boolean isEn) {
        return delegate.buildSecurityAuditRows(auditLogs, isEn);
    }
}
