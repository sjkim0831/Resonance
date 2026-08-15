package egovframework.com.platform.governance.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import org.junit.jupiter.api.AfterEach;
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
        hashBound.put("workspaces",List.of(Map.of("id","PRIMARY_WORKSPACE","tabs",List.of(
            Map.of("id","TASK","label","Task","sections",sections)))));
        hashBound.put("actorDefinitions",List.of(Map.of(
            "actorCode",actorCode,"actorName",actorCode,"description","Requirement actor",
            "permissionCodes",List.of(command))));
        hashBound.put("process",Map.of("processCode",processCode,"startState","DRAFT",
            "endState","COMPLETED","steps",List.of(step)));
        hashBound.put("generation",Map.of("commonLayout","RESPONSIVE_WORKSPACE",
            "commonTheme","KRDS_GOV_DEFAULT"));
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
        contract.put("source",Map.ofEntries(
            Map.entry("type","REQUIREMENT_DOCUMENT"),
            Map.entry("fileName","requirements.json"),Map.entry("documentSha256","b".repeat(64)),
            Map.entry("textSha256","c".repeat(64)),Map.entry("stableKey","PROJECT_A:REQUIREMENTS"),
            Map.entry("processCode",processCode),Map.entry("contentSha256",contentSha)));
        return contract;
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
