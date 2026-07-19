package egovframework.com.platform.governance.service;

import egovframework.com.platform.codex.service.CodexProvisioningService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertEquals;
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
            jdbc, mock(ScreenDevelopmentNoteService.class), mock(CodexProvisioningService.class));

    @Test
    void startRequiresCurrentAccountsActorAssignment() {
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(Map.of(
                "step_code", "STEP_1", "actor_code", "COMPANY_MANAGER", "from_state", "READY")));
        when(jdbc.queryForObject(argThat(sql -> sql.contains("lower(account_id)=lower(?)")),
                org.mockito.ArgumentMatchers.eq(Integer.class), any(Object[].class))).thenReturn(0);

        assertThrows(IllegalArgumentException.class, () -> service.startProcessExecution(Map.of(
                "tenantId", "TENANT_A", "projectId", "PROJECT_A", "processCode", "PROCESS_A",
                "actorCode", "COMPANY_MANAGER"), "user-a"));

        verify(jdbc).queryForObject(argThat(sql -> sql.contains("lower(account_id)=lower(?)")),
                org.mockito.ArgumentMatchers.eq(Integer.class), any(Object[].class));
    }

    @Test
    void idempotencyEvidenceIsNotReadBeforeExecutionContextValidation() {
        UUID executionId = UUID.randomUUID();
        when(jdbc.queryForList(argThat(sql -> sql.contains("from framework_process_execution where execution_id=? for update")),
                any(Object[].class))).thenReturn(List.of(Map.of(
                "execution_status", "RUNNING", "tenant_id", "TENANT_B", "project_id", "PROJECT_B",
                "process_code", "PROCESS_A", "current_step_code", "STEP_1")));

        assertThrows(IllegalArgumentException.class, () -> service.executeProcessCommand(executionId, Map.of(
                "tenantId", "TENANT_A", "projectId", "PROJECT_A", "processCode", "PROCESS_A",
                "stepCode", "STEP_1", "actorCode", "COMPANY_MANAGER", "commandCode", "RUN",
                "idempotencyKey", "same-key"), "user-a"));

        verify(jdbc, never()).queryForList(argThat(sql -> sql.contains("framework_process_execution_event")
                && sql.contains("idempotency_key")), any(Object[].class));
    }

    @Test
    void designSaveWithoutProcessBindingReturnsAnExplicitGenerationGate() {
        ScreenDevelopmentNoteService notes = mock(ScreenDevelopmentNoteService.class);
        ActorProcessGovernanceService isolated = new ActorProcessGovernanceService(
                jdbc, notes, mock(CodexProvisioningService.class));
        when(notes.save(any(), anyString())).thenReturn(Map.of("version", 3));
        when(jdbc.queryForList(argThat(sql -> sql.contains("framework_professional_screen_contract")),
                org.mockito.ArgumentMatchers.eq(String.class), any(Object[].class))).thenReturn(List.of());
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
}
