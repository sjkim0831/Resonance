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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockingDetails;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ActorProcessGovernanceMutationPropagationTest {

    @Test
    void incompleteAddStepRefreshesSpecsAndSkipsWithoutLegacyFanout() throws Exception {
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        ActorProcessGovernanceService service=service(jdbc);
        when(jdbc.queryForObject(argThat(sql->sql!=null&&sql.contains("framework_process_definition where process_code")),
            eq(Integer.class),any(Object[].class))).thenReturn(1);
        when(jdbc.queryForObject(argThat(sql->sql!=null&&sql.contains("framework_actor_definition where actor_code")),
            eq(Integer.class),any(Object[].class))).thenReturn(1);
        when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains("select step_order")&&sql.contains("for update")),
            any(Object[].class))).thenReturn(List.of());
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

    private static void stubSkippedRefresh(JdbcTemplate jdbc,int defined,int specs,int ready){
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
