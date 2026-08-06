package egovframework.com.platform.governance.service;

import egovframework.com.platform.codex.service.CodexProvisioningService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ActorProcessGovernanceServiceSecurityTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final ActorProcessGovernanceService service = new ActorProcessGovernanceService(
            jdbc, mock(ScreenDevelopmentNoteService.class), mock(CodexProvisioningService.class), mock(ScreenContractRuntimeService.class));

    @Test
    void persistedDesignCompleteStatusCanBeSavedAgain() {
        assertTrue(ActorProcessGovernanceService.isSupportedProfessionalContractStatus("DESIGN_COMPLETE"));
        assertFalse(ActorProcessGovernanceService.isSupportedProfessionalContractStatus("IMPLEMENTED"));
    }

    @Test
    void screenContractFieldSelectionPreservesEverySupportedAudience() {
        assertEquals("USER", ActorProcessGovernanceService.preferredScreenContractAudience("USER"));
        assertEquals("ADMIN", ActorProcessGovernanceService.preferredScreenContractAudience("admin"));
        assertEquals("PUBLIC", ActorProcessGovernanceService.preferredScreenContractAudience(" public "));
        assertEquals("USER", ActorProcessGovernanceService.preferredScreenContractAudience("UNBOUND"));
    }

    @Test
    void systemReportKeepsFixtureSuiteSeparateFromContractAuditAndBusinessE2e() {
        when(jdbc.queryForList(argThat(sql -> sql.contains("fixture_suite_cases")
                        && sql.contains("fixtureSuiteCoverageState")
                        && sql.contains("fixtureSuiteExecutionState")
                        && sql.contains("businessTestResult")),
                any(Object[].class))).thenReturn(List.of());

        Map<String, Object> report = service.systemProcessTestReport("", "", "");
        @SuppressWarnings("unchecked") Map<String, Object> summary = (Map<String, Object>) report.get("summary");

        ArgumentCaptor<String> sqlCaptor=ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForList(sqlCaptor.capture(),any(Object[].class));
        assertFalse(sqlCaptor.getValue().contains("p.domain_code,p.process_code,p.process_name"),
                "scoped_steps must expose process_code exactly once; s.* already contains it");

        assertEquals("CONTRACT_ONLY", report.get("auditMode"));
        assertEquals(false, report.get("businessFunctionsExecuted"));
        assertEquals(5, summary.get("fixtureSuiteRequiredTypeCount"));
        assertEquals(0, summary.get("fixtureSuiteBindingCount"));
        assertEquals("INVENTORY_AND_SIMULATION_EVIDENCE_ONLY", summary.get("fixtureSuiteMode"));
        assertEquals("EVIDENCE_LEDGER_UNAVAILABLE", summary.get("businessEvidenceStatus"));
    }

    @Test
    void controlPlaneAdministratorComesFromExistingAuthorityData() {
        when(jdbc.queryForObject(argThat(sql -> sql.contains("ROLE_SYSTEM_MASTER")),
                org.mockito.ArgumentMatchers.eq(Integer.class), any(Object[].class)))
                .thenReturn(1);

        assertTrue(service.isControlPlaneAdministrator("platform-admin"));
    }

    @Test
    void controlPlaneCommandRequiresTheAuthenticatedAccount() {
        UUID executionId=UUID.randomUUID();
        when(jdbc.queryForList(argThat(sql -> sql.contains("from framework_process_execution e")),
                any(Object[].class))).thenReturn(List.of(Map.of(
                        "tenantId","TENANT_A","projectId","PROJECT_A",
                        "processCode","EMISSION_PROJECT","stepCode","EMISSION_PROJECT_COLLECT",
                        "executionStatus","RUNNING","actorCode","SITE_DATA_OWNER",
                        "commandCode","SUBMIT_ACTIVITY_DATA")));

        SecurityException failure=assertThrows(SecurityException.class,
                () -> service.validateProcessCommandFromControlPlane(
                        executionId,Map.of(),"BACKSTAGE_CONTROL_PLANE"));

        assertTrue(failure.getMessage().contains("Authenticated control-plane account"));
        verify(jdbc,never()).queryForList(argThat(sql -> sql.contains(
                "from framework_account_actor_assignment")),any(Object[].class));
    }

    @Test
    void nonDomainProcessKeepsUsingTheMetadataDraftContract() {
        assertFalse(service.verifyDomainCompletion(Map.of(
                "processCode","CONTENT_PUBLISH",
                "stepCode","CONTENT_DRAFT")));
    }

    @Test
    void completedEmissionDomainTaskDoesNotRequireADuplicateGenericDraft() {
        when(jdbc.queryForList(argThat(sql -> sql.contains("from emission_project_task")),
                any(Object[].class))).thenReturn(List.of(Map.of(
                        "taskStatus","DONE","blockedReason","","targetUrl","/emission/activity-data")));

        assertTrue(service.verifyDomainCompletion(Map.of(
                "processCode","EMISSION_PROJECT",
                "stepCode","EMISSION_PROJECT_COLLECT",
                "projectId","PROJECT_A",
                "tenantId","TENANT_A")));
    }

    @Test
    void incompleteActivityCollectionReportsTheRealDomainReadiness() {
        when(jdbc.queryForList(argThat(sql -> sql.contains("from emission_project_task")),
                any(Object[].class))).thenReturn(List.of(Map.of(
                        "taskStatus","IN_PROGRESS","blockedReason","","targetUrl","/emission/activity-data")));
        when(jdbc.queryForMap(argThat(sql -> sql.contains("emission_activity_quality_run")),
                any(Object[].class))).thenReturn(Map.of(
                        "activityCount",4L,"qualityReady",true,
                        "submittedCount",1L,"openRequestCount",1L));

        IllegalStateException failure=assertThrows(IllegalStateException.class,
                () -> service.verifyDomainCompletion(Map.of(
                        "processCode","EMISSION_PROJECT",
                        "stepCode","EMISSION_PROJECT_COLLECT",
                        "projectId","PROJECT_A",
                        "tenantId","TENANT_A")));

        assertTrue(failure.getMessage().contains("saved=4"));
        assertTrue(failure.getMessage().contains("qualityReady=true"));
        assertTrue(failure.getMessage().contains("openRequests=1"));
        assertTrue(failure.getMessage().contains("/emission/activity-data"));
    }

    @Test
    void orphanedEmissionExecutionFailsClosedInsteadOfUsingAGenericDraft() {
        when(jdbc.queryForList(argThat(sql -> sql.contains("from emission_project_task")),
                any(Object[].class))).thenReturn(List.of());

        IllegalStateException failure=assertThrows(IllegalStateException.class,
                () -> service.verifyDomainCompletion(Map.of(
                        "processCode","EMISSION_PROJECT",
                        "stepCode","EMISSION_PROJECT_COLLECT",
                        "projectId","DELETED_PROJECT",
                        "tenantId","TENANT_A")));

        assertTrue(failure.getMessage().contains("missing or orphaned"));
        assertTrue(failure.getMessage().contains("DELETED_PROJECT"));
    }

    @Test
    void startRequiresCurrentAccountsActorAssignment() {
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(Map.of(
                "step_code", "STEP_1", "actor_code", "COMPANY_MANAGER", "from_state", "READY")));
        when(jdbc.queryForObject(argThat(sql -> sql.contains("lower(account_id)=lower(?)")),
                org.mockito.ArgumentMatchers.eq(Integer.class), any(Object[].class))).thenReturn(0);

        assertThrows(SecurityException.class, () -> service.startProcessExecution(Map.of(
                "tenantId", "TENANT_A", "projectId", "PROJECT_A", "processCode", "PROCESS_A",
                "actorCode", "COMPANY_MANAGER"), "user-a"));

        verify(jdbc).queryForObject(argThat(sql ->
                        sql.contains("(project_id=? or project_id='*')")
                                && sql.contains("lower(account_id)=lower(?)")),
                org.mockito.ArgumentMatchers.eq(Integer.class), any(Object[].class));
    }

    @Test
    void idempotencyEvidenceIsNotReadBeforeExecutionContextValidation() {
        UUID executionId = UUID.randomUUID();
        when(jdbc.queryForList(argThat(sql -> sql != null && sql.contains("from framework_process_execution where execution_id=? for update")),
                any(Object[].class))).thenReturn(List.of(Map.of(
                "execution_status", "RUNNING", "tenant_id", "TENANT_B", "project_id", "PROJECT_B",
                "process_code", "PROCESS_A", "current_step_code", "STEP_1")));

        assertThrows(SecurityException.class, () -> service.executeProcessCommand(executionId, Map.of(
                "tenantId", "TENANT_A", "projectId", "PROJECT_A", "processCode", "PROCESS_A",
                "stepCode", "STEP_1", "actorCode", "COMPANY_MANAGER", "commandCode", "RUN",
                "idempotencyKey", "same-key"), "user-a"));

        verify(jdbc, never()).queryForList(argThat(sql -> sql.contains("framework_process_execution_event")
                && sql.contains("idempotency_key")), any(Object[].class));
    }

    @Test
    void idempotentReplayKeepsTheOriginalCommandResponseContract() {
        UUID executionId = UUID.randomUUID();
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            if (sql.contains("from framework_process_execution where execution_id=? for update")) {
                return List.of(Map.of(
                        "execution_status", "RUNNING", "tenant_id", "TENANT_A", "project_id", "PROJECT_A",
                        "process_code", "PROCESS_A", "current_step_code", "STEP_2"));
            }
            if (sql.contains("framework_process_execution_event") && sql.contains("idempotency_key")) {
                return List.of(Map.of("eventId", 73L, "toState", "SUBMITTED"));
            }
            return List.of();
        });

        Map<String, Object> replay = service.executeProcessCommand(executionId, Map.of(
                "tenantId", "TENANT_A", "projectId", "PROJECT_A", "processCode", "PROCESS_A",
                "stepCode", "STEP_1", "actorCode", "COMPANY_MANAGER", "commandCode", "RUN",
                "idempotencyKey", "same-key"), "user-a");

        assertTrue((Boolean) replay.get("idempotent"));
        assertEquals(73L, replay.get("eventId"));
        assertEquals("SUBMITTED", replay.get("toState"));
        assertEquals(73L, ((Map<?, ?>) replay.get("event")).get("eventId"));
    }

    @Test
    void designSaveWithoutProcessBindingReturnsAnExplicitGenerationGate() {
        ScreenDevelopmentNoteService notes = mock(ScreenDevelopmentNoteService.class);
        ActorProcessGovernanceService isolated = new ActorProcessGovernanceService(
                jdbc, notes, mock(CodexProvisioningService.class), mock(ScreenContractRuntimeService.class));
        when(notes.save(any(), anyString())).thenReturn(Map.of("version", 3));
        when(jdbc.queryForList(argThat(sql -> sql.contains("framework_professional_screen_contract")),
                org.mockito.ArgumentMatchers.eq(String.class), any(Object[].class))).thenReturn(List.of());
        UUID recoveryRun=UUID.randomUUID();
        when(jdbc.queryForObject(argThat(sql -> sql.contains("framework_design_self_healing_run")),
                org.mockito.ArgumentMatchers.eq(UUID.class), any(Object[].class))).thenReturn(recoveryRun);
        when(jdbc.queryForList(argThat(sql -> sql.contains("from framework_screen_blueprint where")),
                any(Object[].class))).thenReturn(List.of());

        Map<String, Object> result = isolated.saveDesignAndGenerate(Map.of(
                "routePath", "/emission/unbound",
                "designNote", "layout",
                "functionNote", "function",
                "acceptanceNote", "acceptance"), "designer");

        assertEquals("PROCESS_BINDING_REQUIRED", result.get("generationStatus"));
        assertEquals(false, result.get("buildRequired"));
        assertEquals(List.of(), result.get("codeOutputs"));
        assertEquals(recoveryRun, result.get("selfHealingRunId"));
        assertEquals("TRANSACTION_ROLLBACK", result.get("rollbackPolicy"));
        verify(jdbc).update(argThat(sql -> sql.contains("update framework_design_self_healing_run")), any(Object[].class));
    }

    @Test
    void dashboardDevelopmentRequestApprovesOnlyTheSelectedJob() {
        when(jdbc.queryForList(argThat(sql -> sql.contains("from framework_development_job where job_id=? for update")), any(Object[].class)))
                .thenReturn(List.of(Map.of("job_id", 41L, "process_code", "EMISSION_PROJECT", "step_code", "COLLECT", "job_status", "FAILED", "approval_status", "PENDING")));
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);

        Map<String, Object> result = service.requestDevelopmentJob(41L, "webmaster");

        assertEquals("RETRY", result.get("status"));
        assertEquals(true, result.get("changed"));
        verify(jdbc).update(argThat(sql -> sql.contains("approval_status='APPROVED'") && sql.contains("where job_id=?")), any(Object[].class));
        verify(jdbc).update(argThat(sql -> sql.contains("framework_development_job_event")), any(Object[].class));
    }

    @Test
    void dashboardDevelopmentRequestDoesNotReopenVerifiedWork() {
        when(jdbc.queryForList(argThat(sql -> sql.contains("from framework_development_job where job_id=? for update")), any(Object[].class)))
                .thenReturn(List.of(Map.of("job_id", 42L, "process_code", "EMISSION_PROJECT", "step_code", "REPORT", "job_status", "VERIFIED", "approval_status", "APPROVED")));

        Map<String, Object> result = service.requestDevelopmentJob(42L, "webmaster");

        assertEquals(false, result.get("changed"));
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void workDraftRejectsAnActorThatDoesNotOwnTheStep() {
        when(jdbc.queryForList(argThat(sql -> sql != null && sql.contains("select actor_code from framework_process_step")), any(Object[].class)))
                .thenReturn(List.of(Map.of("actor_code", "SITE_DATA_OWNER")));

        assertThrows(SecurityException.class, () -> service.saveWorkDraft(Map.of(
                "tenantId", "TENANT_A", "projectId", "PROJECT_A", "processCode", "EMISSION_PROJECT",
                "stepCode", "EMISSION_PROJECT_COLLECT", "actorCode", "UNAUTHORIZED_ACTOR",
                "expectedVersion", 0, "payloadJson", "{}", "evidenceJson", "{}"), "user-a"));

        verify(jdbc, never()).update(argThat(sql -> sql != null && sql.contains("framework_process_work_draft")), any(Object[].class));
    }

    @Test
    void workDraftRejectsAStaleOptimisticVersion() {
        when(jdbc.queryForList(argThat(sql -> sql != null && sql.contains("select actor_code from framework_process_step")), any(Object[].class)))
                .thenReturn(List.of(Map.of("actor_code", "SITE_DATA_OWNER")));
        when(jdbc.queryForObject(argThat(sql -> sql != null && sql.contains("lower(account_id)=lower(?)")),
                org.mockito.ArgumentMatchers.eq(Integer.class), any(Object[].class))).thenReturn(1);
        when(jdbc.queryForList(argThat(sql -> sql != null && sql.contains("from framework_process_work_draft") && sql.contains("for update")), any(Object[].class)))
                .thenReturn(List.of(Map.of("draft_id", UUID.randomUUID(), "draft_version", 2, "draft_status", "DRAFT")));

        assertThrows(IllegalStateException.class, () -> service.saveWorkDraft(Map.of(
                "tenantId", "TENANT_A", "projectId", "PROJECT_A", "processCode", "EMISSION_PROJECT",
                "stepCode", "EMISSION_PROJECT_COLLECT", "actorCode", "SITE_DATA_OWNER",
                "expectedVersion", 1, "payloadJson", "{}", "evidenceJson", "{}"), "user-a"));

        verify(jdbc, never()).update(argThat(sql -> sql != null && sql.startsWith("update framework_process_work_draft")), any(Object[].class));
    }

    @Test
    void projectDeliveryRequiresEveryBlueprintActorBindingBeforeMutation() {
        when(jdbc.queryForObject(argThat(sql -> sql.contains("select specification::text")),
                org.mockito.ArgumentMatchers.eq(String.class), any(Object[].class)))
                .thenReturn("{\"actors\":[{\"actorCode\":\"COMPANY_MANAGER\"},{\"actorCode\":\"SITE_DATA_OWNER\"}],\"processCodes\":[\"ACTIVITY_DATA\"]}");

        IllegalArgumentException failure=assertThrows(IllegalArgumentException.class,
                () -> service.applyProjectDeliveryBlueprint(Map.of(
                        "blueprintCode","EMISSION_STANDARD","tenantId","TENANT_A","projectId","PROJECT_A",
                        "actorBindings",List.of(Map.of("actorCode","COMPANY_MANAGER","accountId","manager-a"))),
                        "webmaster"));

        assertTrue(failure.getMessage().contains("every blueprint actor"));
        verify(jdbc,never()).queryForObject(argThat(sql -> sql.contains("framework_apply_project_delivery_blueprint")),
                org.mockito.ArgumentMatchers.eq(String.class),any(Object[].class));
    }
}
