package egovframework.com.platform.runtimecontrol.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.executiongate.ExecutionGateVersion;
import egovframework.com.platform.executiongate.runtimecontrol.RuntimeControlGate;
import egovframework.com.platform.executiongate.runtimecontrol.RuntimeControlGateRequest;
import egovframework.com.platform.executiongate.runtimecontrol.RuntimeControlGateResponse;
import egovframework.com.platform.runtimecontrol.model.ParityCompareRequest;
import egovframework.com.platform.runtimecontrol.model.ProjectPipelineRunRequest;
import egovframework.com.platform.runtimecontrol.model.ProjectPipelineStatusRequest;
import egovframework.com.platform.runtimecontrol.model.RepairApplyRequest;
import egovframework.com.platform.runtimecontrol.model.RepairOpenRequest;
import egovframework.com.platform.runtimecontrol.service.RuntimeControlPlaneService;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class RuntimeControlExecutionGateService implements RuntimeControlGate {

    private final RuntimeControlPlaneService runtimeControlPlaneService;
    private final ObjectMapper objectMapper;

    public RuntimeControlExecutionGateService(RuntimeControlPlaneService runtimeControlPlaneService,
                                              ObjectMapper objectMapper) {
        this.runtimeControlPlaneService = runtimeControlPlaneService;
        this.objectMapper = objectMapper;
    }

    @Override
    public RuntimeControlGateResponse execute(RuntimeControlGateRequest request) {
        try {
            Map<String, Object> payload = switch (safe(request.operationKey())) {
                case "parity.compare" -> runtimeControlPlaneService.getParityCompare(convert(request.parameters(), ParityCompareRequest.class));
                case "repair.open" -> runtimeControlPlaneService.openRepairSession(convert(request.parameters(), RepairOpenRequest.class));
                case "repair.apply" -> runtimeControlPlaneService.applyRepair(convert(request.parameters(), RepairApplyRequest.class));
                case "project-pipeline.run" -> runtimeControlPlaneService.runProjectPipeline(convert(request.parameters(), ProjectPipelineRunRequest.class));
                case "project-pipeline.status" -> runtimeControlPlaneService.getProjectPipelineStatus(convert(request.parameters(), ProjectPipelineStatusRequest.class));
                default -> throw new IllegalArgumentException("Unsupported runtime control operation: " + request.operationKey());
            };
            return new RuntimeControlGateResponse(
                    request.context() == null ? ExecutionGateVersion.CURRENT : request.context().executionGateVersion(),
                    request.operationKey(),
                    "SUCCESS",
                    payload
            );
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Runtime control execution failed.", e);
        }
    }

    private <T> T convert(Map<String, Object> parameters, Class<T> type) {
        Map<String, Object> source = parameters == null ? Map.of() : parameters;
        return objectMapper.convertValue(source, type);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
