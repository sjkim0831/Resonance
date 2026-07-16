package egovframework.com.platform.governance.service;

import egovframework.com.platform.codex.service.CodexProvisioningService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
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
}
