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
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.timeout;
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
    void exactCanonicalContractChecksumQueuesWithoutRequirementMutation() throws Exception {
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

        assertEquals(200,response.getStatusCode().value());
        assertEquals("PENDING",((Map<?,?>)response.getBody()).get("applicationStatus"));
        verify(governance,never()).createProcessForRequirementImport(any(),anyString());
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
        Map<String,Object> contract=Map.of(
            "source",Map.of("type","REQUIREMENT_DOCUMENT"),
            "process",Map.of("processCode","PROCESS_A","steps",java.util.List.of(step)));
        when(governance.lockRequirementImportProcesses(eq("PROCESS_A"),any()))
            .thenReturn(java.util.List.of("PROCESS_A","PROCESS_B"));
        when(governance.createActorForRequirementImport(any(),anyString()))
            .thenReturn(Map.of("success",true,
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
        order.verify(governance).createActorForRequirementImport(any(),anyString());
        order.verify(governance).createProcessForRequirementImport(any(),anyString());
        order.verify(governance).addStepForRequirementImport(any(),anyString());
        order.verify(governance).reconcileRequirementImportSteps(anyString(),any(),anyString());
        order.verify(governance).ensureGeneratedProcessSafetyCases("PROCESS_A");
        order.verify(governance).ensureGeneratedProcessDesignContracts(
            "PROCESS_A","BACKSTAGE_REQUIREMENT_AUTOMATION");
        order.verify(governance).ensureGeneratedProcessPageDesigns(
            "PROCESS_A","BACKSTAGE_REQUIREMENT_AUTOMATION");
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
    void incompleteRelatedProcessPublicationRejectsTheAtomicRequirementRelease()
            throws Exception {
        Map<String,Object> step=Map.ofEntries(
            Map.entry("stepCode","STEP_ONE"),Map.entry("actorCode","WORKER_ACTOR"),
            Map.entry("routePath","/work/one"),Map.entry("screenName","Step one"),
            Map.entry("description","Complete step one"),
            Map.entry("endpoint",Map.of("method","POST","path","/api/work/one")),
            Map.entry("fields",java.util.List.of(Map.of("fieldCode","name"))));
        Map<String,Object> contract=Map.of(
            "source",Map.of("type","REQUIREMENT_DOCUMENT"),
            "process",Map.of("processCode","PROCESS_A","steps",java.util.List.of(step)));
        when(governance.lockRequirementImportProcesses(eq("PROCESS_A"),any()))
            .thenReturn(java.util.List.of("PROCESS_A","PROCESS_B"));
        when(governance.createActorForRequirementImport(any(),anyString()))
            .thenReturn(Map.of("success",true,
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

        assertEquals(400,response.getStatusCode().value());
        verify(jdbc,never()).update(org.mockito.ArgumentMatchers.argThat(sql->sql!=null
            &&sql.contains("framework_actor_process_design_release")),any(Object[].class));
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
