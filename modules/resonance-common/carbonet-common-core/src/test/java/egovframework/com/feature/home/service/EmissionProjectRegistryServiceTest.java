package egovframework.com.feature.home.service;

import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
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
}
