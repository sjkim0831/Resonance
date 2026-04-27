package egovframework.com.platform.codex.web;

import egovframework.com.common.security.AdminActionRateLimitService;
import egovframework.com.platform.codex.model.CodexAdminActorContext;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.feature.auth.domain.entity.EmplyrInfo;
import egovframework.com.feature.auth.domain.repository.EmployeeMemberRepository;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import egovframework.com.platform.executiongate.GateActorScope;
import egovframework.com.platform.executiongate.support.OperationsConsoleGateSupport;
import egovframework.com.platform.request.codex.CodexProvisionRequest;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.util.ObjectUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

@Controller
@RequestMapping({
        "/admin/system/codex-request",
        "/en/admin/system/codex-request",
        "/admin/system/codex-provision",
        "/en/admin/system/codex-provision"
})
@RequiredArgsConstructor
@Slf4j
public class CodexProvisionAdminApiController {
    private static final int CODEX_EXECUTION_RATE_LIMIT = 5;
    private static final long CODEX_EXECUTION_WINDOW_SECONDS = 300L;

    @Value("${security.codex.enabled:false}")
    private boolean codexEnabled;

    @Value("${security.codex.api-key:}")
    private String configuredApiKey;

    private final OperationsConsoleGateSupport operationsConsoleGateSupport;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthGroupManageService authGroupManageService;
    private final EmployeeMemberRepository employeeMemberRepository;
    private final AdminActionRateLimitService adminActionRateLimitService;

    @PostMapping("/login")
    @ResponseBody
    public ResponseEntity<?> login() {
        return validateInternalAvailability();
    }

    @PostMapping("/execute")
    @ResponseBody
    public ResponseEntity<?> execute(HttpServletRequest request,
                                     @RequestBody(required = false) CodexProvisionRequest provisionRequest) {
        ResponseEntity<?> availability = validateInternalAvailability();
        if (!availability.getStatusCode().is2xxSuccessful()) {
            return availability;
        }
        ResponseEntity<?> blocked = enforceCodexRateLimit(request, "execute");
        if (blocked != null) {
            return blocked;
        }

        try {
            CodexAdminActorContext actorContext = resolveActorContext(request);
            return ResponseEntity.ok(runGate(
                    request,
                    "codex-admin.execute",
                    null,
                    codexParameters(actorContext, Map.of("payload", provisionRequest == null ? Map.of() : provisionRequest))
            ));
        } catch (IllegalArgumentException e) {
            log.warn("Admin Codex provisioning request rejected. reason={}", e.getMessage());
            return ResponseEntity.badRequest().body(errorBody("fail", e.getMessage()));
        } catch (Exception e) {
            log.error("Admin Codex provisioning failed.", e);
            return ResponseEntity.internalServerError().body(errorBody("error", "Provisioning failed."));
        }
    }

    @GetMapping("/history")
    @ResponseBody
    public ResponseEntity<?> history(HttpServletRequest request) {
        ResponseEntity<?> availability = validateInternalAvailability();
        if (!availability.getStatusCode().is2xxSuccessful()) {
            return availability;
        }

        try {
            return ResponseEntity.ok(runGate(request, "codex-admin.history.list", null, Map.of("limit", 30)));
        } catch (Exception e) {
            log.error("Failed to load Codex history.", e);
            return ResponseEntity.internalServerError().body(errorBody("error", "Failed to load history."));
        }
    }

    @PostMapping("/history/{logId}/inspect")
    @ResponseBody
    public ResponseEntity<?> inspect(@PathVariable("logId") String logId) {
        ResponseEntity<?> availability = validateInternalAvailability();
        if (!availability.getStatusCode().is2xxSuccessful()) {
            return availability;
        }

        try {
            Object response = runGate(null, "codex-admin.history.inspect", logId, Map.of("logId", logId));
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorBody("fail", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to inspect Codex history. logId={}", logId, e);
            return ResponseEntity.internalServerError().body(errorBody("error", "Inspection failed."));
        }
    }

    @PostMapping("/history/{logId}/remediate")
    @ResponseBody
    public ResponseEntity<?> remediate(HttpServletRequest request, @PathVariable("logId") String logId) {
        ResponseEntity<?> availability = validateInternalAvailability();
        if (!availability.getStatusCode().is2xxSuccessful()) {
            return availability;
        }

        try {
            Object response = runGate(request, "codex-admin.history.remediate", logId, Map.of("logId", logId));
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorBody("fail", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to remediate Codex history. logId={}", logId, e);
            return ResponseEntity.internalServerError().body(errorBody("error", "Remediation failed."));
        }
    }

    @GetMapping("/tickets")
    @ResponseBody
    public ResponseEntity<?> tickets() {
        ResponseEntity<?> availability = validateInternalAvailability();
        if (!availability.getStatusCode().is2xxSuccessful()) {
            return availability;
        }
        try {
            return ResponseEntity.ok(runGate(null, "codex-admin.tickets.list", null, Map.of()));
        } catch (Exception e) {
            log.error("Failed to load SR tickets for Codex request console.", e);
            return ResponseEntity.internalServerError().body(errorBody("error", "Failed to load SR tickets."));
        }
    }

    @GetMapping("/tickets/{ticketId}")
    @ResponseBody
    public ResponseEntity<?> ticketDetail(@PathVariable("ticketId") String ticketId) {
        ResponseEntity<?> availability = validateInternalAvailability();
        if (!availability.getStatusCode().is2xxSuccessful()) {
            return availability;
        }
        try {
            return ResponseEntity.ok(runGate(null, "codex-admin.tickets.detail", ticketId, Map.of("ticketId", ticketId)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorBody("fail", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to load SR ticket detail. ticketId={}", ticketId, e);
            return ResponseEntity.internalServerError().body(errorBody("error", "Failed to load SR ticket detail."));
        }
    }

    @GetMapping("/tickets/{ticketId}/artifacts/{artifactType}")
    @ResponseBody
    public ResponseEntity<?> ticketArtifact(@PathVariable("ticketId") String ticketId,
                                            @PathVariable("artifactType") String artifactType) {
        ResponseEntity<?> availability = validateInternalAvailability();
        if (!availability.getStatusCode().is2xxSuccessful()) {
            return availability;
        }
        try {
            return ResponseEntity.ok(runGate(null, "codex-admin.tickets.artifact", ticketId + ":" + artifactType, Map.of(
                    "ticketId", ticketId,
                    "artifactType", artifactType
            )));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorBody("fail", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to load SR ticket artifact. ticketId={} artifactType={}", ticketId, artifactType, e);
            return ResponseEntity.internalServerError().body(errorBody("error", "Failed to load SR ticket artifact."));
        }
    }

    @PostMapping("/tickets/{ticketId}/prepare")
    @ResponseBody
    public ResponseEntity<?> prepareTicket(HttpServletRequest request, @PathVariable("ticketId") String ticketId) {
        ResponseEntity<?> availability = validateInternalAvailability();
        if (!availability.getStatusCode().is2xxSuccessful()) {
            return availability;
        }
        try {
            return ResponseEntity.ok(runGate(request, "codex-admin.tickets.prepare", ticketId, Map.of("ticketId", ticketId)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorBody("fail", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to prepare SR ticket. ticketId={}", ticketId, e);
            return ResponseEntity.internalServerError().body(errorBody("error", "Failed to prepare SR ticket."));
        }
    }

    @PostMapping("/tickets/{ticketId}/plan")
    @ResponseBody
    public ResponseEntity<?> planTicket(HttpServletRequest request, @PathVariable("ticketId") String ticketId) {
        ResponseEntity<?> availability = validateInternalAvailability();
        if (!availability.getStatusCode().is2xxSuccessful()) {
            return availability;
        }
        try {
            return ResponseEntity.ok(runGate(request, "codex-admin.tickets.plan", ticketId, Map.of("ticketId", ticketId)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorBody("fail", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to plan SR ticket. ticketId={}", ticketId, e);
            return ResponseEntity.internalServerError().body(errorBody("error", "Failed to plan SR ticket."));
        }
    }

    @PostMapping("/tickets/{ticketId}/execute")
    @ResponseBody
    public ResponseEntity<?> executeTicket(HttpServletRequest request, @PathVariable("ticketId") String ticketId) {
        ResponseEntity<?> availability = validateInternalAvailability();
        if (!availability.getStatusCode().is2xxSuccessful()) {
            return availability;
        }
        ResponseEntity<?> blocked = enforceCodexRateLimit(request, "execute-ticket");
        if (blocked != null) {
            return blocked;
        }
        try {
            return ResponseEntity.ok(runGate(request, "codex-admin.tickets.execute", ticketId, executeParams(ticketId, null)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorBody("fail", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to execute SR ticket. ticketId={}", ticketId, e);
            return ResponseEntity.internalServerError().body(errorBody("error", "Failed to execute SR ticket."));
        }
    }

    @PostMapping("/tickets/{ticketId}/direct-execute")
    @ResponseBody
    public ResponseEntity<?> directExecuteTicket(HttpServletRequest request, @PathVariable("ticketId") String ticketId) {
        ResponseEntity<?> availability = validateInternalAvailability();
        if (!availability.getStatusCode().is2xxSuccessful()) {
            return availability;
        }
        ResponseEntity<?> blocked = enforceCodexRateLimit(request, "direct-execute-ticket");
        if (blocked != null) {
            return blocked;
        }
        try {
            return ResponseEntity.ok(runGate(request, "codex-admin.tickets.direct-execute", ticketId, executeParams(ticketId, null)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorBody("fail", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to direct execute SR ticket. ticketId={}", ticketId, e);
            return ResponseEntity.internalServerError().body(errorBody("error", "Failed to direct execute SR ticket."));
        }
    }

    @PostMapping("/tickets/{ticketId}/queue-direct-execute")
    @ResponseBody
    public ResponseEntity<?> queueDirectExecuteTicket(HttpServletRequest request, @PathVariable("ticketId") String ticketId) {
        ResponseEntity<?> availability = validateInternalAvailability();
        if (!availability.getStatusCode().is2xxSuccessful()) {
            return availability;
        }
        ResponseEntity<?> blocked = enforceCodexRateLimit(request, "queue-direct-execute-ticket");
        if (blocked != null) {
            return blocked;
        }
        try {
            return ResponseEntity.ok(runGate(request, "codex-admin.tickets.queue-direct-execute", ticketId, Map.of("ticketId", ticketId)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorBody("fail", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to queue direct execute SR ticket. ticketId={}", ticketId, e);
            return ResponseEntity.internalServerError().body(errorBody("error", "Failed to queue SR ticket execution."));
        }
    }

    @PostMapping("/tickets/{ticketId}/skip-plan-execute")
    @ResponseBody
    public ResponseEntity<?> skipPlanExecuteTicket(HttpServletRequest request, @PathVariable("ticketId") String ticketId) {
        ResponseEntity<?> availability = validateInternalAvailability();
        if (!availability.getStatusCode().is2xxSuccessful()) {
            return availability;
        }
        ResponseEntity<?> blocked = enforceCodexRateLimit(request, "skip-plan-execute-ticket");
        if (blocked != null) {
            return blocked;
        }
        try {
            return ResponseEntity.ok(runGate(request, "codex-admin.tickets.skip-plan-execute", ticketId, executeParams(ticketId, null)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorBody("fail", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to skip-plan execute SR ticket. ticketId={}", ticketId, e);
            return ResponseEntity.internalServerError().body(errorBody("error", "Failed to skip-plan execute SR ticket."));
        }
    }

    @PostMapping("/tickets/{ticketId}/rollback")
    @ResponseBody
    public ResponseEntity<?> rollbackTicket(HttpServletRequest request, @PathVariable("ticketId") String ticketId) {
        ResponseEntity<?> availability = validateInternalAvailability();
        if (!availability.getStatusCode().is2xxSuccessful()) {
            return availability;
        }
        try {
            return ResponseEntity.ok(runGate(request, "codex-admin.tickets.rollback", ticketId, Map.of("ticketId", ticketId)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorBody("fail", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to rollback SR ticket. ticketId={}", ticketId, e);
            return ResponseEntity.internalServerError().body(errorBody("error", "Failed to rollback SR ticket."));
        }
    }

    @PostMapping("/tickets/{ticketId}/reissue")
    @ResponseBody
    public ResponseEntity<?> reissueTicket(HttpServletRequest request, @PathVariable("ticketId") String ticketId) {
        ResponseEntity<?> availability = validateInternalAvailability();
        if (!availability.getStatusCode().is2xxSuccessful()) {
            return availability;
        }
        try {
            return ResponseEntity.ok(runGate(request, "codex-admin.tickets.reissue", ticketId, Map.of("ticketId", ticketId)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorBody("fail", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to reissue SR ticket. ticketId={}", ticketId, e);
            return ResponseEntity.internalServerError().body(errorBody("error", "Failed to reissue SR ticket."));
        }
    }

    @PostMapping("/tickets/{ticketId}/delete")
    @ResponseBody
    public ResponseEntity<?> deleteTicket(HttpServletRequest request, @PathVariable("ticketId") String ticketId) {
        ResponseEntity<?> availability = validateInternalAvailability();
        if (!availability.getStatusCode().is2xxSuccessful()) {
            return availability;
        }
        try {
            return ResponseEntity.ok(runGate(request, "codex-admin.tickets.delete", ticketId, Map.of("ticketId", ticketId)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorBody("fail", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to delete SR ticket. ticketId={}", ticketId, e);
            return ResponseEntity.internalServerError().body(errorBody("error", "Failed to delete SR ticket."));
        }
    }

    private ResponseEntity<?> validateInternalAvailability() {
        if (!codexEnabled) {
            return ResponseEntity.status(503).body(errorBody("disabled", "Codex API is disabled."));
        }
        if (ObjectUtils.isEmpty(configuredApiKey) || configuredApiKey.trim().isEmpty()) {
            return ResponseEntity.status(503).body(errorBody("misconfigured", "Codex API key is not configured."));
        }
        return ResponseEntity.ok(successBody());
    }

    private Map<String, Object> successBody() {
        Map<String, Object> body = new HashMap<>();
        body.put("status", "success");
        body.put("mode", "admin-proxy");
        return body;
    }

    private Map<String, Object> errorBody(String status, String message) {
        Map<String, Object> body = new HashMap<>();
        body.put("status", status);
        body.put("message", message);
        return body;
    }

    private CodexAdminActorContext resolveActorContext(HttpServletRequest request) {
        CodexAdminActorContext context = new CodexAdminActorContext();
        String accessToken = request == null ? "" : safeString(jwtTokenProvider.getCookie(request, "accessToken"));
        String userId = extractCurrentUserId(accessToken);
        context.setActorUserId(userId);
        try {
            String authorCode = safeString(authGroupManageService.selectAuthorCodeByUserId(userId)).toUpperCase(Locale.ROOT);
            context.setActorAuthorCode(authorCode);
            context.setMaster("ROLE_SYSTEM_MASTER".equals(authorCode));
        } catch (Exception e) {
            log.warn("Failed to resolve Codex admin actor role. userId={}", userId, e);
        }
        try {
            context.setActorInsttId(employeeMemberRepository.findById(userId)
                    .map(EmplyrInfo::getInsttId)
                    .map(this::safeString)
                    .orElse(""));
        } catch (Exception e) {
            log.warn("Failed to resolve Codex admin actor company. userId={}", userId, e);
        }
        return context;
    }

    private String extractCurrentUserId(String accessToken) {
        if (safeString(accessToken).isEmpty()) {
            return "";
        }
        try {
            Claims claims = jwtTokenProvider.accessExtractClaims(accessToken);
            Object encryptedUserId = claims.get("userId");
            if (ObjectUtils.isEmpty(encryptedUserId)) {
                return "";
            }
            return safeString(jwtTokenProvider.decrypt(encryptedUserId.toString()));
        } catch (Exception e) {
            return "";
        }
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }

    private Object runGate(HttpServletRequest request,
                           String actionKey,
                           String targetId,
                           Map<String, Object> parameters) {
        CodexAdminActorContext actorContext = resolveActorContext(request);
        return operationsConsoleGateSupport.payload(
                request,
                actionKey,
                targetId,
                safeString(actorContext.getActorUserId()),
                resolveGateActorScope(actorContext),
                codexParameters(actorContext, parameters)
        );
    }

    private Map<String, Object> executeParams(String ticketId, String approvalToken) {
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("ticketId", ticketId);
        parameters.put("approvalToken", safeString(approvalToken));
        return parameters;
    }

    private GateActorScope resolveGateActorScope(CodexAdminActorContext actorContext) {
        return actorContext.isMaster() ? GateActorScope.COMMON_ADMIN_OPS : GateActorScope.PROJECT_ADMIN;
    }

    private Map<String, Object> codexParameters(CodexAdminActorContext actorContext, Map<String, Object> parameters) {
        Map<String, Object> enriched = new HashMap<>(parameters);
        enriched.put("actorId", safeString(actorContext.getActorUserId()));
        enriched.put("actorAuthorCode", safeString(actorContext.getActorAuthorCode()));
        enriched.put("actorInsttId", safeString(actorContext.getActorInsttId()));
        enriched.put("actorMaster", actorContext.isMaster());
        return enriched;
    }

    private ResponseEntity<?> enforceCodexRateLimit(HttpServletRequest request, String actionKey) {
        CodexAdminActorContext actorContext = resolveActorContext(request);
        String actorId = safeString(actorContext.getActorUserId());
        String remoteAddr = request == null ? "" : safeString(request.getRemoteAddr());
        String scope = "codex-execution:" + actionKey + ":" + (actorId.isEmpty() ? remoteAddr : actorId);
        AdminActionRateLimitService.RateLimitDecision decision =
                adminActionRateLimitService.check(scope, CODEX_EXECUTION_RATE_LIMIT, CODEX_EXECUTION_WINDOW_SECONDS);
        if (decision.isAllowed()) {
            return null;
        }
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header("Retry-After", String.valueOf(decision.getRetryAfterSeconds()))
                .body(errorBody("rate_limited", "Codex execution is temporarily throttled."));
    }
}
