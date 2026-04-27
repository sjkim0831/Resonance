package egovframework.com.platform.codex.web;

import egovframework.com.feature.admin.web.AdminMenuShellService;
import egovframework.com.feature.admin.web.AdminSystemBuilderAccessService;
import egovframework.com.platform.executiongate.GateActorScope;
import egovframework.com.platform.executiongate.support.OperationsConsoleGateSupport;
import egovframework.com.platform.read.AdminSummaryReadPort;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Controller
@RequestMapping({"/admin", "/en/admin"})
@RequiredArgsConstructor
public class AdminSystemBuilderController {

    private final AdminSystemBuilderAccessService adminSystemBuilderAccessService;
    private final OperationsConsoleGateSupport operationsConsoleGateSupport;
    private final AdminSummaryReadPort adminSummaryReadPort;
    private final AdminMenuShellService adminMenuShellService;

    @GetMapping("/api/admin/system/menu-permission-diagnostics")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> menuPermissionDiagnosticsApi(
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminSystemBuilderAccessService.isEnglishRequest(request, locale);
        if (!adminSystemBuilderAccessService.hasGlobalAdminAccess(request)) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", false);
            response.put("message", isEn
                    ? "Only global administrators can view menu permission diagnostics."
                    : "메뉴 권한 진단은 전체 관리자만 조회할 수 있습니다.");
            return ResponseEntity.status(HttpServletResponse.SC_FORBIDDEN).body(response);
        }
        return ResponseEntity.ok(adminSummaryReadPort.buildMenuPermissionDiagnosticSummary(isEn));
    }

    @PostMapping("/api/admin/system/menu-permission-diagnostics/auto-cleanup")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> menuPermissionAutoCleanupApi(
            @RequestBody(required = false) Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminSystemBuilderAccessService.isEnglishRequest(request, locale);
        String currentUserId = adminSystemBuilderAccessService.extractCurrentUserId(request);
        if (!adminSystemBuilderAccessService.hasGlobalAdminAccess(request)) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", false);
            response.put("message", isEn
                    ? "Only global administrators can run menu permission cleanup."
                    : "메뉴 권한 정리는 전체 관리자만 실행할 수 있습니다.");
            return ResponseEntity.status(HttpServletResponse.SC_FORBIDDEN).body(response);
        }
        Object menuUrls = payload == null ? null : payload.get("menuUrls");
        return executeCommand(request,
                "system-builder.menu-permission.auto-cleanup",
                currentUserId,
                isEn,
                Map.of("menuUrls", toStringList(menuUrls)));
    }

    @PostMapping("/api/admin/system/security-policy/state")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> securityPolicyStateApi(
            @RequestBody(required = false) Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminSystemBuilderAccessService.isEnglishRequest(request, locale);
        String currentUserId = adminSystemBuilderAccessService.extractCurrentUserId(request);
        return executeCommand(request, "system-builder.security-policy.state", currentUserId, isEn, wrapPayload(payload));
    }

    @PostMapping("/api/admin/system/security-monitoring/state")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> securityMonitoringStateApi(
            @RequestBody(required = false) Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminSystemBuilderAccessService.isEnglishRequest(request, locale);
        String currentUserId = adminSystemBuilderAccessService.extractCurrentUserId(request);
        return executeCommand(request, "system-builder.security-monitoring.state", currentUserId, isEn, wrapPayload(payload));
    }

    @PostMapping("/api/admin/system/security-monitoring/block-candidates")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> securityMonitoringBlockCandidateApi(
            @RequestBody(required = false) Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminSystemBuilderAccessService.isEnglishRequest(request, locale);
        String currentUserId = adminSystemBuilderAccessService.extractCurrentUserId(request);
        if (!adminSystemBuilderAccessService.hasGlobalAdminAccess(request)) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", false);
            response.put("message", isEn
                    ? "Only global administrators can register block candidates."
                    : "차단 후보 등록은 전체 관리자만 수행할 수 있습니다.");
            return ResponseEntity.status(HttpServletResponse.SC_FORBIDDEN).body(response);
        }
        return executeCommand(request, "system-builder.security-monitoring.block-candidates.register", currentUserId, isEn, wrapPayload(payload));
    }

    @PostMapping("/api/admin/system/security-monitoring/block-candidates/state")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> securityMonitoringBlockCandidateStateApi(
            @RequestBody(required = false) Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminSystemBuilderAccessService.isEnglishRequest(request, locale);
        String currentUserId = adminSystemBuilderAccessService.extractCurrentUserId(request);
        if (!adminSystemBuilderAccessService.hasGlobalAdminAccess(request)) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", false);
            response.put("message", isEn
                    ? "Only global administrators can update block candidates."
                    : "차단 후보 상태 변경은 전체 관리자만 수행할 수 있습니다.");
            return ResponseEntity.status(HttpServletResponse.SC_FORBIDDEN).body(response);
        }
        return executeCommand(request, "system-builder.security-monitoring.block-candidates.update", currentUserId, isEn, wrapPayload(payload));
    }

    @PostMapping("/api/admin/system/security-monitoring/notify")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> securityMonitoringNotifyApi(
            @RequestBody(required = false) Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminSystemBuilderAccessService.isEnglishRequest(request, locale);
        String currentUserId = adminSystemBuilderAccessService.extractCurrentUserId(request);
        if (!adminSystemBuilderAccessService.hasGlobalAdminAccess(request)) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", false);
            response.put("message", isEn
                    ? "Only global administrators can dispatch monitoring notifications."
                    : "보안 모니터링 알림 발송은 전체 관리자만 수행할 수 있습니다.");
            return ResponseEntity.status(HttpServletResponse.SC_FORBIDDEN).body(response);
        }
        return executeCommand(request, "system-builder.security-monitoring.notify", currentUserId, isEn, wrapPayload(payload));
    }

    @PostMapping("/api/admin/system/security-history/action")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> securityHistoryActionApi(
            @RequestBody(required = false) Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminSystemBuilderAccessService.isEnglishRequest(request, locale);
        String currentUserId = adminSystemBuilderAccessService.extractCurrentUserId(request);
        if (currentUserId == null || currentUserId.trim().isEmpty()) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", false);
            response.put("message", isEn
                    ? "Authentication is required."
                    : "인증된 사용자만 실행할 수 있습니다.");
            return ResponseEntity.status(HttpServletResponse.SC_FORBIDDEN).body(response);
        }
        Map<String, Object> safePayload = payload == null ? Map.of() : payload;
        Object actionValue = safePayload.get("action");
        String action = safeString(actionValue == null ? null : String.valueOf(actionValue)).toUpperCase(Locale.ROOT);
        boolean requiresGlobalSecurityOperator = Set.of("UNBLOCK_USER", "REGISTER_EXCEPTION", "ESCALATE_BLOCK_IP").contains(action);
        if (requiresGlobalSecurityOperator && !adminSystemBuilderAccessService.hasGlobalAdminAccess(request)) {
                Map<String, Object> response = new LinkedHashMap<>();
                response.put("success", false);
                response.put("message", isEn
                        ? "Only global administrators can run this security action."
                        : "이 보안 조치는 전체 관리자만 수행할 수 있습니다.");
                return ResponseEntity.status(HttpServletResponse.SC_FORBIDDEN).body(response);
        }
        return executeCommand(request, "system-builder.security-history.action", currentUserId, isEn, wrapPayload(safePayload));
    }

    @PostMapping("/api/admin/system/security-policy/clear-suppressions")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> clearSecurityPolicySuppressionsApi(
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminSystemBuilderAccessService.isEnglishRequest(request, locale);
        String currentUserId = adminSystemBuilderAccessService.extractCurrentUserId(request);
        return executeCommand(request, "system-builder.security-policy.clear-suppressions", currentUserId, isEn, Map.of());
    }

    @PostMapping("/api/admin/system/security-policy/auto-fix")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> securityPolicyAutoFixApi(
            @RequestBody(required = false) Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminSystemBuilderAccessService.isEnglishRequest(request, locale);
        String currentUserId = adminSystemBuilderAccessService.extractCurrentUserId(request);
        if (!adminSystemBuilderAccessService.hasGlobalAdminAccess(request)) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", false);
            response.put("message", isEn
                    ? "Only global administrators can run security policy auto-fix."
                    : "보안 정책 자동 정리는 전체 관리자만 실행할 수 있습니다.");
            return ResponseEntity.status(HttpServletResponse.SC_FORBIDDEN).body(response);
        }
        return executeCommand(request, "system-builder.security-policy.auto-fix", currentUserId, isEn, wrapPayload(payload));
    }

    @PostMapping("/api/admin/system/security-policy/auto-fix-bulk")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> securityPolicyBulkAutoFixApi(
            @RequestBody(required = false) Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminSystemBuilderAccessService.isEnglishRequest(request, locale);
        String currentUserId = adminSystemBuilderAccessService.extractCurrentUserId(request);
        if (!adminSystemBuilderAccessService.hasGlobalAdminAccess(request)) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", false);
            response.put("message", isEn
                    ? "Only global administrators can run bulk security policy auto-fix."
                    : "보안 정책 일괄 자동 정리는 전체 관리자만 실행할 수 있습니다.");
            return ResponseEntity.status(HttpServletResponse.SC_FORBIDDEN).body(response);
        }
        Object findings = payload == null ? null : payload.get("findings");
        List<Map<String, Object>> rows = new ArrayList<>();
        if (findings instanceof Collection) {
            for (Object item : (Collection<?>) findings) {
                if (item instanceof Map) {
                    Map<?, ?> raw = (Map<?, ?>) item;
                    Map<String, Object> normalized = new LinkedHashMap<>();
                    for (Map.Entry<?, ?> entry : raw.entrySet()) {
                        if (entry.getKey() != null) {
                            normalized.put(entry.getKey().toString(), entry.getValue());
                        }
                    }
                    rows.add(normalized);
                }
            }
        }
        return executeCommand(request, "system-builder.security-policy.auto-fix-bulk", currentUserId, isEn, Map.of("findings", rows));
    }

    @PostMapping("/api/admin/system/security-policy/notification-config")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> securityPolicyNotificationConfigApi(
            @RequestBody(required = false) Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminSystemBuilderAccessService.isEnglishRequest(request, locale);
        String currentUserId = adminSystemBuilderAccessService.extractCurrentUserId(request);
        if (!adminSystemBuilderAccessService.hasGlobalAdminAccess(request)) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", false);
            response.put("message", isEn
                    ? "Only global administrators can save security notification routing."
                    : "보안 알림 라우팅은 전체 관리자만 저장할 수 있습니다.");
            return ResponseEntity.status(HttpServletResponse.SC_FORBIDDEN).body(response);
        }
        return executeCommand(request, "system-builder.security-policy.notification-config", currentUserId, isEn, wrapPayload(payload));
    }

    @PostMapping("/api/admin/system/security-policy/rollback")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> securityPolicyRollbackApi(
            @RequestBody(required = false) Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminSystemBuilderAccessService.isEnglishRequest(request, locale);
        String currentUserId = adminSystemBuilderAccessService.extractCurrentUserId(request);
        if (!adminSystemBuilderAccessService.hasGlobalAdminAccess(request)) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", false);
            response.put("message", isEn
                    ? "Only global administrators can run rollback."
                    : "원복 실행은 전체 관리자만 수행할 수 있습니다.");
            return ResponseEntity.status(HttpServletResponse.SC_FORBIDDEN).body(response);
        }
        return executeCommand(request, "system-builder.security-policy.rollback", currentUserId, isEn, wrapPayload(payload));
    }

    @PostMapping("/api/admin/system/security-policy/dispatch")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> securityPolicyDispatchApi(
            @RequestBody(required = false) Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminSystemBuilderAccessService.isEnglishRequest(request, locale);
        String currentUserId = adminSystemBuilderAccessService.extractCurrentUserId(request);
        if (!adminSystemBuilderAccessService.hasGlobalAdminAccess(request)) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", false);
            response.put("message", isEn
                    ? "Only global administrators can dispatch notifications."
                    : "알림 발송은 전체 관리자만 수행할 수 있습니다.");
            return ResponseEntity.status(HttpServletResponse.SC_FORBIDDEN).body(response);
        }
        return executeCommand(request, "system-builder.security-policy.dispatch", currentUserId, isEn, wrapPayload(payload));
    }

    @GetMapping("/api/admin/menu-placeholder")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> adminMenuPlaceholderApi(
            @RequestParam(value = "requestPath", required = false) String requestPath,
            HttpServletRequest request,
            Locale locale) {
        return ResponseEntity.ok(adminMenuShellService.buildMenuPlaceholderPayload(requestPath, request, locale));
    }

    @RequestMapping(value = "/**", method = { RequestMethod.GET })
    public String adminFallback(HttpServletRequest request, Locale locale, Model model) {
        return adminMenuShellService.renderAdminFallback(request, locale, model);
    }

    private List<String> toStringList(Object value) {
        if (!(value instanceof Collection)) {
            return new ArrayList<>();
        }
        Collection<?> collection = (Collection<?>) value;
        List<String> result = new ArrayList<>();
        for (Object item : collection) {
            if (item != null) {
                result.add(item.toString());
            }
        }
        return result;
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }

    private ResponseEntity<Map<String, Object>> executeCommand(HttpServletRequest request,
                                                               String actionKey,
                                                               String actorId,
                                                               boolean isEn,
                                                               Map<String, Object> parameters) {
        return ResponseEntity.ok(operationsConsoleGateSupport.payload(
                request,
                actionKey,
                actorId,
                actorId,
                safeString(actorId).isEmpty() ? GateActorScope.ANONYMOUS : GateActorScope.COMMON_ADMIN_OPS,
                enrichParameters(actorId, isEn, parameters)));
    }

    private Map<String, Object> enrichParameters(String actorId, boolean isEn, Map<String, Object> parameters) {
        Map<String, Object> enriched = new LinkedHashMap<>(parameters);
        enriched.put("actorId", safeString(actorId));
        enriched.put("isEn", isEn);
        return enriched;
    }

    private Map<String, Object> wrapPayload(Map<String, Object> payload) {
        return Map.of("payload", payload == null ? Map.of() : payload);
    }
}
