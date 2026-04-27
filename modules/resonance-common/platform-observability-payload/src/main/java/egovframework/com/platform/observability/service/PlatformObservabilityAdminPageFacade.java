package egovframework.com.platform.observability.service;

import egovframework.com.platform.request.observability.BackupConfigSaveRequest;
import egovframework.com.platform.request.observability.BackupRunRequest;
import egovframework.com.platform.request.observability.BackupVersionRestoreRequest;
import egovframework.com.platform.service.observability.CertificateAuditLogPageDataPort;
import egovframework.com.platform.service.observability.ExternalConnectionListPayloadPort;
import egovframework.com.platform.service.observability.ExternalConnectionFormPayloadPort;
import egovframework.com.platform.service.observability.ExternalConnectionSavePort;
import egovframework.com.platform.service.observability.ExternalKeysPayloadPort;
import egovframework.com.platform.service.observability.ExternalLogsPayloadPort;
import egovframework.com.platform.service.observability.ExternalMonitoringPayloadPort;
import egovframework.com.platform.service.observability.ExternalMaintenancePayloadPort;
import egovframework.com.platform.service.observability.ExternalRetryPayloadPort;
import egovframework.com.platform.service.observability.ExternalSchemaPayloadPort;
import egovframework.com.platform.service.observability.ExternalSyncPayloadPort;
import egovframework.com.platform.service.observability.ExternalUsagePayloadPort;
import egovframework.com.platform.service.observability.ExternalWebhooksPayloadPort;
import egovframework.com.platform.service.observability.PlatformObservabilityCompanyScopePort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PlatformObservabilityAdminPageFacade {

    private final PlatformObservabilityCompanyScopePort companyScopeService;
    private final PlatformObservabilityHistoryPayloadService historyPayloadService;
    private final PlatformObservabilityErrorLogPayloadService errorLogPayloadService;
    private final PlatformObservabilitySecurityAuditPayloadService securityAuditPayloadService;
    private final CertificateAuditLogPageDataPort certificateAuditLogPageDataPort;
    private final PlatformObservabilitySecurityPolicyPayloadService securityPolicyPayloadService;
    private final PlatformObservabilityBlocklistPayloadService blocklistPayloadService;
    private final PlatformObservabilitySchedulerPayloadService schedulerPayloadService;
    private final PlatformObservabilityBatchManagementPayloadService batchManagementPayloadService;
    private final PlatformObservabilityBackupPayloadService backupPayloadService;
    private final ExternalConnectionListPayloadPort externalConnectionListPayloadService;
    private final ExternalConnectionFormPayloadPort externalConnectionFormPayloadService;
    private final ExternalConnectionSavePort externalConnectionSavePort;
    private final ExternalKeysPayloadPort externalKeysPayloadService;
    private final ExternalLogsPayloadPort externalLogsPayloadService;
    private final ExternalMonitoringPayloadPort externalMonitoringPayloadService;
    private final ExternalMaintenancePayloadPort externalMaintenancePayloadService;
    private final ExternalRetryPayloadPort externalRetryPayloadService;
    private final ExternalSchemaPayloadPort externalSchemaPayloadService;
    private final ExternalSyncPayloadPort externalSyncPayloadService;
    private final ExternalUsagePayloadPort externalUsagePayloadService;
    private final ExternalWebhooksPayloadPort externalWebhooksPayloadService;

    public Map<String, Object> buildSecurityHistoryPagePayload(String pageIndexParam, String searchKeyword, String userSe,
                                                               String insttId, String actionStatus,
                                                               HttpServletRequest request, boolean isEn) {
        return historyPayloadService.buildSecurityHistoryPagePayload(pageIndexParam, searchKeyword, userSe, insttId, actionStatus, request, isEn);
    }

    public Map<String, Object> buildLoginHistoryPagePayload(String pageIndexParam, String searchKeyword, String userSe,
                                                            String loginResult, String insttId,
                                                            HttpServletRequest request, boolean isEn) {
        return historyPayloadService.buildLoginHistoryPagePayload(pageIndexParam, searchKeyword, userSe, loginResult, insttId, request, isEn);
    }

    public Map<String, Object> buildSecurityPolicyPagePayload(boolean isEn) { return securityPolicyPayloadService.buildSecurityPolicyPagePayload(isEn); }
    public Map<String, Object> buildBlocklistPagePayload(String searchKeyword, String blockType, String status, String source, boolean isEn) { return blocklistPayloadService.buildBlocklistPagePayload(searchKeyword, blockType, status, source, isEn); }
    public Map<String, Object> buildSecurityAuditPagePayload(String pageIndexParam, String searchKeyword, String actionType, String routeGroup, String startDate, String endDate, String sortKey, String sortDirection, boolean isEn) { return securityAuditPayloadService.buildSecurityAuditPagePayload(pageIndexParam, searchKeyword, actionType, routeGroup, startDate, endDate, sortKey, sortDirection, isEn); }
    public Map<String, Object> buildCertificateAuditLogPagePayload(String pageIndexParam, String searchKeyword, String auditType, String status, String certificateType, String startDate, String endDate, boolean isEn) { return certificateAuditLogPageDataPort.buildCertificateAuditLogPageData(pageIndexParam, searchKeyword, auditType, status, certificateType, startDate, endDate, isEn); }
    public String exportSecurityAuditCsv(String searchKeyword, String actionType, String routeGroup, String startDate, String endDate, String sortKey, String sortDirection, boolean isEn) { return securityAuditPayloadService.exportSecurityAuditCsv(searchKeyword, actionType, routeGroup, startDate, endDate, sortKey, sortDirection, isEn); }
    public Map<String, Object> buildSchedulerPagePayload(String jobStatus, String executionType, boolean isEn) { return schedulerPayloadService.buildSchedulerPagePayload(jobStatus, executionType, isEn); }
    public Map<String, Object> buildBatchManagementPagePayload(boolean isEn) { return batchManagementPayloadService.buildBatchManagementPagePayload(isEn); }
    public Map<String, Object> buildExternalConnectionListPagePayload(boolean isEn) { return externalConnectionListPayloadService.buildExternalConnectionListPagePayload(isEn); }
    public Map<String, Object> buildExternalSchemaPagePayload(boolean isEn) { return externalSchemaPayloadService.buildExternalSchemaPagePayload(isEn); }
    public Map<String, Object> buildExternalKeysPagePayload(boolean isEn) { return externalKeysPayloadService.buildExternalKeysPagePayload(isEn); }
    public Map<String, Object> buildExternalUsagePagePayload(boolean isEn) { return externalUsagePayloadService.buildExternalUsagePagePayload(isEn); }
    public Map<String, Object> buildExternalLogsPagePayload(boolean isEn) { return externalLogsPayloadService.buildExternalLogsPagePayload(isEn); }
    public Map<String, Object> buildExternalSyncPagePayload(boolean isEn) { return externalSyncPayloadService.buildExternalSyncPagePayload(isEn); }
    public Map<String, Object> buildExternalMonitoringPagePayload(boolean isEn) { return externalMonitoringPayloadService.buildExternalMonitoringPagePayload(isEn); }
    public Map<String, Object> buildExternalMaintenancePagePayload(boolean isEn) { return externalMaintenancePayloadService.buildExternalMaintenancePagePayload(isEn); }
    public Map<String, Object> buildExternalRetryPagePayload(boolean isEn) { return externalRetryPayloadService.buildExternalRetryPagePayload(isEn); }
    public Map<String, Object> buildExternalWebhooksPagePayload(String keyword, String syncMode, String status, boolean isEn) { return externalWebhooksPayloadService.buildExternalWebhooksPagePayload(keyword, syncMode, status, isEn); }
    public Map<String, Object> buildExternalConnectionFormPagePayload(String mode, String connectionId, boolean isEn) { return externalConnectionFormPayloadService.buildExternalConnectionFormPagePayload(mode, connectionId, isEn); }
    public Map<String, Object> saveExternalConnection(Map<String, String> payload, boolean isEn) { return externalConnectionSavePort.saveExternalConnection(payload, isEn); }
    public Map<String, Object> buildBackupConfigPagePayload(boolean isEn) { return backupPayloadService.buildBackupConfigPagePayload(isEn); }
    public Map<String, Object> saveBackupConfigPayload(BackupConfigSaveRequest requestBody, String actorId, boolean isEn) { return backupPayloadService.saveBackupConfigPayload(requestBody, actorId, isEn); }
    public Map<String, Object> restoreBackupConfigVersionPayload(BackupVersionRestoreRequest requestBody, String actorId, boolean isEn) { return backupPayloadService.restoreBackupConfigVersionPayload(requestBody, actorId, isEn); }
    public Map<String, Object> runBackupPayload(BackupRunRequest requestBody, String actorId, boolean isEn) { return backupPayloadService.runBackupPayload(requestBody, actorId, isEn); }
    public Map<String, Object> buildErrorLogPagePayload(String pageIndexParam, String searchKeyword, String requestedInsttId, String sourceType, String errorType, HttpServletRequest request, boolean isEn) { return errorLogPayloadService.buildErrorLogPagePayload(pageIndexParam, searchKeyword, requestedInsttId, sourceType, errorType, request, isEn); }
    public List<Map<String, String>> loadAccessHistoryCompanyOptions() { return companyScopeService.loadAccessHistoryCompanyOptions(); }
    public List<Map<String, String>> buildScopedAccessHistoryCompanyOptions(String insttId) { return companyScopeService.buildScopedAccessHistoryCompanyOptions(insttId); }
}
