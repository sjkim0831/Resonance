package egovframework.com.platform.runtimecontrol.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.executiongate.ExecutionGateRequestContext;
import egovframework.com.platform.executiongate.GateActorScope;
import egovframework.com.platform.executiongate.GateRouteScope;
import egovframework.com.platform.executiongate.runtimecontrol.RuntimeControlGate;
import egovframework.com.platform.executiongate.runtimecontrol.RuntimeControlGateRequest;
import egovframework.com.platform.executiongate.runtimecontrol.RuntimeControlGateResponse;
import egovframework.com.platform.runtimecontrol.model.ParityCompareRequest;
import egovframework.com.platform.runtimecontrol.model.ProjectPipelineRunRequest;
import egovframework.com.platform.runtimecontrol.model.ProjectPipelineStatusRequest;
import egovframework.com.platform.runtimecontrol.model.RepairApplyRequest;
import egovframework.com.platform.runtimecontrol.model.RepairOpenRequest;
import egovframework.com.platform.runtimecontrol.service.port.RuntimeActorContext;
import egovframework.com.platform.runtimecontrol.service.port.RuntimeActorContextPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping({
        "/api/platform/runtime",
        "/admin/api/platform/runtime",
        "/en/admin/api/platform/runtime",
        "/api/admin/ops",
        "/admin/api/admin/ops",
        "/en/admin/api/admin/ops"
})
@Slf4j
public class RuntimeControlPlaneApiController {

    private final RuntimeControlGate runtimeControlGate;
    private final RuntimeActorContextPort runtimeActorContextPort;
    private final ObjectMapper objectMapper;

    @GetMapping("/parity/compare")
    public ResponseEntity<Map<String, Object>> getParityCompareByQuery(@ModelAttribute ParityCompareRequest request,
                                                                       HttpServletRequest servletRequest) {
        return execute("parity.compare", request, servletRequest);
    }

    @PostMapping("/parity/compare")
    public ResponseEntity<Map<String, Object>> getParityCompare(@RequestBody ParityCompareRequest request,
                                                                HttpServletRequest servletRequest) {
        return execute("parity.compare", request, servletRequest);
    }

    @PostMapping("/repair/open")
    public ResponseEntity<Map<String, Object>> openRepairSession(@RequestBody RepairOpenRequest request,
                                                                 HttpServletRequest servletRequest) {
        return execute("repair.open", request, servletRequest);
    }

    @PostMapping("/repair/apply")
    public ResponseEntity<Map<String, Object>> applyRepair(@RequestBody RepairApplyRequest request,
                                                           HttpServletRequest servletRequest) {
        return execute("repair.apply", request, servletRequest);
    }

    @PostMapping("/project-pipeline/run")
    public ResponseEntity<Map<String, Object>> runProjectPipeline(@RequestBody ProjectPipelineRunRequest request,
                                                                  HttpServletRequest servletRequest) {
        return execute("project-pipeline.run", request, servletRequest);
    }

    @PostMapping("/project-pipeline/status")
    public ResponseEntity<Map<String, Object>> getProjectPipelineStatus(@RequestBody ProjectPipelineStatusRequest request,
                                                                        HttpServletRequest servletRequest) {
        return execute("project-pipeline.status", request, servletRequest);
    }

    private ResponseEntity<Map<String, Object>> execute(String operationKey,
                                                        Object requestBody,
                                                        HttpServletRequest servletRequest) {
        try {
            RuntimeControlGateResponse response = runtimeControlGate.execute(new RuntimeControlGateRequest(
                    buildContext(servletRequest, operationKey),
                    operationKey,
                    null,
                    requestBody == null
                            ? Map.of()
                            : objectMapper.convertValue(requestBody, objectMapper.getTypeFactory().constructMapType(LinkedHashMap.class, String.class, Object.class))
            ));
            return ResponseEntity.ok(response.payload());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorBody(e.getMessage()));
        } catch (Exception e) {
            log.error("Runtime control-plane API failed.", e);
            return ResponseEntity.internalServerError().body(errorBody("Runtime control-plane API failed."));
        }
    }

    private ExecutionGateRequestContext buildContext(HttpServletRequest request, String operationKey) {
        RuntimeActorContext userContext = request == null
                ? new RuntimeActorContext("", "")
                : runtimeActorContextPort.resolve(request);
        return ExecutionGateRequestContext.of(
                extractProjectId(request),
                resolveActorScope(userContext),
                GateRouteScope.OPERATIONS_CONSOLE,
                operationKey,
                userContext.userId(),
                request == null ? null : request.getHeader("X-Trace-Id"),
                request == null ? null : request.getHeader("X-Request-Id")
        );
    }

    private String extractProjectId(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String projectId = request.getParameter("projectId");
        return projectId == null || projectId.trim().isEmpty() ? null : projectId.trim();
    }

    private GateActorScope resolveActorScope(RuntimeActorContext context) {
        String authorCode = context == null ? "" : safe(context.authorCode());
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

    private Map<String, Object> errorBody(String message) {
        Map<String, Object> body = new LinkedHashMap<String, Object>();
        body.put("message", message == null ? "" : message);
        return body;
    }
}
