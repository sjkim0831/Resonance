package egovframework.com.platform.governance;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import egovframework.com.platform.governance.service.ScreenDevelopmentNoteService;
import egovframework.com.platform.governance.service.ScreenContractRuntimeService;
import egovframework.com.platform.codex.service.CodexProvisioningService;
import egovframework.com.platform.governance.web.ActorProcessGovernanceApiController;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.*;

class ActorProcessRevisionHistoryApiTest {
    private final ActorProcessGovernanceService service=mock(ActorProcessGovernanceService.class);
    private final CurrentUserContextService users=mock(CurrentUserContextService.class);
    private final HttpServletRequest request=mock(HttpServletRequest.class);
    private final ActorProcessGovernanceApiController controller=new ActorProcessGovernanceApiController(service,users,"");

    @Test
    void requiresAuthenticationForRevisionHistory(){
        when(users.resolve(request)).thenReturn(context(false,""));
        ResponseEntity<?> response=controller.processRevisionHistory("PROC_ALPHA",50,request);
        assertEquals(401,response.getStatusCode().value());
        verifyNoInteractions(service);
    }

    @Test
    void deniesAuthenticatedNonAdministrator(){
        when(users.resolve(request)).thenReturn(context(true,"ROLE_USER"));
        ResponseEntity<?> response=controller.processRevisionHistory("PROC_ALPHA",50,request);
        assertEquals(403,response.getStatusCode().value());
        verifyNoInteractions(service);
    }

    @Test
    void allowsSystemAdministratorAndDelegatesLimitForServiceClamping(){
        when(users.resolve(request)).thenReturn(context(true,"ROLE_SYSTEM_ADMIN"));
        Map<String,Object> history=Map.of("processCode","PROC_ALPHA","limit",50,"revisions",List.of());
        when(service.processRevisionHistory("PROC_ALPHA",50)).thenReturn(history);
        ResponseEntity<?> response=controller.processRevisionHistory("PROC_ALPHA",500,request);
        assertEquals(200,response.getStatusCode().value());
        verify(service).processRevisionHistory("PROC_ALPHA",500);
    }

    @Test
    void rejectsInvalidProcessCodeBeforeDatabaseQuery(){
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        ActorProcessGovernanceService reader=new ActorProcessGovernanceService(
            jdbc,mock(ScreenDevelopmentNoteService.class),mock(CodexProvisioningService.class),mock(ScreenContractRuntimeService.class));
        assertThrows(IllegalArgumentException.class,()->reader.processRevisionHistory("bad-code",10));
        verifyNoInteractions(jdbc);
    }

    @Test
    void returnsReadOnlyProcessSnapshotsWithLimitClampedToOneHundred(){
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        ActorProcessGovernanceService reader=new ActorProcessGovernanceService(
            jdbc,mock(ScreenDevelopmentNoteService.class),mock(CodexProvisioningService.class),mock(ScreenContractRuntimeService.class));
        when(jdbc.queryForObject(contains("framework_process_definition"),eq(Integer.class),eq("PROC_ALPHA"))).thenReturn(1);
        when(jdbc.queryForList(anyString(),eq("PROC_ALPHA"),eq(100))).thenReturn(List.of(
            Map.of("revisionId",8,"revisionReason","second","actor","admin","createdAt","2026-09-27","snapshot","{\"definition\":{\"process_version\":\"2\",\"process_name\":\"Changed\"},\"steps\":[{\"step_code\":\"S1\",\"step_name\":\"Changed Step\",\"step_order\":1},{\"step_code\":\"S2\",\"step_name\":\"Added Step\",\"step_order\":2}],\"executionSpecs\":[]}"),
            Map.of("revisionId",7,"revisionReason","first","actor","admin","createdAt","2026-09-26","snapshot","{\"definition\":{\"process_version\":\"1\",\"process_name\":\"Initial\"},\"steps\":[{\"step_code\":\"S1\",\"step_name\":\"Initial Step\",\"step_order\":1},{\"step_code\":\"S3\",\"step_name\":\"Removed Step\",\"step_order\":3}],\"executionSpecs\":[]}")
        ));
        Map<String,Object> result=reader.processRevisionHistory("proc_alpha",900);
        assertEquals(100,result.get("limit"));
        @SuppressWarnings("unchecked") List<Map<String,Object>> revisions=(List<Map<String,Object>>)result.get("revisions");
        assertEquals("1",revisions.get(0).get("beforeProcessVersion"));
        assertEquals("2",revisions.get(0).get("afterProcessVersion"));
        @SuppressWarnings("unchecked") List<String> fields=(List<String>)revisions.get(0).get("changedFields");
        org.junit.jupiter.api.Assertions.assertTrue(fields.contains("definition.process_name"));
        org.junit.jupiter.api.Assertions.assertTrue(fields.contains("definition.process_version"));
        org.junit.jupiter.api.Assertions.assertTrue(fields.contains("STEP_ADDED:S2"));
        org.junit.jupiter.api.Assertions.assertTrue(fields.contains("STEP_MODIFIED:S1"));
        org.junit.jupiter.api.Assertions.assertTrue(fields.contains("STEP_REMOVED_FROM_SNAPSHOT:S3"));
        verify(jdbc,never()).update(anyString(),org.mockito.ArgumentMatchers.<Object[]>any());
    }

    @Test
    void stepContractSaveUsesCanonicalRevisionSnapshotsWithoutMissingAuditTable(){
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        ActorProcessGovernanceService writer=new ActorProcessGovernanceService(
            jdbc,mock(ScreenDevelopmentNoteService.class),mock(CodexProvisioningService.class),mock(ScreenContractRuntimeService.class));
        when(jdbc.queryForMap(contains("for update"),eq("PROC_ALPHA"))).thenReturn(Map.of("process_version","1"));
        when(jdbc.queryForObject(contains("framework_process_structure_hash"),eq(String.class),eq("PROC_ALPHA")))
            .thenReturn("hash-before","hash-after");
        when(jdbc.queryForObject(contains("select count(*) from framework_process_step"),eq(Integer.class),eq("PROC_ALPHA"),eq("STEP_ONE")))
            .thenReturn(1);
        when(jdbc.queryForObject(contains("jsonb_build_object"),eq(String.class),anyString(),anyString(),anyString(),anyString(),anyString()))
            .thenReturn("{\"definition\":{},\"steps\":[],\"executionSpecs\":[]}","{\"definition\":{},\"steps\":[],\"executionSpecs\":[]}");
        when(jdbc.queryForObject(contains("framework_begin_process_design_revision"),eq(String.class),eq("PROC_ALPHA"),eq("admin")))
            .thenReturn("{}");
        when(jdbc.queryForObject(contains("framework_finalize_process_design_revision"),eq(String.class),eq("PROC_ALPHA"),eq("admin")))
            .thenReturn("{}");
        when(jdbc.queryForObject(eq("select process_version from framework_process_definition where process_code=?"),eq(String.class),eq("PROC_ALPHA")))
            .thenReturn("2");
        Map<String,Object> result=writer.updateStepContract("PROC_ALPHA","STEP_ONE",
            Map.of("inputContract","{}","revisionReason","input contract correction","expectedProcessVersion","1"),"admin");
        assertEquals("2",result.get("processVersion"));
        verify(jdbc).queryForObject(contains("framework_begin_process_design_revision"),eq(String.class),eq("PROC_ALPHA"),eq("admin"));
        verify(jdbc).queryForObject(contains("framework_finalize_process_design_revision"),eq(String.class),eq("PROC_ALPHA"),eq("admin"));
        verify(jdbc,never()).update(contains("framework_process_step_revision_audit"),org.mockito.ArgumentMatchers.<Object[]>any());
    }

    private CurrentUserContextService.CurrentUserContext context(boolean authenticated,String authority){
        var context=new CurrentUserContextService.CurrentUserContext();
        context.setAuthenticated(authenticated);
        context.setUserId(authenticated?"revision-admin":"");
        context.setAuthorCode(authority);
        return context;
    }
}
