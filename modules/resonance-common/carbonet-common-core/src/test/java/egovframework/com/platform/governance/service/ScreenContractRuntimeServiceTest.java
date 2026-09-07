package egovframework.com.platform.governance.service;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

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
    @SuppressWarnings("unchecked")
    void predictsOneHashedSupportBundleFromTheCanonicalDesign() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ScreenContractRuntimeService service = new ScreenContractRuntimeService(jdbc, new ObjectMapper());
        stubProfessionalPredictionReads(jdbc,
            professionalActiveBinding("old", 2022L, 2), "new", List.of());
        when(jdbc.queryForObject(argThat(sql -> sql != null && sql.contains("coalesce(max(version_no),0)+1")),
            eq(Integer.class), any(Object[].class))).thenReturn(3);

        Map<String,Object> prediction = service.predictProfessionalContract(37865L, Map.of());

        assertEquals("new", prediction.get("contractHash"));
        assertEquals("ef42c8bce9df1444d32766962be7f4ce05e845bc9532769ca75cb95844288728",
            prediction.get("designHash"));
        assertEquals("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            prediction.get("catalogHash"));
        assertEquals(false, prediction.get("buildRequired"));
        Map<String,Object> responseSupport = (Map<String,Object>)prediction.get("support");
        assertEquals("carbonet.executable-screen-support/v1", responseSupport.get("schemaVersion"));
        assertTrue(responseSupport.keySet().containsAll(Set.of("help", "workGuide", "qa", "designCard", "assetBindings")));
        assertTrue(mockingDetails(jdbc).getInvocations().stream().anyMatch(invocation -> {
            Object[] arguments = invocation.getArguments();
            if (arguments.length < 3 || !(arguments[0] instanceof String sql)
                    || !sql.startsWith("select md5")) return false;
            try {
                Map<String,Object> contract = new ObjectMapper().readValue(String.valueOf(arguments[2]), Map.class);
                Map<String,Object> support = (Map<String,Object>)contract.get("support");
                Map<String,Object> operations = (Map<String,Object>)contract.get("operations");
                return "carbonet.executable-screen-support/v1".equals(support.get("schemaVersion"))
                    && String.valueOf(support.get("designHash")).matches("[0-9a-f]{64}")
                    && String.valueOf(support.get("catalogHash")).matches("[0-9a-f]{64}")
                    && support.keySet().containsAll(Set.of("help", "workGuide", "qa", "designCard", "lanes"))
                    && support.get("designHash").equals(operations.get("designHash"))
                    && support.get("catalogHash").equals(operations.get("catalogHash"));
            } catch (Exception ignored) {
                return false;
            }
        }), "versioned runtime contract omitted canonical support hashes or surfaces");
    }

    @Test
    @SuppressWarnings("unchecked")
    void projectsLegacyEightStatesIntoOneFinalTenStateRuntimeAndSupportHash() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ScreenContractRuntimeService service = new ScreenContractRuntimeService(jdbc, new ObjectMapper());
        List<String> finalTen = List.of(
            "LOADING", "EMPTY", "READY", "DIRTY", "SAVING",
            "SUCCESS", "ERROR", "FORBIDDEN", "CONFLICT", "RECOVERY");
        String finalTenJson = new ObjectMapper().writeValueAsString(finalTen);
        AtomicReference<String> projectionJson = new AtomicReference<>();
        AtomicReference<String> runtimePayload = new AtomicReference<>();

        when(jdbc.queryForList(
            argThat(sql -> sql != null && sql.contains("from framework_professional_screen_contract c")),
            any(Object[].class))).thenAnswer(invocation -> {
                projectionJson.set(String.valueOf((Object)invocation.getArgument(1)));
                return List.of(professionalContractSourceWithCanonicalStates(finalTen));
            });
        when(jdbc.queryForList(
            argThat(sql -> sql != null && sql.contains("from framework_screen_contract_binding b")),
            any(Object[].class))).thenReturn(List.of(
                professionalActiveBinding("legacy-eight-hash", 2022L, 2)));
        when(jdbc.queryForList(
            argThat(sql -> sql != null && sql.contains(
                "from framework_screen_contract_version where contract_id=? and contract_hash=?")),
            any(Object[].class))).thenReturn(List.of());
        when(jdbc.queryForObject(
            argThat(sql -> sql != null && sql.startsWith("select md5")),
            eq(String.class), any(Object[].class))).thenAnswer(invocation -> {
                runtimePayload.set(String.valueOf((Object)invocation.getArgument(2)));
                return "final-ten-runtime-hash";
            });
        when(jdbc.queryForObject(
            argThat(sql -> sql != null && sql.contains("coalesce(max(version_no),0)+1")),
            eq(Integer.class), any(Object[].class))).thenReturn(3);

        Map<String,Object> prediction = service.predictProfessionalContract(
            37865L, Map.of("stateContract", finalTenJson));

        Map<String,Object> projected = new ObjectMapper().readValue(projectionJson.get(), Map.class);
        assertEquals(finalTenJson, projected.get("stateContract"));
        Map<String,Object> payload = new ObjectMapper().readValue(runtimePayload.get(), Map.class);
        Map<String,Object> process = (Map<String,Object>)payload.get("process");
        Map<String,Object> support = (Map<String,Object>)payload.get("support");
        Map<String,Object> lanes = (Map<String,Object>)support.get("lanes");
        Map<String,Object> help = (Map<String,Object>)lanes.get("HELP");
        Map<String,Object> frontend = (Map<String,Object>)lanes.get("FRONTEND");
        Map<String,Object> operations = (Map<String,Object>)payload.get("operations");
        assertEquals(finalTen, process.get("states"));
        assertEquals(finalTen, help.get("exceptionStates"));
        assertEquals(finalTen, frontend.get("states"));
        assertEquals(support.get("designHash"), operations.get("designHash"));
        assertEquals(support.get("catalogHash"), operations.get("catalogHash"));
        assertEquals(support.get("designHash"), prediction.get("designHash"));
        assertEquals("final-ten-runtime-hash", prediction.get("contractHash"));
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void acceptsNullOrLegacyBlankCatalogHashAndRetainsExactSupportValue() {
        for(Object catalogHash:java.util.Arrays.asList(null,"  ")){
            JdbcTemplate jdbc = mock(JdbcTemplate.class);
            ScreenContractRuntimeService service = new ScreenContractRuntimeService(jdbc, new ObjectMapper());
            stubProfessionalPredictionReads(jdbc,
                professionalActiveBinding("old", 2022L, 2), "new", List.of());
            when(jdbc.queryForList(
                argThat(sql -> sql != null && sql.contains("from framework_professional_screen_contract c")),
                any(Object[].class))).thenReturn(List.of(
                    professionalContractSourceWithCatalogHash(catalogHash)));
            when(jdbc.queryForObject(
                argThat(sql -> sql != null && sql.contains("coalesce(max(version_no),0)+1")),
                eq(Integer.class), any(Object[].class))).thenReturn(3);

            Map<String,Object> prediction = service.predictProfessionalContract(37865L, Map.of());

            assertEquals("ef42c8bce9df1444d32766962be7f4ce05e845bc9532769ca75cb95844288728",
                prediction.get("designHash"));
            assertTrue(prediction.containsKey("catalogHash"));
            assertEquals(catalogHash, prediction.get("catalogHash"));
            Map<String,Object> support = (Map<String,Object>)prediction.get("support");
            assertEquals(Set.of("schemaVersion", "designHash", "catalogHash", "help", "workGuide",
                "qa", "designCard", "assetBindings", "lanes"), support.keySet());
            assertEquals(catalogHash, support.get("catalogHash"));
        }
    }

    @Test
    void rejectsMalformedOrNonStringCatalogHashBeforeVersionOrBindingMutation() {
        for(Object invalidCatalogHash:List.of(
                "not-a-sha256",new java.math.BigInteger("1".repeat(64)))){
            JdbcTemplate jdbc = mock(JdbcTemplate.class);
            ScreenContractRuntimeService service = new ScreenContractRuntimeService(jdbc, new ObjectMapper());
            stubProfessionalPredictionReads(jdbc,
                professionalActiveBinding("old", 2022L, 2), "new", List.of());
            when(jdbc.queryForList(
                argThat(sql -> sql != null && sql.contains("from framework_professional_screen_contract c")),
                any(Object[].class))).thenReturn(List.of(
                    professionalContractSourceWithCatalogHash(invalidCatalogHash)));

            IllegalStateException error = assertThrows(IllegalStateException.class,
                () -> service.predictProfessionalContract(37865L, Map.of()));

            assertTrue(error.getMessage().contains("Canonical screen bundle"));
            verify(jdbc, never()).update(anyString(), any(Object[].class));
        }
    }

    @Test
    void rejectsIncompleteCanonicalBundleBeforeVersionOrBindingMutation() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ScreenContractRuntimeService service = new ScreenContractRuntimeService(jdbc, new ObjectMapper());
        stubProfessionalPredictionReads(jdbc,
            professionalActiveBinding("old", 2022L, 2), "new", List.of());
        Map<String,Object> incompleteSource = professionalContractSource();
        incompleteSource.put("canonicalBundle", """
            {"schema":"carbonet.canonical-design/v1",
             "designHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
             "catalogHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
             "canonicalDesign":{"lanes":{"HELP":{}}}}
            """);
        when(jdbc.queryForList(
            argThat(sql -> sql != null && sql.contains("from framework_professional_screen_contract c")),
            any(Object[].class))).thenReturn(List.of(incompleteSource));

        IllegalStateException error = assertThrows(IllegalStateException.class,
            () -> service.predictProfessionalContract(37865L, Map.of()));

        assertTrue(error.getMessage().contains("Canonical screen bundle"));
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void rejectsCanonicalTextHashDriftBeforeVersionOrBindingMutation() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ScreenContractRuntimeService service = new ScreenContractRuntimeService(jdbc, new ObjectMapper());
        stubProfessionalPredictionReads(jdbc,
            professionalActiveBinding("old", 2022L, 2), "new", List.of());
        Map<String,Object> driftedSource = professionalContractSource();
        String bundle = String.valueOf(driftedSource.get("canonicalBundle"));
        driftedSource.put("canonicalBundle", bundle.replace(
            "ef42c8bce9df1444d32766962be7f4ce05e845bc9532769ca75cb95844288728",
            "0000000000000000000000000000000000000000000000000000000000000000"));
        when(jdbc.queryForList(
            argThat(sql -> sql != null && sql.contains("from framework_professional_screen_contract c")),
            any(Object[].class))).thenReturn(List.of(driftedSource));

        IllegalStateException error = assertThrows(IllegalStateException.class,
            () -> service.predictProfessionalContract(37865L, Map.of()));

        assertTrue(error.getMessage().contains("Canonical screen bundle"));
        assertTrue(mockingDetails(jdbc).getInvocations().stream().noneMatch(invocation -> {
            Object[] arguments = invocation.getArguments();
            return arguments.length > 0 && arguments[0] instanceof String sql
                && sql.toLowerCase(java.util.Locale.ROOT).matches("(?s).*\\b(insert|update|delete)\\b.*");
        }));
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
    void rejectsNonCanonicalProfessionalPredictionStatusesBeforeDatabaseAccess() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ScreenContractRuntimeService service = new ScreenContractRuntimeService(jdbc, new ObjectMapper());

        for (Object status : java.util.Arrays.asList("BOGUS", "verified", 7, null)) {
            Map<String,Object> proposed = new LinkedHashMap<>();
            proposed.put("contractStatus", status);
            IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.predictProfessionalContract(37865L, proposed));
            assertTrue(error.getMessage().contains("contractStatus"));
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
        source.put("permissionCodes", "[]");
        source.put("apiVerified", true);
        source.put("databaseVerified", true);
        source.put("authorityVerified", true);
        source.put("responsiveVerified", true);
        source.put("accessibilityVerified", true);
        source.put("exceptionStatesVerified", true);
        source.put("auditEvidenceRef", "qa-run:sha256:0123456789abcdef");
        source.put("contractStatus", "VERIFIED");
        source.put("canonicalBundle", """
            {"schema":"carbonet.canonical-design/v1",
             "designHash":"ef42c8bce9df1444d32766962be7f4ce05e845bc9532769ca75cb95844288728",
             "canonicalText":"{\\\"identity\\\":{\\\"pageId\\\":\\\"DISCLOSURE_CORRECTION_S1\\\"},\\\"process\\\":{\\\"processCode\\\":\\\"DISCLOSURE_CORRECTION\\\"},\\\"step\\\":{\\\"stepCode\\\":\\\"DISCLOSURE_CORRECTION_S1\\\"},\\\"lanes\\\":{\\\"HELP\\\":{\\\"items\\\":[]},\\\"WORK_GUIDE\\\":{\\\"actorCode\\\":\\\"COMPANY_MANAGER\\\"},\\\"QA\\\":{\\\"requiredScenarios\\\":[\\\"HAPPY_PATH\\\",\\\"AUTHORITY\\\",\\\"ISOLATION\\\",\\\"EXCEPTION\\\",\\\"RECOVERY\\\"]},\\\"DESIGN_CARD\\\":{\\\"assetBindings\\\":[]},\\\"FRONTEND\\\":{},\\\"API\\\":[],\\\"DATABASE\\\":[]}}",
             "catalogHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
             "canonicalDesign":{
               "identity":{"pageId":"DISCLOSURE_CORRECTION_S1"},
               "process":{"processCode":"DISCLOSURE_CORRECTION"},
               "step":{"stepCode":"DISCLOSURE_CORRECTION_S1"},
               "lanes":{
               "HELP":{"items":[]},
               "WORK_GUIDE":{"actorCode":"COMPANY_MANAGER"},
               "QA":{"requiredScenarios":["HAPPY_PATH","AUTHORITY","ISOLATION","EXCEPTION","RECOVERY"]},
               "DESIGN_CARD":{"assetBindings":[]},
               "FRONTEND":{},
               "API":[],
               "DATABASE":[]
             }}}}
            """);
        return source;
    }

    @SuppressWarnings("unchecked")
    private Map<String,Object> professionalContractSourceWithCatalogHash(Object catalogHash) {
        Map<String,Object> source = professionalContractSource();
        try {
            ObjectMapper mapper = new ObjectMapper();
            Map<String,Object> bundle = mapper.readValue(
                String.valueOf(source.get("canonicalBundle")), Map.class);
            bundle.put("catalogHash", catalogHash);
            source.put("canonicalBundle", mapper.writeValueAsString(bundle));
            return source;
        } catch (Exception error) {
            throw new IllegalStateException(error);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String,Object> professionalContractSourceWithCanonicalStates(List<String> states) {
        Map<String,Object> source = professionalContractSource();
        source.put("stateContract",
            "[\"LOADING\",\"EMPTY\",\"READY\",\"DIRTY\",\"SAVING\",\"SUCCESS\",\"ERROR\",\"FORBIDDEN\"]");
        try {
            ObjectMapper mapper = new ObjectMapper();
            Map<String,Object> bundle = mapper.readValue(
                String.valueOf(source.get("canonicalBundle")), Map.class);
            Map<String,Object> design = (Map<String,Object>)bundle.get("canonicalDesign");
            Map<String,Object> lanes = (Map<String,Object>)design.get("lanes");
            ((Map<String,Object>)lanes.get("HELP")).put("exceptionStates", states);
            ((Map<String,Object>)lanes.get("FRONTEND")).put("states", states);
            String canonicalText = mapper.writeValueAsString(design);
            String designHash = java.util.HexFormat.of().formatHex(
                java.security.MessageDigest.getInstance("SHA-256").digest(
                    canonicalText.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
            bundle.put("canonicalText", canonicalText);
            bundle.put("designHash", designHash);
            bundle.put("catalogHash", null);
            source.put("canonicalBundle", mapper.writeValueAsString(bundle));
            return source;
        } catch (Exception error) {
            throw new IllegalStateException(error);
        }
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
