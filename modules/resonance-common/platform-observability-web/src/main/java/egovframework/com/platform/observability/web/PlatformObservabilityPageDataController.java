package egovframework.com.platform.observability.web;

import egovframework.com.feature.admin.web.AdminReactRouteSupport;
import egovframework.com.platform.service.observability.CertificateAuditLogPageDataPort;
import egovframework.com.platform.service.observability.PlatformObservabilityAdminPagePort;
import egovframework.com.platform.service.observability.PlatformObservabilityPagePayloadPort;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.security.web.csrf.CsrfToken;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import java.util.Map;

@Controller
@RequestMapping({"/admin", "/en/admin"})
@RequiredArgsConstructor
public class PlatformObservabilityPageDataController {

    private final PlatformObservabilityAdminPagePort platformObservabilityAdminPageFacade;
    private final PlatformObservabilityPagePayloadPort platformObservabilityPagePayloadService;
    private final AdminReactRouteSupport adminReactRouteSupport;
    private final CertificateAuditLogPageDataPort certificateAuditLogPageDataPort;

    @GetMapping("/system/error-log/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> errorLogPageApi(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "insttId", required = false) String insttId,
            @RequestParam(value = "sourceType", required = false) String sourceType,
            @RequestParam(value = "errorType", required = false) String errorType,
            HttpServletRequest request,
            Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityAdminPageFacade.buildErrorLogPagePayload(
                pageIndexParam,
                searchKeyword,
                insttId,
                sourceType,
                errorType,
                request,
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping("/system/security/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> securityHistoryPageApi(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "userSe", required = false) String userSe,
            @RequestParam(value = "insttId", required = false) String insttId,
            @RequestParam(value = "actionStatus", required = false) String actionStatus,
            HttpServletRequest request,
            Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityAdminPageFacade.buildSecurityHistoryPagePayload(
                pageIndexParam,
                searchKeyword,
                userSe,
                insttId,
                actionStatus,
                request,
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping("/system/security-policy/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> securityPolicyPageApi(HttpServletRequest request, Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityAdminPageFacade.buildSecurityPolicyPagePayload(
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping("/system/notification/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> notificationPageApi(
            @RequestParam(value = "deliveryChannel", required = false) String deliveryChannel,
            @RequestParam(value = "deliveryStatus", required = false) String deliveryStatus,
            @RequestParam(value = "deliveryKeyword", required = false) String deliveryKeyword,
            @RequestParam(value = "deliveryPage", required = false) String deliveryPage,
            @RequestParam(value = "activityAction", required = false) String activityAction,
            @RequestParam(value = "activityKeyword", required = false) String activityKeyword,
            @RequestParam(value = "activityPage", required = false) String activityPage,
            HttpServletRequest request,
            Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityPagePayloadService.buildNotificationPagePayload(
                adminReactRouteSupport.isEnglishRequest(request, locale),
                deliveryChannel,
                deliveryStatus,
                deliveryKeyword,
                deliveryPage,
                activityAction,
                activityKeyword,
                activityPage));
    }

    @GetMapping("/system/performance/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> performancePageApi(HttpServletRequest request, Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityPagePayloadService.buildPerformancePagePayload(
                request,
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping("/external/connection_list/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> externalConnectionListPageApi(HttpServletRequest request, Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityAdminPageFacade.buildExternalConnectionListPagePayload(
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping("/external/schema/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> externalSchemaPageApi(HttpServletRequest request, Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityAdminPageFacade.buildExternalSchemaPagePayload(
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping("/external/keys/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> externalKeysPageApi(HttpServletRequest request, Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityAdminPageFacade.buildExternalKeysPagePayload(
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping("/external/usage/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> externalUsagePageApi(HttpServletRequest request, Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityAdminPageFacade.buildExternalUsagePagePayload(
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping("/external/logs/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> externalLogsPageApi(HttpServletRequest request, Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityAdminPageFacade.buildExternalLogsPagePayload(
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping("/external/sync/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> externalSyncPageApi(HttpServletRequest request, Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityAdminPageFacade.buildExternalSyncPagePayload(
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping("/external/monitoring/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> externalMonitoringPageApi(HttpServletRequest request, Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityAdminPageFacade.buildExternalMonitoringPagePayload(
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping("/external/maintenance/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> externalMaintenancePageApi(HttpServletRequest request, Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityAdminPageFacade.buildExternalMaintenancePagePayload(
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping("/external/retry/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> externalRetryPageApi(HttpServletRequest request, Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityAdminPageFacade.buildExternalRetryPagePayload(
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping("/external/webhooks/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> externalWebhooksPageApi(
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "syncMode", required = false) String syncMode,
            @RequestParam(value = "status", required = false) String status,
            HttpServletRequest request,
            Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityAdminPageFacade.buildExternalWebhooksPagePayload(
                keyword,
                syncMode,
                status,
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping("/external/connection_add/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> externalConnectionAddPageApi(HttpServletRequest request, Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityAdminPageFacade.buildExternalConnectionFormPagePayload(
                "add",
                "",
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping("/external/connection_edit/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> externalConnectionEditPageApi(
            @RequestParam(value = "connectionId", required = false) String connectionId,
            HttpServletRequest request,
            Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityAdminPageFacade.buildExternalConnectionFormPagePayload(
                "edit",
                connectionId,
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping("/monitoring/center/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> operationsCenterPageApi(HttpServletRequest request, Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityPagePayloadService.buildOperationsCenterPagePayload(
                request,
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping("/monitoring/sensor_list/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> sensorListPageApi(HttpServletRequest request, Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityPagePayloadService.buildSensorListPagePayload(
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping("/system/security-monitoring/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> securityMonitoringPageApi(HttpServletRequest request, Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityPagePayloadService.buildSecurityMonitoringPagePayload(
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping("/system/blocklist/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> blocklistPageApi(
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "blockType", required = false) String blockType,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "source", required = false) String source,
            HttpServletRequest request,
            Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityAdminPageFacade.buildBlocklistPagePayload(
                searchKeyword,
                blockType,
                status,
                source,
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping("/system/security-audit/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> securityAuditPageApi(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "actionType", required = false) String actionType,
            @RequestParam(value = "routeGroup", required = false) String routeGroup,
            @RequestParam(value = "startDate", required = false) String startDate,
            @RequestParam(value = "endDate", required = false) String endDate,
            @RequestParam(value = "sortKey", required = false) String sortKey,
            @RequestParam(value = "sortDirection", required = false) String sortDirection,
            HttpServletRequest request,
            Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityAdminPageFacade.buildSecurityAuditPagePayload(
                pageIndexParam,
                searchKeyword,
                actionType,
                routeGroup,
                startDate,
                endDate,
                sortKey,
                sortDirection,
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping("/certificate/audit-log/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> certificateAuditLogPageApi(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "auditType", required = false) String auditType,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "certificateType", required = false) String certificateType,
            @RequestParam(value = "startDate", required = false) String startDate,
            @RequestParam(value = "endDate", required = false) String endDate,
            HttpServletRequest request,
            Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(certificateAuditLogPageDataPort.buildCertificateAuditLogPageData(
                pageIndexParam,
                searchKeyword,
                auditType,
                status,
                certificateType,
                startDate,
                endDate,
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping("/system/batch/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> batchPageApi(HttpServletRequest request, Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityAdminPageFacade.buildBatchManagementPagePayload(
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping("/system/scheduler/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> schedulerPageApi(
            @RequestParam(value = "jobStatus", required = false) String jobStatus,
            @RequestParam(value = "executionType", required = false) String executionType,
            HttpServletRequest request,
            Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityAdminPageFacade.buildSchedulerPagePayload(
                jobStatus,
                executionType,
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping({ "/system/backup_config/page-data", "/system/backup/page-data", "/system/restore/page-data", "/system/version/page-data" })
    @ResponseBody
    public ResponseEntity<Map<String, Object>> backupConfigPageApi(HttpServletRequest request, Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityAdminPageFacade.buildBackupConfigPagePayload(
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping("/api/admin/member/login-history/page")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> loginHistoryPageApi(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "userSe", required = false) String userSe,
            @RequestParam(value = "loginResult", required = false) String loginResult,
            @RequestParam(value = "insttId", required = false) String insttId,
            HttpServletRequest request,
            Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityAdminPageFacade.buildLoginHistoryPagePayload(
                pageIndexParam,
                searchKeyword,
                userSe,
                loginResult,
                insttId,
                request,
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    private void primeCsrfToken(HttpServletRequest request) {
        if (request == null) {
            return;
        }
        Object token = request.getAttribute("_csrf");
        if (token instanceof CsrfToken) {
            ((CsrfToken) token).getToken();
        }
    }
}
