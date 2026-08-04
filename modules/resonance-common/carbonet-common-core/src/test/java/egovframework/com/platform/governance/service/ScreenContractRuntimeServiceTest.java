package egovframework.com.platform.governance.service;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ScreenContractRuntimeServiceTest {
    @Test
    void acceptsCompleteEightLayerContract() {
        assertDoesNotThrow(() -> ScreenContractRuntimeService.validateContract(validContract()));
    }

    @Test
    void rejectsMissingLayerBeforePublish() {
        Map<String,Object> contract = validContract();
        contract.remove("permission");
        assertThrows(IllegalArgumentException.class, () -> ScreenContractRuntimeService.validateContract(contract));
    }

    @Test
    void rejectsContractWithoutProcessIdentity() {
        Map<String,Object> contract = validContract();
        contract.put("process", Map.of("processCode","EMISSION_PROJECT"));
        assertThrows(IllegalArgumentException.class, () -> ScreenContractRuntimeService.validateContract(contract));
    }

    @Test
    void acceptsCanonicalRouteAndRejectsUnsafeRoute() {
        assertDoesNotThrow(() -> ScreenContractRuntimeService.canonicalRoute("/Emission/Project/Create?draft=1"));
        assertThrows(IllegalArgumentException.class, () -> ScreenContractRuntimeService.canonicalRoute("../admin"));
    }

    private Map<String,Object> validContract() {
        Map<String,Object> contract = new LinkedHashMap<>();
        contract.put("screen", Map.of("screenKey","EMISSION_PROJECT_CREATE_V1","name","프로젝트 등록","route","/emission/project/create"));
        contract.put("data", Map.of("fields", java.util.List.of()));
        contract.put("ui", Map.of("sections", java.util.List.of()));
        contract.put("action", Map.of("commands", java.util.List.of()));
        contract.put("process", Map.of("processCode","EMISSION_PROJECT","stepCode","EMISSION_PROJECT_SETUP"));
        contract.put("permission", Map.of("actorCode","COMPANY_MANAGER"));
        contract.put("test", Map.of("cases", java.util.List.of()));
        contract.put("operations", Map.of("rollback",true));
        return contract;
    }
}
