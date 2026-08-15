package egovframework.com.platform.governance.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.inOrder;
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
        when(governance.createActorForRequirementImport(any(),anyString()))
            .thenReturn(Map.of("success",true,"affectedProcessCodes",java.util.List.of()));
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
                "jobCount",1,"generationQueued",true)));
        String checksum=canonicalChecksum(contract);
        TransactionSynchronizationManager.initSynchronization();

        var response=controller.applyDesignRelease("secret-token",Map.of(
            "projectId","PROJECT_A","designVersion",1,
            "contractSha256",checksum,"contract",contract));

        assertEquals(200,response.getStatusCode().value());
        var order=inOrder(governance);
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
        verify(governance,never()).createProcess(any(),anyString());
        verify(governance,never()).addStep(any(),anyString());
    }

    private String canonicalChecksum(Object contract) throws Exception {
        String canonical=mapper.writer()
            .with(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
            .writeValueAsString(contract);
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
            .digest(canonical.getBytes(StandardCharsets.UTF_8)));
    }

    private static <T> T eq(T value){return org.mockito.ArgumentMatchers.eq(value);}
}
