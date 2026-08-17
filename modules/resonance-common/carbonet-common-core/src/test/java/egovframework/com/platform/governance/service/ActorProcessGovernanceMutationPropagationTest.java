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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
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
                Map.entry("sections",List.of(
                    Map.of("sectionId","SUMMARY","zone","summary-zone",
                        "displayOrder",10,"props",Map.of()),
                    Map.of("sectionId","FORM","zone","form-zone",
                        "displayOrder",20,"props",Map.of()))),
                Map.entry("components",List.of(Map.of(
                    "componentId","JSON_FORM","sectionId","FORM",
                    "instanceKey","json-form","displayOrder",10,
                    "props",Map.of(),"condition","always"))),
                Map.entry("dependencies",List.of()))));

        assertEquals("91d88a9e7f2ba5e48bf8bcac96ed63f7df7beb480f60d935aa74b73cb17f1480",
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
        when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains(
                "employee_account as materialized")),
            any(Object[].class))).thenReturn(List.of(Map.of(
                "esntl_id","ADMIN_ESSENTIAL","account_type","EMPLOYEE",
                "account_status","P")));
        when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains(
                "from comtnemplyrscrtyestbs")&&sql.contains("for update")),
            any(Object[].class))).thenReturn(List.of(Map.of(
                "scrty_dtrmn_trget_id","ADMIN_ESSENTIAL",
                "author_code","ROLE_SYSTEM_MASTER")));
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
        verify(jdbc,never()).update(any(String.class),any(Object[].class));
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
    void integratedDraftSaveIsPendingAndDoesNotTouchCanonicalSource(){
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
            Map.entry("routePath","/screen-a"),Map.entry("audience","USER"),
            Map.entry("documentType","REQUIREMENT"),
            Map.entry("title","Requirement note"),Map.entry("content","review note"),
            Map.entry("status","DRAFT"),Map.entry("revision",0)),
            "user:default/system-admin");

        assertEquals("COMPOSITE_PENDING",result.get("mutationKind"));
        assertEquals(false,result.get("sourceCommitted"));
        assertEquals(0,result.get("jobCount"));
        assertEquals(0,result.get("endpointExpected"));
        assertFalse(mockingDetails(jdbc).getInvocations().stream().anyMatch(call->
            String.valueOf(call.getArguments()[0]).contains(
                "for update of contract,blueprint")));
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
                Map.entry("routePath","/screen-a"),Map.entry("audience","USER"),
                Map.entry("documentType","API"),
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
    void singleStrictReadyAxisStaysPendingUntilAllEighteenAreReady(){
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        ActorProcessGovernanceService service=service(jdbc);
        when(jdbc.queryForList(argThat(sql->sql!=null
                &&sql.contains("from integrated_design_document")
                &&sql.contains("for update")),any(Object[].class))).thenReturn(List.of());
        when(jdbc.queryForObject(argThat(sql->sql!=null
                &&sql.contains("insert into integrated_design_document")),
            eq(Long.class),any(Object[].class))).thenReturn(1L);
        String content="""
            {"schemaVersion":"carbonet.integrated-design-axis/v1","documentType":"API",
             "axisVersion":"1.0.0","identity":{"contractId":7,"processCode":"PROCESS_A",
             "stepCode":"STEP_A","routePath":"/screen-a","audience":"USER",
             "selectedBlueprintId":9,"ownershipStrategy":"EXACT_SINGLE",
             "ownershipJustification":"one exact generated blueprint"},
             "payload":{"operations":[{"method":"POST","path":"/api/items",
             "commandCode":"SAVE","requestFields":["name"],"responseFields":["id"],
             "permissionCodes":["PERM_SAVE"]}],"verified":true}}
            """;

        Map<String,Object> result=service.saveIntegratedDesignDocument(Map.ofEntries(
            Map.entry("processCode","PROCESS_A"),Map.entry("stepCode","STEP_A"),
            Map.entry("routePath","/screen-a"),Map.entry("audience","USER"),
            Map.entry("documentType","API"),Map.entry("title","API source"),
            Map.entry("content",content),Map.entry("status","READY"),Map.entry("revision",0)),
            "user:default/system-admin");

        assertEquals("COMPOSITE_PENDING",result.get("mutationKind"));
        assertEquals(false,result.get("sourceCommitted"));
        assertEquals(0,result.get("jobCount"));
        assertFalse(mockingDetails(jdbc).getInvocations().stream().anyMatch(call->
            String.valueOf(call.getArguments()[0]).contains(
                "update framework_professional_screen_contract")));
    }

    @Test
    void integratedSourceAndArchetypeBindingUseOneCanonicalPublicationPath()
            throws Exception {
        String source=Files.readString(findRepositoryFile(
            "modules/resonance-common/carbonet-common-core/src/main/java/"+
            "egovframework/com/platform/governance/service/ActorProcessGovernanceService.java"));
        String compiler=Files.readString(findRepositoryFile(
            "modules/resonance-common/carbonet-common-core/src/main/java/"+
            "egovframework/com/platform/governance/service/CompositeExecutableDesignAuthorityCompiler.java"));
        String application=Files.readString(findRepositoryFile(
            "modules/resonance-common/carbonet-common-core/src/main/java/"+
            "egovframework/com/platform/governance/service/CompositeExecutableDesignApplicationService.java"));
        String store=Files.readString(findRepositoryFile(
            "modules/resonance-common/carbonet-common-core/src/main/java/"+
            "egovframework/com/platform/governance/service/CompositeExecutableDesignAuthorityStore.java"));
        String integrated=application+"\n"+store;
        String binding=source.substring(source.indexOf(
            "Map<String,Object> bindScreenProcessArchetype("),source.indexOf(
            "Map<String,Object> executableScreens("));

        for(String type:List.of("AUTHORITY","PROCESS","ACTIVE_UI","DESIGN_ASSET",
                "DATABASE","API"))assertTrue(compiler.contains("\""+type+"\""));
        assertFalse(integrated.contains("compilation.selectedAdopt(),false"));
        assertTrue(integrated.contains("compilation.selectedAdopt(),true"));
        assertTrue(source.contains("preserveBlueprint")&&source.contains("PRESERVE_ADOPT"));
        assertTrue(integrated.contains("COMPOSITE_BATCH_FINAL_PUBLICATION_NOT_GENERATABLE"));
        assertTrue(integrated.contains("CompositeExecutableDesignAuthorityCompiler.compile"));
        assertTrue(integrated.contains("compileIntegratedDesignProcess(compileRequest,actor)")
            &&integrated.contains("selectedCompositeBatchReceipt"));
        assertTrue(integrated.contains("STALE_DESIGN_DOCUMENT_REVISION"));
        assertTrue(integrated.contains("\"COMPOSITE_PENDING\""));
        assertTrue(binding.contains("'{processArchetype}'"));
        assertTrue(binding.contains("refreshAndQueueCanonicalProcess("));
        assertTrue(binding.contains("jobCount!=1||endpointExpected<1"));
        assertFalse(binding.contains("DESIGN_ASSET_PROMOTION"));
    }

    @Test
    void compositeBatchUsesOneFinalRefreshAndRfpBindsProjectProvenance() throws Exception {
        String source=Files.readString(findRepositoryFile(
            "modules/resonance-common/carbonet-common-core/src/main/java/"+
            "egovframework/com/platform/governance/service/ActorProcessGovernanceService.java"));
        String application=Files.readString(findRepositoryFile(
            "modules/resonance-common/carbonet-common-core/src/main/java/"+
            "egovframework/com/platform/governance/service/CompositeExecutableDesignApplicationService.java"));
        String store=Files.readString(findRepositoryFile(
            "modules/resonance-common/carbonet-common-core/src/main/java/"+
            "egovframework/com/platform/governance/service/CompositeExecutableDesignAuthorityStore.java"));
        String bridge=Files.readString(findRepositoryFile(
            "modules/resonance-common/carbonet-common-core/src/main/java/"+
            "egovframework/com/platform/governance/web/ActorProcessControlPlaneBridgeController.java"));
        String worker=Files.readString(findRepositoryFile(
            "modules/resonance-common/carbonet-common-core/src/main/java/"+
            "egovframework/com/platform/governance/service/CompositeDesignOperationalWorker.java"));
        String migration=Files.readString(findRepositoryFile(
            "apps/carbonet-api/src/main/resources/db/migration/postgresql/"+
            "V20260816154000__compile_composite_executable_design_authority.sql"));
        String batch=application.substring(application.indexOf(
            "Map<String,Object> compileIntegratedDesignProcess("),application.indexOf(
            "private Map<String,Object> compositeBatchReceipt("));
        assertEquals(1,countOccurrences(batch,"refreshAndQueueCanonicalProcess("));
        assertEquals(1,countOccurrences(batch,"refresh_integrated_design_axis_documents"));
        assertTrue(batch.contains("stageCompositeSource")
            &&batch.contains("finalHeadMismatchCount")
            &&batch.contains("reboundAuthorityCount"));
        String singleSave=application.substring(application.indexOf(
            "Map<String,Object> saveIntegratedDesignDocument("),application.indexOf(
            "/** Atomically previews or compiles every screen identity"));
        assertTrue(singleSave.indexOf("lockCompositeProcessAuthority(process,request.requestedActors())")
            <singleSave.indexOf("COMPOSITE_EXECUTABLE_DESIGN_AUTHORITY_V1:"));
        assertTrue(singleSave.indexOf("COMPOSITE_EXECUTABLE_DESIGN_AUTHORITY_V1:")
            <singleSave.indexOf("INTEGRATED_DESIGN_DOCUMENT_V1:"));
        String compositeLock=source.substring(source.indexOf(
            "void lockCompositeProcessAuthority("),source.indexOf(
            "SortedSet<String> compositeProcessActorSet("));
        assertTrue(compositeLock.indexOf("lockActorDefinitions(before)")
            <compositeLock.indexOf("lockCanonicalProcessPublication(process)"));
        assertTrue(compositeLock.contains("COMPOSITE_PROCESS_ACTOR_SET_CHANGED_RETRY"));
        String completion=worker.substring(worker.indexOf("private void complete("),
            worker.indexOf("Map<String,Object> scopeForProcess("));
        int workerCanonical=completion.indexOf("governance.lockCompositeProcessAuthority(process)");
        int executionBinding=completion.indexOf("readiness.assertActiveExecutionBinding(");
        int sourceSlot=completion.indexOf("readiness.acquireSourceExecutionSlot(");
        int sourceRegistry=completion.indexOf("readiness.lockCompilerSourceRegistries()");
        int compiler=completion.indexOf("governance.compileIntegratedDesignProcess(");
        assertTrue(workerCanonical>=0&&executionBinding>=0&&sourceSlot>=0
            &&sourceRegistry>=0&&compiler>=0&&workerCanonical<executionBinding
            &&executionBinding<sourceSlot
            &&sourceSlot<sourceRegistry&&sourceRegistry<compiler);
        assertEquals(1,countOccurrences(completion,
            "governance.lockCompositeProcessAuthority(process)"));
        assertTrue(store.contains("for share of assignment,account,security")
            &&store.contains("for share of assignment,project_assignment")
            &&store.contains("account.emplyr_sttus_code in('P','A')")
            &&store.contains("account.entrprs_mber_sttus in('P','A')")
            &&store.contains("comtnemplyrscrtyestbs")
            &&store.contains("framework_project_actor_assignment"));
        assertTrue(store.contains("integrated_design_scope_binding")
            &&store.contains("PROJECT_COMPOSITE_PROCESS_SHARED")
            &&store.contains("authorityRevision"));
        assertTrue(bridge.contains("\"scopeType\",\"PROJECT\"")
            &&bridge.contains("releaseContractSha256")
            &&bridge.contains("\"SOURCE_APPLIED_PHYSICAL_QUEUED\",\"PHYSICAL_GENERATED_VERIFIED\""));
        assertTrue(migration.contains("integrated_design_scope_binding")
            &&migration.contains("authority_revision bigint NOT NULL")
            &&migration.contains("contract_sha256"));
    }

    @Test
    void serializationRetryKeepsExactClaimContextCapacityAndShutdownSafety() throws Exception {
        String worker=Files.readString(findRepositoryFile(
            "modules/resonance-common/carbonet-common-core/src/main/java/"+
            "egovframework/com/platform/governance/service/CompositeDesignOperationalWorker.java"));
        String readiness=Files.readString(findRepositoryFile(
            "modules/resonance-common/carbonet-common-core/src/main/java/"+
            "egovframework/com/platform/governance/service/CompositeAutocompletionReadinessService.java"));
        String retryStore=Files.readString(findRepositoryFile(
            "modules/resonance-common/carbonet-common-core/src/main/java/"+
            "egovframework/com/platform/governance/service/CompositeSerializationRetryStore.java"));

        String ordinaryClaim=readiness.substring(readiness.indexOf(
            "List<Map<String,Object>> claimOne("),readiness.indexOf(
            "List<Map<String,Object>> claimSerializationRetry("));
        assertTrue(ordinaryClaim.contains("blocker_code is distinct from 'RETRY_WAIT'")
            &&ordinaryClaim.contains(
                "not jsonb_exists(receipt.receipt_json,'serializationRetryContext')"));

        String retryClaim=readiness.substring(readiness.indexOf(
            "List<Map<String,Object>> claimSerializationRetry("),readiness.indexOf(
            "int clearSupersededSerializationRetries("));
        assertTrue(retryClaim.contains("completion_status='PENDING'")
            &&retryClaim.contains("blocker_code='RETRY_WAIT'")
            &&retryClaim.contains("serializationRetryContext'=?::jsonb")
            &&retryClaim.contains("retryNotBeforeEpochMs")
            &&retryClaim.contains("framework_composite_dependency_fingerprint"));

        String reclaim=worker.substring(worker.indexOf(
            "private boolean reclaimSerializationRetry("),worker.indexOf(
            "private Map<String,Object> serializationRetryContext("));
        int globalLock=reclaim.indexOf("acquireGlobalDispatchLock(");
        int globalCap=reclaim.indexOf("globallyRunning()>=parallelism");
        int exactClaim=reclaim.indexOf("readiness.claimSerializationRetry(");
        assertTrue(globalLock>=0&&globalLock<globalCap&&globalCap<exactClaim);
        assertFalse(reclaim.contains("claimOne("));

        String scheduled=worker.substring(worker.indexOf(
            "public void runScheduledBatch("),worker.indexOf(
            "public Map<String,Object> inspect("));
        assertTrue(scheduled.indexOf("resumeDueSerializationRetries()")
            <scheduled.indexOf("if(capabilityEnabled)"));
        assertTrue(worker.contains("SERIALIZATION_RECLAIM_SCHEDULE_LIMIT=3")
            &&worker.contains("durable RETRY_WAIT and a healthy replica/scheduled sweep"));

        String submit=worker.substring(worker.indexOf(
            "private void submitClaim("),worker.indexOf(
            "private Map<String,Object> dispatchReceipt("));
        assertTrue(submit.contains("catch(RejectedExecutionException rejected)")
            &&submit.contains("HEARTBEAT_EXECUTOR_REJECTED")
            &&submit.contains("WORKER_EXECUTOR_REJECTED")
            &&submit.contains("requeueExecutorRejection(")
            &&submit.contains("running.decrementAndGet()"));
        assertTrue(worker.contains("List<Runnable> abandoned=workers.shutdownNow()")
            &&worker.contains("task instanceof ClaimExecution execution")
            &&worker.contains("WORKER_SHUTDOWN_BEFORE_START")
            &&worker.contains("execution.releaseBeforeStart("));

        String completion=worker.substring(worker.indexOf("private void complete("),
            worker.indexOf("private RetryOutcome requeueExecutorRejection("));
        assertTrue(completion.contains("isSqlState(error,\"40001\")")
            &&completion.contains("requeueSerializationFailure(")
            &&completion.contains("-'serializationRetryContext'"));
        assertTrue(worker.contains("serializationRetries.requeueExecutorRejection(")
            &&worker.contains("serializationRetries.requeueSerializationFailure(")
            &&worker.contains("serializationRetries.resumeDue(available)"));
        assertTrue(retryStore.contains("SERIALIZATION_RETRY_EXHAUSTED")
            &&retryStore.contains("jsonb_exists(receipt.receipt_json,"+
                "'serializationRetryContext')")
            &&retryStore.contains("RETRY_LIMIT,process,token,RETRY_LIMIT,RETRY_LIMIT")
            &&retryStore.contains("FIRST_RETRY_DELAY_MS,SECOND_RETRY_DELAY_MS"));
        String retryPersistence=worker.substring(worker.indexOf(
            "private RetryOutcome requeueExecutorRejection("),worker.indexOf(
            "private void scheduleSerializationRetry("));
        String retrySchedule=worker.substring(worker.indexOf(
            "private void scheduleSerializationRetry("),worker.indexOf(
            "private void resumeDueSerializationRetries("));
        String retryResume=worker.substring(worker.indexOf(
            "private void resumeDueSerializationRetries("),worker.indexOf(
            "private boolean reclaimSerializationRetry("));
        String retryReclaim=worker.substring(worker.indexOf(
            "private boolean reclaimSerializationRetry("),worker.indexOf(
            "private Map<String,Object> serializationRetryContext("));
        for(String method:List.of(retryPersistence,retrySchedule,retryResume,retryReclaim))
            assertTrue(method.split("\\R").length<120);
        assertTrue(worker.contains("clearSupersededSerializationRetries(\"AUTOMATIC\"")
            &&worker.contains("clearSupersededSerializationRetries(\"CANARY\""));
        assertTrue(readiness.contains("receipt_json#>>'{canary,status}' in('ACTIVE','RETRY_WAIT')"));
    }

    @Test
    void projectRuntimePurgeUsesFailFastWriterKeysAfterCompleteInventoryLock() throws Exception {
        String migration=Files.readString(findRepositoryFile(
            "apps/carbonet-api/src/main/resources/db/migration/postgresql/"+
            "V20260816134500__install_project_runtime_purge_restore_contract.sql"));
        String coordination=migration.substring(migration.indexOf(
            "CREATE OR REPLACE FUNCTION framework_project_runtime_purge_lock_coordination("),
            migration.indexOf(
            "CREATE OR REPLACE FUNCTION framework_project_runtime_purge_try_writer_keys("));
        assertTrue(coordination.contains("PROJECT_RUNTIME_PURGE_COORDINATION_V2:"));
        assertFalse(coordination.contains("BACKSTAGE_DESIGN_RELEASE_V1:")
            ||coordination.contains("CANONICAL_PROCESS_PUBLICATION_V1:"));

        String writerKeys=migration.substring(migration.indexOf(
            "CREATE OR REPLACE FUNCTION framework_project_runtime_purge_try_writer_keys("),
            migration.indexOf(
            "CREATE OR REPLACE FUNCTION framework_project_runtime_purge_snapshot_insert("));
        assertTrue(writerKeys.contains("BACKSTAGE_DESIGN_RELEASE_V1:")
            &&writerKeys.contains("CANONICAL_PROCESS_PUBLICATION_V1:")
            &&writerKeys.contains("PROJECT_RUNTIME_PURGE_V1:")
            &&writerKeys.contains("ORDER BY key_value COLLATE \"C\"")
            &&writerKeys.contains("pg_try_advisory_xact_lock")
            &&writerKeys.contains("ERRCODE='40001'"));

        String inventory=migration.substring(migration.indexOf(
            "CREATE OR REPLACE FUNCTION framework_project_runtime_purge_lock_inventory_tables("),
            migration.indexOf(
            "CREATE OR REPLACE FUNCTION framework_project_runtime_purge_set_user_triggers("));
        assertTrue(inventory.contains("framework_project_runtime_purge_snapshot_row")
            &&inventory.contains("trg_project_runtime_write_fence")
            &&inventory.contains("JOIN pg_constraint foreign_key")
            &&inventory.contains("child_namespace.nspname!~'^pg_'")
            &&inventory.contains("child_namespace.nspname<>'information_schema'")
            &&inventory.contains("access exclusive mode nowait")
            &&inventory.contains("ERRCODE='40001'"));

        String closure=migration.substring(migration.indexOf(
            "CREATE OR REPLACE FUNCTION framework_project_runtime_purge_assert_fk_closure("),
            migration.indexOf(
            "CREATE OR REPLACE FUNCTION framework_project_runtime_purge_external_fk_descendant_rows("));
        assertTrue(closure.contains("child_namespace.nspname!~'^pg_'")
            &&closure.contains("child_namespace.nspname<>'information_schema'")
            &&closure.contains("captured.row_payload=to_jsonb(row_value)")
            &&closure.contains("ERRCODE='40001'"));

        String external=migration.substring(migration.indexOf(
            "CREATE OR REPLACE FUNCTION framework_project_runtime_purge_external_fk_descendant_rows("),
            migration.indexOf(
            "CREATE OR REPLACE FUNCTION framework_project_runtime_purge_build_snapshot("));
        assertTrue(external.contains("child_namespace.nspname!~'^pg_'")
            &&external.contains("child_namespace.nspname<>'information_schema'")
            &&external.contains("child.relname LIKE 'framework\\_%' ESCAPE '\\'")
            &&external.contains("child.relname LIKE 'integrated_design\\_%' ESCAPE '\\'"));

        String apply=migration.substring(migration.indexOf(
            "CREATE OR REPLACE FUNCTION framework_apply_project_runtime_purge("),
            migration.indexOf(
            "CREATE OR REPLACE FUNCTION framework_restore_project_runtime_purge("));
        int applyNonIdempotent=apply.indexOf("receipt.receipt_status NOT IN");
        int applyInventory=apply.indexOf("lock_inventory_tables(",applyNonIdempotent);
        int applyTry=apply.indexOf("try_writer_keys(",applyInventory);
        int applyScope=apply.indexOf("pre_scope_counts:=",applyTry);
        int applyClosure=apply.indexOf("assert_fk_closure(",applyScope);
        int applyExact=apply.indexOf("-- Lock and verify every exact preimage",applyClosure);
        int applyTriggers=apply.indexOf("set_user_triggers(",applyExact);
        int applyMutation=apply.indexOf("receipt_status='PURGING'",applyTriggers);
        assertTrue(applyNonIdempotent>=0&&applyNonIdempotent<applyInventory
            &&applyInventory<applyTry&&applyTry<applyScope&&applyScope<applyClosure
            &&applyClosure<applyExact&&applyExact<applyTriggers
            &&applyTriggers<applyMutation);

        String restore=migration.substring(migration.indexOf(
            "CREATE OR REPLACE FUNCTION framework_restore_project_runtime_purge("),
            migration.indexOf("-- Install fences for every table"));
        int restoreNonIdempotent=restore.indexOf("receipt.receipt_status<>'PURGED'");
        int restoreInventory=restore.indexOf("lock_inventory_tables(",restoreNonIdempotent);
        int restoreTry=restore.indexOf("try_writer_keys(",restoreInventory);
        int restoreScope=restore.indexOf("framework_project_runtime_purge_scope_counts(",restoreTry);
        int restoreClosure=restore.indexOf("assert_fk_closure(",restoreScope);
        int restoreExact=restore.indexOf("project runtime restore found snapshot residual",restoreClosure);
        int restoreTriggers=restore.indexOf("set_user_triggers(",restoreExact);
        int restoreMutation=restore.indexOf("receipt_status='RESTORING'",restoreTriggers);
        assertTrue(restoreNonIdempotent>=0&&restoreNonIdempotent<restoreInventory
            &&restoreInventory<restoreTry&&restoreTry<restoreScope
            &&restoreScope<restoreClosure&&restoreClosure<restoreExact
            &&restoreExact<restoreTriggers&&restoreTriggers<restoreMutation);

        int restored=restore.indexOf("receipt.receipt_status='RESTORED'");
        int restoredEnd=restore.indexOf("receipt.receipt_status<>'PURGED'",restored);
        String restoredReplay=restore.substring(restored,restoredEnd);
        int restoredInventory=restoredReplay.indexOf("lock_inventory_tables(");
        int restoredTry=restoredReplay.indexOf("try_writer_keys(");
        int restoredClosure=restoredReplay.indexOf("assert_fk_closure(");
        int restoredScope=restoredReplay.indexOf("scope_counts(");
        int restoredRows=restoredReplay.indexOf("FOR snapshot_row IN");
        assertTrue(restoredInventory>=0&&restoredInventory<restoredTry
            &&restoredTry<restoredClosure&&restoredClosure<restoredScope
            &&restoredScope<restoredRows);

        String guard=migration.substring(migration.indexOf(
            "CREATE OR REPLACE FUNCTION framework_guard_project_runtime_write_fence("),
            migration.indexOf(
            "CREATE OR REPLACE FUNCTION framework_install_project_runtime_write_fences("));
        assertTrue(guard.contains("pg_try_advisory_xact_lock")
            &&guard.contains("ERRCODE='40001'"));
        assertFalse(guard.contains("PERFORM pg_advisory_xact_lock(hashtextextended(lock_key"));
        assertTrue(migration.contains(
            "framework_project_runtime_purge_lock_coordination(text,text)")
            &&migration.contains(
            "framework_project_runtime_purge_try_writer_keys(text,text)")
            &&migration.contains(
                "framework_project_runtime_purge_lock_inventory_tables(uuid)")
            &&migration.contains(
                "framework_project_runtime_purge_assert_fk_closure(uuid)")
            &&migration.contains(
                "framework_project_runtime_purge_external_fk_descendant_rows(uuid)")
            &&migration.contains("'externalFkDescendantRowCount',external_fk_descendant_count"));
    }

    private static int countOccurrences(String value,String needle){
        int count=0,offset=0;
        while((offset=value.indexOf(needle,offset))>=0){count++;offset+=needle.length();}
        return count;
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
