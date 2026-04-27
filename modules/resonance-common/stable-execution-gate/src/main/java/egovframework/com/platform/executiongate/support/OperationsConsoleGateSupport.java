package egovframework.com.platform.executiongate.support;

import egovframework.com.platform.executiongate.ExecutionGateRequestContext;
import egovframework.com.platform.executiongate.GateActorScope;
import egovframework.com.platform.executiongate.GateRouteScope;
import egovframework.com.platform.executiongate.operations.OperationsActionGate;
import egovframework.com.platform.executiongate.operations.OperationsActionGateRequest;
import egovframework.com.platform.executiongate.operations.OperationsActionGateResponse;
import egovframework.com.platform.service.observability.CurrentUserContextReadPort;
import egovframework.com.platform.service.observability.CurrentUserContextSnapshot;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class OperationsConsoleGateSupport {

    private final OperationsActionGate operationsActionGate;
    private final ObjectProvider<CurrentUserContextReadPort> currentUserContextReadPortProvider;

    public OperationsConsoleGateSupport(OperationsActionGate operationsActionGate,
                                        ObjectProvider<CurrentUserContextReadPort> currentUserContextReadPortProvider) {
        this.operationsActionGate = operationsActionGate;
        this.currentUserContextReadPortProvider = currentUserContextReadPortProvider;
    }

    public OperationsActionGateResponse execute(HttpServletRequest request,
                                                String actionKey,
                                                String targetId,
                                                String actorId,
                                                GateActorScope actorScope,
                                                Map<String, Object> parameters) {
        Map<String, Object> gateParameters = new LinkedHashMap<>();
        if (parameters != null) {
            gateParameters.putAll(parameters);
        }
        gateParameters.put("actorId", safe(actorId));
        return operationsActionGate.execute(new OperationsActionGateRequest(
                ExecutionGateRequestContext.of(
                        null,
                        actorScope == null ? GateActorScope.ANONYMOUS : actorScope,
                        GateRouteScope.OPERATIONS_CONSOLE,
                        actionKey,
                        safe(actorId),
                        request == null ? null : request.getHeader("X-Trace-Id"),
                        request == null ? null : request.getHeader("X-Request-Id")
                ),
                actionKey,
                targetId,
                enrichParameters(gateParameters, request, actorId, actorScope)
        ));
    }

    public Map<String, Object> payload(HttpServletRequest request,
                                       String actionKey,
                                       String targetId,
                                       String actorId,
                                       GateActorScope actorScope,
                                       Map<String, Object> parameters) {
        return execute(request, actionKey, targetId, actorId, actorScope, parameters).payload();
    }

    public OperationsActionGateResponse executeForCurrentAdmin(HttpServletRequest request,
                                                               String actionKey,
                                                               String targetId,
                                                               Map<String, Object> parameters) {
        CurrentUserContextSnapshot userContext = resolveCurrentUserContext(request);
        return execute(
                request,
                actionKey,
                targetId,
                userContext.getUserId(),
                resolveActorScope(userContext),
                parameters
        );
    }

    public Map<String, Object> payloadForCurrentAdmin(HttpServletRequest request,
                                                      String actionKey,
                                                      String targetId,
                                                      Map<String, Object> parameters) {
        return executeForCurrentAdmin(request, actionKey, targetId, parameters).payload();
    }

    private Map<String, Object> enrichParameters(Map<String, Object> parameters,
                                                 HttpServletRequest request,
                                                 String actorId,
                                                 GateActorScope actorScope) {
        Map<String, Object> enriched = new LinkedHashMap<>(parameters);
        CurrentUserContextSnapshot userContext = resolveCurrentUserContext(request);
        enriched.put("actorId", safe(actorId));
        enriched.putIfAbsent("actorRole", safe(userContext.getAuthorCode()));
        enriched.putIfAbsent("requestIp", resolveRequestIp(request));
        enriched.putIfAbsent("userAgent", request == null ? "" : safe(request.getHeader("User-Agent")));
        enriched.putIfAbsent("gateActorScope", actorScope == null ? "" : actorScope.name());
        return enriched;
    }

    private CurrentUserContextSnapshot resolveCurrentUserContext(HttpServletRequest request) {
        CurrentUserContextReadPort currentUserContextReadPort = currentUserContextReadPortProvider.getIfAvailable();
        if (currentUserContextReadPort == null) {
            return new CurrentUserContextSnapshot();
        }
        CurrentUserContextSnapshot snapshot = currentUserContextReadPort.resolve(request);
        return snapshot == null ? new CurrentUserContextSnapshot() : snapshot;
    }

    private GateActorScope resolveActorScope(CurrentUserContextSnapshot context) {
        String authorCode = safe(context == null ? null : context.getAuthorCode());
        if ("ROLE_SYSTEM_MASTER".equals(authorCode) || "ROLE_OPERATION_ADMIN".equals(authorCode)) {
            return GateActorScope.COMMON_ADMIN_OPS;
        }
        if (!authorCode.isEmpty()) {
            return GateActorScope.PROJECT_ADMIN;
        }
        return GateActorScope.ANONYMOUS;
    }

    private String resolveRequestIp(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        String forwarded = safe(request.getHeader("X-Forwarded-For"));
        if (!forwarded.isEmpty()) {
            int commaIndex = forwarded.indexOf(',');
            return commaIndex >= 0 ? forwarded.substring(0, commaIndex).trim() : forwarded;
        }
        return safe(request.getRemoteAddr());
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
