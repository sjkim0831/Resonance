package egovframework.com.feature.home.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.BadSqlGrammarException;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

class EmissionProjectRegistryServiceTest {

    @Test
    void springContextSelectsTheProductionDataSourceConstructors() {
        DataSource dataSource = mock(DataSource.class);
        ActorProcessGovernanceService governanceService = mock(ActorProcessGovernanceService.class);
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.registerBean(DataSource.class, () -> dataSource);
            context.registerBean(ActorProcessGovernanceService.class, () -> governanceService);
            context.register(ScopeAccessAuditService.class, EmissionProjectRegistryService.class);

            assertDoesNotThrow(context::refresh);
            assertNotNull(context.getBean(ScopeAccessAuditService.class));
            assertNotNull(context.getBean(EmissionProjectRegistryService.class));
        }
    }

    @Test
    void enrichCompletionReadinessUsesProjectedTaskCodeWithoutReloadingDeletedTask() {
        DataSource dataSource = mock(DataSource.class);
        ActorProcessGovernanceService governanceService = mock(ActorProcessGovernanceService.class);
        ScopeAccessAuditService auditService = mock(ScopeAccessAuditService.class);
        EmissionProjectRegistryService service = new EmissionProjectRegistryService(dataSource, governanceService, auditService);
        Map<String, Object> projectedTask = new LinkedHashMap<>();
        projectedTask.put("id", 987654321L);
        projectedTask.put("projectId", "PRJ-ALREADY-CLEANED");
        projectedTask.put("taskCode", "EXTENSION_STEP");
        projectedTask.put("pendingPredecessors", "");
        projectedTask.put("actionable", true);

        assertDoesNotThrow(() -> service.enrichCompletionReadiness(projectedTask));

        assertEquals("EXTENSION_STEP", projectedTask.get("taskCode"));
        assertFalse((Boolean) projectedTask.get("completionSatisfied"));
        assertNotNull(projectedTask.get("completionEvidence"));
        assertTrue((Boolean) projectedTask.get("actionable"));
        verifyNoInteractions(dataSource);
    }

    @Test
    void onboardingReadinessDoesNotTreatPendingCompanyAsApproved() {
        assertFalse(EmissionProjectRegistryService.isApprovedInstitutionStatus("A"));
        assertFalse(EmissionProjectRegistryService.isApprovedInstitutionStatus("pending"));
        assertFalse(EmissionProjectRegistryService.isApprovedInstitutionStatus(null));
        assertTrue(EmissionProjectRegistryService.isApprovedInstitutionStatus("P"));
        assertTrue(EmissionProjectRegistryService.isApprovedInstitutionStatus("approved"));
        assertTrue(EmissionProjectRegistryService.isApprovedInstitutionStatus(" ACTIVE "));
        assertTrue(EmissionProjectRegistryService.isApprovedInstitutionStatus("Y"));
    }

    @Test
    void regulatoryAcceptWrongActorAuditsExactlyOnceBeforeAnyBusinessWrite() throws Exception {
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        ActorProcessGovernanceService governanceService=mock(ActorProcessGovernanceService.class);
        ScopeAccessAuditService auditService=mock(ScopeAccessAuditService.class);
        EmissionProjectRegistryService service=new EmissionProjectRegistryService(jdbc,governanceService,auditService);
        when(jdbc.queryForObject(contains("FROM emission_project_registry WHERE project_id=? AND tenant_id=?"),eq(Integer.class),any(Object[].class)))
                .thenReturn(1);
        when(jdbc.queryForObject(contains("FROM framework_account_actor_assignment"),eq(Integer.class),any(Object[].class)))
                .thenReturn(0);

        SecurityException denial=assertThrows(SecurityException.class,() -> service.transitionRegulatorySubmission(
                "PRJ-1",77L,"TENANT-1","wrong.actor",false,Map.of("action","ACCEPT")));

        assertEquals("ACTOR_NOT_AUTHORIZED:APPROVER|VERIFIER",denial.getMessage());
        verify(auditService,times(1)).recordDenied(
                "wrong.actor","TENANT-1","PRJ-1",
                ScopeAccessAuditService.ActionCode.REGULATORY_SUBMISSION_TRANSITION,
                ScopeAccessAuditService.ResourceType.REGULATORY_SUBMISSION,
                "ACTOR_NOT_AUTHORIZED:APPROVER|VERIFIER");
        verify(jdbc,never()).queryForList(contains("FROM emission_regulatory_submission"),any(Object[].class));
        verify(jdbc,never()).update(anyString(),any(Object[].class));
        assertNotNull(EmissionProjectRegistryService.class
                .getMethod("transitionRegulatorySubmission",String.class,long.class,String.class,String.class,boolean.class,Map.class)
                .getAnnotation(Transactional.class));
    }

    @Test
    void regulatoryTransitionWrongTenantAuditsProjectDenialExactlyOnce() {
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        ScopeAccessAuditService auditService=mock(ScopeAccessAuditService.class);
        EmissionProjectRegistryService service=new EmissionProjectRegistryService(
                jdbc,mock(ActorProcessGovernanceService.class),auditService);
        when(jdbc.queryForObject(contains("FROM emission_project_registry WHERE project_id=? AND tenant_id=?"),eq(Integer.class),any(Object[].class)))
                .thenReturn(0);

        SecurityException denial=assertThrows(SecurityException.class,() -> service.transitionRegulatorySubmission(
                "PRJ-OTHER",77L,"TENANT-1","wrong.actor",false,Map.of("action","ACCEPT")));

        assertEquals("PROJECT_TENANT_SCOPE_DENIED",denial.getMessage());
        verify(auditService,times(1)).recordDenied(
                "wrong.actor","TENANT-1","PRJ-OTHER",
                ScopeAccessAuditService.ActionCode.REGULATORY_SUBMISSION_TRANSITION,
                ScopeAccessAuditService.ResourceType.REGULATORY_SUBMISSION,
                "PROJECT_TENANT_SCOPE_DENIED");
        verify(jdbc,never()).queryForObject(contains("FROM framework_account_actor_assignment"),eq(Integer.class),any(Object[].class));
        verify(jdbc,never()).update(anyString(),any(Object[].class));
    }

    @Test
    void canonicalSupportBatchEnrichesPresentAndIsolatesAbsentAndMalformedWithoutNPlusOne() throws Exception {
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        EmissionProjectRegistryService service=new EmissionProjectRegistryService(
                jdbc,mock(ActorProcessGovernanceService.class),mock(ScopeAccessAuditService.class));
        String designHash="a".repeat(64),catalogHash="b".repeat(64);
        Map<String,Object> validSupport=canonicalSupport(designHash,catalogHash,"/work/current");
        Map<String,Object> validRow=publishedSupportRow("/work/current","PROCESS_A","STEP_A",validSupport,designHash,catalogHash);
        Map<String,Object> malformedRow=publishedSupportRow("/work/broken","PROCESS_B","STEP_B",Map.of("schemaVersion","wrong"),designHash,catalogHash);
        when(jdbc.queryForList(contains("with requested(route_path) as (values"),any(Object[].class)))
                .thenReturn(List.of(validRow,malformedRow));

        Map<String,Object> present=task("/work/current?projectId=PRJ-1","PROCESS_A","STEP_A");
        present.put("nextTaskName","Review result");
        present.put("nextActorCode","VERIFIER");
        present.put("nextTaskUrl","/work/review?projectId=PRJ-1");
        Map<String,Object> absent=task("/work/absent","PROCESS_X","STEP_X");
        Map<String,Object> malformed=task("/work/broken","PROCESS_B","STEP_B");
        List<Map<String,Object>> tasks=new ArrayList<>(List.of(present,absent,malformed));

        Map<String,Object> summary=service.enrichCanonicalDesignSupport(tasks);

        assertEquals("PRESENT",present.get("canonicalSupportStatus"));
        assertEquals(designHash,present.get("designHash"));
        assertEquals("Canonical purpose",present.get("workPurpose"));
        assertEquals("Canonical completion",present.get("completionRule"));
        assertEquals("Canonical step",present.get("name"));
        @SuppressWarnings("unchecked")
        Map<String,Object> synchronizedGuide=(Map<String,Object>)present.get("workGuide");
        @SuppressWarnings("unchecked")
        Map<String,Object> synchronizedNext=(Map<String,Object>)synchronizedGuide.get("nextAction");
        assertEquals("/work/review",synchronizedNext.get("routePath"));
        assertEquals("Review result",synchronizedNext.get("label"));
        assertEquals("WORKFLOW_NEXT_TASK",synchronizedNext.get("source"));
        @SuppressWarnings("unchecked")
        Map<String,Object> immutableSupport=(Map<String,Object>)present.get("support");
        @SuppressWarnings("unchecked")
        Map<String,Object> supportedGuide=(Map<String,Object>)immutableSupport.get("workGuide");
        @SuppressWarnings("unchecked")
        Map<String,Object> supportedLanes=(Map<String,Object>)immutableSupport.get("lanes");
        assertEquals(synchronizedGuide,supportedGuide);
        assertEquals(synchronizedGuide,supportedLanes.get("WORK_GUIDE"));
        assertEquals("/work/review",((Map<?,?>)supportedGuide.get("nextAction")).get("routePath"));
        assertEquals("ABSENT",absent.get("canonicalSupportStatus"));
        assertEquals("PUBLISHED_SUPPORT_NOT_FOUND",absent.get("canonicalSupportReason"));
        assertFalse(absent.containsKey("support"));
        assertEquals("INVALID",malformed.get("canonicalSupportStatus"));
        assertEquals("PUBLISHED_SUPPORT_HASH_OR_LANE_INVALID",malformed.get("canonicalSupportReason"));
        assertFalse(malformed.containsKey("support"));
        assertEquals(1,summary.get("queryCount"));
        assertEquals(1L,summary.get("presentCount"));
        assertEquals(1L,summary.get("absentCount"));
        assertEquals(1L,summary.get("invalidCount"));
        assertEquals(1,summary.get("malformedPublishedRowCount"));
        verify(jdbc,times(1)).queryForList(contains("with requested(route_path) as (values"),any(Object[].class));
        verifyNoMoreInteractions(jdbc);
    }

    @Test
    void canonicalSupportAllowsJointlyEmptyCatalogHashAndRemovesCurrentRouteForTerminalTask() throws Exception {
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        EmissionProjectRegistryService service=new EmissionProjectRegistryService(
                jdbc,mock(ActorProcessGovernanceService.class),mock(ScopeAccessAuditService.class));
        String designHash="c".repeat(64);
        Map<String,Object> support=canonicalSupport(designHash,null,"/work/terminal");
        when(jdbc.queryForList(contains("with requested(route_path) as (values"),any(Object[].class)))
                .thenReturn(List.of(publishedSupportRow("/work/terminal","PROCESS_T","STEP_T",support,designHash,null)));
        Map<String,Object> terminal=task("/work/terminal?projectId=PRJ-2","PROCESS_T","STEP_T");

        Map<String,Object> summary=service.enrichCanonicalDesignSupport(new ArrayList<>(List.of(terminal)));

        assertEquals("PRESENT",terminal.get("canonicalSupportStatus"));
        assertNull(terminal.get("catalogHash"));
        @SuppressWarnings("unchecked")
        Map<String,Object> guide=(Map<String,Object>)terminal.get("workGuide");
        @SuppressWarnings("unchecked")
        Map<String,Object> next=(Map<String,Object>)guide.get("nextAction");
        assertFalse(next.containsKey("routePath"));
        assertEquals("WORKFLOW_TERMINAL_OR_UNROUTED",next.get("source"));
        assertEquals(1L,summary.get("presentCount"));
        assertEquals(0L,summary.get("invalidCount"));
        verify(jdbc,times(1)).queryForList(contains("with requested(route_path) as (values"),any(Object[].class));
        verifyNoMoreInteractions(jdbc);
    }

    @Test
    void canonicalSupportRequiresExactlyOneUserAudienceCandidate() throws Exception {
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        EmissionProjectRegistryService service=new EmissionProjectRegistryService(
                jdbc,mock(ActorProcessGovernanceService.class),mock(ScopeAccessAuditService.class));
        String adminHash="d".repeat(64),userHash="e".repeat(64),duplicateHash="f".repeat(64),catalogHash="1".repeat(64);
        Map<String,Object> adminOnly=canonicalSupport(adminHash,catalogHash,"/work/admin-only");
        Map<String,Object> mixedAdmin=canonicalSupport(adminHash,catalogHash,"/work/mixed");
        Map<String,Object> mixedUser=canonicalSupport(userHash,catalogHash,"/work/mixed");
        Map<String,Object> duplicateUserOne=canonicalSupport(userHash,catalogHash,"/work/duplicate");
        Map<String,Object> duplicateUserTwo=canonicalSupport(duplicateHash,catalogHash,"/work/duplicate");
        when(jdbc.queryForList(contains("with requested(route_path) as (values"),any(Object[].class)))
                .thenReturn(List.of(
                        publishedSupportRow("/work/admin-only","PROCESS_A","STEP_A",adminOnly,adminHash,catalogHash,"ADMIN"),
                        publishedSupportRow("/work/mixed","PROCESS_M","STEP_M",mixedAdmin,adminHash,catalogHash,"ADMIN"),
                        publishedSupportRow("/work/mixed","PROCESS_M","STEP_M",mixedUser,userHash,catalogHash,"USER"),
                        publishedSupportRow("/work/duplicate","PROCESS_D","STEP_D",duplicateUserOne,userHash,catalogHash,"USER"),
                        publishedSupportRow("/work/duplicate","PROCESS_D","STEP_D",duplicateUserTwo,duplicateHash,catalogHash,"USER")));
        Map<String,Object> adminOnlyTask=task("/work/admin-only","PROCESS_A","STEP_A");
        Map<String,Object> mixedTask=task("/work/mixed","PROCESS_M","STEP_M");
        Map<String,Object> duplicateTask=task("/work/duplicate","PROCESS_D","STEP_D");

        Map<String,Object> summary=service.enrichCanonicalDesignSupport(
                new ArrayList<>(List.of(adminOnlyTask,mixedTask,duplicateTask)));

        assertEquals("ABSENT",adminOnlyTask.get("canonicalSupportStatus"));
        assertEquals("PUBLISHED_USER_SUPPORT_NOT_FOUND",adminOnlyTask.get("canonicalSupportReason"));
        assertFalse(adminOnlyTask.containsKey("support"));
        assertEquals("PRESENT",mixedTask.get("canonicalSupportStatus"));
        assertEquals(userHash,mixedTask.get("designHash"));
        assertEquals("INVALID",duplicateTask.get("canonicalSupportStatus"));
        assertEquals("PUBLISHED_SUPPORT_IDENTITY_DUPLICATE",duplicateTask.get("canonicalSupportReason"));
        assertEquals(1L,summary.get("presentCount"));
        assertEquals(1L,summary.get("absentCount"));
        assertEquals(1L,summary.get("invalidCount"));
        verify(jdbc,times(1)).queryForList(contains("with requested(route_path) as (values"),any(Object[].class));
        verifyNoMoreInteractions(jdbc);
    }

    @Test
    void canonicalSupportOnlyAbsorbsExplicitRolloutSchemaStatesAndRethrowsSyntaxErrors() {
        assertRolloutSchemaStateIsAbsorbed("42P01");
        assertRolloutSchemaStateIsAbsorbed("42703");

        JdbcTemplate syntaxJdbc=mock(JdbcTemplate.class);
        EmissionProjectRegistryService syntaxService=new EmissionProjectRegistryService(
                syntaxJdbc,mock(ActorProcessGovernanceService.class),mock(ScopeAccessAuditService.class));
        BadSqlGrammarException syntaxFailure=nestedSqlFailure("42601");
        when(syntaxJdbc.queryForList(contains("with requested(route_path) as (values"),any(Object[].class)))
                .thenThrow(syntaxFailure);
        Map<String,Object> syntaxTask=task("/work/syntax","PROCESS_S","STEP_S");

        BadSqlGrammarException thrown=assertThrows(BadSqlGrammarException.class,
                ()->syntaxService.enrichCanonicalDesignSupport(new ArrayList<>(List.of(syntaxTask))));

        assertEquals(syntaxFailure,thrown);
        assertFalse(syntaxTask.containsKey("canonicalSupportStatus"));
        verify(syntaxJdbc,times(1)).queryForList(contains("with requested(route_path) as (values"),any(Object[].class));
        verifyNoMoreInteractions(syntaxJdbc);
    }

    private static void assertRolloutSchemaStateIsAbsorbed(String sqlState) {
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        EmissionProjectRegistryService service=new EmissionProjectRegistryService(
                jdbc,mock(ActorProcessGovernanceService.class),mock(ScopeAccessAuditService.class));
        when(jdbc.queryForList(contains("with requested(route_path) as (values"),any(Object[].class)))
                .thenThrow(nestedSqlFailure(sqlState));
        Map<String,Object> task=task("/work/schema-"+sqlState,"PROCESS_R","STEP_R");

        Map<String,Object> summary=service.enrichCanonicalDesignSupport(new ArrayList<>(List.of(task)));

        assertEquals("ABSENT",task.get("canonicalSupportStatus"));
        assertEquals("PUBLISHED_SUPPORT_SCHEMA_NOT_READY",task.get("canonicalSupportReason"));
        assertEquals("ROLLOUT_SCHEMA_NOT_READY",summary.get("lookupStatus"));
        assertEquals(1,summary.get("queryCount"));
        verify(jdbc,times(1)).queryForList(contains("with requested(route_path) as (values"),any(Object[].class));
        verifyNoMoreInteractions(jdbc);
    }

    private static BadSqlGrammarException nestedSqlFailure(String mostSpecificState) {
        SQLException specific=new SQLException("specific database failure",mostSpecificState);
        SQLException wrapper=new SQLException("driver wrapper","HY000",specific);
        return new BadSqlGrammarException("canonical support batch","select canonical support",wrapper);
    }

    private static Map<String,Object> task(String route,String process,String step) {
        Map<String,Object> task=new LinkedHashMap<>();
        task.put("targetUrl",route);task.put("processCode",process);task.put("processStepCode",step);
        task.put("name","Stale task");task.put("workPurpose","Stale purpose");
        return task;
    }

    private static Map<String,Object> publishedSupportRow(String route,String process,String step,
                                                          Map<String,Object> support,String designHash,String catalogHash) throws Exception {
        Map<String,Object> row=new LinkedHashMap<>();
        row.put("routePath",route);row.put("screenRoute",route);row.put("processCode",process);
        row.put("stepCode",step);row.put("audience","USER");
        row.put("supportJson",new ObjectMapper().writeValueAsString(support));
        row.put("operationsDesignHash",designHash);row.put("operationsCatalogHash",catalogHash);
        return row;
    }
    private static Map<String,Object> publishedSupportRow(String route,String process,String step,
                                                          Map<String,Object> support,String designHash,String catalogHash,
                                                          String audience) throws Exception {
        Map<String,Object> row=publishedSupportRow(route,process,step,support,designHash,catalogHash);
        row.put("audience",audience);
        return row;
    }

    private static Map<String,Object> canonicalSupport(String designHash,String catalogHash,String currentRoute) {
        Map<String,Object> help=Map.of("items",List.of(Map.of("id","help-1","title","Help")));
        Map<String,Object> workGuide=new LinkedHashMap<>();
        workGuide.put("requirement","Canonical purpose");workGuide.put("completionRule","Canonical completion");
        workGuide.put("inputContract",Map.of("projectId","required"));workGuide.put("outputContract",Map.of("saved",true));
        workGuide.put("fromState","READY");workGuide.put("commandCode","SAVE");
        workGuide.put("steps",List.of(Map.of("order",1,"code","STEP_A","name","Canonical step")));
        workGuide.put("nextAction",Map.of("routePath",currentRoute,"commandCode","SAVE","label","SAVE"));
        Map<String,Object> qa=Map.of("requiredScenarioTypes",List.of("HAPPY_PATH","AUTHORITY","ISOLATION","EXCEPTION","RECOVERY"),"checks",List.of(Map.of("code","API","passed",true)));
        List<Map<String,Object>> assets=List.of(Map.of("assetType","SECTION","assetCode","CARD:1"));
        Map<String,Object> designCard=Map.of("assetBindings",assets,"specification",Map.of(),"traceability",Map.of());
        Map<String,Object> lanes=new LinkedHashMap<>();
        lanes.put("HELP",help);lanes.put("WORK_GUIDE",workGuide);lanes.put("QA",qa);lanes.put("DESIGN_CARD",designCard);
        lanes.put("FRONTEND",Map.of("routePath",currentRoute));lanes.put("API",List.of(Map.of("method","GET")));lanes.put("DATABASE",List.of(Map.of("table","example")));
        Map<String,Object> support=new LinkedHashMap<>();
        support.put("schemaVersion","carbonet.executable-screen-support/v1");support.put("designHash",designHash);support.put("catalogHash",catalogHash);
        support.put("help",help);support.put("workGuide",workGuide);support.put("qa",qa);support.put("designCard",designCard);support.put("assetBindings",assets);support.put("lanes",lanes);
        return support;
    }
}
