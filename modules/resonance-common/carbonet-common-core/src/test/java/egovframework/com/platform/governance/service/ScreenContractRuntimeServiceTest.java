package egovframework.com.platform.governance.service;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import javax.sql.DataSource;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockingDetails;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

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

    @Test
    void springContextSelectsTheExplicitAutowiredDataSourceConstructor() {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.registerBean(DataSource.class, () -> mock(DataSource.class));
            context.registerBean(ObjectMapper.class, () -> new ObjectMapper());
            context.registerBean(ScreenContractRuntimeService.class);
            context.refresh();

            assertNotNull(context.getBean(ScreenContractRuntimeService.class));
        }
    }

    @Test
    void predictsChangedProfessionalContractWithoutWriteLockOrMutationSql() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ScreenContractRuntimeService service = new ScreenContractRuntimeService(jdbc, new ObjectMapper());
        Map<String,Object> active = professionalActiveBinding(
            "bc9e943a358401a7d9dc4b59881600f3", 2022L, 2);
        stubProfessionalPredictionReads(jdbc, active,
            "ae5c83c034aab359960c3558d4b0406b", List.of());
        when(jdbc.queryForObject(argThat(sql -> sql != null && sql.contains("coalesce(max(version_no),0)+1")), eq(Integer.class), any(Object[].class)))
            .thenReturn(3);

        Map<String,Object> prediction = service.predictProfessionalContract(37865L, Map.of());

        assertEquals(false, prediction.get("published"));
        assertEquals(true, prediction.get("wouldPublish"));
        assertEquals(true, prediction.get("predicted"));
        assertEquals(false, prediction.get("applied"));
        assertEquals("DESIGN_CHANGED", prediction.get("reason"));
        assertEquals(3, prediction.get("versionNo"));
        assertEquals("ae5c83c034aab359960c3558d4b0406b", prediction.get("contractHash"));
        assertTrue(mockingDetails(jdbc).getInvocations().stream().allMatch(invocation -> {
            Object[] arguments = invocation.getArguments();
            if (arguments.length == 0 || !(arguments[0] instanceof String sql)) return true;
            String normalized = sql.toLowerCase(java.util.Locale.ROOT);
            return !normalized.contains(" for update")
                && !normalized.matches("(?s).*\\b(insert|update|delete|nextval)\\b.*");
        }), "read-only prediction executed mutation SQL or acquired a write lock");
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void rejectsImmutableAndUnknownProfessionalPredictionOverridesBeforeDatabaseAccess() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ScreenContractRuntimeService service = new ScreenContractRuntimeService(jdbc, new ObjectMapper());

        for (String field : List.of("processCode", "routePath", "contractId", "kpiContract", "unknownField")) {
            IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.predictProfessionalContract(37865L, Map.of(field, "OVERRIDE")));
            assertTrue(error.getMessage().contains(field));
        }
        verifyNoInteractions(jdbc);
    }

    @Test
    void predictsUnchangedWithoutClaimingPublication() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ScreenContractRuntimeService service = new ScreenContractRuntimeService(jdbc, new ObjectMapper());
        String hash = "ae5c83c034aab359960c3558d4b0406b";
        Map<String,Object> active = professionalActiveBinding(hash, 2022L, 2);
        stubProfessionalPredictionReads(jdbc, active, hash, List.of());

        Map<String,Object> prediction = service.predictProfessionalContract(37865L, Map.of());

        assertEquals(false, prediction.get("published"));
        assertEquals(false, prediction.get("wouldPublish"));
        assertEquals(true, prediction.get("predicted"));
        assertEquals(false, prediction.get("applied"));
        assertEquals("UNCHANGED", prediction.get("reason"));
        assertEquals(2022L, prediction.get("versionId"));
        assertEquals(2, prediction.get("versionNo"));
    }

    @Test
    void predictsHistoricalVersionReuseWithoutClaimingPublication() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ScreenContractRuntimeService service = new ScreenContractRuntimeService(jdbc, new ObjectMapper());
        String hash = "ae5c83c034aab359960c3558d4b0406b";
        Map<String,Object> active = professionalActiveBinding(
            "bc9e943a358401a7d9dc4b59881600f3", 2022L, 2);
        Map<String,Object> historical = Map.of("versionId", 2017L, "versionNo", 1);
        stubProfessionalPredictionReads(jdbc, active, hash, List.of(historical));

        Map<String,Object> prediction = service.predictProfessionalContract(37865L, Map.of());

        assertEquals(false, prediction.get("published"));
        assertEquals(true, prediction.get("wouldPublish"));
        assertEquals(true, prediction.get("predicted"));
        assertEquals(false, prediction.get("applied"));
        assertEquals("HISTORICAL_VERSION_REUSED", prediction.get("reason"));
        assertEquals(2017L, prediction.get("versionId"));
        assertEquals(1, prediction.get("versionNo"));
    }

    private void stubProfessionalPredictionReads(JdbcTemplate jdbc, Map<String,Object> active,
            String computedHash, List<Map<String,Object>> historical) {
        when(jdbc.queryForList(argThat(sql -> sql != null && sql.contains("from framework_professional_screen_contract c")), any(Object[].class)))
            .thenReturn(List.of(professionalContractSource()));
        when(jdbc.queryForList(argThat(sql -> sql != null && sql.contains("from framework_screen_contract_binding b")), any(Object[].class)))
            .thenReturn(List.of(active));
        when(jdbc.queryForList(argThat(sql -> sql != null && sql.contains("from framework_screen_contract_version where contract_id=? and contract_hash=?")), any(Object[].class)))
            .thenReturn(historical);
        when(jdbc.queryForObject(argThat(sql -> sql != null && sql.startsWith("select md5")), eq(String.class), any(Object[].class)))
            .thenReturn(computedHash);
    }

    private Map<String,Object> professionalActiveBinding(String hash, long versionId, int versionNo) {
        Map<String,Object> active = new LinkedHashMap<>();
        active.put("screenKey", "DISCLOSURE_CORRECTION__DISCLOSURE_CORRECTION_S1__USER__37865__F78E81FFF3E0");
        active.put("versionId", versionId);
        active.put("versionNo", versionNo);
        active.put("contractHash", hash);
        return active;
    }

    private Map<String,Object> professionalContractSource() {
        Map<String,Object> source = new LinkedHashMap<>();
        source.put("processCode", "DISCLOSURE_CORRECTION");
        source.put("stepCode", "DISCLOSURE_CORRECTION_S1");
        source.put("audience", "USER");
        source.put("routePath", "/planned/emission/disclosure-correction/disclosure-correction-s1");
        source.put("screenName", "공시 정정");
        source.put("actorCode", "COMPANY_MANAGER");
        source.put("businessPurpose", "공시 정정 업무를 정확하게 처리합니다.");
        source.put("entryCondition", "정정 대상이 존재합니다.");
        source.put("exitCondition", "정정 결과와 감사 증적이 저장됩니다.");
        source.put("sectionContract", "[]");
        source.put("fieldContract", "[]");
        source.put("commandContract", "[]");
        source.put("stateContract", "[\"LOADING\",\"EMPTY\",\"ERROR\",\"FORBIDDEN\",\"READY\"]");
        source.put("apiContract", "[]");
        source.put("dataContract", "[]");
        source.put("evidenceContract", "[]");
        source.put("responsiveContract", "360px, 768px, 1280px 검증");
        source.put("accessibilityContract", "KRDS 및 WCAG 2.1 AA");
        source.put("securityContract", "서버 권한 검증");
        source.put("apiVerified", true);
        source.put("databaseVerified", true);
        source.put("authorityVerified", true);
        source.put("responsiveVerified", true);
        source.put("accessibilityVerified", true);
        source.put("exceptionStatesVerified", true);
        source.put("auditEvidenceRef", "qa-run:sha256:0123456789abcdef");
        source.put("contractStatus", "VERIFIED");
        return source;
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
