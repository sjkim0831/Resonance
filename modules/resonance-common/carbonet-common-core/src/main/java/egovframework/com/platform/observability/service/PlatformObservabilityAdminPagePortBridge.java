package egovframework.com.platform.observability.service;

import egovframework.com.platform.request.observability.BackupConfigSaveRequest;
import egovframework.com.platform.request.observability.BackupRunRequest;
import egovframework.com.platform.request.observability.BackupVersionRestoreRequest;
import egovframework.com.platform.service.observability.PlatformObservabilityAdminPagePort;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;

@Service
public class PlatformObservabilityAdminPagePortBridge implements PlatformObservabilityAdminPagePort {

    private final PlatformObservabilityAdminPageFacade delegate;

    public PlatformObservabilityAdminPagePortBridge(PlatformObservabilityAdminPageFacade delegate) {
        this.delegate = delegate;
    }

    @Override
    public Map<String, Object> buildErrorLogPagePayload(String pageIndexParam, String searchKeyword, String requestedInsttId,
                                                        String sourceType, String errorType, HttpServletRequest request,
                                                        boolean isEn) {
        return delegate.buildErrorLogPagePayload(pageIndexParam, searchKeyword, requestedInsttId, sourceType, errorType, request, isEn);
    }

    @Override
    public Map<String, Object> buildSecurityHistoryPagePayload(String pageIndexParam, String searchKeyword, String userSe,
                                                               String insttId, String actionStatus, HttpServletRequest request,
                                                               boolean isEn) {
        return delegate.buildSecurityHistoryPagePayload(pageIndexParam, searchKeyword, userSe, insttId, actionStatus, request, isEn);
    }

    @Override
    public Map<String, Object> buildSecurityPolicyPagePayload(boolean isEn) {
        return delegate.buildSecurityPolicyPagePayload(isEn);
    }

    @Override
    public Map<String, Object> buildExternalConnectionListPagePayload(boolean isEn) {
        return delegate.buildExternalConnectionListPagePayload(isEn);
    }

    @Override
    public Map<String, Object> buildExternalSchemaPagePayload(boolean isEn) {
        return delegate.buildExternalSchemaPagePayload(isEn);
    }

    @Override
    public Map<String, Object> buildExternalKeysPagePayload(boolean isEn) {
        return delegate.buildExternalKeysPagePayload(isEn);
    }

    @Override
    public Map<String, Object> buildExternalUsagePagePayload(boolean isEn) {
        return delegate.buildExternalUsagePagePayload(isEn);
    }

    @Override
    public Map<String, Object> buildExternalLogsPagePayload(boolean isEn) {
        return delegate.buildExternalLogsPagePayload(isEn);
    }

    @Override
    public Map<String, Object> buildExternalSyncPagePayload(boolean isEn) {
        return delegate.buildExternalSyncPagePayload(isEn);
    }

    @Override
    public Map<String, Object> buildExternalMonitoringPagePayload(boolean isEn) {
        return delegate.buildExternalMonitoringPagePayload(isEn);
    }

    @Override
    public Map<String, Object> buildExternalMaintenancePagePayload(boolean isEn) {
        return delegate.buildExternalMaintenancePagePayload(isEn);
    }

    @Override
    public Map<String, Object> buildExternalRetryPagePayload(boolean isEn) {
        return delegate.buildExternalRetryPagePayload(isEn);
    }

    @Override
    public Map<String, Object> buildExternalWebhooksPagePayload(String keyword, String syncMode, String status, boolean isEn) {
        return delegate.buildExternalWebhooksPagePayload(keyword, syncMode, status, isEn);
    }

    @Override
    public Map<String, Object> buildExternalConnectionFormPagePayload(String mode, String connectionId, boolean isEn) {
        return delegate.buildExternalConnectionFormPagePayload(mode, connectionId, isEn);
    }

    @Override
    public Map<String, Object> buildBlocklistPagePayload(String searchKeyword, String blockType, String status, String source, boolean isEn) {
        return delegate.buildBlocklistPagePayload(searchKeyword, blockType, status, source, isEn);
    }

    @Override
    public Map<String, Object> buildSecurityAuditPagePayload(String pageIndexParam, String searchKeyword, String actionType,
                                                             String routeGroup, String startDate, String endDate,
                                                             String sortKey, String sortDirection, boolean isEn) {
        return delegate.buildSecurityAuditPagePayload(pageIndexParam, searchKeyword, actionType, routeGroup, startDate, endDate, sortKey, sortDirection, isEn);
    }

    @Override
    public Map<String, Object> buildCertificateAuditLogPagePayload(String pageIndexParam, String searchKeyword,
                                                                   String auditType, String status,
                                                                   String certificateType, String startDate,
                                                                   String endDate, boolean isEn) {
        return delegate.buildCertificateAuditLogPagePayload(pageIndexParam, searchKeyword, auditType, status, certificateType, startDate, endDate, isEn);
    }

    @Override
    public Map<String, Object> buildBatchManagementPagePayload(boolean isEn) {
        return delegate.buildBatchManagementPagePayload(isEn);
    }

    @Override
    public Map<String, Object> buildSchedulerPagePayload(String jobStatus, String executionType, boolean isEn) {
        return delegate.buildSchedulerPagePayload(jobStatus, executionType, isEn);
    }

    @Override
    public Map<String, Object> buildBackupConfigPagePayload(boolean isEn) {
        return delegate.buildBackupConfigPagePayload(isEn);
    }

    @Override
    public String exportSecurityAuditCsv(String searchKeyword, String actionType, String routeGroup, String startDate,
                                         String endDate, String sortKey, String sortDirection, boolean isEn) {
        return delegate.exportSecurityAuditCsv(searchKeyword, actionType, routeGroup, startDate, endDate, sortKey, sortDirection, isEn);
    }

    @Override
    public Map<String, Object> saveExternalConnection(Map<String, String> payload, boolean isEn) {
        return delegate.saveExternalConnection(payload, isEn);
    }

    @Override
    public Map<String, Object> saveBackupConfigPayload(BackupConfigSaveRequest requestBody, String actorId, boolean isEn) {
        return delegate.saveBackupConfigPayload(requestBody, actorId, isEn);
    }

    @Override
    public Map<String, Object> restoreBackupConfigVersionPayload(BackupVersionRestoreRequest requestBody, String actorId, boolean isEn) {
        return delegate.restoreBackupConfigVersionPayload(requestBody, actorId, isEn);
    }

    @Override
    public Map<String, Object> runBackupPayload(BackupRunRequest requestBody, String actorId, boolean isEn) {
        return delegate.runBackupPayload(requestBody, actorId, isEn);
    }

    @Override
    public Map<String, Object> buildLoginHistoryPagePayload(String pageIndexParam, String searchKeyword, String userSe,
                                                            String loginResult, String insttId, HttpServletRequest request,
                                                            boolean isEn) {
        return delegate.buildLoginHistoryPagePayload(pageIndexParam, searchKeyword, userSe, loginResult, insttId, request, isEn);
    }

    @Override
    public List<Map<String, String>> loadAccessHistoryCompanyOptions() {
        return delegate.loadAccessHistoryCompanyOptions();
    }

    @Override
    public List<Map<String, String>> buildScopedAccessHistoryCompanyOptions(String insttId) {
        return delegate.buildScopedAccessHistoryCompanyOptions(insttId);
    }
}
