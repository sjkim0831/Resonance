package egovframework.com.platform.observability.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;

@Controller
@RequestMapping({"/admin", "/en/admin"})
public class PlatformObservabilityPageController {

    @RequestMapping(value = "/system/observability", method = RequestMethod.GET)
    public String observabilityPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "observability");
    }

    @RequestMapping(value = "/system/unified_log", method = RequestMethod.GET)
    public String unifiedLogPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "unified-log");
    }

    @RequestMapping(value = "/system/unified_log/trace", method = RequestMethod.GET)
    public String unifiedTraceLogPage(HttpServletRequest request, Locale locale) {
        return forwardUnifiedLogPreset(request, locale, "trace", "", "", "");
    }

    @RequestMapping(value = "/system/unified_log/page-events", method = RequestMethod.GET)
    public String unifiedPageEventLogPage(HttpServletRequest request, Locale locale) {
        return forwardUnifiedLogPreset(request, locale, "trace", "PAGE_VIEW,PAGE_LEAVE", "", "");
    }

    @RequestMapping(value = "/system/unified_log/ui-actions", method = RequestMethod.GET)
    public String unifiedUiActionLogPage(HttpServletRequest request, Locale locale) {
        return forwardUnifiedLogPreset(request, locale, "trace", "UI_ACTION", "", "");
    }

    @RequestMapping(value = "/system/unified_log/api-trace", method = RequestMethod.GET)
    public String unifiedApiTraceLogPage(HttpServletRequest request, Locale locale) {
        return forwardUnifiedLogPreset(request, locale, "trace", "API_REQUEST,API_RESPONSE", "", "");
    }

    @RequestMapping(value = "/system/unified_log/ui-errors", method = RequestMethod.GET)
    public String unifiedUiErrorLogPage(HttpServletRequest request, Locale locale) {
        return forwardUnifiedLogPreset(request, locale, "error", "UI_ERROR,WINDOW_ERROR,UNHANDLED_REJECTION,REACT_ERROR_BOUNDARY,FRONTEND_REPORT,FRONTEND_TELEMETRY", "", "");
    }

    @RequestMapping(value = "/system/unified_log/layout-render", method = RequestMethod.GET)
    public String unifiedLayoutRenderLogPage(HttpServletRequest request, Locale locale) {
        return forwardUnifiedLogPreset(request, locale, "trace", "LAYOUT_RENDER", "", "");
    }

    @RequestMapping(value = "/system/security", method = {RequestMethod.GET, RequestMethod.POST})
    public String securityHistoryPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "security-history");
    }

    @RequestMapping(value = "/system/access_history", method = {RequestMethod.GET, RequestMethod.POST})
    public String accessHistoryPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "access-history");
    }

    @RequestMapping(value = "/system/error-log", method = {RequestMethod.GET, RequestMethod.POST})
    public String errorLogPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "error-log");
    }

    @RequestMapping(value = "/system/security-policy", method = {RequestMethod.GET, RequestMethod.POST})
    public String securityPolicyPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "security-policy");
    }

    @RequestMapping(value = "/system/notification", method = {RequestMethod.GET, RequestMethod.POST})
    public String notificationPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "notification");
    }

    @RequestMapping(value = "/system/performance", method = {RequestMethod.GET, RequestMethod.POST})
    public String performancePage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "performance");
    }

    @RequestMapping(value = "/external/connection_list", method = {RequestMethod.GET, RequestMethod.POST})
    public String externalConnectionListPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "external-connection-list");
    }

    @RequestMapping(value = "/external/schema", method = {RequestMethod.GET, RequestMethod.POST})
    public String externalSchemaPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "external-schema");
    }

    @RequestMapping(value = "/external/keys", method = {RequestMethod.GET, RequestMethod.POST})
    public String externalKeysPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "external-keys");
    }

    @RequestMapping(value = "/external/usage", method = {RequestMethod.GET, RequestMethod.POST})
    public String externalUsagePage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "external-usage");
    }

    @RequestMapping(value = "/external/logs", method = {RequestMethod.GET, RequestMethod.POST})
    public String externalLogsPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "external-logs");
    }

    @RequestMapping(value = "/external/sync", method = {RequestMethod.GET, RequestMethod.POST})
    public String externalSyncPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "external-sync");
    }

    @RequestMapping(value = "/external/monitoring", method = {RequestMethod.GET, RequestMethod.POST})
    public String externalMonitoringPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "external-monitoring");
    }

    @RequestMapping(value = "/external/maintenance", method = {RequestMethod.GET, RequestMethod.POST})
    public String externalMaintenancePage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "external-maintenance");
    }

    @RequestMapping(value = "/external/retry", method = {RequestMethod.GET, RequestMethod.POST})
    public String externalRetryPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "external-retry");
    }

    @RequestMapping(value = "/external/webhooks", method = {RequestMethod.GET, RequestMethod.POST})
    public String externalWebhooksPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "external-webhooks");
    }

    @RequestMapping(value = "/external/connection_add", method = {RequestMethod.GET, RequestMethod.POST})
    public String externalConnectionAddPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "external-connection-add");
    }

    @RequestMapping(value = "/system/security-monitoring", method = {RequestMethod.GET, RequestMethod.POST})
    public String securityMonitoringControlPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "security-monitoring");
    }

    @RequestMapping(value = "/monitoring/center", method = {RequestMethod.GET, RequestMethod.POST})
    public String operationsCenterPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "monitoring-center");
    }

    @RequestMapping(value = "/monitoring/sensor_add", method = {RequestMethod.GET, RequestMethod.POST})
    public String sensorAddPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "sensor-add");
    }

    @RequestMapping(value = "/monitoring/sensor_edit", method = {RequestMethod.GET, RequestMethod.POST})
    public String sensorEditPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "sensor-edit");
    }

    @RequestMapping(value = "/monitoring/sensor_list", method = {RequestMethod.GET, RequestMethod.POST})
    public String sensorListPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "sensor-list");
    }

    @RequestMapping(value = "/system/blocklist", method = {RequestMethod.GET, RequestMethod.POST})
    public String blocklistPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "blocklist");
    }

    @RequestMapping(value = "/system/security-audit", method = {RequestMethod.GET, RequestMethod.POST})
    public String securityAuditPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "security-audit");
    }

    @RequestMapping(value = "/certificate/audit-log", method = {RequestMethod.GET, RequestMethod.POST})
    public String certificateAuditLogPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "certificate-audit-log");
    }

    @RequestMapping(value = "/system/scheduler", method = {RequestMethod.GET, RequestMethod.POST})
    public String schedulerPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "scheduler-management");
    }

    @RequestMapping(value = "/system/batch", method = {RequestMethod.GET, RequestMethod.POST})
    public String batchPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "batch-management");
    }

    @RequestMapping(value = "/system/backup_config", method = {RequestMethod.GET, RequestMethod.POST})
    public String backupConfigPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "backup-config");
    }

    @RequestMapping(value = "/system/backup", method = {RequestMethod.GET, RequestMethod.POST})
    public String backupExecutionPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "backup-execution");
    }

    @RequestMapping(value = "/system/restore", method = {RequestMethod.GET, RequestMethod.POST})
    public String restoreExecutionPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "restore-execution");
    }

    @RequestMapping(value = "/system/version", method = {RequestMethod.GET, RequestMethod.POST})
    public String versionManagementPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "version-management");
    }

    @RequestMapping(value = "/member/login_history", method = {RequestMethod.GET, RequestMethod.POST})
    public String loginHistoryPage(HttpServletRequest request, Locale locale) {
        return forwardAdminRoute(request, locale, "login-history");
    }

    private String forwardUnifiedLogPreset(HttpServletRequest request,
                                           Locale locale,
                                           String tab,
                                           String eventType,
                                           String actionCode,
                                           String pageId) {
        StringBuilder builder = new StringBuilder(adminAppRouteBase(request, locale, "unified-log"));
        builder.append("&tab=").append(safe(tab));
        if (!safe(eventType).isEmpty()) {
            builder.append("&eventType=").append(safe(eventType));
        }
        if (!safe(actionCode).isEmpty()) {
            builder.append("&actionCode=").append(safe(actionCode));
        }
        if (!safe(pageId).isEmpty()) {
            builder.append("&pageId=").append(safe(pageId));
        }
        String query = request == null ? "" : safe(request.getQueryString());
        if (!query.isEmpty()) {
            builder.append("&").append(query);
        }
        return builder.toString();
    }

    private String forwardAdminRoute(HttpServletRequest request, Locale locale, String route) {
        StringBuilder builder = new StringBuilder(adminAppRouteBase(request, locale, route));
        String query = request == null ? "" : safe(request.getQueryString());
        if (!query.isEmpty()) {
            builder.append("&").append(query);
        }
        return builder.toString();
    }

    private String adminAppRouteBase(HttpServletRequest request, Locale locale, String route) {
        StringBuilder builder = new StringBuilder("forward:");
        builder.append(isEnglishRequest(request, locale) ? "/en/admin/app?route=" : "/admin/app?route=");
        builder.append(safe(route));
        return builder.toString();
    }

    private boolean isEnglishRequest(HttpServletRequest request, Locale locale) {
        if (request != null) {
            String path = request.getRequestURI();
            if (path != null && path.startsWith("/en/")) {
                return true;
            }
            String language = request.getParameter("language");
            if ("en".equalsIgnoreCase(language)) {
                return true;
            }
        }
        return locale != null && locale.getLanguage().toLowerCase(Locale.ROOT).startsWith("en");
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
