package egovframework.com.platform.codex.web;

import egovframework.com.feature.admin.web.*;
import egovframework.com.feature.admin.dto.request.AdminDevSessionSimulationRequestDTO;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.platform.executiongate.ExecutionGateRequestContext;
import egovframework.com.platform.executiongate.GateActorScope;
import egovframework.com.platform.executiongate.GateRouteScope;
import egovframework.com.platform.executiongate.session.SessionSimulationGate;
import egovframework.com.platform.executiongate.session.SessionSimulationGateRequest;
import egovframework.com.platform.executiongate.session.SessionSimulationGateResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping({"/api/admin/dev", "/admin/api/admin/dev", "/en/admin/api/admin/dev"})
@RequiredArgsConstructor
public class AdminDevSessionSimulationController {

    private final SessionSimulationGate sessionSimulationGate;
    private final CurrentUserContextService currentUserContextService;

    @GetMapping("/session-simulator")
    public ResponseEntity<Map<String, Object>> getState(
            @RequestParam(value = "insttId", required = false) String insttId,
            HttpServletRequest request) {
        SessionSimulationGateResponse response = sessionSimulationGate.execute(
                new SessionSimulationGateRequest(
                        buildContext(request, "session-simulator.get"),
                        "session-simulator.get",
                        insttId,
                        null
                ),
                request
        );
        return ResponseEntity.ok(response.payload());
    }

    @PostMapping("/session-simulator")
    public ResponseEntity<Map<String, Object>> apply(
            @RequestBody(required = false) AdminDevSessionSimulationRequestDTO payload,
            HttpServletRequest request) {
        SessionSimulationGateResponse response = sessionSimulationGate.execute(
                new SessionSimulationGateRequest(
                        buildContext(request, "session-simulator.apply"),
                        "session-simulator.apply",
                        null,
                        toPayloadMap(payload)
                ),
                request
        );
        return ResponseEntity.ok(response.payload());
    }

    @DeleteMapping("/session-simulator")
    public ResponseEntity<Map<String, Object>> reset(HttpServletRequest request) {
        SessionSimulationGateResponse response = sessionSimulationGate.execute(
                new SessionSimulationGateRequest(
                        buildContext(request, "session-simulator.reset"),
                        "session-simulator.reset",
                        null,
                        null
                ),
                request
        );
        return ResponseEntity.ok(response.payload());
    }

    private ExecutionGateRequestContext buildContext(HttpServletRequest request, String actionKey) {
        CurrentUserContextService.CurrentUserContext userContext = request == null
                ? new CurrentUserContextService.CurrentUserContext()
                : currentUserContextService.resolve(request);
        return ExecutionGateRequestContext.of(
                null,
                resolveActorScope(userContext),
                GateRouteScope.OPERATIONS_CONSOLE,
                actionKey,
                userContext.getUserId(),
                request == null ? null : request.getHeader("X-Trace-Id"),
                request == null ? null : request.getHeader("X-Request-Id")
        );
    }

    private GateActorScope resolveActorScope(CurrentUserContextService.CurrentUserContext context) {
        String authorCode = context == null ? "" : safe(context.getAuthorCode());
        if ("ROLE_SYSTEM_MASTER".equals(authorCode) || "ROLE_OPERATION_ADMIN".equals(authorCode)) {
            return GateActorScope.COMMON_ADMIN_OPS;
        }
        if (!authorCode.isEmpty()) {
            return GateActorScope.PROJECT_ADMIN;
        }
        return GateActorScope.ANONYMOUS;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private Map<String, Object> toPayloadMap(AdminDevSessionSimulationRequestDTO payload) {
        Map<String, Object> map = new LinkedHashMap<>();
        if (payload == null) {
            return map;
        }
        map.put("insttId", payload.getInsttId());
        map.put("emplyrId", payload.getEmplyrId());
        map.put("authorCode", payload.getAuthorCode());
        return map;
    }
}
