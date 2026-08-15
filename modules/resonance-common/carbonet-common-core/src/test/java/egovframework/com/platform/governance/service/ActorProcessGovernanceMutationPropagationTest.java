package egovframework.com.platform.governance.service;

import egovframework.com.platform.codex.service.CodexProvisioningService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockingDetails;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ActorProcessGovernanceMutationPropagationTest {

    @Test
    void commonDesignFingerprintIsByteIdenticalToBackstageStableJson(){
        Map<String,Object> canonical=Map.ofEntries(
            Map.entry("assetType","SCREEN"),Map.entry("assetId","SCREEN_GLOBAL"),
            Map.entry("assetName","전역 화면"),Map.entry("routePath","/global"),
            Map.entry("version","1.0.0"),Map.entry("active",true),
            Map.entry("payload",Map.ofEntries(
                Map.entry("schemaVersion","1.0.0"),Map.entry("pageName","전역 화면"),
                Map.entry("layout","KRDS_WORKSPACE"),Map.entry("theme","KRDS_GOV_DEFAULT"),
                Map.entry("sections",List.of("SUMMARY","FORM")),
                Map.entry("components",List.of("JSON_FORM")),
                Map.entry("dependencies",List.of()))));

        assertEquals("8e54f5c6185545bc94fea05909ce1b4ef9f8f0520566bbccd695f3cd19f4f2a7",
            ActorProcessGovernanceService.commonDesignAssetFingerprint(canonical));
        assertEquals("ab37e189a99684ecd2cbad7cb21874b42402f460b7143c932e2c70ef151ff4ad",
            ActorProcessGovernanceService.commonDesignAssetFingerprint(Map.of(
                "numbers",List.of(1,1.5,1e-7,1e-6,1e21,-0.0,-1.25e21,1e23,
                    Double.longBitsToDouble(1L)),
                "text","control\u000f😀")));
        Map<String,Object> nonCanonicalRoute=new java.util.LinkedHashMap<>(canonical);
        nonCanonicalRoute.put("routePath","//global?draft=1#editor");
        assertEquals(ActorProcessGovernanceService.commonDesignAssetFingerprint(canonical),
            ActorProcessGovernanceService.commonDesignAssetFingerprint(nonCanonicalRoute));
    }

    @Test
    void commonDesignSourceFailsClosedBeforeAnyRuntimeWriteOrGenerationJob(){
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        ActorProcessGovernanceService service=service(jdbc);
        Map<String,Object> forbidden=new java.util.LinkedHashMap<>();
        forbidden.put("activationPolicy","SOURCE_IMMEDIATE_V1");
        forbidden.put("authorityMode","MANUAL");

        assertThrows(SecurityException.class,()->
            service.applyCommonDesignAssetSource(forbidden,"design-approver"));

        Map<String,Object> invalid=new java.util.LinkedHashMap<>();
        invalid.put("activationPolicy","SOURCE_IMMEDIATE_V1");
        invalid.put("authorityMode","SOURCE");invalid.put("projectId","PROJECT_A");
        invalid.put("assetType","SCREEN");invalid.put("assetId","SCREEN_A");
        invalid.put("assetName","Screen A");invalid.put("routePath","/screen-a");
        invalid.put("version","1.0.0");invalid.put("active",true);
        invalid.put("baseFingerprint","a".repeat(64));
        invalid.put("assetFingerprint","b".repeat(64));
        invalid.put("dependencies",List.of());
        invalid.put("payload",Map.of("layout","KRDS_LAYOUT","theme","KRDS_THEME",
            "sections",List.of(),"components",List.of(),"unexpected",true));

        assertThrows(IllegalArgumentException.class,()->
            service.applyCommonDesignAssetSource(invalid,"design-approver"));
        verifyNoInteractions(jdbc);
    }

    @Test
    void commonDesignSourceContractMutatesCanonicalSourceBeforeExactProcessFanout()
            throws Exception {
        String source=Files.readString(findRepositoryFile(
            "modules/resonance-common/carbonet-common-core/src/main/java/"+
            "egovframework/com/platform/governance/service/ActorProcessGovernanceService.java"));
        int start=source.indexOf("Map<String,Object> applyCommonDesignAssetSource(");
        int end=source.indexOf("private List<Map<String,Object>> affectedCommonDesignScreens(",start);
        String mutation=source.substring(start,end);

        int registry=mutation.indexOf("updateCommonDesignRegistry(");
        int canonical=mutation.indexOf("update framework_screen_blueprint");
        int graph=mutation.indexOf("generateProfessionalDesignGraph(process,actor)");
        int fanout=mutation.indexOf("refreshAndQueueCanonicalProcess(process,actor,trigger)");
        assertTrue(registry>0&&canonical>registry&&graph>canonical&&fanout>graph);
        assertTrue(mutation.contains("COMMON_DESIGN_REGISTRY_WRITE_NOT_EXACT"));
        assertTrue(mutation.contains("DESIGN_ASSET_BASE_FINGERPRINT_FORGED"));
        assertTrue(mutation.contains("DESIGN_ASSET_AFTER_FINGERPRINT_FORGED"));
        assertTrue(mutation.contains("DESIGN_ASSET_GLOBAL_FINGERPRINT_CHANGED"));
        assertTrue(mutation.contains("COMMON_DESIGN_CANONICAL_HASH_UNCHANGED"));
        assertTrue(mutation.contains("sourceCommitted\",true"));
        assertTrue(mutation.contains("jobCount"));
        assertTrue(mutation.contains("endpointExpected"));
        assertFalse(mutation.contains("DESIGN_ASSET_PROMOTION"));
        assertTrue(source.contains("\"COMMON_DESIGN_SOURCE_V1:\"+identity"));
        assertFalse(source.contains("\"COMMON_DESIGN_SOURCE_V1:\"+projectId"));
        assertTrue(source.contains("case \"THEME\"")||
            source.contains("if(\"THEME\".equals(assetType))"));
        assertTrue(source.contains("if(\"SECTION\".equals(assetType))"));
        assertTrue(source.contains("if(\"COMPONENT\".equals(assetType))"));
        assertTrue(source.contains("from ui_page_manifest where page_id=? for update"));

        int impactEnd=source.indexOf("private int updateCommonDesignRegistry(",end);
        String impact=source.substring(end,impactEnd);
        assertTrue(impact.contains("ui_page_component_map"));
        assertTrue(impact.contains("assetBindings"));
        assertTrue(impact.contains("upper(blueprint.page_id)=upper(?)"));
        assertTrue(impact.contains("order by blueprint.process_code collate \"C\""));
    }

    @Test
    void incompleteAddStepRefreshesSpecsAndSkipsWithoutLegacyFanout() throws Exception {
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        ActorProcessGovernanceService service=service(jdbc);
        when(jdbc.queryForObject(argThat(sql->sql!=null&&sql.contains("framework_process_definition where process_code")),
            eq(Integer.class),any(Object[].class))).thenReturn(1);
        when(jdbc.queryForObject(argThat(sql->sql!=null&&sql.contains("framework_actor_definition where actor_code")),
            eq(Integer.class),any(Object[].class))).thenReturn(1);
        when(jdbc.queryForList(argThat(sql->sql!=null
                &&sql.contains("select actor_code,use_at")&&sql.contains("for update")),
            any(Object[].class))).thenReturn(List.of(
                Map.of("actor_code","ACTOR_A","use_at","Y")));
        when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains("select step_order")&&sql.contains("for update")),
            any(Object[].class))).thenReturn(List.of());
        when(jdbc.queryForObject(argThat(sql->sql!=null
                &&sql.contains("framework_professional_screen_contract contract")
                &&sql.contains("PRIMARY_STEP_COMMAND")),eq(Integer.class),any(Object[].class)))
            .thenReturn(0);
        stubSkippedRefresh(jdbc,1,1,0);
        Map<String,Object> body=Map.ofEntries(
            Map.entry("processCode","PROCESS_A"),Map.entry("stepCode","STEP_A"),
            Map.entry("stepOrder",1),Map.entry("actorCode","ACTOR_A"),
            Map.entry("stepName","Step A"),Map.entry("fromState","DRAFT"),
            Map.entry("commandCode","EXECUTE"),Map.entry("toState","DONE"),
            Map.entry("completionRule","complete"));

        Map<String,Object> result=service.addStep(body,"system-admin");

        assertEquals("SKIPPED",result.get("status"));
        assertEquals(false,result.get("generationQueued"));
        assertEquals(0,result.get("jobCount"));
        assertEquals(1,result.get("skippedStepCount"));
        verify(jdbc).queryForObject(argThat(sql->sql.contains(
            "framework_refresh_process_execution_specs(?,?)")),eq(String.class),
            any(Object[].class));
        String source=Files.readString(findRepositoryFile(
            "modules/resonance-common/carbonet-common-core/src/main/java/"+
            "egovframework/com/platform/governance/service/ActorProcessGovernanceService.java"));
        String addStep=source.substring(source.indexOf("Map<String,Object> addStep("),
            source.indexOf("Map<String,Object> generateDevelopmentPlan("));
        assertTrue(addStep.contains("refreshAndQueueCanonicalProcess"));
        assertFalse(addStep.contains("generateDevelopmentPlan("));
    }

    @Test
    void newProcessWithoutStepsReturnsNumericSkipUsingAuthenticatedIdentity(){
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        ActorProcessGovernanceService service=service(jdbc);
        when(jdbc.queryForObject(argThat(sql->sql!=null&&sql.contains("framework_business_work_type")),
            eq(Integer.class),any(Object[].class))).thenReturn(1);
        when(jdbc.queryForObject(argThat(sql->sql!=null&&sql.contains("framework_actor_definition")),
            eq(Integer.class),any(Object[].class))).thenReturn(1);
        when(jdbc.queryForList(argThat(sql->sql!=null
                &&sql.contains("select actor_code,use_at")&&sql.contains("for update")),
            any(Object[].class))).thenReturn(List.of(
                Map.of("actor_code","OWNER_A","use_at","Y")));
        stubSkippedRefresh(jdbc,0,0,0);
        Map<String,Object> body=Map.ofEntries(
            Map.entry("processCode","PROCESS_A"),Map.entry("processName","Process A"),
            Map.entry("domainCode","DOMAIN_A"),Map.entry("goal","goal"),
            Map.entry("startCondition","start"),Map.entry("completionCondition","complete"),
            Map.entry("ownerActorCode","OWNER_A"));

        Map<String,Object> result=service.createProcess(body,"authenticated-admin");

        assertEquals("SKIPPED",result.get("status"));
        assertEquals(0,result.get("processStepCount"));
        assertEquals(0,result.get("jobCount"));
        verify(jdbc).queryForObject(argThat(sql->sql.contains(
                "framework_refresh_process_execution_specs(?,?)")),eq(String.class),
            eq("PROCESS_A"),eq("authenticated-admin"));
    }

    @Test
    void actorMutationFindsPrimaryOwnerEscalationAndSegregationProcesses(){
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        ActorProcessGovernanceService service=service(jdbc);
        when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains("affected.process_code")),
            eq(String.class),any(Object[].class)))
            .thenReturn(List.of("PROCESS_PRIMARY","PROCESS_OWNER","PROCESS_ESCALATION","PROCESS_SEGREGATION"));
        stubSkippedRefresh(jdbc,1,1,0);
        Map<String,Object> body=Map.of(
            "actorCode","ACTOR_A","actorName","Actor A","purpose","purpose");

        Map<String,Object> result=service.createActor(body,"authenticated-admin");

        assertEquals(4,result.get("affectedProcessCount"));
        assertEquals(0,result.get("queuedProcessCount"));
        assertEquals(false,result.get("generationQueued"));
        var lookup=mockingDetails(jdbc).getInvocations().stream()
            .filter(call->call.getMethod().getName().equals("queryForList")
                &&String.valueOf(call.getArguments()[0]).contains("affected.process_code"))
            .findFirst().orElseThrow();
        String sql=String.valueOf(lookup.getArguments()[0]);
        assertTrue(sql.contains("step.actor_code=?"));
        assertTrue(sql.contains("process.owner_actor_code=?"));
        assertTrue(sql.contains("step.escalation_actor_code=?"));
        assertTrue(sql.contains("step.segregation_actor_codes"));
        verify(jdbc,times(4)).queryForObject(argThat(query->query.contains(
                "framework_refresh_process_execution_specs(?,?)")),eq(String.class),
            any(Object[].class));
    }

    @Test
    void integratedNoteOnlySaveIsTruthfulAndDoesNotTouchCanonicalSource(){
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        ActorProcessGovernanceService service=service(jdbc);
        when(jdbc.queryForList(argThat(sql->sql!=null
                &&sql.contains("from integrated_design_document")
                &&sql.contains("for update")),any(Object[].class)))
            .thenReturn(List.of());
        when(jdbc.queryForObject(argThat(sql->sql!=null
                &&sql.contains("insert into integrated_design_document")),
            eq(Long.class),any(Object[].class))).thenReturn(1L);

        Map<String,Object> result=service.saveIntegratedDesignDocument(Map.ofEntries(
            Map.entry("processCode","PROCESS_A"),Map.entry("stepCode","STEP_A"),
            Map.entry("routePath","/screen-a"),Map.entry("documentType","REQUIREMENT"),
            Map.entry("title","Requirement note"),Map.entry("content","review note"),
            Map.entry("status","DRAFT"),Map.entry("revision",0)),
            "user:default/system-admin");

        assertEquals("NOTE_ONLY",result.get("mutationKind"));
        assertEquals(false,result.get("sourceCommitted"));
        assertEquals(0,result.get("jobCount"));
        assertEquals(0,result.get("endpointExpected"));
        assertFalse(mockingDetails(jdbc).getInvocations().stream().anyMatch(call->
            String.valueOf(call.getArguments()[0]).contains(
                "framework_professional_screen_contract")));
    }

    @Test
    void unsupportedStructuredFieldFailsBeforeCanonicalOrDocumentWrite(){
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        ActorProcessGovernanceService service=service(jdbc);
        when(jdbc.queryForList(argThat(sql->sql!=null
                &&sql.contains("from integrated_design_document")
                &&sql.contains("for update")),any(Object[].class)))
            .thenReturn(List.of());
        String content="""
            {"schemaVersion":"carbonet.integrated-design-source/v1",
             "contractId":7,"apiContract":[],"unsupported":true}
            """;

        assertThrows(IllegalArgumentException.class,()->
            service.saveIntegratedDesignDocument(Map.ofEntries(
                Map.entry("processCode","PROCESS_A"),Map.entry("stepCode","STEP_A"),
                Map.entry("routePath","/screen-a"),Map.entry("documentType","API"),
                Map.entry("title","API source"),Map.entry("content",content),
                Map.entry("status","READY"),Map.entry("revision",0)),
                "user:default/system-admin"));

        assertFalse(mockingDetails(jdbc).getInvocations().stream().anyMatch(call->{
            String sql=String.valueOf(call.getArguments()[0]);
            return sql.contains("insert into integrated_design_document")
                ||sql.contains("update integrated_design_document")
                ||sql.contains("update framework_professional_screen_contract")
                ||sql.contains("insert into framework_development_job");
        }));
    }

    @Test
    void integratedApiDesignProjectsCanonicalSourceAndReturnsExactJobEndpoint(){
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        ActorProcessGovernanceService service=spy(service(jdbc));
        when(jdbc.queryForList(argThat(sql->sql!=null
                &&sql.contains("from integrated_design_document")
                &&sql.contains("for update")),any(Object[].class)))
            .thenReturn(List.of());
        when(jdbc.queryForList(argThat(sql->sql!=null
                &&sql.contains("from framework_professional_screen_contract")
                &&sql.contains("permission_codes::text")
                &&sql.contains("for update")),any(Object[].class)))
            .thenReturn(List.of(Map.ofEntries(
                Map.entry("contractId",7L),Map.entry("businessPurpose","Existing purpose"),
                Map.entry("entryCondition","Existing entry"),
                Map.entry("exitCondition","Existing exit condition"),
                Map.entry("kpiContract","[]"),Map.entry("sectionContract","[]"),
                Map.entry("fieldContract","[]"),Map.entry("commandContract","[]"),
                Map.entry("stateContract","[\"READY\"]"),Map.entry("apiContract","[]"),
                Map.entry("dataContract","[]"),Map.entry("evidenceContract","[]"),
                Map.entry("responsiveContract","responsive"),
                Map.entry("accessibilityContract","accessible"),
                Map.entry("securityContract","secure"),Map.entry("permissionCodes","[]"),
                Map.entry("apiVerified",false),Map.entry("databaseVerified",false),
                Map.entry("authorityVerified",false),Map.entry("responsiveVerified",false),
                Map.entry("accessibilityVerified",false),
                Map.entry("exceptionStatesVerified",false),
                Map.entry("auditEvidenceRef",""),
                Map.entry("contractStatus","REVIEW_REQUIRED"))));
        doReturn(new java.util.LinkedHashMap<>(Map.ofEntries(
            Map.entry("jobCount",1),Map.entry("endpointExpected",1),
            Map.entry("sourceHash","a".repeat(64)),Map.entry("designHash","b".repeat(64)),
            Map.entry("generationQueued",true),Map.entry("status","QUEUED"))))
            .when(service).saveProfessionalScreenContract(anyMap(),
                eq("user:default/system-admin"));
        when(jdbc.queryForObject(argThat(sql->sql!=null
                &&sql.contains("insert into integrated_design_document")),
            eq(Long.class),any(Object[].class))).thenReturn(1L);
        String content="""
            {"schemaVersion":"carbonet.integrated-design-source/v1",
             "contractId":7,"apiContract":[{"method":"POST","path":"/api/items"}],
             "apiVerified":true}
            """;

        Map<String,Object> result=service.saveIntegratedDesignDocument(Map.ofEntries(
            Map.entry("processCode","PROCESS_A"),Map.entry("stepCode","STEP_A"),
            Map.entry("routePath","/screen-a"),Map.entry("documentType","API"),
            Map.entry("title","API source"),Map.entry("content",content),
            Map.entry("status","READY"),Map.entry("revision",0)),
            "user:default/system-admin");

        assertEquals("SOURCE_IMMEDIATE",result.get("mutationKind"));
        assertEquals(true,result.get("sourceCommitted"));
        assertEquals(1,result.get("jobCount"));
        assertEquals(1,result.get("endpointExpected"));
        assertEquals("a".repeat(64),result.get("sourceHash"));
        verify(service).saveProfessionalScreenContract(argThat(mutation->
                String.valueOf(mutation.get("apiContract")).contains("/api/items")
                    &&Boolean.TRUE.equals(mutation.get("apiVerified"))),
            eq("user:default/system-admin"));
        verify(jdbc).queryForObject(argThat(sql->sql!=null
                &&sql.contains("insert into integrated_design_document")),
            eq(Long.class),any(Object[].class));
    }

    @Test
    void integratedSourceAndArchetypeBindingUseOneCanonicalPublicationPath()
            throws Exception {
        String source=Files.readString(findRepositoryFile(
            "modules/resonance-common/carbonet-common-core/src/main/java/"+
            "egovframework/com/platform/governance/service/ActorProcessGovernanceService.java"));
        String integrated=source.substring(source.indexOf(
            "Map<String,Object> saveIntegratedDesignDocument("),source.indexOf(
            "Map<String,Object> saveProfessionalScreenContract("));
        String binding=source.substring(source.indexOf(
            "Map<String,Object> bindScreenProcessArchetype("),source.indexOf(
            "Map<String,Object> executableScreens("));

        for(String type:List.of("AUTHORITY","PROCESS","ACTIVE_UI","DESIGN_ASSET",
                "DATABASE","API"))assertTrue(source.contains("\""+type+"\""));
        assertTrue(integrated.contains("saveProfessionalScreenContract(mutation,actor)"));
        assertTrue(integrated.contains("jobCount!=1||endpointExpected<1"));
        assertTrue(integrated.contains("UNSUPPORTED_STRUCTURED_DESIGN_FIELDS"));
        assertTrue(integrated.contains("STALE_DESIGN_DOCUMENT_REVISION"));
        assertTrue(integrated.contains("\"NOTE_ONLY\""));
        assertTrue(binding.contains("'{processArchetype}'"));
        assertTrue(binding.contains("refreshAndQueueCanonicalProcess("));
        assertTrue(binding.contains("jobCount!=1||endpointExpected<1"));
        assertFalse(binding.contains("DESIGN_ASSET_PROMOTION"));
    }

    private static void stubSkippedRefresh(JdbcTemplate jdbc,int defined,int specs,int ready){
        when(jdbc.queryForObject(argThat(sql->sql!=null&&sql.contains(
                "framework_begin_process_design_revision(?,?)")),eq(String.class),
            any(Object[].class))).thenReturn("{\"exists\":false,\"revisionOpened\":false}");
        when(jdbc.queryForObject(argThat(sql->sql!=null&&sql.contains(
                "select definition_locked from framework_process_definition")),eq(Boolean.class),
            any(Object[].class))).thenReturn(false);
        when(jdbc.queryForMap(argThat(sql->sql!=null&&sql.contains("completeStepCount")
                &&sql.contains("definitionLocked")),any(Object[].class)))
            .thenReturn(Map.of("definitionLocked",false,"definedStepCount",defined,
                "specStepCount",specs,"completeStepCount",ready));
        when(jdbc.queryForObject(argThat(sql->sql!=null&&sql.contains(
                "framework_close_process_design_revision(?,?)")),eq(Boolean.class),
            any(Object[].class))).thenReturn(true);
        when(jdbc.queryForObject(argThat(sql->sql!=null&&sql.contains(
                "framework_refresh_process_execution_specs(?,?)")),eq(String.class),
            any(Object[].class))).thenReturn("{\"refreshedStepCount\":"+specs+"}");
        when(jdbc.queryForMap(argThat(sql->sql!=null&&sql.contains("definedStepCount")
                &&sql.contains("canonicalJobCount")),any(Object[].class)))
            .thenReturn(Map.of("definedStepCount",defined,"specStepCount",specs,
                "generationReadyStepCount",ready,"canonicalJobCount",0));
    }

    private static ActorProcessGovernanceService service(JdbcTemplate jdbc){
        return new ActorProcessGovernanceService(jdbc,mock(ScreenDevelopmentNoteService.class),
            mock(CodexProvisioningService.class),mock(ScreenContractRuntimeService.class));
    }

    private static Path findRepositoryFile(String relative){
        Path cursor=Path.of("").toAbsolutePath();
        for(int depth=0;cursor!=null&&depth<8;depth++,cursor=cursor.getParent()){
            Path candidate=cursor.resolve(relative);
            if(Files.isRegularFile(candidate))return candidate;
        }
        throw new IllegalStateException("repository file not found: "+relative);
    }
}
