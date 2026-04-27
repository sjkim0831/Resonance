package egovframework.com.platform.codex.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.feature.admin.dto.request.AdminDevSessionSimulationRequestDTO;
import egovframework.com.feature.admin.web.AdminSessionSimulationService;
import egovframework.com.platform.executiongate.ExecutionGateVersion;
import egovframework.com.platform.executiongate.session.SessionSimulationGate;
import egovframework.com.platform.executiongate.session.SessionSimulationGateRequest;
import egovframework.com.platform.executiongate.session.SessionSimulationGateResponse;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;

@Service
public class AdminSessionSimulationGateService implements SessionSimulationGate {

    private final AdminSessionSimulationService adminSessionSimulationService;
    private final ObjectMapper objectMapper;

    public AdminSessionSimulationGateService(AdminSessionSimulationService adminSessionSimulationService,
                                             ObjectMapper objectMapper) {
        this.adminSessionSimulationService = adminSessionSimulationService;
        this.objectMapper = objectMapper;
    }

    @Override
    public SessionSimulationGateResponse execute(SessionSimulationGateRequest request, HttpServletRequest httpServletRequest) {
        Map<String, Object> payload = switch (safe(request.actionKey())) {
            case "session-simulator.get" -> adminSessionSimulationService.buildPayload(httpServletRequest, request.insttId());
            case "session-simulator.apply" -> adminSessionSimulationService.apply(
                    httpServletRequest,
                    objectMapper.convertValue(request.payload(), AdminDevSessionSimulationRequestDTO.class));
            case "session-simulator.reset" -> adminSessionSimulationService.reset(httpServletRequest);
            default -> throw new IllegalArgumentException("Unsupported session simulation action: " + request.actionKey());
        };
        return new SessionSimulationGateResponse(
                request.context() == null ? ExecutionGateVersion.CURRENT : request.context().executionGateVersion(),
                request.actionKey(),
                "SUCCESS",
                payload
        );
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
