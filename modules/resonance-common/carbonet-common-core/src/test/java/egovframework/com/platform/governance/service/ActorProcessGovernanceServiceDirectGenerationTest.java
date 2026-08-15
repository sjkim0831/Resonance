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
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockingDetails;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ActorProcessGovernanceServiceDirectGenerationTest {
    private static final String PROCESS="PROCESS_A";
    private static final String STEP="STEP_A";
    private static final String ROUTE="/design/route";
    private static final String DESIGN_HASH="d".repeat(64);
    private static final String SOURCE_HASH="s".replace('s','a').repeat(64);
    private static final String DESIGN_SET_HASH="e".repeat(64);

    @Test
    void structuredContractRefreshQueuesExistingFullStackWorkerWithExactHeads(){
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        ActorProcessGovernanceService service=service(jdbc);
        when(jdbc.queryForObject(argThat(sql->sql!=null&&sql.contains("framework_canonical_screen_bundle")
                &&sql.contains("designHash")),eq(String.class),any(Object[].class)))
            .thenReturn(DESIGN_HASH);
        stubRefreshAndCoverage(jdbc);
        when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains("contract_source as materialized")),any(Object[].class)))
            .thenReturn(List.of(Map.of("endpointExpected",2)));
        when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains("framework_process_generation_input(?::text)")
                &&sql.contains("generationReadyStepCount")),any(Object[].class)))
            .thenReturn(List.of(head(SOURCE_HASH)));
        when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains("job_type='FULL_STACK_GENERATION'")
                &&sql.contains("for update")),any(Object[].class))).thenReturn(List.of());
        when(jdbc.queryForObject(argThat(sql->sql!=null&&sql.contains("insert into framework_development_job")),
                eq(Long.class),any(Object[].class))).thenReturn(77L);
        when(jdbc.queryForObject(argThat(sql->sql!=null&&sql.contains("framework_process_artifact")
                &&sql.contains("count(*)")),eq(Integer.class),any(Object[].class))).thenReturn(0);
        when(jdbc.queryForObject(argThat(sql->sql!=null&&sql.contains("framework_development_job")
                &&sql.contains("job_group_code=?")&&sql.contains("count(*)")),
                eq(Integer.class),any(Object[].class))).thenReturn(1);

        Map<String,Object> result=service.executeDesignDirectDevelopment(request(DESIGN_HASH),"system-admin");

        assertEquals(true,result.get("generationQueued"));
        assertEquals(1,result.get("jobCount"));
        assertEquals(2,result.get("endpointExpected"));
        assertEquals(DESIGN_HASH,result.get("designHash"));
        assertEquals(SOURCE_HASH,result.get("sourceHash"));
        assertEquals(DESIGN_SET_HASH,result.get("designSetHash"));
        assertEquals(0,result.get("publishCount"));
        verify(jdbc).queryForList(argThat(sql->sql!=null&&sql.contains("framework_step_permission_requirements(?,?)")
                &&sql.contains("screen_contract=screens.value")
                &&sql.contains("field_contract=jsonb_build_object")
                &&sql.contains("command_contract=commands.value")
                &&sql.contains("api_contract=apis.value")
                &&sql.contains("'templateCode',template_code")
                &&sql.contains("'layout',layout_code")
                &&sql.contains("'theme',theme_code")
                &&sql.contains("transition_status='CONTRACT_LINKED'")
                &&sql.contains("professional_screen_contract:")
                &&!sql.contains("from framework_permission_requirement_v1")
                &&!sql.contains("framework_permission_grant_v1")
                &&!sql.contains("framework_account_assignment")),any(Object[].class));
        verify(jdbc).queryForObject(argThat(sql->sql!=null&&sql.contains("insert into framework_development_job")
                &&sql.contains("FULL_STACK_GENERATION")&&sql.contains("'PLANNED','APPROVED'")),
            eq(Long.class),any(Object[].class));
        var enqueue=mockingDetails(jdbc).getInvocations().stream()
            .filter(call->call.getMethod().getName().equals("queryForObject")
                &&call.getArguments().length>5
                &&String.valueOf(call.getArguments()[0]).contains("insert into framework_development_job"))
            .findFirst().orElseThrow();
        String target=String.valueOf(enqueue.getArguments()[4]);
        String specification=String.valueOf(enqueue.getArguments()[5]);
        assertEquals("canonical://"+PROCESS+"/"+SOURCE_HASH,target);
        assertTrue(specification.contains("\"sourceHash\":\""+SOURCE_HASH+"\""));
        assertTrue(specification.contains("\"processInputHash\":\""+SOURCE_HASH+"\""));
        assertTrue(specification.contains("\"processStepCount\":1"));
        assertTrue(specification.contains("\"coordinatorStep\":\""+STEP+"\""));
        assertTrue(specification.contains("\"designHash\":\""+DESIGN_HASH+"\""));
        assertTrue(specification.contains("\"autoDeploy\":false"));
    }

    @Test
    void workerHeadCheckBindsTheClaimedReceiptToTheCurrentJobRow() throws Exception {
        String worker=Files.readString(findRepositoryFile(
            "ops/scripts/run-process-development-worker.sh"));

        assertTrue(worker.contains("(.designSetHash|type==\"string\""));
        assertTrue(worker.contains("j.spec->>'sourceHash'='${receipt_source_hash}'"));
        assertTrue(worker.contains("j.spec->>'designHash'='${receipt_design_hash}'"));
        assertTrue(worker.contains("j.spec->>'designSetHash'='${receipt_design_set_hash}'"));
    }

    @Test
    void staleDesignHeadFailsBeforeSpecRefreshOrJobPublication(){
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        ActorProcessGovernanceService service=service(jdbc);
        when(jdbc.queryForObject(argThat(sql->sql!=null&&sql.contains("framework_canonical_screen_bundle")),
                eq(String.class),any(Object[].class))).thenReturn("f".repeat(64));

        IllegalStateException error=assertThrows(IllegalStateException.class,
            ()->service.executeDesignDirectDevelopment(request(DESIGN_HASH),"system-admin"));

        assertEquals("STALE_CANONICAL_DESIGN_HASH",error.getMessage());
        verify(jdbc,never()).queryForList(argThat(sql->sql!=null&&sql.contains("contract_source as materialized")),
            any(Object[].class));
        verify(jdbc,never()).queryForObject(argThat(sql->sql!=null&&sql.contains("insert into framework_development_job")),
            eq(Long.class),any(Object[].class));
    }

    @Test
    void malformedStructuredProjectionFailsClosedWithoutEnqueue(){
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        ActorProcessGovernanceService service=service(jdbc);
        when(jdbc.queryForObject(argThat(sql->sql!=null&&sql.contains("framework_canonical_screen_bundle")),
                eq(String.class),any(Object[].class))).thenReturn(DESIGN_HASH);
        stubRefreshAndCoverage(jdbc);
        when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains("contract_source as materialized")),
                any(Object[].class))).thenReturn(List.of());

        IllegalStateException error=assertThrows(IllegalStateException.class,
            ()->service.executeDesignDirectDevelopment(request(DESIGN_HASH),"system-admin"));

        assertTrue(error.getMessage().contains("STRUCTURED_GENERATION_SPEC_NOT_EXACT"));
        verify(jdbc,never()).queryForObject(argThat(sql->sql!=null&&sql.contains("insert into framework_development_job")),
            eq(Long.class),any(Object[].class));
    }

    @Test
    void md5ProcessInputHeadIsRejectedBeforeQueuePublication(){
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        ActorProcessGovernanceService service=service(jdbc);
        when(jdbc.queryForObject(argThat(sql->sql!=null&&sql.contains("framework_canonical_screen_bundle")),
                eq(String.class),any(Object[].class))).thenReturn(DESIGN_HASH);
        stubRefreshAndCoverage(jdbc);
        when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains("contract_source as materialized")),
                any(Object[].class))).thenReturn(List.of(Map.of("endpointExpected",2)));
        when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains("framework_process_generation_input(?::text)")),
                any(Object[].class))).thenReturn(List.of(head("a".repeat(32))));

        IllegalStateException error=assertThrows(IllegalStateException.class,
            ()->service.executeDesignDirectDevelopment(request(DESIGN_HASH),"system-admin"));

        assertEquals("CANONICAL_SOURCE_HASH_INVALID",error.getMessage());
        verify(jdbc,never()).queryForObject(argThat(sql->sql!=null&&sql.contains("insert into framework_development_job")),
            eq(Long.class),any(Object[].class));
    }

    private static ActorProcessGovernanceService service(JdbcTemplate jdbc){
        return new ActorProcessGovernanceService(jdbc,mock(ScreenDevelopmentNoteService.class),
            mock(CodexProvisioningService.class),mock(ScreenContractRuntimeService.class));
    }

    private static void stubRefreshAndCoverage(JdbcTemplate jdbc){
        when(jdbc.queryForObject(argThat(sql->sql!=null
                &&sql.contains("framework_refresh_process_execution_specs")),
                eq(String.class),any(Object[].class)))
            .thenReturn("{\"processCode\":\"PROCESS_A\",\"refreshedStepCount\":1}");
        when(jdbc.queryForMap(argThat(sql->sql!=null
                &&sql.contains("definedStepCount")&&sql.contains("canonicalJobCount")),
                any(Object[].class))).thenReturn(Map.of(
                    "definedStepCount",1,"specStepCount",1,
                    "generationReadyStepCount",1,"canonicalJobCount",0));
    }

    private static Map<String,Object> request(String designHash){
        return Map.of("processCode",PROCESS,"stepCode",STEP,"routePath",ROUTE,
            "audience","USER","designHash",designHash);
    }

    private static Map<String,Object> head(String sourceHash){
        return Map.ofEntries(
            Map.entry("sourceHash",sourceHash),Map.entry("designSetHash",DESIGN_SET_HASH),
            Map.entry("coordinatorStep",STEP),Map.entry("processStepCount",1),
            Map.entry("generationReadyStepCount",1),Map.entry("processEndpointExpected",2),
            Map.entry("designCount",1),Map.entry("updatedCount",1),
            Map.entry("designCatalogHash","b".repeat(64)),
            Map.entry("designCatalogTextHash","c".repeat(64)),
            Map.entry("endpointCatalogHash","f".repeat(64)),
            Map.entry("endpointCatalogTextHash","9".repeat(64)));
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
