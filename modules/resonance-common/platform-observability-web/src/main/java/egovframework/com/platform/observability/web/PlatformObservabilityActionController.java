package egovframework.com.platform.observability.web;

import egovframework.com.platform.service.audit.AuditTrailPort;
import egovframework.com.feature.admin.web.AdminReactRouteSupport;
import egovframework.com.platform.request.observability.BackupConfigSaveRequest;
import egovframework.com.platform.request.observability.BackupRunRequest;
import egovframework.com.platform.request.observability.BackupVersionRestoreRequest;
import egovframework.com.platform.service.observability.AdminActionRateLimitPort;
import egovframework.com.platform.service.observability.CurrentUserContextReadPort;
import egovframework.com.platform.service.observability.CurrentUserContextSnapshot;
import egovframework.com.platform.service.observability.PlatformObservabilityAdminPagePort;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Controller
@RequestMapping({"/admin", "/en/admin"})
@RequiredArgsConstructor
public class PlatformObservabilityActionController {

    private static final int SENSITIVE_ACTION_RATE_LIMIT = 3;
    private static final long SENSITIVE_ACTION_WINDOW_SECONDS = 300L;

    private final PlatformObservabilityAdminPagePort platformObservabilityAdminPagePort;
    private final AdminReactRouteSupport adminReactRouteSupport;
    private final CurrentUserContextReadPort currentUserContextReadPort;
    private final AuditTrailPort auditTrailPort;
    private final AdminActionRateLimitPort adminActionRateLimitPort;

    @PostMapping("/external/connection/save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> externalConnectionSaveApi(
            @RequestBody(required = false) Map<String, String> payload,
            HttpServletRequest request,
            Locale locale) {
        primeCsrfToken(request);
        return ResponseEntity.ok(platformObservabilityAdminPagePort.saveExternalConnection(
                payload,
                adminReactRouteSupport.isEnglishRequest(request, locale)));
    }

    @GetMapping("/system/security-audit/export.csv")
    @ResponseBody
    public ResponseEntity<String> securityAuditExportCsv(
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
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        String filename = isEn ? "security-audit-export.csv" : "security-audit-내보내기.csv";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename*=UTF-8''" + URLEncoder.encode(filename, StandardCharsets.UTF_8))
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(platformObservabilityAdminPagePort.exportSecurityAuditCsv(
                        searchKeyword,
                        actionType,
                        routeGroup,
                        startDate,
                        endDate,
                        sortKey,
                        sortDirection,
                        isEn));
    }

    @PostMapping("/system/backup_config/save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveBackupConfigPageApi(
            @RequestBody BackupConfigSaveRequest requestBody,
            HttpServletRequest request,
            Locale locale) {
        primeCsrfToken(request);
        CurrentUserContextSnapshot currentUser = currentUserContextReadPort.resolve(request);
        String actorId = safe(currentUser == null ? "" : currentUser.getUserId());
        Map<String, Object> payload = platformObservabilityAdminPagePort.saveBackupConfigPayload(
                requestBody,
                actorId,
                adminReactRouteSupport.isEnglishRequest(request, locale));
        recordBackupAudit(request, currentUser, "BACKUP_CONFIG_SAVE", "BACKUP_CONFIG", "backup-config",
                safe(actorId), "SUCCESS", "backup_config",
                "{\"versionMemo\":\"" + safe(requestBody == null ? "" : requestBody.getVersionMemo()) + "\"}");
        return ResponseEntity.ok(payload);
    }

    @PostMapping("/system/version/restore")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> restoreBackupConfigVersionApi(
            @RequestBody BackupVersionRestoreRequest requestBody,
            HttpServletRequest request,
            Locale locale) {
        primeCsrfToken(request);
        CurrentUserContextSnapshot currentUser = currentUserContextReadPort.resolve(request);
        ResponseEntity<Map<String, Object>> blocked = enforceSensitiveActionRateLimit(request, currentUser, "version-restore");
        if (blocked != null) {
            return blocked;
        }
        String actorId = safe(currentUser == null ? "" : currentUser.getUserId());
        Map<String, Object> payload = platformObservabilityAdminPagePort.restoreBackupConfigVersionPayload(
                requestBody,
                actorId,
                adminReactRouteSupport.isEnglishRequest(request, locale));
        recordBackupAudit(request, currentUser, "BACKUP_VERSION_RESTORE", "BACKUP_CONFIG_VERSION", "version-management",
                safe(requestBody == null ? "" : requestBody.getVersionId()), "SUCCESS", "version",
                "{\"versionId\":\"" + safe(requestBody == null ? "" : requestBody.getVersionId()) + "\"}");
        return ResponseEntity.ok(payload);
    }

    @PostMapping("/system/backup/run")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> runBackupPageApi(
            @RequestBody BackupRunRequest requestBody,
            HttpServletRequest request,
            Locale locale) {
        primeCsrfToken(request);
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        CurrentUserContextSnapshot currentUser = currentUserContextReadPort.resolve(request);
        ResponseEntity<Map<String, Object>> blocked = enforceSensitiveActionRateLimit(
                request,
                currentUser,
                resolveBackupRateLimitActionKey(requestBody),
                isEn);
        if (blocked != null) {
            return blocked;
        }
        String actorId = safe(currentUser == null ? "" : currentUser.getUserId());
        Map<String, Object> payload = platformObservabilityAdminPagePort.runBackupPayload(requestBody, actorId, isEn);
        recordBackupAudit(request, currentUser, "BACKUP_RUN", "BACKUP_EXECUTION", resolveBackupEntityType(requestBody),
                resolveBackupEntityId(requestBody), "SUCCESS", resolveBackupPageId(requestBody),
                "{\"executionType\":\"" + safe(requestBody == null ? "" : requestBody.getExecutionType()) + "\",\"dbRestoreType\":\""
                        + safe(requestBody == null ? "" : requestBody.getDbRestoreType()) + "\"}");
        return ResponseEntity.ok(payload);
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

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private ResponseEntity<Map<String, Object>> enforceSensitiveActionRateLimit(HttpServletRequest request,
                                                                                CurrentUserContextSnapshot currentUser,
                                                                                String actionKey) {
        return enforceSensitiveActionRateLimit(request, currentUser, actionKey, false);
    }

    private ResponseEntity<Map<String, Object>> enforceSensitiveActionRateLimit(HttpServletRequest request,
                                                                                CurrentUserContextSnapshot currentUser,
                                                                                String actionKey,
                                                                                boolean isEn) {
        String actorId = safe(currentUser == null ? "" : currentUser.getUserId());
        String remoteAddr = safe(request == null ? "" : request.getRemoteAddr());
        String scope = "admin-sensitive:" + actionKey + ":" + (actorId.isEmpty() ? remoteAddr : actorId);
        AdminActionRateLimitPort.RateLimitDecision decision =
                adminActionRateLimitPort.check(scope, SENSITIVE_ACTION_RATE_LIMIT, SENSITIVE_ACTION_WINDOW_SECONDS);
        if (decision.isAllowed()) {
            return null;
        }
        String message = isEn
                ? "Too many sensitive admin requests. Try again shortly."
                : "민감한 관리자 작업 요청이 너무 많습니다. 잠시 후 다시 시도하세요.";
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header("Retry-After", String.valueOf(decision.getRetryAfterSeconds()))
                .body(orderedMap(
                        "status", "rate_limited",
                        "message", message,
                        "backupConfigMessage", message,
                        "retryAfterSeconds", decision.getRetryAfterSeconds()));
    }

    private void recordBackupAudit(HttpServletRequest request,
                                   CurrentUserContextSnapshot currentUser,
                                   String actionCode,
                                   String entityType,
                                   String pageId,
                                   String entityId,
                                   String resultStatus,
                                   String menuCode,
                                   String afterSummaryJson) {
        if (currentUser == null) {
            return;
        }
        auditTrailPort.record(
                safe(currentUser.getUserId()),
                safe(currentUser.getAuthorCode()),
                safe(menuCode),
                safe(pageId),
                safe(actionCode),
                safe(entityType),
                safe(entityId),
                safe(resultStatus),
                safe(actionCode),
                "",
                safe(afterSummaryJson),
                safe(request == null ? "" : request.getRemoteAddr()),
                safe(request == null ? "" : request.getHeader("User-Agent")));
    }

    private String resolveBackupRateLimitActionKey(BackupRunRequest requestBody) {
        String executionType = safe(requestBody == null ? "" : requestBody.getExecutionType())
                .trim()
                .toUpperCase(Locale.ROOT);
        if (executionType.isEmpty()) {
            executionType = "UNKNOWN";
        }
        return "backup-run:" + executionType;
    }

    private String resolveBackupEntityType(BackupRunRequest requestBody) {
        String executionType = safe(requestBody == null ? "" : requestBody.getExecutionType()).toUpperCase(Locale.ROOT);
        if (executionType.contains("RESTORE") || executionType.contains("PITR")) {
            return "BACKUP_RESTORE";
        }
        return "BACKUP_EXECUTION";
    }

    private String resolveBackupEntityId(BackupRunRequest requestBody) {
        if (requestBody == null) {
            return "";
        }
        if (!safe(requestBody.getGitRestoreCommit()).isEmpty()) {
            return safe(requestBody.getGitRestoreCommit());
        }
        if (!safe(requestBody.getDbRestoreTarget()).isEmpty()) {
            return safe(requestBody.getDbRestoreTarget());
        }
        return safe(requestBody.getExecutionType());
    }

    private String resolveBackupPageId(BackupRunRequest requestBody) {
        String executionType = safe(requestBody == null ? "" : requestBody.getExecutionType()).toUpperCase(Locale.ROOT);
        if (executionType.contains("RESTORE") || executionType.contains("PITR")) {
            return "restore-execution";
        }
        if (executionType.contains("VERSION")) {
            return "version-management";
        }
        return "backup-execution";
    }

    private Map<String, Object> orderedMap(Object... fields) {
        Map<String, Object> values = new LinkedHashMap<>();
        if (fields == null) {
            return values;
        }
        for (int index = 0; index + 1 < fields.length; index += 2) {
            values.put(String.valueOf(fields[index]), fields[index + 1]);
        }
        return values;
    }
}
