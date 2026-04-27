package egovframework.com.platform.service.observability;

import egovframework.com.platform.request.observability.BackupConfigSaveRequest;
import egovframework.com.platform.request.observability.BackupRunRequest;
import egovframework.com.platform.request.observability.BackupVersionRestoreRequest;

import java.util.List;
import java.util.Map;

public interface PlatformObservabilityAdminPagePort {

    Map<String, Object> buildErrorLogPagePayload(String pageIndexParam, String searchKeyword, String requestedInsttId,
                                                 String sourceType, String errorType, jakarta.servlet.http.HttpServletRequest request,
                                                 boolean isEn);

    Map<String, Object> buildSecurityHistoryPagePayload(String pageIndexParam, String searchKeyword, String userSe,
                                                        String insttId, String actionStatus,
                                                        jakarta.servlet.http.HttpServletRequest request, boolean isEn);

    Map<String, Object> buildSecurityPolicyPagePayload(boolean isEn);

    Map<String, Object> buildExternalConnectionListPagePayload(boolean isEn);

    Map<String, Object> buildExternalSchemaPagePayload(boolean isEn);

    Map<String, Object> buildExternalKeysPagePayload(boolean isEn);

    Map<String, Object> buildExternalUsagePagePayload(boolean isEn);

    Map<String, Object> buildExternalLogsPagePayload(boolean isEn);

    Map<String, Object> buildExternalSyncPagePayload(boolean isEn);

    Map<String, Object> buildExternalMonitoringPagePayload(boolean isEn);

    Map<String, Object> buildExternalMaintenancePagePayload(boolean isEn);

    Map<String, Object> buildExternalRetryPagePayload(boolean isEn);

    Map<String, Object> buildExternalWebhooksPagePayload(String keyword, String syncMode, String status, boolean isEn);

    Map<String, Object> buildExternalConnectionFormPagePayload(String mode, String connectionId, boolean isEn);

    Map<String, Object> buildBlocklistPagePayload(String searchKeyword, String blockType, String status, String source, boolean isEn);

    Map<String, Object> buildSecurityAuditPagePayload(String pageIndexParam, String searchKeyword, String actionType,
                                                      String routeGroup, String startDate, String endDate,
                                                      String sortKey, String sortDirection, boolean isEn);

    Map<String, Object> buildCertificateAuditLogPagePayload(String pageIndexParam, String searchKeyword, String auditType,
                                                            String status, String certificateType, String startDate,
                                                            String endDate, boolean isEn);

    Map<String, Object> buildBatchManagementPagePayload(boolean isEn);

    Map<String, Object> buildSchedulerPagePayload(String jobStatus, String executionType, boolean isEn);

    Map<String, Object> buildBackupConfigPagePayload(boolean isEn);

    String exportSecurityAuditCsv(String searchKeyword, String actionType, String routeGroup, String startDate,
                                  String endDate, String sortKey, String sortDirection, boolean isEn);

    Map<String, Object> saveExternalConnection(Map<String, String> payload, boolean isEn);

    Map<String, Object> saveBackupConfigPayload(BackupConfigSaveRequest requestBody, String actorId, boolean isEn);

    Map<String, Object> restoreBackupConfigVersionPayload(BackupVersionRestoreRequest requestBody, String actorId, boolean isEn);

    Map<String, Object> runBackupPayload(BackupRunRequest requestBody, String actorId, boolean isEn);

    Map<String, Object> buildLoginHistoryPagePayload(String pageIndexParam, String searchKeyword, String userSe,
                                                     String loginResult, String insttId,
                                                     jakarta.servlet.http.HttpServletRequest request, boolean isEn);

    List<Map<String, String>> loadAccessHistoryCompanyOptions();

    List<Map<String, String>> buildScopedAccessHistoryCompanyOptions(String insttId);
}
