package egovframework.com.platform.governance.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ActorProcessControlPlaneBridgeAuthorizationTest {
    private final JdbcTemplate jdbc=mock(JdbcTemplate.class);
    private final ObjectMapper mapper=new ObjectMapper();
    private final ActorProcessGovernanceService governance=mock(ActorProcessGovernanceService.class);
    private final ActorProcessControlPlaneBridgeController controller=
        new ActorProcessControlPlaneBridgeController(jdbc,mapper,governance,"secret-token");
    private final Map<String,Object> command=Map.of(
        "command","screen.design.generate","routePath","/design/route");

    @BeforeEach void releaseInsertSucceedsByDefault(){
        when(jdbc.update(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
            &&sql.contains("insert into framework_actor_process_design_release")),
            any(Object[].class))).thenReturn(1);
    }

    @AfterEach void close(){
        if(TransactionSynchronizationManager.isSynchronizationActive())
            TransactionSynchronizationManager.clearSynchronization();
        controller.shutdownGenerationExecutor();
    }

    @Test
    void invalidBridgeTokenReturns401WithoutMutation(){
        var response=controller.executeGovernanceCommand("wrong-token","BACKSTAGE","system-admin",command);

        assertEquals(401,response.getStatusCode().value());
        verify(governance,never()).saveDesignAndGenerate(any(),anyString());
    }

    @Test
    void authenticatedNonAdministratorReturns403WithoutMutation(){
        when(governance.isControlPlaneAdministrator("designer")).thenReturn(false);

        var response=controller.executeGovernanceCommand("secret-token","BACKSTAGE","designer",command);

        assertEquals(403,response.getStatusCode().value());
        verify(governance,never()).saveDesignAndGenerate(any(),anyString());
    }

    @Test
    void authenticatedAdministratorCanRunExactDesignMutation(){
        when(governance.isControlPlaneAdministrator("system-admin")).thenReturn(true);
        when(governance.saveDesignAndGenerate(any(),eq("system-admin")))
            .thenReturn(Map.of("success",true,"buildRequired",false));

        var response=controller.executeGovernanceCommand(
            "secret-token","BACKSTAGE","system-admin",command);

        assertEquals(200,response.getStatusCode().value());
        verify(governance).saveDesignAndGenerate(
            org.mockito.ArgumentMatchers.argThat(body->
                "screen.design.generate".equals(body.get("command"))
                    &&"system-admin".equals(body.get("requestingAccount"))),
            eq("system-admin"));
        @SuppressWarnings("unchecked")
        Map<String,Object> payload=(Map<String,Object>)response.getBody();
        assertEquals("NOTE_ONLY",payload.get("mutationKind"));
        assertEquals(false,payload.get("structuredChanged"));
    }

    @Test
    void structuredDesignGenerateDelegatesToCanonicalProfessionalSave(){
        when(governance.isControlPlaneAdministrator("system-admin")).thenReturn(true);
        Map<String,Object> structured=new LinkedHashMap<>();
        structured.put("command","screen.design.generate");
        structured.put("contractId",31);
        structured.put("businessPurpose","Persist an exact structured screen contract.");
        structured.put("entryCondition","Assigned actor may enter the screen.");
        structured.put("exitCondition","Validated command persists and rereads its output.");
        structured.put("sectionContract","[{\"sectionCode\":\"SUMMARY\"}]");
        structured.put("fieldContract","[{\"fieldCode\":\"amount\"}]");
        structured.put("commandContract","[{\"commandCode\":\"SAVE\"}]");
        structured.put("stateContract","[{\"stateCode\":\"READY\"}]");
        structured.put("apiContract","[{\"method\":\"POST\",\"path\":\"/api/save\"}]");
        structured.put("dataContract","[{\"entity\":\"ITEM\"}]");
        structured.put("permissionCodes","[\"ITEM_WRITE\"]");
        structured.put("layout","RESPONSIVE_WORKSPACE");
        structured.put("theme","KRDS_GOV_DEFAULT");
        when(governance.saveProfessionalScreenContract(any(),eq("system-admin")))
            .thenReturn(Map.of("success",true,"generationQueued",true,
                "sourceHash","a".repeat(64),"endpointExpected",1));

        var response=controller.executeGovernanceCommand(
            "secret-token","BACKSTAGE","system-admin",structured);

        assertEquals(200,response.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String,Object> payload=(Map<String,Object>)response.getBody();
        assertEquals(true,payload.get("generationQueued"));
        assertEquals("a".repeat(64),payload.get("sourceHash"));
        assertEquals(1,payload.get("endpointExpected"));
        verify(governance).saveProfessionalScreenContract(
            org.mockito.ArgumentMatchers.argThat(body->
                "[\"ITEM_WRITE\"]".equals(body.get("permissionCodes"))
                    &&"RESPONSIVE_WORKSPACE".equals(body.get("layout"))
                    &&"KRDS_GOV_DEFAULT".equals(body.get("theme"))),
            eq("system-admin"));
        verify(governance,never()).saveDesignAndGenerate(any(),anyString());
    }

    @Test
    void forgedContractChecksumIsRejectedBeforeAnyImportOrReleaseWrite(){
        Map<String,Object> contract=Map.of("source",Map.of("type","DESIGN_DOCUMENT"),
            "process",Map.of("processCode","PROCESS_A"));

        var response=controller.applyDesignRelease("secret-token",Map.of(
            "projectId","PROJECT_A","designVersion",1,
            "contractSha256","a".repeat(64),"contract",contract));

        assertEquals(422,response.getStatusCode().value());
        verifyNoInteractions(jdbc,governance);
    }

    @Test
    void forgedInnerRequirementContentHashIsRejectedBeforeMutation() throws Exception {
        Map<String,Object> step=Map.ofEntries(
            Map.entry("stepCode","STEP_ONE"),Map.entry("actorCode","WORKER_ACTOR"),
            Map.entry("routePath","/work/one"),Map.entry("screenName","Step one"),
            Map.entry("description","Complete step one"),
            Map.entry("endpoint",Map.of("method","POST","path","/api/work/one")),
            Map.entry("fields",List.of(Map.of("fieldCode","name"))));
        Map<String,Object> contract=requirementContract("PROCESS_A",1,step);
        contract.put("contentSha256","f".repeat(64));

        var response=controller.applyDesignRelease("secret-token",Map.of(
            "projectId","PROJECT_A","designVersion",1,
            "contractSha256",canonicalChecksum(contract),"contract",contract));

        assertEquals(400,response.getStatusCode().value());
        verifyNoInteractions(jdbc,governance);
    }

    @Test
    void requirementReleaseRequiresPositiveInt32DesignVersion(){
        for(Object invalidVersion:List.of(0,2147483648L,1.5d,"1")){
            var response=controller.applyDesignRelease("secret-token",Map.of(
                "projectId","PROJECT_A","designVersion",invalidVersion,
                "contractSha256","a".repeat(64),"contract",Map.of()));
            assertEquals(422,response.getStatusCode().value(),String.valueOf(invalidVersion));
        }
        verifyNoInteractions(jdbc,governance);
    }

    @Test
    void exactRequirementSchemaRejectsMissingDuplicateUnknownTrimmedAndOversizedValues()
            throws Exception {
        List<java.util.function.Consumer<Map<String,Object>>> mutations=List.of(
            contract->requirementSteps(contract).get(0).remove("title"),
            contract->requirementSteps(contract).get(1).put("requirementId",
                requirementSteps(contract).get(0).get("requirementId")),
            contract->requirementSteps(contract).get(0).put("unknownField",true),
            contract->requirementSteps(contract).get(0).put("title"," Trimmed title"),
            contract->requirementSteps(contract).get(0).put("requirementId","R".repeat(121)),
            contract->requirementSteps(contract).get(0).put("title","T".repeat(241)),
            contract->requiredTestObject(contract,"identity").put("stableKey","slot:other"),
            contract->requiredTestObject(contract,"generation").put("strategy","MANUAL"),
            contract->requiredTestObject(contract,"generation").put("maxScreens",999),
            contract->((List<?>)requiredTestObject(contract,"generation")
                .get("genericEndpoints")).remove(0),
            contract->requirementSteps(contract).get(0).put("screenName","S".repeat(161)),
            contract->requirementActors(contract).get(0).put("actorName","A".repeat(121)),
            contract->requirementSteps(contract).get(0).put("routePath","/"+"r".repeat(300)),
            contract->{
                Map<String,Object> step=requirementSteps(contract).get(0);
                String path="/"+"e".repeat(270);
                requiredTestObject(step,"endpoint").put("path",path);
                requiredTestObject(step,"apiContract").put("path",path);
            },
            contract->{
                Map<String,Object> step=requirementSteps(contract).get(0);
                requiredTestObject(step,"endpoint").put("method","post");
                requiredTestObject(step,"apiContract").put("method","post");
            },
            contract->java.util.Collections.swap(requirementWorkspaces(contract),0,1),
            contract->requirementWorkspaces(contract).get(0).put("unknownField",true),
            contract->requiredTestTabs(requirementWorkspaces(contract).get(0)).get(0)
                .put("order",20)
        );

        int mutationIndex=0;
        for(java.util.function.Consumer<Map<String,Object>> mutation:mutations){
            Map<String,Object> contract=goldenRequirementContract();
            mutation.accept(contract);
            rehashRequirementContract(contract);
            var response=controller.applyDesignRelease("secret-token",Map.of(
                "projectId","PROJECT_A","designVersion",contract.get("designVersion"),
                "contractSha256",canonicalChecksum(contract),"contract",contract));
            assertEquals(400,response.getStatusCode().value(),"mutation "+mutationIndex);
            mutationIndex++;
        }
        verifyNoInteractions(jdbc,governance);
    }

    @Test
    void exactReleaseHeadReplayIsIdempotentWithoutImportOrWrite() throws Exception {
        Map<String,Object> contract=requirementContract("PROCESS_A",4,Map.ofEntries(
            Map.entry("stepCode","STEP_ONE"),Map.entry("actorCode","WORKER_ACTOR"),
            Map.entry("routePath","/work/one"),Map.entry("screenName","Step one"),
            Map.entry("description","Complete step one"),
            Map.entry("endpoint",Map.of("method","POST","path","/api/work/one"))));
        String checksum=canonicalChecksum(contract);
        when(jdbc.queryForObject(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
            &&sql.contains("'designVersion',design_version")),eq(String.class),
            any(Object[].class))).thenReturn(mapper.writeValueAsString(Map.of(
                "designVersion",4,"contractSha256",checksum,
                "releaseStatus","QUEUED","generationResult",Map.of("status","PENDING"))));

        var response=controller.applyDesignRelease("secret-token",Map.of(
            "projectId","PROJECT_A","designVersion",4,
            "contractSha256",checksum,"contract",contract));

        assertEquals(200,response.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String,Object> payload=(Map<String,Object>)response.getBody();
        assertEquals(true,payload.get("idempotent"));
        verifyNoInteractions(governance);
        verify(jdbc,never()).update(anyString(),any(Object[].class));
    }

    @Test
    void exactFailedReleaseReplayReopensTheSameReceiptOnceWithoutReimport()
            throws Exception {
        Map<String,Object> contract=requirementContract("PROCESS_A",4,Map.ofEntries(
            Map.entry("stepCode","STEP_ONE"),Map.entry("actorCode","WORKER_ACTOR"),
            Map.entry("routePath","/work/one"),Map.entry("screenName","Step one"),
            Map.entry("description","Complete step one"),
            Map.entry("endpoint",Map.of("method","POST","path","/api/work/one"))));
        String checksum=canonicalChecksum(contract);
        when(jdbc.queryForObject(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
            &&sql.contains("'designVersion',design_version")),eq(String.class),
            any(Object[].class))).thenReturn(mapper.writeValueAsString(Map.of(
                "designVersion",4,"contractSha256",checksum,
                "releaseStatus","FAILED","generationResult",Map.of(
                    "status","FAILED","retryAttempt",0,
                    "expectedProcessReceipts",Map.of("PROCESS_A",Map.of(
                        "processInputHash","a".repeat(64),"jobId",7))))));
        when(jdbc.update(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
            &&sql.contains("release_status='QUEUED'")
            &&sql.contains("retryAttempt")),any(Object[].class))).thenReturn(1);
        TransactionSynchronizationManager.initSynchronization();

        var response=controller.applyDesignRelease("secret-token",Map.of(
            "projectId","PROJECT_A","designVersion",4,
            "contractSha256",checksum,"contract",contract));

        assertEquals(200,response.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String,Object> payload=(Map<String,Object>)response.getBody();
        assertEquals("QUEUED",payload.get("releaseStatus"));
        assertEquals(true,payload.get("publicationRetried"));
        @SuppressWarnings("unchecked")
        Map<String,Object> generation=(Map<String,Object>)payload.get("generation");
        assertEquals(1,generation.get("retryAttempt"));
        assertEquals(1,TransactionSynchronizationManager.getSynchronizations().size());
        verifyNoInteractions(governance);
    }

    @Test
    void exhaustedFailedReplayStaysTerminalAndAppliedReplayIsWriteZero()
            throws Exception {
        Map<String,Object> contract=requirementContract("PROCESS_A",4,Map.ofEntries(
            Map.entry("stepCode","STEP_ONE"),Map.entry("actorCode","WORKER_ACTOR"),
            Map.entry("routePath","/work/one"),Map.entry("screenName","Step one"),
            Map.entry("description","Complete step one"),
            Map.entry("endpoint",Map.of("method","POST","path","/api/work/one"))));
        String checksum=canonicalChecksum(contract);
        when(jdbc.queryForObject(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
            &&sql.contains("'designVersion',design_version")),eq(String.class),
            any(Object[].class)))
            .thenReturn(mapper.writeValueAsString(Map.of(
                "designVersion",4,"contractSha256",checksum,
                "releaseStatus","FAILED","generationResult",Map.of(
                    "status","FAILED","retryAttempt",3))))
            .thenReturn(mapper.writeValueAsString(Map.of(
                "designVersion",4,"contractSha256",checksum,
                "releaseStatus","APPLIED","generationResult",Map.of(
                    "status","APPLIED","retryAttempt",1))));

        var failed=controller.applyDesignRelease("secret-token",Map.of(
            "projectId","PROJECT_A","designVersion",4,
            "contractSha256",checksum,"contract",contract));
        var applied=controller.applyDesignRelease("secret-token",Map.of(
            "projectId","PROJECT_A","designVersion",4,
            "contractSha256",checksum,"contract",contract));

        @SuppressWarnings("unchecked")
        Map<String,Object> failedBody=(Map<String,Object>)failed.getBody();
        @SuppressWarnings("unchecked")
        Map<String,Object> appliedBody=(Map<String,Object>)applied.getBody();
        assertEquals("FAILED",failedBody.get("releaseStatus"));
        assertEquals(true,failedBody.get("retryExhausted"));
        assertEquals("APPLIED",appliedBody.get("releaseStatus"));
        verify(jdbc,never()).update(anyString(),any(Object[].class));
        verifyNoInteractions(governance);
    }

    @Test
    void exactReceiptReadConvergesAllTerminalStatesWithoutMutation(){
        String checksum="a".repeat(64);
        when(jdbc.queryForList(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
            &&sql.contains("generation_result::text generation_result_json")
            &&sql.contains("project_id=? and design_version=?")),any(Object[].class)))
            .thenReturn(List.of(Map.of("contract_sha256",checksum,
                "release_status","QUEUED","generation_result_json",
                "{\"status\":\"PENDING\",\"retryAttempt\":0}")))
            .thenReturn(List.of(Map.of("contract_sha256",checksum,
                "release_status","APPLIED","generation_result_json",
                "{\"status\":\"APPLIED\",\"evidenceRef\":\"receipt://7\"}")))
            .thenReturn(List.of(Map.of("contract_sha256",checksum,
                "release_status","FAILED","generation_result_json",
                "{\"status\":\"FAILED\",\"message\":\"worker failed\"}")))
            .thenReturn(List.of(Map.of("contract_sha256",checksum,
                "release_status","REVIEW_REQUIRED","generation_result_json",
                "{\"status\":\"REVIEW_REQUIRED\"}")));

        assertEquals(401,controller.designReleaseReceipt("wrong-token",
            "PROJECT_A",4,checksum).getStatusCode().value());
        var pending=controller.designReleaseReceipt("secret-token",
            "PROJECT_A",4,checksum);
        @SuppressWarnings("unchecked")
        Map<String,Object> pendingBody=(Map<String,Object>)pending.getBody();
        assertEquals("PENDING",pendingBody.get("applicationStatus"));
        assertEquals("QUEUED",pendingBody.get("releaseStatus"));
        for(String status:List.of("APPLIED","FAILED","REVIEW_REQUIRED")){
            var response=controller.designReleaseReceipt("secret-token",
                "PROJECT_A",4,checksum);
            assertEquals(200,response.getStatusCode().value());
            assertEquals("no-store",response.getHeaders().getFirst("Cache-Control"));
            @SuppressWarnings("unchecked")
            Map<String,Object> body=(Map<String,Object>)response.getBody();
            assertEquals(status,body.get("releaseStatus"));
            assertEquals(status,body.get("applicationStatus"));
            assertEquals(checksum,body.get("contractSha256"));
        }
        verify(jdbc,never()).update(anyString(),any(Object[].class));
        verifyNoInteractions(governance);
    }

    @Test
    void receiptReadRejectsAStaleChecksumWithoutMutation(){
        when(jdbc.queryForList(anyString(),any(Object[].class))).thenReturn(List.of(Map.of(
            "contract_sha256","b".repeat(64),"release_status","APPLIED",
            "generation_result_json","{\"status\":\"APPLIED\"}")));

        var response=controller.designReleaseReceipt("secret-token",
            "PROJECT_A",4,"a".repeat(64));

        assertEquals(409,response.getStatusCode().value());
        verify(jdbc,never()).update(anyString(),any(Object[].class));
        verifyNoInteractions(governance);
    }

    @Test
    void staleOrConflictingReleaseVersionReturns409WithoutImport() throws Exception {
        Map<String,Object> step=Map.ofEntries(
            Map.entry("stepCode","STEP_ONE"),Map.entry("actorCode","WORKER_ACTOR"),
            Map.entry("routePath","/work/one"),Map.entry("screenName","Step one"),
            Map.entry("description","Complete step one"),
            Map.entry("endpoint",Map.of("method","POST","path","/api/work/one")));
        Map<String,Object> staleContract=requirementContract("PROCESS_A",3,step);
        Map<String,Object> conflictingContract=requirementContract("PROCESS_A",4,step);
        when(jdbc.queryForObject(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
            &&sql.contains("'designVersion',design_version")),eq(String.class),
            any(Object[].class))).thenReturn(mapper.writeValueAsString(Map.of(
                "designVersion",4,"contractSha256","f".repeat(64),
                "releaseStatus","APPLIED","generationResult",Map.of("status","APPLIED"))));

        for(Map<String,Object> contract:List.of(staleContract,conflictingContract)){
            int version=((Number)contract.get("designVersion")).intValue();
            String checksum=canonicalChecksum(contract);
            var response=controller.applyDesignRelease("secret-token",Map.of(
                "projectId","PROJECT_A","designVersion",version,
                "contractSha256",checksum,"contract",contract));
            assertEquals(409,response.getStatusCode().value());
        }
        verifyNoInteractions(governance);
        verify(jdbc,never()).update(anyString(),any(Object[].class));
    }

    @Test
    void producerGoldenContractHasExactJavaHashesAndImportsTwoSteps() throws Exception {
        Map<String,Object> fixture=mapper.readValue(Files.readString(findRepositoryFile(
                "ops/tests/fixtures/requirement-design-cross-language-v1.json")),
            new com.fasterxml.jackson.core.type.TypeReference<LinkedHashMap<String,Object>>(){});
        @SuppressWarnings("unchecked")
        Map<String,Object> contract=(Map<String,Object>)fixture.get("contract");
        @SuppressWarnings("unchecked")
        Map<String,Object> process=(Map<String,Object>)contract.get("process");
        String processCode=String.valueOf(process.get("processCode"));
        List<String> hashBoundKeys=List.of("schemaVersion","projectId","tenantId","identity",
            "contextFields","workspaces","actorDefinitions","process","generation",
            "reconciliation","qualityGates");
        LinkedHashMap<String,Object> hashBound=new LinkedHashMap<>();
        hashBoundKeys.forEach(key->hashBound.put(key,contract.get(key)));

        assertEquals(contract.get("contentSha256"),canonicalChecksum(hashBound));
        assertEquals(fixture.get("contractSha256"),canonicalChecksum(contract));
        assertFalse(mapper.writeValueAsString(contract).contains("M3"));
        @SuppressWarnings("unchecked")
        Map<String,Object> reconciliation=(Map<String,Object>)contract.get("reconciliation");
        assertEquals(1,((List<?>)reconciliation.get("endpointIdentities")).size());
        @SuppressWarnings("unchecked")
        List<Map<String,Object>> workspaces=(List<Map<String,Object>>)contract.get("workspaces");
        @SuppressWarnings("unchecked")
        List<Map<String,Object>> tabs=(List<Map<String,Object>>)workspaces.get(0).get("tabs");
        assertEquals(true,((List<?>)tabs.get(0).get("sections")).get(0) instanceof Map<?,?>);

        when(governance.lockRequirementImportProcesses(eq(processCode),any()))
            .thenReturn(List.of(processCode,"UNRELATED_INCOMPLETE"));
        when(governance.createActorForRequirementImport(any(),anyString()))
            .thenReturn(Map.of("success",true,"definitionChanged",false,
                "affectedProcessCodes",List.of("UNRELATED_INCOMPLETE")));
        when(governance.createProcessForRequirementImport(any(),anyString()))
            .thenReturn(Map.of("success",true,"status","DEFERRED"));
        when(governance.addStepForRequirementImport(any(),anyString()))
            .thenReturn(Map.of("success",true,"status","DEFERRED"));
        when(governance.reconcileRequirementImportSteps(anyString(),any(),anyString()))
            .thenReturn(Map.of("success",true,"removedStepCount",0));
        when(jdbc.queryForObject(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
                &&sql.contains("step_code=any")),eq(Integer.class),any(Object[].class)))
            .thenReturn(2);
        when(jdbc.queryForObject(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
                &&sql.contains("select count(*) from framework_process_step")
                &&!sql.contains("step_code=any")),eq(Integer.class),any(Object[].class)))
            .thenReturn(2);
        when(governance.ensureGeneratedProcessSafetyCases(processCode)).thenReturn(5);
        when(governance.ensureGeneratedProcessDesignContracts(
            processCode,"BACKSTAGE_REQUIREMENT_AUTOMATION")).thenReturn(2);
        when(governance.ensureGeneratedProcessPageDesigns(
            processCode,"BACKSTAGE_REQUIREMENT_AUTOMATION")).thenReturn(2);
        when(governance.applyRequirementProcessDesignProjection(eq(processCode),any(),
            eq("BACKSTAGE_REQUIREMENT_AUTOMATION"))).thenReturn(Map.of(
                "success",true,"screenCount",2));
        when(governance.finalizeAndQueueProcessDesign(processCode,
            "BACKSTAGE_REQUIREMENT_AUTOMATION","REQUIREMENT_PROCESS_CONTRACT"))
            .thenReturn(new LinkedHashMap<>(Map.of("success",true,"status","QUEUED",
                "jobCount",1,"generationQueued",true,"processCode",processCode,
                "processInputHash","a".repeat(64),"jobId",17L)));
        TransactionSynchronizationManager.initSynchronization();

        var response=controller.applyDesignRelease("secret-token",Map.of(
            "projectId",fixture.get("input") instanceof Map<?,?> input
                ? input.get("projectId") : "",
            "designVersion",contract.get("designVersion"),
            "contractSha256",fixture.get("contractSha256"),"contract",contract));

        assertEquals(200,response.getStatusCode().value());
        verify(governance,times(2)).addStepForRequirementImport(any(),
            eq("BACKSTAGE_REQUIREMENT_AUTOMATION"));
        verify(governance).applyRequirementProcessDesignProjection(eq(processCode),
            eq(contract),eq("BACKSTAGE_REQUIREMENT_AUTOMATION"));
        verify(governance,never()).finalizeAndQueueProcessDesign("UNRELATED_INCOMPLETE",
            "BACKSTAGE_REQUIREMENT_AUTOMATION","REQUIREMENT_ACTOR_DEFINITION");
    }

    @Test
    void unsupportedCanonicalDesignDocumentFailsClosedWithoutReleaseWrite() throws Exception {
        LinkedHashMap<String,Object> contract=new LinkedHashMap<>();
        contract.put("zeta",Map.of("b",2,"a",1));
        contract.put("source",Map.of("type","DESIGN_DOCUMENT"));
        String canonical=mapper.writer()
            .with(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
            .writeValueAsString(contract);
        String checksum=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
            .digest(canonical.getBytes(StandardCharsets.UTF_8)));
        TransactionSynchronizationManager.initSynchronization();

        var response=controller.applyDesignRelease("secret-token",Map.of(
            "projectId","PROJECT_A","designVersion",1,
            "contractSha256",checksum,"contract",contract));

        assertEquals(400,response.getStatusCode().value());
        verify(governance,never()).createProcessForRequirementImport(any(),anyString());
        verify(jdbc,never()).update(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
            &&sql.contains("framework_actor_process_design_release")),any(Object[].class));
    }

    @Test
    void requirementImportDefersIntermediatePropagationAndQueuesOnceAfterPrerequisites()
            throws Exception {
        Map<String,Object> step=Map.ofEntries(
            Map.entry("stepCode","STEP_ONE"),Map.entry("actorCode","WORKER_ACTOR"),
            Map.entry("routePath","/work/one"),Map.entry("screenName","Step one"),
            Map.entry("description","Complete step one"),
            Map.entry("endpoint",Map.of("method","POST","path","/api/work/one")),
            Map.entry("fields",java.util.List.of(Map.of("fieldCode","name"))));
        Map<String,Object> contract=requirementContract("PROCESS_A",1,step);
        when(governance.lockRequirementImportProcesses(eq("PROCESS_A"),any()))
            .thenReturn(java.util.List.of("PROCESS_A","PROCESS_B"));
        when(governance.createActorForRequirementImport(any(),anyString()))
            .thenReturn(Map.of("success",true,
                "definitionChanged",true,
                "affectedProcessCodes",java.util.List.of("PROCESS_B")));
        when(governance.createProcessForRequirementImport(any(),anyString()))
            .thenReturn(Map.of("success",true,"status","DEFERRED"));
        when(governance.addStepForRequirementImport(any(),anyString()))
            .thenReturn(Map.of("success",true,"status","DEFERRED"));
        when(governance.reconcileRequirementImportSteps(anyString(),any(),anyString()))
            .thenReturn(Map.of("success",true,"removedStepCount",0));
        when(jdbc.queryForObject(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
                &&sql.contains("step_code=any")),eq(Integer.class),any(Object[].class)))
            .thenReturn(1);
        when(jdbc.queryForObject(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
                &&sql.contains("select count(*) from framework_process_step")
                &&!sql.contains("step_code=any")),eq(Integer.class),any(Object[].class)))
            .thenReturn(1);
        when(governance.ensureGeneratedProcessSafetyCases("PROCESS_A")).thenReturn(5);
        when(governance.ensureGeneratedProcessDesignContracts(
            "PROCESS_A","BACKSTAGE_REQUIREMENT_AUTOMATION")).thenReturn(1);
        when(governance.ensureGeneratedProcessPageDesigns(
            "PROCESS_A","BACKSTAGE_REQUIREMENT_AUTOMATION")).thenReturn(1);
        when(governance.applyRequirementProcessDesignProjection(eq("PROCESS_A"),any(),
            eq("BACKSTAGE_REQUIREMENT_AUTOMATION"))).thenReturn(Map.of(
                "success",true,"screenCount",1));
        when(governance.finalizeAndQueueProcessDesign("PROCESS_A",
            "BACKSTAGE_REQUIREMENT_AUTOMATION","REQUIREMENT_PROCESS_CONTRACT"))
            .thenReturn(new LinkedHashMap<>(Map.of("success",true,"status","QUEUED",
                "jobCount",1,"generationQueued",true,"processCode","PROCESS_A",
                "processInputHash","a".repeat(64),"jobId",7L)));
        when(governance.finalizeAndQueueProcessDesign("PROCESS_B",
            "BACKSTAGE_REQUIREMENT_AUTOMATION","REQUIREMENT_ACTOR_DEFINITION"))
            .thenReturn(new LinkedHashMap<>(Map.of("success",true,"status","UNCHANGED",
                "jobCount",1,"generationQueued",false,"processCode","PROCESS_B",
                "processInputHash","b".repeat(64),"jobId",8L)));
        String checksum=canonicalChecksum(contract);
        TransactionSynchronizationManager.initSynchronization();

        var response=controller.applyDesignRelease("secret-token",Map.of(
            "projectId","PROJECT_A","designVersion",1,
            "contractSha256",checksum,"contract",contract));

        assertEquals(200,response.getStatusCode().value());
        var order=inOrder(governance);
        order.verify(governance).lockRequirementImportProcesses(eq("PROCESS_A"),any());
        order.verify(governance).createActorForRequirementImport(
            org.mockito.ArgumentMatchers.argThat(actor->
                "WORKER_ACTOR".equals(actor.get("actorCode"))
                    &&"EXECUTE_STEP_ONE".equals(actor.get("capabilityCodes"))),anyString());
        order.verify(governance).createProcessForRequirementImport(any(),anyString());
        order.verify(governance).addStepForRequirementImport(
            org.mockito.ArgumentMatchers.argThat(request->
                "EXECUTE_STEP_ONE".equals(request.get("commandCode"))
                    &&Integer.valueOf(10).equals(request.get("stepOrder"))
                    &&"DRAFT".equals(request.get("fromState"))
                    &&"COMPLETED".equals(request.get("toState"))
                    &&String.valueOf(request.get("apiContract")).contains("/api/work/one")),
            anyString());
        order.verify(governance).reconcileRequirementImportSteps(anyString(),any(),anyString());
        order.verify(governance).ensureGeneratedProcessSafetyCases("PROCESS_A");
        order.verify(governance).ensureGeneratedProcessDesignContracts(
            "PROCESS_A","BACKSTAGE_REQUIREMENT_AUTOMATION");
        order.verify(governance).ensureGeneratedProcessPageDesigns(
            "PROCESS_A","BACKSTAGE_REQUIREMENT_AUTOMATION");
        order.verify(governance).applyRequirementProcessDesignProjection(eq("PROCESS_A"),
            org.mockito.ArgumentMatchers.argThat(design->{
                Map<?,?> process=(Map<?,?>)design.get("process");
                Map<?,?> projectedStep=(Map<?,?>)((List<?>)process.get("steps")).get(0);
                return "RESPONSIVE_WORKSPACE".equals(projectedStep.get("layoutCode"))
                    &&"KRDS_GOV_DEFAULT".equals(projectedStep.get("themeCode"))
                    &&List.of("EXECUTE_STEP_ONE").equals(projectedStep.get("permissionCodes"))
                    &&"MAIN_TASK".equals(((Map<?,?>)((List<?>)
                        projectedStep.get("sections")).get(0)).get("sectionCode"));
            }),eq("BACKSTAGE_REQUIREMENT_AUTOMATION"));
        order.verify(governance).finalizeAndQueueProcessDesign("PROCESS_A",
            "BACKSTAGE_REQUIREMENT_AUTOMATION","REQUIREMENT_PROCESS_CONTRACT");
        order.verify(governance).finalizeAndQueueProcessDesign("PROCESS_B",
            "BACKSTAGE_REQUIREMENT_AUTOMATION","REQUIREMENT_ACTOR_DEFINITION");
        verify(governance,never()).createProcess(any(),anyString());
        verify(governance,never()).addStep(any(),anyString());
        verify(governance,never()).saveWorkType(any());
        verify(jdbc).update(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
                &&sql.contains("set release_status='QUEUED'")),
            org.mockito.ArgumentMatchers.argThat(value->{
                String json=String.valueOf(value);
                try{
                    var release=mapper.readTree(json);
                    return release.path("expectedProcessHeads").path("PROCESS_A")
                            .asText().equals("a".repeat(64))
                        &&release.path("expectedProcessHeads").path("PROCESS_B")
                            .asText().equals("b".repeat(64))
                        &&release.path("expectedProcessReceipts").path("PROCESS_A")
                            .path("processInputHash").asText().equals("a".repeat(64))
                        &&release.path("expectedProcessReceipts").path("PROCESS_A")
                            .path("jobId").asLong()==7L
                        &&release.path("expectedProcessReceipts").path("PROCESS_B")
                            .path("processInputHash").asText().equals("b".repeat(64))
                        &&release.path("expectedProcessReceipts").path("PROCESS_B")
                            .path("jobId").asLong()==8L;
                }catch(Exception invalidJson){
                    return false;
                }
            }),eq("PROJECT_A"),eq(1));
    }

    @Test
    void requirementImportRejectsAnAffectedProcessOutsideThePrelockedSet()
            throws Exception {
        Map<String,Object> step=Map.ofEntries(
            Map.entry("stepCode","STEP_ONE"),Map.entry("actorCode","WORKER_ACTOR"),
            Map.entry("routePath","/work/one"),Map.entry("screenName","Step one"),
            Map.entry("description","Complete step one"),
            Map.entry("endpoint",Map.of("method","POST","path","/api/work/one")),
            Map.entry("fields",java.util.List.of(Map.of("fieldCode","name"))));
        Map<String,Object> contract=requirementContract("PROCESS_A",1,step);
        when(governance.lockRequirementImportProcesses("PROCESS_A",java.util.Set.of("WORKER_ACTOR")))
            .thenReturn(java.util.List.of("PROCESS_A"));
        when(governance.createActorForRequirementImport(any(),anyString()))
            .thenReturn(Map.of("success",true,
                "definitionChanged",true,
                "affectedProcessCodes",java.util.List.of("PROCESS_OUTSIDE_LOCK_SET")));
        TransactionSynchronizationManager.initSynchronization();

        var response=controller.applyDesignRelease("secret-token",Map.of(
            "projectId","PROJECT_A","designVersion",1,
            "contractSha256",canonicalChecksum(contract),"contract",contract));

        assertEquals(400,response.getStatusCode().value());
        verify(governance,never()).createProcessForRequirementImport(any(),anyString());
        verify(jdbc,never()).update(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
            &&sql.contains("framework_actor_process_design_release")),any(Object[].class));
    }

    @Test
    void supersededRequirementHeadCannotBeAppliedByANewerCanonicalJob(){
        String expectedMain="a".repeat(64);
        String expectedRelated="b".repeat(64);
        String currentRelated="c".repeat(64);
        String checksum="d".repeat(64);
        String expectedHeadsJson="{\"PROCESS_A\":\""+expectedMain+
            "\",\"PROCESS_B\":\""+expectedRelated+"\"}";
        String expectedReceiptsJson="{\"PROCESS_A\":{"+
            "\"processInputHash\":\""+expectedMain+"\",\"jobId\":7},"+
            "\"PROCESS_B\":{\"processInputHash\":\""+expectedRelated+
            "\",\"jobId\":8}}";
        String capturedGenerationResult="{\"status\":\"PENDING\","+
            "\"expectedProcessHeads\":"+expectedHeadsJson+","+
            "\"expectedProcessReceipts\":"+expectedReceiptsJson+"}";
        when(jdbc.queryForList(anyString(),any(Object[].class)))
            .thenReturn(java.util.List.of(Map.of(
                "contract_sha256",checksum,"release_status","QUEUED",
                "generation_result_json",capturedGenerationResult,
                "expected_receipts_json",expectedReceiptsJson)))
            .thenReturn(java.util.List.of(
            Map.ofEntries(Map.entry("expected_process_code","PROCESS_A"),
                Map.entry("expected_input_hash",expectedMain),
                Map.entry("expected_job_id",7L),
                Map.entry("current_input_hash",expectedMain),Map.entry("job_id",7L),
                Map.entry("job_status","VERIFIED"),Map.entry("quality_status","PASSED"),
                Map.entry("evidence_ref","receipt://main"),
                Map.entry("target_path","canonical://PROCESS_A/"+expectedMain),
                Map.entry("job_input_hash",expectedMain)),
            Map.ofEntries(Map.entry("expected_process_code","PROCESS_B"),
                Map.entry("expected_input_hash",expectedRelated),
                Map.entry("expected_job_id",8L),
                Map.entry("current_input_hash",currentRelated),Map.entry("job_id",8L),
                Map.entry("job_status","VERIFIED"),Map.entry("quality_status","PASSED"),
                Map.entry("evidence_ref","receipt://newer-related"),
                Map.entry("target_path","canonical://PROCESS_B/"+currentRelated),
                Map.entry("job_input_hash",currentRelated))));

        controller.reconcileRequirementRelease("PROJECT_A",1,"PROCESS_A");

        verify(jdbc).queryForList(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
                &&sql.contains("job.job_id=headed.expected_job_id")),eq(expectedReceiptsJson));
        verify(jdbc).update(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
                &&sql.contains("set release_status=?")
                &&sql.contains("and release_status=?")
                &&sql.contains("and generation_result=cast(? as jsonb)")),
            eq("REVIEW_REQUIRED"),eq(false),
            org.mockito.ArgumentMatchers.argThat(value->{
                String json=String.valueOf(value);
                return json.contains("\"status\":\"SUPERSEDED\"")
                    &&json.contains("\"PROCESS_A\":\""+expectedMain+"\"")
                    &&json.contains("\"PROCESS_B\":\""+expectedRelated+"\"")
                    &&json.contains("\"currentProcessInputHash\":\""+
                        currentRelated+"\"");
            }),eq("PROJECT_A"),eq(1),eq(checksum),eq("QUEUED"),
            eq(capturedGenerationResult));
    }

    @Test
    void replacementCanonicalJobWithTheSameHashCannotSatisfyTheCapturedReceipt(){
        String expectedHash="a".repeat(64);
        String checksum="d".repeat(64);
        String expectedReceiptsJson="{\"PROCESS_A\":{"+
            "\"processInputHash\":\""+expectedHash+"\",\"jobId\":41}}";
        String capturedGenerationResult="{\"status\":\"PENDING\","+
            "\"expectedProcessReceipts\":"+expectedReceiptsJson+"}";
        when(jdbc.queryForList(anyString(),any(Object[].class)))
            .thenReturn(java.util.List.of(Map.of(
                "contract_sha256",checksum,"release_status","QUEUED",
                "generation_result_json",capturedGenerationResult,
                "expected_receipts_json",expectedReceiptsJson)))
            .thenReturn(java.util.List.of(Map.of(
                "expected_process_code","PROCESS_A",
                "expected_input_hash",expectedHash,
                "expected_job_id",41L,
                "current_input_hash",expectedHash)));

        controller.reconcileRequirementRelease("PROJECT_A",1,"PROCESS_A");

        verify(jdbc).queryForList(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
            &&sql.contains("job.job_id=headed.expected_job_id")
            &&sql.contains("job.job_group_code=headed.process_code")),
            eq(expectedReceiptsJson));
        verify(jdbc).update(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
                &&sql.contains("and release_status=?")
                &&sql.contains("and generation_result=cast(? as jsonb)")),
            eq("REVIEW_REQUIRED"),eq(false),
            org.mockito.ArgumentMatchers.argThat(value->{
                String json=String.valueOf(value);
                return json.contains("\"status\":\"REVIEW_REQUIRED\"")
                    &&json.contains("\"expectedJobId\":41")
                    &&json.contains("\"jobCount\":0");
            }),eq("PROJECT_A"),eq(1),eq(checksum),eq("QUEUED"),
            eq(capturedGenerationResult));
    }

    @Test
    void appliedRequirementReleaseIsATerminalReconciliationNoOp(){
        String captured="{\"status\":\"APPLIED\",\"receipt\":\"immutable\"}";
        when(jdbc.queryForList(anyString(),any(Object[].class)))
            .thenReturn(java.util.List.of(Map.of(
                "contract_sha256","d".repeat(64),"release_status","APPLIED",
                "generation_result_json",captured,"expected_receipts_json","{}")));

        controller.reconcileRequirementRelease("PROJECT_A",1,"PROCESS_A");

        verify(jdbc,never()).update(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
            &&sql.contains("set release_status=?")),any(Object[].class));
    }

    @Test
    void exactRetriedReceiptCanReconcileFromRunningToApplied(){
        String hash="a".repeat(64),checksum="d".repeat(64);
        String receipts="{\"PROCESS_A\":{\"processInputHash\":\""+hash+
            "\",\"jobId\":7}}";
        String captured="{\"status\":\"PENDING\",\"retryAttempt\":1,"+
            "\"expectedProcessReceipts\":"+receipts+"}";
        when(jdbc.queryForList(anyString(),any(Object[].class)))
            .thenReturn(List.of(Map.of(
                "contract_sha256",checksum,"release_status","RUNNING",
                "generation_result_json",captured,
                "expected_receipts_json",receipts)))
            .thenReturn(List.of(Map.ofEntries(
                Map.entry("expected_process_code","PROCESS_A"),
                Map.entry("expected_input_hash",hash),Map.entry("expected_job_id",7L),
                Map.entry("current_input_hash",hash),Map.entry("job_id",7L),
                Map.entry("job_status","VERIFIED"),Map.entry("quality_status","PASSED"),
                Map.entry("evidence_ref","receipt://retry-1"),
                Map.entry("target_path","canonical://PROCESS_A/"+hash),
                Map.entry("job_input_hash",hash))));

        controller.reconcileRequirementRelease("PROJECT_A",4,"PROCESS_A");

        verify(jdbc).update(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
                &&sql.contains("set release_status=?")
                &&sql.contains("generation_result=cast(? as jsonb)")),
            eq("APPLIED"),eq(true),
            org.mockito.ArgumentMatchers.argThat(value->{
                String json=String.valueOf(value);
                return json.contains("\"status\":\"APPLIED\"")
                    &&json.contains("\"retryAttempt\":1")
                    &&json.contains("\"evidencePresent\":true");
            }),eq("PROJECT_A"),eq(4),eq(checksum),eq("RUNNING"),eq(captured));
    }

    @Test
    void unchangedExistingActorDoesNotPublishAnUnrelatedIncompleteProcess()
            throws Exception {
        Map<String,Object> step=Map.ofEntries(
            Map.entry("stepCode","STEP_ONE"),Map.entry("actorCode","WORKER_ACTOR"),
            Map.entry("routePath","/work/one"),Map.entry("screenName","Step one"),
            Map.entry("description","Complete step one"),
            Map.entry("endpoint",Map.of("method","POST","path","/api/work/one")),
            Map.entry("fields",java.util.List.of(Map.of("fieldCode","name"))));
        Map<String,Object> contract=requirementContract("PROCESS_A",2,step);
        when(governance.lockRequirementImportProcesses(eq("PROCESS_A"),any()))
            .thenReturn(java.util.List.of("PROCESS_A","PROCESS_B"));
        when(governance.createActorForRequirementImport(any(),anyString()))
            .thenReturn(Map.of("success",true,
                "definitionChanged",false,
                "affectedProcessCodes",java.util.List.of("PROCESS_B")));
        when(governance.createProcessForRequirementImport(any(),anyString()))
            .thenReturn(Map.of("success",true,"status","DEFERRED"));
        when(governance.addStepForRequirementImport(any(),anyString()))
            .thenReturn(Map.of("success",true,"status","DEFERRED"));
        when(governance.reconcileRequirementImportSteps(anyString(),any(),anyString()))
            .thenReturn(Map.of("success",true,"removedStepCount",0));
        when(jdbc.queryForObject(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
                &&sql.contains("step_code=any")),eq(Integer.class),any(Object[].class)))
            .thenReturn(1);
        when(jdbc.queryForObject(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
                &&sql.contains("select count(*) from framework_process_step")
                &&!sql.contains("step_code=any")),eq(Integer.class),any(Object[].class)))
            .thenReturn(1);
        when(governance.ensureGeneratedProcessSafetyCases("PROCESS_A")).thenReturn(5);
        when(governance.ensureGeneratedProcessDesignContracts(
            "PROCESS_A","BACKSTAGE_REQUIREMENT_AUTOMATION")).thenReturn(1);
        when(governance.ensureGeneratedProcessPageDesigns(
            "PROCESS_A","BACKSTAGE_REQUIREMENT_AUTOMATION")).thenReturn(1);
        when(governance.applyRequirementProcessDesignProjection(eq("PROCESS_A"),any(),
            eq("BACKSTAGE_REQUIREMENT_AUTOMATION"))).thenReturn(Map.of(
                "success",true,"screenCount",1));
        when(governance.finalizeAndQueueProcessDesign("PROCESS_A",
            "BACKSTAGE_REQUIREMENT_AUTOMATION","REQUIREMENT_PROCESS_CONTRACT"))
            .thenReturn(new LinkedHashMap<>(Map.of("success",true,"status","QUEUED",
                "jobCount",1,"generationQueued",true,"processCode","PROCESS_A",
                "processInputHash","a".repeat(64),"jobId",7L)));
        when(governance.finalizeAndQueueProcessDesign("PROCESS_B",
            "BACKSTAGE_REQUIREMENT_AUTOMATION","REQUIREMENT_ACTOR_DEFINITION"))
            .thenReturn(new LinkedHashMap<>(Map.of("success",true,"status","SKIPPED",
                "jobCount",0,"generationQueued",false,"processCode","PROCESS_B")));
        TransactionSynchronizationManager.initSynchronization();

        var response=controller.applyDesignRelease("secret-token",Map.of(
            "projectId","PROJECT_A","designVersion",2,
            "contractSha256",canonicalChecksum(contract),"contract",contract));

        assertEquals(200,response.getStatusCode().value());
        verify(governance,never()).finalizeAndQueueProcessDesign("PROCESS_B",
            "BACKSTAGE_REQUIREMENT_AUTOMATION","REQUIREMENT_ACTOR_DEFINITION");
    }

    @Test
    void requirementImportAndRecoveryDoNotRewriteTheSingletonWorkType() throws Exception {
        String source=Files.readString(findRepositoryFile(
            "modules/resonance-common/carbonet-common-core/src/main/java/"+
            "egovframework/com/platform/governance/web/"+
            "ActorProcessControlPlaneBridgeController.java"));
        String requirementImport=source.substring(
            source.indexOf("private Map<String,Object> importRequirementProcessContract"),
            source.indexOf("private java.util.SortedMap<String,Map<String,Object>> "+
                "requirementExpectedProcessReceipts"));
        String recovery=source.substring(
            source.indexOf("public void recoverQueuedDesignGeneration()"));

        assertFalse(requirementImport.contains("saveWorkType"));
        assertFalse(requirementImport.contains("framework_business_work_type"));
        assertFalse(recovery.contains("update framework_business_work_type"));
        assertFalse(source.contains("requirement-automation-sequence"));
        assertFalse(source.contains("max(workflow_order)"));
        String service=Files.readString(findRepositoryFile(
            "modules/resonance-common/carbonet-common-core/src/main/java/"+
            "egovframework/com/platform/governance/service/ActorProcessGovernanceService.java"));
        assertFalse(service.contains("requirement-automation-sequence"));
        assertFalse(service.contains("max(workflow_order)"));
        org.junit.jupiter.api.Assertions.assertTrue(service.contains(
            "framework_allocate_requirement_process_sequence"));
    }

    @Test
    void generationClaimFencesEveryStaleWorkerTerminalWrite() throws Exception {
        String source=Files.readString(findRepositoryFile(
            "modules/resonance-common/carbonet-common-core/src/main/java/"+
            "egovframework/com/platform/governance/web/"+
            "ActorProcessControlPlaneBridgeController.java"));
        String compile=source.substring(source.indexOf("private void compilePromotedRelease"),
            source.indexOf("void reconcileRequirementRelease("));
        String failure=source.substring(source.indexOf("private void recordGenerationFailure"),
            source.indexOf("private long nextRetryEpoch"));
        String reconciliation=source.substring(source.indexOf(
            "private void reconcileRequirementRelease("),source.indexOf(
            "private Map<String,Object> importRequirementProcessContract"));

        org.junit.jupiter.api.Assertions.assertTrue(compile.contains(
            "claimedReceipt.put(\"claimToken\",claimToken)"));
        org.junit.jupiter.api.Assertions.assertTrue(compile.contains(
            "generation_result->>'claimToken'=?"));
        org.junit.jupiter.api.Assertions.assertTrue(failure.contains(
            "generation_result->>'claimToken'=?"));
        org.junit.jupiter.api.Assertions.assertTrue(reconciliation.contains(
            "expectedClaimToken.equals("));
        org.junit.jupiter.api.Assertions.assertTrue(reconciliation.contains(
            "generation_result=cast(? as jsonb)"));
    }

    @Test
    void recoverySchedulesReleaseReconciliationOnlyAfterItsTransactionCommits(){
        when(jdbc.queryForObject(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
            &&sql.contains("resonance:requirement-design-self-healer")),eq(Boolean.class)))
            .thenReturn(true);
        when(jdbc.queryForList(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
            &&sql.contains("left(process_code,4)")),eq(String.class)))
            .thenReturn(java.util.List.of());
        when(jdbc.queryForList(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
            &&sql.contains("framework_actor_process_design_release")
            &&sql.contains("release_status='QUEUED'"))))
            .thenReturn(java.util.List.of(Map.of("project_id","PROJECT_A","design_version",1)));
        when(jdbc.queryForMap(anyString(),any(Object[].class))).thenReturn(Map.of(
            "source_type","REQUIREMENT_DOCUMENT","process_code","PROCESS_A"));
        when(jdbc.queryForList(anyString(),any(Object[].class)))
            .thenReturn(java.util.List.of());
        TransactionSynchronizationManager.initSynchronization();

        controller.recoverQueuedDesignGeneration();

        verify(jdbc,never()).queryForMap(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
            &&sql.contains("contract_payload")),any(Object[].class));
        assertEquals(1,TransactionSynchronizationManager.getSynchronizations().size());
        TransactionSynchronizationManager.getSynchronizations().forEach(
            org.springframework.transaction.support.TransactionSynchronization::afterCommit);
        verify(jdbc,timeout(1000)).queryForMap(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
            &&sql.contains("contract_payload")),eq("PROJECT_A"),eq(1));
    }

    @Test
    void recoveryReopensOnlyDueTerminalReceiptsWithABoundedAttempt(){
        when(jdbc.queryForObject(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
            &&sql.contains("resonance:requirement-design-self-healer")),eq(Boolean.class)))
            .thenReturn(true);
        when(jdbc.queryForList(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
            &&sql.contains("for update skip locked")
            &&sql.contains("retryNotBeforeEpoch")
            &&sql.contains("'^[0-2]$'"))))
            .thenReturn(List.of(Map.of(
                "project_id","PROJECT_A","design_version",4,
                "contract_sha256","d".repeat(64),"release_status","FAILED",
                "generation_result_json","{\"status\":\"FAILED\","+
                    "\"retryAttempt\":0,\"retryNotBeforeEpoch\":0}")));
        when(jdbc.update(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
            &&sql.contains("release_status='QUEUED'")
            &&sql.contains("retryAttempt")),any(Object[].class))).thenReturn(1);
        TransactionSynchronizationManager.initSynchronization();

        controller.recoverQueuedDesignGeneration();

        verify(jdbc).update(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
                &&sql.contains("release_status='QUEUED'")),
            org.mockito.ArgumentMatchers.argThat(json->String.valueOf(json)
                .contains("\"retryAttempt\":1")),
            eq("PROJECT_A"),eq(4),eq("d".repeat(64)),eq("FAILED"),eq("0"));
        assertEquals(1,TransactionSynchronizationManager.getSynchronizations().size());
        verifyNoInteractions(governance);
    }

    private Map<String,Object> goldenRequirementContract() throws Exception {
        Map<String,Object> fixture=mapper.readValue(Files.readString(findRepositoryFile(
                "ops/tests/fixtures/requirement-design-cross-language-v1.json")),
            new com.fasterxml.jackson.core.type.TypeReference<LinkedHashMap<String,Object>>(){});
        return mapper.convertValue(fixture.get("contract"),
            new com.fasterxml.jackson.core.type.TypeReference<LinkedHashMap<String,Object>>(){});
    }

    @SuppressWarnings("unchecked")
    private static Map<String,Object> requiredTestObject(Map<String,Object> value,String key){
        return (Map<String,Object>)value.get(key);
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String,Object>> requirementSteps(Map<String,Object> contract){
        return (List<Map<String,Object>>)requiredTestObject(contract,"process").get("steps");
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String,Object>> requirementActors(Map<String,Object> contract){
        return (List<Map<String,Object>>)contract.get("actorDefinitions");
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String,Object>> requirementWorkspaces(Map<String,Object> contract){
        return (List<Map<String,Object>>)contract.get("workspaces");
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String,Object>> requiredTestTabs(Map<String,Object> workspace){
        return (List<Map<String,Object>>)workspace.get("tabs");
    }

    private void rehashRequirementContract(Map<String,Object> contract) throws Exception {
        List<String> hashBoundKeys=List.of("schemaVersion","projectId","tenantId","identity",
            "contextFields","workspaces","actorDefinitions","process","generation",
            "reconciliation","qualityGates");
        LinkedHashMap<String,Object> hashBound=new LinkedHashMap<>();
        hashBoundKeys.forEach(key->hashBound.put(key,contract.get(key)));
        String contentSha=canonicalChecksum(hashBound);
        contract.put("contentSha256",contentSha);
        requiredTestObject(contract,"source").put("contentSha256",contentSha);
    }

    private Map<String,Object> requirementContract(
            String processCode,int designVersion,Map<String,Object> rawStep) throws Exception {
        String stepCode=String.valueOf(rawStep.get("stepCode"));
        String actorCode=String.valueOf(rawStep.get("actorCode"));
        String route=String.valueOf(rawStep.get("routePath"));
        String command="EXECUTE_"+stepCode;
        @SuppressWarnings("unchecked")
        Map<String,Object> endpoint=(Map<String,Object>)rawStep.get("endpoint");
        List<Map<String,Object>> sections=List.of(Map.of(
            "sectionCode","MAIN_TASK","order",1,"componentType","JSON_FORM"));
        LinkedHashMap<String,Object> step=new LinkedHashMap<>(rawStep);
        step.put("requirementId","REQ_"+stepCode);
        step.put("title",String.valueOf(rawStep.get("screenName")));
        step.put("processCode",processCode);
        step.put("stepOrder",10);
        step.put("layoutCode","RESPONSIVE_WORKSPACE");
        step.put("themeCode","KRDS_GOV_DEFAULT");
        step.put("sections",sections);
        step.put("permissionCodes",List.of(command));
        step.put("commandCode",command);
        step.put("fromState","DRAFT");
        step.put("toState","COMPLETED");
        step.put("apiContract",new LinkedHashMap<>(endpoint));
        step.put("fields",List.of(Map.of("fieldCode","NAME","label","Name",
            "type","TEXT","required",true,"order",1)));
        step.put("acceptanceCriteria",List.of("Persist and reread the completed work."));
        LinkedHashMap<String,Object> hashBound=new LinkedHashMap<>();
        hashBound.put("schemaVersion","3.0.0");
        hashBound.put("projectId","PROJECT_A");
        hashBound.put("tenantId","TENANT_A");
        hashBound.put("identity",Map.of("strategy","STABLE_DOCUMENT_KEY",
            "stableKey","PROJECT_A:REQUIREMENTS","processCode",processCode));
        hashBound.put("contextFields",List.of("projectId","tenantId","designVersion",
            "actorCode","processCode","stepCode"));
        hashBound.put("workspaces",canonicalRequirementWorkspaces());
        hashBound.put("actorDefinitions",List.of(Map.of(
            "actorCode",actorCode,"actorName",actorCode,"description","Requirement actor",
            "permissionCodes",List.of(command))));
        hashBound.put("process",Map.of("processCode",processCode,"startState","DRAFT",
            "endState","COMPLETED","steps",List.of(step)));
        hashBound.put("generation",Map.of(
            "strategy","METADATA_FIRST_INCREMENTAL","maxScreens",1000,
            "commonLayout","RESPONSIVE_WORKSPACE","commonTheme","KRDS_GOV_DEFAULT",
            "genericEndpoints",List.of(
                "/admin/api/system/actor-process/executions/start",
                "/admin/api/system/actor-process/executions/{executionId}/commands",
                "/admin/api/system/actor-process/process-design",
                "/admin/api/system/actor-process/backend/verify")));
        String audience=actorCode.contains("ADMIN")?"ADMIN":"USER";
        hashBound.put("reconciliation",Map.ofEntries(
            Map.entry("mode","EXACT_SET"),
            Map.entry("staleIdentityIntent","REMOVE_GENERATOR_OWNED_MISSING"),
            Map.entry("stepCodes",List.of(stepCode)),
            Map.entry("routePaths",List.of(route)),
            Map.entry("screenKeys",List.of(String.join("|",processCode,stepCode,audience,route))),
            Map.entry("commandCodes",List.of(command)),
            Map.entry("endpointIdentities",List.of(endpoint.get("method")+" "+endpoint.get("path"))),
            Map.entry("actorCodes",List.of(actorCode))));
        hashBound.put("qualityGates",List.of("ACTOR_PROCESS_TRACEABILITY",
            "INPUT_OUTPUT_HANDOFF","AUTHORITY_ISOLATION","DATABASE_REREAD",
            "RESPONSIVE_ACCESSIBILITY","RECOVERY_EVIDENCE"));
        String contentSha=canonicalChecksum(hashBound);
        LinkedHashMap<String,Object> contract=new LinkedHashMap<>(hashBound);
        contract.put("designVersion",designVersion);
        contract.put("contentSha256",contentSha);
        contract.put("contentHashAlgorithm","SHA-256/CANONICAL-JSON-V1");
        contract.put("source",Map.ofEntries(
            Map.entry("type","REQUIREMENT_DOCUMENT"),
            Map.entry("fileName","requirements.json"),Map.entry("documentSha256","b".repeat(64)),
            Map.entry("textSha256","c".repeat(64)),Map.entry("stableKey","PROJECT_A:REQUIREMENTS"),
            Map.entry("processCode",processCode),Map.entry("contentSha256",contentSha)));
        return contract;
    }

    private static List<Map<String,Object>> canonicalRequirementWorkspaces(){
        List<Map<String,Object>> workspaces=new java.util.ArrayList<>();
        for(String workspaceId:List.of("design","develop","operate")){
            List<Map<String,Object>> tabs=new java.util.ArrayList<>();
            int tabCount="operate".equals(workspaceId)?9:8;
            for(int tabIndex=1;tabIndex<=tabCount;tabIndex++){
                List<Map<String,Object>> sections=new java.util.ArrayList<>();
                int sectionIndex=0;
                for(String sectionCode:List.of("HELP","NEXT_TASK","QA","SCREEN_DESIGN")){
                    sectionIndex++;
                    sections.add(Map.of("sectionCode",sectionCode,"componentType",sectionCode,
                        "order",sectionIndex*10));
                }
                tabs.add(Map.of("id",workspaceId+"-"+tabIndex,
                    "label",workspaceId.toUpperCase()+" "+tabIndex,
                    "order",tabIndex*10,"sections",sections));
            }
            workspaces.add(Map.of("id",workspaceId,"tabs",tabs));
        }
        return workspaces;
    }

    private String canonicalChecksum(Object contract) throws Exception {
        String canonical=mapper.writer()
            .with(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
            .writeValueAsString(contract);
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
            .digest(canonical.getBytes(StandardCharsets.UTF_8)));
    }

    private static Path findRepositoryFile(String relative){
        Path cursor=Path.of("").toAbsolutePath();
        for(int depth=0;cursor!=null&&depth<8;depth++,cursor=cursor.getParent()){
            Path candidate=cursor.resolve(relative);
            if(Files.isRegularFile(candidate))return candidate;
        }
        throw new IllegalStateException("repository file not found: "+relative);
    }

    private static <T> T eq(T value){return org.mockito.ArgumentMatchers.eq(value);}
}
