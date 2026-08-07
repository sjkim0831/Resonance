package egovframework.com.platform.governance.service;

import egovframework.com.platform.codex.service.CodexProvisioningService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ActorProcessGovernanceServiceScreenContextTest {
    private final JdbcTemplate jdbc=mock(JdbcTemplate.class);
    private final ActorProcessGovernanceService service=new ActorProcessGovernanceService(
        jdbc,mock(ScreenDevelopmentNoteService.class),mock(CodexProvisioningService.class),mock(ScreenContractRuntimeService.class));

    @Test
    void selectsTheExplicitProcessStepAndCanonicalizesTheRoute(){
        stubIdentity();
        when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains("with candidate_source as")),any(Object[].class)))
            .thenReturn(List.of(candidate("PROCESS_A","STEP_A",1),candidate("PROCESS_B","STEP_B",2)));

        Map<String,Object> context=service.screenContext(
            "/en/Emission/Workspace/?tab=summary","","PROJECT-1","process_b","step_b",
            "company_manager","user","save",Set.of("USER","PUBLIC"),"ACCOUNT-1","TENANT-1",true);

        @SuppressWarnings("unchecked") Map<String,Object> identity=(Map<String,Object>)context.get("identity");
        @SuppressWarnings("unchecked") Map<String,Object> workflow=(Map<String,Object>)context.get("workflow");
        assertEquals("/emission/workspace",identity.get("routeKey"));
        assertEquals("PROJECT-1",identity.get("projectId"));
        assertEquals("PROCESS_B",workflow.get("processCode"));
        assertEquals("STEP_B",workflow.get("stepCode"));
        assertEquals("기업 책임자",workflow.get("actorName"));
        assertEquals("",workflow.get("adminPath"));
        assertTrue((Boolean)context.get("linked"));
        assertEquals(2,context.get("candidateCount"));
        assertFalse((Boolean)context.get("selectionRequired"));
        assertEquals("SAVE",identity.get("requestedCapabilityCode"));
    }

    @Test
    void returnsCandidatesWithoutGuessingWhenTheRouteIsAmbiguous(){
        stubIdentity();
        when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains("with candidate_source as")),any(Object[].class)))
            .thenReturn(List.of(candidate("PROCESS_A","STEP_A",1),candidate("PROCESS_B","STEP_B",2)));

        Map<String,Object> context=service.screenContext(
            "/emission/workspace","","","","","","","",Set.of("USER","PUBLIC"),
            "ACCOUNT-1","TENANT-1",true);

        assertNull(context.get("workflow"));
        assertEquals(2,((List<?>)context.get("candidates")).size());
        assertFalse((Boolean)context.get("linked"));
        assertEquals(2,context.get("candidateCount"));
        assertTrue((Boolean)context.get("selectionRequired"));
    }

    @Test
    void returnsAnEmptyMappingWithoutInventingAWorkflow(){
        when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains("with requested(route_key,page_id)")),any(Object[].class)))
            .thenReturn(List.of());
        when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains("with candidate_source as")),any(Object[].class)))
            .thenReturn(List.of());

        Map<String,Object> context=service.screenContext(
            "/unmapped","PAGE-MISSING","","PROCESS_X","STEP_X","","","",Set.of("USER","PUBLIC"),
            "ACCOUNT-1","TENANT-1",true);

        assertNull(context.get("workflow"));
        assertEquals(List.of(),context.get("candidates"));
        assertFalse((Boolean)context.get("linked"));
        assertEquals(0,context.get("candidateCount"));
        assertFalse((Boolean)context.get("selectionRequired"));
    }

    @Test
    void filtersByActorAndAudienceWithoutCollapsingAudienceSpecificBindings(){
        stubIdentity();
        Map<String,Object> userCandidate=candidate("PROCESS_A","STEP_A",1);
        Map<String,Object> adminCandidate=candidate("PROCESS_A","STEP_A",1);
        adminCandidate.put("audience","ADMIN");
        adminCandidate.put("actorCode","OPERATION_ADMIN");
        adminCandidate.put("actorName","운영 관리자");
        adminCandidate.put("adminPath","/admin/emission/workspace");
        when(jdbc.queryForList(argThat(sql->sql!=null
                &&sql.contains("distinct on (process_code,step_code,audience)")
                &&sql.contains("coalesce(nullif(binding.actor_code,''),binding_step.actor_code)")
                &&sql.contains("framework_menu_route_semantic_audit")
                &&sql.contains("menu.verified_at is not null")
                &&sql.contains("semantic.semantic_status in ('EXACT_STEP','SCREEN_CONTRACT')")
                &&sql.contains("semantic.resolved_actor_code=menu.actor_code")
                &&sql.contains("framework_step_capability_binding")),any(Object[].class)))
            .thenReturn(List.of(userCandidate,adminCandidate));

        Map<String,Object> context=service.screenContext(
            "/emission/workspace","","PROJECT-1","PROCESS_A","STEP_A","operation_admin","admin","",
            Set.of("USER","PUBLIC","ADMIN"),"ADMIN-1","TENANT-1",true);

        @SuppressWarnings("unchecked") Map<String,Object> identity=(Map<String,Object>)context.get("identity");
        @SuppressWarnings("unchecked") Map<String,Object> workflow=(Map<String,Object>)context.get("workflow");
        assertEquals("OPERATION_ADMIN",workflow.get("actorCode"));
        assertEquals("ADMIN",workflow.get("audience"));
        assertEquals("",workflow.get("userPath"));
        assertEquals("/admin/emission/workspace",workflow.get("adminPath"));
        assertEquals("ADMIN",identity.get("audience"));
        assertEquals(2,context.get("candidateCount"));
        assertFalse((Boolean)context.get("selectionRequired"));
    }

    @Test
    void excludesAdminCandidatesFromOrdinaryUserAudienceScope(){
        stubIdentity();
        Map<String,Object> adminCandidate=candidate("PROCESS_A","STEP_A",1);
        adminCandidate.put("audience","ADMIN");
        when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains("with candidate_source as")),any(Object[].class)))
            .thenReturn(List.of(candidate("PROCESS_A","STEP_A",1),adminCandidate));

        Map<String,Object> context=service.screenContext(
            "/emission/workspace","","PROJECT-1","","","","","",Set.of("USER","PUBLIC"),
            "ACCOUNT-1","TENANT-1",true);

        @SuppressWarnings("unchecked") Map<String,Object> workflow=(Map<String,Object>)context.get("workflow");
        assertEquals("USER",workflow.get("audience"));
        assertEquals(1,context.get("candidateCount"));
        assertEquals(1,((List<?>)context.get("candidates")).size());
    }

    @Test
    void rejectsActorRequestedOutsideTheAccountsActiveAssignmentScope(){
        stubAllowedActors("COMPANY_MANAGER");

        SecurityException error=assertThrows(SecurityException.class,()->service.screenContext(
            "/emission/workspace","","PROJECT-1","","","VERIFIER","USER","",Set.of("USER","PUBLIC"),
            "OTHER-ACCOUNT","TENANT-1",false));

        assertEquals("SCREEN_CONTEXT_ACTOR_FORBIDDEN",error.getMessage());
    }

    @Test
    void filtersCandidatesByAccountActorScopeEvenWithoutActorInTheUrl(){
        stubAllowedActors("COMPANY_MANAGER");
        stubIdentity();
        Map<String,Object> otherAccountsActor=candidate("PROCESS_B","STEP_B",2);
        otherAccountsActor.put("actorCode","VERIFIER");
        otherAccountsActor.put("actorName","검증 담당자");
        when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains("with candidate_source as")),any(Object[].class)))
            .thenReturn(List.of(candidate("PROCESS_A","STEP_A",1),otherAccountsActor));

        Map<String,Object> context=service.screenContext(
            "/emission/workspace","","PROJECT-1","","","","USER","",Set.of("USER","PUBLIC"),
            "ACCOUNT-1","TENANT-1",false);

        @SuppressWarnings("unchecked") Map<String,Object> workflow=(Map<String,Object>)context.get("workflow");
        assertEquals("COMPANY_MANAGER",workflow.get("actorCode"));
        assertEquals(1,context.get("candidateCount"));
        assertEquals(1,((List<?>)context.get("candidates")).size());
    }

    @Test
    void keepsExecutableClassificationButMarksAnActorScopedRouteAsAccessRestricted(){
        stubIdentity();
        when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains("with candidate_source as")),any(Object[].class)))
            .thenReturn(List.of(candidate("PROCESS_A","STEP_A",1)));

        Map<String,Object> context=service.screenContext(
            "/emission/workspace","","PROJECT-1","","","","USER","",Set.of("USER","PUBLIC"),
            "ACCOUNT-WITHOUT-ACTOR","TENANT-1",false);

        assertEquals("EXECUTABLE",context.get("classification"));
        assertEquals("ACCESS_RESTRICTED",context.get("reasonCode"));
        assertTrue((Boolean)context.get("accessRestricted"));
        assertFalse((Boolean)context.get("linked"));
        assertFalse((Boolean)context.get("selectionRequired"));
        assertEquals(0,context.get("candidateCount"));
    }

    @Test
    void turnsAnExecutablePolicyWithoutABindingIntoAReviewConflict(){
        stubIdentity();
        stubPolicy("EXECUTABLE","VERIFIED_ROUTE","AUTO_APPROVED");
        when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains("with candidate_source as")),any(Object[].class)))
            .thenReturn(List.of());

        Map<String,Object> context=service.screenContext(
            "/emission/workspace","","","","","","USER","",Set.of("USER","PUBLIC"),
            "ACCOUNT-1","TENANT-1",true);

        assertEquals("REVIEW_REQUIRED",context.get("classification"));
        assertEquals("EXECUTABLE_BINDING_MISSING",context.get("reasonCode"));
        assertEquals("CONFLICT",context.get("reviewStatus"));
        assertFalse((Boolean)context.get("linked"));
    }

    @Test
    void rejectsAnExecutableBindingWhenTheRoutePolicyIsInformational(){
        stubIdentity();
        stubPolicy("INFORMATIONAL","INFORMATION_ONLY","APPROVED");
        when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains("with candidate_source as")),any(Object[].class)))
            .thenReturn(List.of(candidate("PROCESS_A","STEP_A",1)));

        Map<String,Object> context=service.screenContext(
            "/emission/workspace","","","","","","USER","",Set.of("USER","PUBLIC"),
            "ACCOUNT-1","TENANT-1",true);

        assertEquals("REVIEW_REQUIRED",context.get("classification"));
        assertEquals("POLICY_BINDING_CONFLICT",context.get("reasonCode"));
        assertEquals("CONFLICT",context.get("reviewStatus"));
        assertFalse((Boolean)context.get("linked"));
    }

    private void stubAllowedActors(String... actorCodes){
        when(jdbc.queryForList(argThat(sql->sql!=null
                &&sql.contains("from framework_account_actor_assignment")
                &&sql.contains("project_id='*'")
                &&sql.contains("valid_from is null")
                &&sql.contains("valid_until is null")),any(Object[].class)))
            .thenReturn(java.util.Arrays.stream(actorCodes)
                .map(actorCode->Map.<String,Object>of("actorCode",actorCode))
                .toList());
    }

    private void stubPolicy(String classification,String reasonCode,String reviewStatus){
        when(jdbc.queryForObject(argThat(sql->sql!=null&&sql.contains("to_regclass('public.framework_screen_workflow_policy')")),eq(Boolean.class)))
            .thenReturn(true);
        when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains("from framework_screen_workflow_policy")),any(Object[].class)))
            .thenReturn(List.of(Map.of(
                "classification",classification,
                "reasonCode",reasonCode,
                "reasonText","정책 설명",
                "reviewStatus",reviewStatus)));
    }

    private void stubIdentity(){
        when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains("with requested(route_key,page_id)")),any(Object[].class)))
            .thenReturn(List.of(Map.of(
                "routeKey","/emission/workspace",
                "canonicalRoutePath","/emission/workspace",
                "pageId","emission-workspace",
                "screenResourceId",31L,
                "screenName","배출량 업무 작업공간",
                "screenType","WORKSPACE",
                "implementationStatus","VERIFIED")));
    }

    private Map<String,Object> candidate(String processCode,String stepCode,int stepOrder){
        Map<String,Object> row=new LinkedHashMap<>();
        row.put("workTypeCode","EMISSION");row.put("workTypeName","탄소배출 관리");
        row.put("processCode",processCode);row.put("processName",processCode+" 이름");
        row.put("stepCode",stepCode);row.put("stepName",stepCode+" 이름");row.put("stepOrder",stepOrder);
        row.put("actorCode","COMPANY_MANAGER");row.put("actorName","기업 책임자");
        row.put("workPurpose","업무 목적");row.put("completionRule","완료 조건");
        row.put("inputContract","{}");row.put("outputContract","{}");
        row.put("userPath","/emission/workspace");row.put("adminPath","/admin/hidden");
        row.put("automationStatus","VERIFIED");row.put("audience","USER");row.put("entryMode","PRIMARY");
        row.put("resolutionSource","SCREEN_BINDING");
        return row;
    }
}
